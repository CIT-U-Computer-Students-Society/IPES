"""Combinatorial rule tests, repeatability, tenant isolation and query budgets."""

from itertools import product

from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.urls import reverse
from rest_framework.test import APITestCase

from apps.evaluations.models import AssignmentRule, EvaluationAssignment, EvaluationForm, Question, Response
from apps.evaluations.services import generate_rule_assignments
from apps.evaluations.views.analytics import compute_form_analytics
from apps.organizations.models import Membership, OrganizationRole, OrganizationUnit, PositionType, UnitType
from apps.users.models import User
from .fixtures import EvaluationFixtures


class GenerationAnalyticsTests(EvaluationFixtures, APITestCase):
    def setUp(self):
        self.client.force_authenticate(self.admin)
        self.client.credentials(HTTP_X_ORGANIZATION_ID=str(self.org.pk))

    def make_members(self):
        kind = UnitType.objects.create(organization_id=self.org, name='Committee')
        self.units = [OrganizationUnit.objects.create(organization_id=self.org, type_id=kind, name=f'Unit {i}') for i in range(2)]
        self.positions = [PositionType.objects.create(organization_id=self.org, name=f'Position {i}', rank=i + 1) for i in range(2)]
        Membership.objects.create(user_id=self.evaluator, unit_id=self.units[0], position_id=self.positions[0], date_start=self.form.start_date)
        Membership.objects.create(user_id=self.evaluatee, unit_id=self.units[1], position_id=self.positions[1], date_start=self.form.start_date)
        # A second membership must not multiply assignments for the same person.
        Membership.objects.create(user_id=self.evaluator, unit_id=self.units[1], position_id=self.positions[0], date_start=self.form.start_date)

    def test_rule_unit_position_wildcard_and_self_combinations(self):
        self.make_members()
        memberships = list(Membership.objects.filter(unit_id__organization_id=self.org))
        for ev_unit, ev_pos, ee_unit, ee_pos, exclude in product(
            (None, self.units[0]), (None, self.positions[0]),
            (None, self.units[1]), (None, self.positions[1]), (True, False),
        ):
            with self.subTest(filters=(ev_unit, ev_pos, ee_unit, ee_pos, exclude)):
                EvaluationAssignment.objects.filter(form_id=self.form).delete()
                rule = AssignmentRule.objects.create(
                    form_id=self.form, evaluator_unit=ev_unit, evaluator_position=ev_pos,
                    evaluatee_unit=ee_unit, evaluatee_position=ee_pos, exclude_self=exclude,
                )
                def matching(unit, position):
                    return {m.user_id_id for m in memberships if
                            (unit is None or m.unit_id_id == unit.pk) and
                            (position is None or m.position_id_id == position.pk)}
                expected = {(ev, ee) for ev in matching(ev_unit, ev_pos) for ee in matching(ee_unit, ee_pos) if not exclude or ev != ee}
                self.assertEqual(generate_rule_assignments(rule, self.form), len(expected))
                actual = set(EvaluationAssignment.objects.filter(form_id=self.form).values_list('evaluator_id_id', 'evaluatee_id_id'))
                self.assertEqual(actual, expected)
                self.assertEqual(generate_rule_assignments(rule, self.form), 0)
                rule.delete()

    def test_empty_single_member_and_multiple_member_boundaries(self):
        EvaluationAssignment.objects.filter(form_id=self.form).delete()
        rule = AssignmentRule.objects.create(form_id=self.form)
        self.assertEqual(generate_rule_assignments(rule, self.form), 0)
        kind = UnitType.objects.create(organization_id=self.org, name='Committee')
        unit = OrganizationUnit.objects.create(organization_id=self.org, type_id=kind, name='Unit')
        position = PositionType.objects.create(organization_id=self.org, name='Head', rank=1)
        Membership.objects.create(user_id=self.evaluator, unit_id=unit, position_id=position, date_start=self.form.start_date)
        self.assertFalse(EvaluationAssignment.objects.filter(form_id=self.form).exists())
        Membership.objects.create(user_id=self.evaluatee, unit_id=unit, position_id=position, date_start=self.form.start_date)
        self.assertEqual(EvaluationAssignment.objects.filter(form_id=self.form).count(), 2)
        rule.exclude_self = False
        rule.save()
        self.assertEqual(generate_rule_assignments(rule, self.form), 2)
        self.assertEqual(EvaluationAssignment.objects.filter(form_id=self.form).count(), 4)

    def test_overlapping_rules_preserve_completed_assignments(self):
        self.make_members()
        rule = AssignmentRule.objects.create(form_id=self.form)
        self.assignment.status = 'Completed'
        self.assignment.total_score = 4
        self.assignment.save()
        self.assertEqual(generate_rule_assignments(rule, self.form), 1)
        overlap = AssignmentRule.objects.create(form_id=self.form, evaluator_unit=self.units[1])
        self.assertEqual(generate_rule_assignments(overlap, self.form), 0)
        self.assignment.refresh_from_db()
        self.assertEqual(self.assignment.status, 'Completed')
        self.assertEqual(self.assignment.total_score, 4)

    def test_inactive_members_units_positions_and_system_units_are_excluded(self):
        self.make_members()
        rule = AssignmentRule.objects.create(form_id=self.form)
        cases = [
            (Membership.objects.filter(user_id=self.evaluatee), {'is_active': False}),
            (User.objects.filter(pk=self.evaluatee.pk), {'is_active': False}),
            (OrganizationUnit.objects.filter(pk=self.units[1].pk), {'is_active': False}),
            (PositionType.objects.filter(pk=self.positions[1].pk), {'is_active': False}),
            (UnitType.objects.filter(pk=self.units[1].type_id_id), {'name': 'System'}),
        ]
        for queryset, update in cases:
            with self.subTest(model=queryset.model.__name__):
                old = list(queryset.values('pk', *update))
                queryset.update(**update)
                EvaluationAssignment.objects.filter(form_id=self.form).delete()
                self.assertEqual(generate_rule_assignments(rule, self.form), 0)
                for row in old:
                    pk = row.pop('pk')
                    queryset.model.objects.filter(pk=pk).update(**row)

    def test_membership_reactivation_generates_assignments_but_deleted_forms_do_not(self):
        self.make_members()
        rule = AssignmentRule.objects.create(form_id=self.form)
        membership = Membership.objects.get(user_id=self.evaluatee)
        membership.is_active = False
        membership.save()
        EvaluationAssignment.objects.filter(form_id=self.form).delete()
        membership.is_active = True
        membership.save()
        self.assertEqual(EvaluationAssignment.objects.filter(form_id=self.form).count(), 2)
        EvaluationAssignment.objects.filter(form_id=self.form).delete()
        for flags in ({'is_deleted': True}, {'results_released': True}, {'is_active': False}):
            with self.subTest(flags=flags):
                EvaluationForm.objects.filter(pk=self.form.pk).update(is_deleted=False, results_released=False, is_active=True)
                EvaluationForm.objects.filter(pk=self.form.pk).update(**flags)
                membership.save()
                self.assertEqual(generate_rule_assignments(rule, self.form), 0)
                self.assertFalse(EvaluationAssignment.objects.filter(form_id=self.form).exists())

    def test_generation_query_growth_is_per_batch_not_per_pair(self):
        self.make_members()
        for i in range(22):
            user = User.objects.create_user(username=f'm{i}', email=f'm{i}@example.test')
            OrganizationRole.objects.create(user=user, organization=self.org, role='Member')
            Membership.objects.create(user_id=user, unit_id=self.units[0], position_id=self.positions[0], date_start=self.form.start_date)
        EvaluationAssignment.objects.filter(form_id=self.form).delete()
        rule = AssignmentRule.objects.create(form_id=self.form)
        with CaptureQueriesContext(connection) as queries:
            self.assertEqual(generate_rule_assignments(rule, self.form), 24 * 23)
        # 552 pairs cross the 500-row application batch boundary. SQLite further
        # splits inserts to respect its parameter limit; still far below 552 queries.
        self.assertLessEqual(len(queries), 16)

    def test_dashboard_skips_raw_response_query_export_includes_it(self):
        self.assignment.status = 'Completed'
        self.assignment.total_score = 3
        self.assignment.save()
        Response.objects.create(assignment_id=self.assignment, question_id=self.question, score_value=3, text='Comment')
        with CaptureQueriesContext(connection) as dashboard_queries:
            summary = compute_form_analytics(self.form)
        with CaptureQueriesContext(connection) as export_queries:
            export = compute_form_analytics(self.form, include_raw=True)
        self.assertEqual(summary['raw_data'], [])
        self.assertEqual(len(export['raw_data']), 1)
        self.assertEqual(export['raw_data'][0]['score'], 3)
        self.assertEqual(len(export_queries), len(dashboard_queries) + 1)
        self.assertEqual(summary['overall_score'], export['overall_score'])
        self.assertEqual(summary['participation_rate'], 100)

    def test_analytics_empty_and_zero_score_boundaries(self):
        summary = compute_form_analytics(self.form)
        self.assertEqual(summary['participation_rate'], 0)
        EvaluationAssignment.objects.filter(pk=self.assignment.pk).update(status='Completed', total_score=0)
        summary = compute_form_analytics(self.form)
        self.assertEqual(summary['overall_score'], 0)
        self.assertEqual(summary['participation_rate'], 100)
        EvaluationAssignment.objects.filter(form_id=self.form).delete()
        self.assertEqual(compute_form_analytics(self.form)['total_evaluations'], 0)

    def test_tenant_isolation_for_evaluation_reads_and_exports(self):
        OrganizationRole.objects.create(user=self.admin, organization=self.other_org, role='Admin')
        cases = [
            ('forms-detail', self.other_form.pk), ('questions-detail', self.foreign_question.pk),
            ('forms-analytics', self.other_form.pk), ('forms-analytics-export', self.other_form.pk),
        ]
        for route, pk in cases:
            with self.subTest(route=route):
                self.assertEqual(self.client.get(reverse(route, args=[pk])).status_code, 404)
        self.client.force_authenticate(self.evaluator)
        for route in ('forms-analytics', 'forms-analytics-export'):
            self.assertEqual(self.client.get(reverse(route, args=[self.form.pk])).status_code, 403)

    def test_rule_generation_and_question_writes_require_admin(self):
        self.client.force_authenticate(self.evaluator)
        self.assertEqual(self.client.post(reverse('assignment-rules-generate'), {'form_id': self.form.pk}, format='json').status_code, 403)
        self.assertEqual(self.client.patch(reverse('questions-detail', args=[self.question.pk]), {'weight': 2}, format='json').status_code, 403)

    def test_form_list_does_not_add_queries_for_each_form_or_question(self):
        url = reverse('forms-list')
        with CaptureQueriesContext(connection) as baseline:
            self.assertEqual(self.client.get(url).status_code, 200)
        for i in range(5):
            form = EvaluationForm.objects.create(organization_id=self.org, created_by=self.admin, title=str(i), start_date=self.form.start_date, end_date=self.form.end_date)
            Question.objects.create(form_id=form, text='Question', input_type='text', order=1)
        with CaptureQueriesContext(connection) as expanded:
            response = self.client.get(url)
        self.assertEqual(len(response.data['results']), 6)
        self.assertEqual(len(expanded), len(baseline))
