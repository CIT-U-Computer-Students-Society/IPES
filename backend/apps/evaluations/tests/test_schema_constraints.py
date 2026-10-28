"""Database checks bypass serializers to verify that raw writes are constrained."""

from datetime import timedelta
from importlib import import_module

from django.apps import apps
from django.core.exceptions import ValidationError
from django.db import IntegrityError, connection, transaction
from django.test import TestCase

from apps.evaluations.models import AssignmentRule, EvaluationAssignment, EvaluationForm, Question, Response
from apps.evaluations.serializers import QuestionSerializer, EvaluationFormSerializer
from apps.organizations.models import Membership, Organization, OrganizationRole, OrganizationUnit, PositionType, UnitType, JoinRequest
from apps.organizations.serializers import MembershipSerializer, OrganizationUnitSerializer
from apps.portfolio.models import Accomplishment
from .fixtures import EvaluationFixtures


class SchemaConstraintTests(EvaluationFixtures, TestCase):
    def assert_database_rejects(self, queryset, **values):
        with self.assertRaises(IntegrityError), transaction.atomic():
            queryset.update(**values)

    def test_form_date_boundary_values_and_partial_update(self):
        for offset in (-1, 0, 1):
            end = self.form.start_date + timedelta(days=offset)
            with self.subTest(offset=offset):
                serializer = EvaluationFormSerializer(self.form, data={'end_date': end}, partial=True)
                self.assertEqual(serializer.is_valid(), offset >= 0, serializer.errors)
                if offset < 0:
                    self.assert_database_rejects(EvaluationForm.objects.filter(pk=self.form.pk), end_date=end)
                else:
                    EvaluationForm.objects.filter(pk=self.form.pk).update(end_date=end)

    def test_organization_nullable_date_range_boundary_values(self):
        for offset in (None, -1, 0, 1):
            end = None if offset is None else self.org.period_year_start + timedelta(days=offset)
            with self.subTest(offset=offset):
                if offset == -1:
                    self.assert_database_rejects(Organization.objects.filter(pk=self.org.pk), period_year_end=end)
                else:
                    Organization.objects.filter(pk=self.org.pk).update(period_year_end=end)

    def test_rank_boundary_values(self):
        position = PositionType.objects.create(organization_id=self.org, name='Head', rank=1)
        for value in (0, 1, 2, 99, 100, 101):
            with self.subTest(rank=value):
                if 1 <= value <= 100:
                    PositionType.objects.filter(pk=position.pk).update(rank=value)
                else:
                    self.assert_database_rejects(PositionType.objects.filter(pk=position.pk), rank=value)

    def test_question_order_weight_and_boundaries(self):
        for value in (-1, 0, 1, 2):
            with self.subTest(order=value):
                if value < 1:
                    self.assert_database_rejects(Question.objects.filter(pk=self.question.pk), order=value)
                else:
                    Question.objects.filter(pk=self.question.pk).update(order=value)
        for value in (-0.001, 0, 0.001, 1e308, None, float('inf')):
            with self.subTest(weight=value):
                if value is not None and (value < 0 or value == float('inf')):
                    self.assert_database_rejects(Question.objects.filter(pk=self.question.pk), weight=value)
                else:
                    Question.objects.filter(pk=self.question.pk).update(weight=value)
        for low, high, valid in ((None, None, True), (1, None, True), (None, 5, True), (1, 0, False), (1, 1, True), (1, 2, True)):
            with self.subTest(bounds=(low, high)):
                if valid:
                    Question.objects.filter(pk=self.question.pk).update(min_value=low, max_value=high)
                else:
                    self.assert_database_rejects(Question.objects.filter(pk=self.question.pk), min_value=low, max_value=high)

    def test_question_partial_updates_validate_effective_bounds(self):
        for data, valid in (({'min_value': 6}, False), ({'max_value': 0}, False), ({'weight': -1}, False), ({'weight': 'NaN'}, False), ({'max_value': 1}, True)):
            with self.subTest(data=data):
                serializer = QuestionSerializer(self.question, data=data, partial=True)
                self.assertEqual(serializer.is_valid(), valid, serializer.errors)

    def test_state_equivalence_partitions_are_enforced_by_database(self):
        request = JoinRequest.objects.create(user=self.evaluator, organization=self.org)
        accomplishment = Accomplishment.objects.create(
            user_id=self.evaluator, organization_id=self.org, title='Work', description='', type='Project', date_completed='2026-01-01T00:00:00Z',
        )
        cases = (
            (EvaluationAssignment.objects.filter(pk=self.assignment.pk), 'status', ['Pending', 'In Progress', 'Completed']),
            (JoinRequest.objects.filter(pk=request.pk), 'status', ['Pending', 'Approved', 'Rejected']),
            (Accomplishment.objects.filter(pk=accomplishment.pk), 'status', ['Pending', 'Verified', 'Rejected']),
            (OrganizationRole.objects.filter(user=self.admin), 'role', ['Admin', 'Member']),
            (Question.objects.filter(pk=self.question.pk), 'input_type', Question.INPUT_TYPES),
        )
        for queryset, field, allowed in cases:
            for value in [*allowed, '', 'invalid', allowed[0].lower()]:
                with self.subTest(model=queryset.model.__name__, value=value):
                    if value in allowed:
                        queryset.update(**{field: value})
                    else:
                        self.assert_database_rejects(queryset, **{field: value})

    def test_unit_and_membership_organization_combinations(self):
        kind = UnitType.objects.create(organization_id=self.org, name='Type')
        foreign_kind = UnitType.objects.create(organization_id=self.other_org, name='Other')
        unit = OrganizationUnit.objects.create(organization_id=self.org, type_id=kind, name='Unit')
        position = PositionType.objects.create(organization_id=self.org, name='Position', rank=1)
        foreign_position = PositionType.objects.create(organization_id=self.other_org, name='Other', rank=1)
        for related, valid in ((kind, True), (foreign_kind, False)):
            with self.subTest(unit_type=related.pk):
                serializer = OrganizationUnitSerializer(data={
                    'organization_id': self.org.pk, 'type_id': related.pk, 'name': 'New',
                })
                self.assertEqual(serializer.is_valid(), valid, serializer.errors)
                if not valid:
                    with self.assertRaises(ValidationError):
                        OrganizationUnit.objects.create(organization_id=self.org, type_id=related, name='Invalid')
        for related, valid in ((position, True), (foreign_position, False)):
            with self.subTest(position=related.pk):
                serializer = MembershipSerializer(data={'user_id': self.evaluator.pk, 'unit_id': unit.pk, 'position_id': related.pk})
                self.assertEqual(serializer.is_valid(), valid, serializer.errors)
                if not valid:
                    with self.assertRaises(ValidationError):
                        Membership.objects.create(user_id=self.evaluator, unit_id=unit, position_id=related, date_start=self.form.start_date)
        membership = Membership.objects.create(user_id=self.evaluator, unit_id=unit, position_id=position, date_start=self.form.start_date)
        serializer = MembershipSerializer(membership, data={'position_id': foreign_position.pk}, partial=True)
        self.assertFalse(serializer.is_valid())
        for offset in (-1, 0, 1):
            end = membership.date_start + timedelta(days=offset)
            if offset < 0:
                self.assert_database_rejects(Membership.objects.filter(pk=membership.pk), date_end=end)
            else:
                Membership.objects.filter(pk=membership.pk).update(date_end=end)

    def test_all_four_rule_filter_relationships(self):
        for name, model in (('evaluator_unit', OrganizationUnit), ('evaluatee_unit', OrganizationUnit), ('evaluator_position', PositionType), ('evaluatee_position', PositionType)):
            for org, valid in ((self.org, True), (self.other_org, False)):
                with self.subTest(field=name, organization=org.pk):
                    if model is OrganizationUnit:
                        kind = UnitType.objects.create(organization_id=org, name='Type')
                        related = model.objects.create(organization_id=org, type_id=kind, name='Unit')
                    else:
                        related = model.objects.create(organization_id=org, name='Position', rank=1)
                    rule = AssignmentRule(form_id=self.form, **{name: related})
                    if valid:
                        rule.save()
                    else:
                        with self.assertRaises(ValidationError):
                            rule.save()

    def test_model_rejects_cross_form_answers_and_invalid_scores(self):
        for question, score in ((self.foreign_question, 3), (self.question, 6), (self.question, float('nan'))):
            with self.subTest(question=question.pk, score=score):
                with self.assertRaises(ValidationError):
                    Response.objects.create(assignment_id=self.assignment, question_id=question, score_value=score)

    def test_migrated_indexes_have_expected_column_order(self):
        expected = {
            'evaluations_evaluationassignment': {
                'assignment_form_status_idx': ['form_id_id', 'status'],
                'assignment_received_idx': ['evaluatee_id_id', 'status', 'form_id_id'],
                'assignment_pending_idx': ['evaluator_id_id', 'status', 'id'],
            },
            'audit_auditlog': {'audit_org_datetime_idx': ['organization_id_id', 'datetime']},
            'portfolio_accomplishment': {'accomplishment_queue_idx': ['organization_id_id', 'status', 'date_completed', 'id']},
        }
        with connection.cursor() as cursor:
            for table, indexes in expected.items():
                constraints = connection.introspection.get_constraints(cursor, table)
                for name, columns in indexes.items():
                    with self.subTest(index=name):
                        self.assertEqual(constraints[name]['columns'], columns)
                        self.assertTrue(constraints[name]['index'])

    def test_migration_preflight_detects_legacy_cross_organization_relationships(self):
        validate_orgs = import_module('apps.organizations.migrations.0017_domain_constraints').validate_related_organizations
        validate_rules = import_module('apps.evaluations.migrations.0010_response_integrity_indexes').validate_answer_relationships
        editor = connection.schema_editor()
        kind = UnitType.objects.create(organization_id=self.org, name='Type')
        foreign_kind = UnitType.objects.create(organization_id=self.other_org, name='Other')
        unit = OrganizationUnit.objects.create(organization_id=self.org, type_id=kind, name='Unit')
        position = PositionType.objects.create(organization_id=self.org, name='Head', rank=1)
        foreign_position = PositionType.objects.create(organization_id=self.other_org, name='Other', rank=1)
        membership = Membership.objects.create(user_id=self.evaluator, unit_id=unit, position_id=position, date_start=self.form.start_date)
        # Simulate legacy data written before relationship validation existed.
        OrganizationUnit.objects.filter(pk=unit.pk).update(type_id=foreign_kind)
        with self.assertRaisesMessage(RuntimeError, 'Cross-organization unit types'):
            validate_orgs(apps, editor)
        OrganizationUnit.objects.filter(pk=unit.pk).update(type_id=kind)
        Membership.objects.filter(pk=membership.pk).update(position_id=foreign_position)
        with self.assertRaisesMessage(RuntimeError, 'Cross-organization memberships'):
            validate_orgs(apps, editor)
        Membership.objects.filter(pk=membership.pk).update(position_id=position)
        validate_orgs(apps, editor)
        foreign_unit = OrganizationUnit.objects.create(organization_id=self.other_org, type_id=foreign_kind, name='Other')
        rule = AssignmentRule.objects.create(form_id=self.form)
        for field, value in (('evaluator_unit', foreign_unit), ('evaluatee_unit', foreign_unit), ('evaluator_position', foreign_position), ('evaluatee_position', foreign_position)):
            with self.subTest(field=field):
                AssignmentRule.objects.filter(pk=rule.pk).update(**{field: value})
                with self.assertRaisesMessage(RuntimeError, 'Cross-organization assignment rules'):
                    validate_rules(apps, editor)
                AssignmentRule.objects.filter(pk=rule.pk).update(**{field: None})
        validate_rules(apps, editor)
