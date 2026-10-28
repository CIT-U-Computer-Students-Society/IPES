"""BVA, equivalence partitions, decision tables, state transitions and rollback tests."""

from unittest.mock import patch

from django.db import DatabaseError, IntegrityError, transaction
from django.db.models import Avg
from django.urls import reverse
from rest_framework.test import APITestCase

from apps.audit.models import AuditLog
from apps.evaluations.models import EvaluationAssignment, EvaluationForm, Question, Response
from apps.organizations.models import OrganizationRole
from .fixtures import EvaluationFixtures


class AnswerIntegrityTests(EvaluationFixtures, APITestCase):
    def setUp(self):
        self.client.force_authenticate(self.evaluator)
        self.client.credentials(HTTP_X_ORGANIZATION_ID=str(self.org.pk))
        self.draft_url = reverse('responses-bulk-create')
        self.submit_url = reverse('assignments-submit', args=[self.assignment.pk])

    def reset_assignment(self):
        self.assignment.responses.all().delete()
        EvaluationAssignment.objects.filter(pk=self.assignment.pk).update(
            status='Pending', submitted_at=None, total_score=None,
        )

    def answer(self, value=3, **overrides):
        return {'question_id': self.question.pk, 'score_value': value, **overrides}

    def draft(self, answers):
        return self.client.post(self.draft_url, {
            'assignment_id': self.assignment.pk, 'responses': answers,
        }, format='json')

    def submit(self, answers):
        return self.client.post(self.submit_url, {'responses': answers}, format='json')

    def test_score_boundary_values_on_both_write_paths(self):
        for operation in (self.draft, self.submit):
            for score, expected in ((0.999, 400), (1, 200), (1.001, 200), (4.999, 200), (5, 200), (5.001, 400)):
                with self.subTest(operation=operation.__name__, score=score):
                    self.reset_assignment()
                    response = operation([self.answer(score)])
                    self.assertEqual(response.status_code // 100, expected // 100, response.data)
                    self.assertEqual(Response.objects.count(), int(expected == 200))

    def test_invalid_score_equivalence_partitions(self):
        for value in ('abc', 'NaN', 'Infinity', '-Infinity', [], {}, True, False):
            with self.subTest(value=value):
                response = self.submit([self.answer(value)])
                self.assertEqual(response.status_code, 400, response.data)
                self.assertFalse(Response.objects.exists())

    def test_zero_negative_single_value_and_default_score_ranges(self):
        cases = (
            ('number', 0, 100, 0, 200),
            ('number', -5, 5, -5, 200),
            ('rating', None, None, 0, 200),
            ('number', None, None, 100, 200),
            ('number', None, None, 100.001, 400),
            ('rating', None, None, 5.001, 400),
            ('rating', 2, 2, 2, 200),
        )
        for kind, low, high, score, code in cases:
            with self.subTest(kind=kind, bounds=(low, high), score=score):
                self.reset_assignment()
                Question.objects.filter(pk=self.question.pk).update(input_type=kind, min_value=low, max_value=high)
                self.assertEqual(self.submit([self.answer(score)]).status_code, code)
                if code == 200:
                    self.assignment.refresh_from_db()
                    self.assertEqual(self.assignment.total_score, score)

    def test_draft_then_submit_updates_existing_answer_and_analytics(self):
        self.assertEqual(self.draft([self.answer(1)]).status_code, 201)
        answer_id = Response.objects.get().pk
        self.assertEqual(self.submit([self.answer(5)]).status_code, 200)
        self.assignment.refresh_from_db()
        self.assertEqual(Response.objects.get().pk, answer_id)
        self.assertEqual(self.assignment.total_score, 5)
        self.assertEqual(Response.objects.aggregate(avg=Avg('score_value'))['avg'], 5)
        self.assertEqual(self.assignment.status, 'Completed')
        self.assertIsNotNone(self.assignment.submitted_at)
        self.assertEqual(AuditLog.objects.filter(organization_id=self.org).count(), 1)

    def test_draft_save_is_idempotent(self):
        for _ in range(3):
            self.assertEqual(self.draft([self.answer(2)]).status_code, 201)
        self.assertEqual(Response.objects.count(), 1)
        self.assignment.refresh_from_db()
        self.assertEqual(self.assignment.status, 'In Progress')
        self.assertIsNone(self.assignment.total_score)
        self.assertIsNone(self.assignment.submitted_at)

    def test_database_rejects_duplicate_assignment_question(self):
        Response.objects.create(assignment_id=self.assignment, question_id=self.question, score_value=3)
        with self.assertRaises(IntegrityError), transaction.atomic():
            Response.objects.create(assignment_id=self.assignment, question_id=self.question, score_value=4)

    def test_same_question_is_allowed_on_different_assignments(self):
        second = EvaluationAssignment.objects.create(
            evaluator_id=self.admin, evaluatee_id=self.evaluatee, form_id=self.form,
        )
        for assignment in (self.assignment, second):
            Response.objects.create(assignment_id=assignment, question_id=self.question, score_value=3)
        self.assertEqual(Response.objects.count(), 2)

    def test_duplicate_question_ids_rejected_before_any_write(self):
        for operation in (self.draft, self.submit):
            with self.subTest(operation=operation.__name__):
                response = operation([self.answer(1), self.answer(5)])
                self.assertEqual(response.status_code, 400)
                self.assertFalse(Response.objects.exists())

    def test_foreign_same_org_and_nonexistent_questions_are_rejected(self):
        same_org_form = EvaluationForm.objects.create(
            organization_id=self.org, title='Different form', start_date=self.form.start_date, end_date=self.form.end_date,
        )
        same_org_question = Question.objects.create(form_id=same_org_form, text='Other', input_type='rating', order=1)
        for qid in (same_org_question.pk, self.foreign_question.pk, 999999, 0, -1, None, 'invalid'):
            for operation in (self.draft, self.submit):
                with self.subTest(qid=qid, operation=operation.__name__):
                    response = operation([self.answer(question_id=qid)])
                    self.assertEqual(response.status_code, 400)
                    self.assertFalse(Response.objects.exists())

    def test_batch_validation_is_atomic_and_preserves_existing_draft(self):
        self.draft([self.answer(2)])
        response = self.submit([self.answer(5), self.answer(question_id=self.foreign_question.pk)])
        self.assertEqual(response.status_code, 400)
        self.assertEqual(Response.objects.get().score_value, 2)
        self.assignment.refresh_from_db()
        self.assertEqual(self.assignment.status, 'In Progress')
        self.assertFalse(AuditLog.objects.exists())

    def test_database_failure_rolls_back_answers_status_and_audit(self):
        self.draft([self.answer(2)])
        with patch.object(EvaluationAssignment, 'save', side_effect=DatabaseError('write failed')):
            with self.assertRaises(DatabaseError):
                self.submit([self.answer(5)])
        self.assertEqual(Response.objects.get().score_value, 2)
        self.assignment.refresh_from_db()
        self.assertEqual(self.assignment.status, 'In Progress')
        self.assertFalse(AuditLog.objects.exists())

    def test_empty_and_malformed_payload_partitions(self):
        for payload in ({}, {'responses': None}, {'responses': 'bad'}, {'responses': {}}, {'responses': [None]}):
            with self.subTest(payload=payload):
                self.assertEqual(self.client.post(self.submit_url, payload, format='json').status_code, 400)
        self.assertEqual(self.submit([]).status_code, 400)
        self.assertEqual(self.draft([]).status_code, 201)

    def test_invalid_assignment_id_partitions(self):
        for value in (None, '', 0, -1, True, 'abc', [], 1.5):
            with self.subTest(value=value):
                response = self.client.post(self.draft_url, {'assignment_id': value, 'responses': []}, format='json')
                self.assertEqual(response.status_code, 400)

    def test_required_optional_type_and_phase_decision_table(self):
        for kind in ('rating', 'number', 'dropdown', 'text', 'textarea', 'checkbox'):
            for required in (True, False):
                Question.objects.filter(pk=self.question.pk).update(input_type=kind, is_required=required)
                for provided in (False, True):
                    for phase in ('draft', 'submit'):
                        with self.subTest(kind=kind, required=required, provided=provided, phase=phase):
                            self.reset_assignment()
                            answers = []
                            if provided:
                                answers = [self.answer(3)] if kind in ('rating', 'number', 'dropdown') else [
                                    {'question_id': self.question.pk, 'text': 'An answer'},
                                ]
                            response = getattr(self, phase)(answers)
                            invalid = phase == 'submit' and required and not provided
                            self.assertEqual(response.status_code // 100, 4 if invalid else 2, response.data)

    def test_required_text_blank_partitions(self):
        Question.objects.filter(pk=self.question.pk).update(input_type='text')
        for text in (None, '', ' ', '\n\t'):
            with self.subTest(text=text):
                response = self.submit([{'question_id': self.question.pk, 'text': text}])
                self.assertEqual(response.status_code, 400)

    def test_scores_on_text_questions_are_rejected(self):
        Question.objects.filter(pk=self.question.pk).update(input_type='text')
        self.assertEqual(self.draft([self.answer(3, text='Comment')]).status_code, 400)

    def test_cleared_optional_drafts_are_removed_in_both_phases(self):
        Question.objects.filter(pk=self.question.pk).update(is_required=False)
        for operation in (self.draft, self.submit):
            with self.subTest(operation=operation.__name__):
                self.reset_assignment()
                self.draft([self.answer(3)])
                self.assertEqual(operation([]).status_code // 100, 2)
                self.assertFalse(Response.objects.exists())

    def test_weighted_average_zero_null_and_large_weights(self):
        second = Question.objects.create(
            form_id=self.form, text='Second', input_type='rating', order=2, min_value=1, max_value=5,
        )
        for weights, expected in (((1, 3), 4), ((0, 1), 5), ((None, None), None), ((0, 0), None), ((1e308, 1e308), 3)):
            with self.subTest(weights=weights):
                self.reset_assignment()
                Question.objects.filter(pk=self.question.pk).update(weight=weights[0])
                Question.objects.filter(pk=second.pk).update(weight=weights[1])
                self.assertEqual(self.submit([self.answer(1), self.answer(5, question_id=second.pk)]).status_code, 200)
                self.assignment.refresh_from_db()
                self.assertEqual(self.assignment.total_score, expected)

    def test_completed_state_rejects_all_response_mutations(self):
        self.submit([self.answer(3)])
        row = Response.objects.get()
        url = reverse('responses-detail', args=[row.pk])
        operations = [
            lambda: self.submit([self.answer(4)]), lambda: self.draft([self.answer(4)]),
            lambda: self.client.post(reverse('responses-list'), {'assignment_id': self.assignment.pk, **self.answer(4)}, format='json'),
            lambda: self.client.patch(url, {'score_value': 4}, format='json'),
            lambda: self.client.delete(url),
        ]
        for i, operation in enumerate(operations):
            with self.subTest(operation=i):
                self.assertEqual(operation().status_code, 400)
        self.assertEqual(Response.objects.get().score_value, 3)
        self.assertEqual(AuditLog.objects.count(), 1)

    def test_inactive_deleted_and_released_forms_reject_writes(self):
        for flags, expected in (({'is_active': False}, 400), ({'is_deleted': True}, 404), ({'results_released': True}, 400)):
            with self.subTest(flags=flags):
                EvaluationForm.objects.filter(pk=self.form.pk).update(is_active=True, is_deleted=False, results_released=False)
                EvaluationForm.objects.filter(pk=self.form.pk).update(**flags)
                self.assertEqual(self.draft([self.answer(3)]).status_code, expected)
                self.assertEqual(self.submit([self.answer(3)]).status_code, expected)

    def test_evaluator_admin_evaluatee_and_outsider_access(self):
        self.draft([self.answer(3)])
        for user, read_count, write_code in ((self.evaluator, 1, 201), (self.admin, 1, 403), (self.evaluatee, 0, 403), (self.outsider, None, 403)):
            with self.subTest(user=user.username):
                self.client.force_authenticate(user)
                response = self.client.get(reverse('responses-list'))
                if read_count is None:
                    self.assertEqual(response.status_code, 403)
                else:
                    self.assertEqual(response.status_code, 200)
                    self.assertEqual(len(response.data['results']), read_count)
                self.assertEqual(self.draft([self.answer(4)]).status_code, write_code)

    def test_organization_scope_missing_invalid_conflicting_and_inactive(self):
        for header in (None, '', 'abc', '0', '-1', '1.5', '١', '2147483648', '9' * 5000):
            with self.subTest(header=header):
                self.client.credentials(**({'HTTP_X_ORGANIZATION_ID': header} if header else {}))
                self.assertEqual(self.client.get(reverse('responses-list')).status_code, 400)
        self.client.credentials(HTTP_X_ORGANIZATION_ID=str(self.org.pk))
        self.assertEqual(self.client.get(reverse('responses-list'), {'organization_id': self.other_org.pk}).status_code, 400)
        OrganizationRole.objects.filter(user=self.evaluator).update(is_active=False)
        self.assertEqual(self.draft([self.answer()]).status_code, 403)

    def test_query_parameter_scope_remains_supported_and_anonymous_access_is_denied(self):
        self.client.credentials()
        response = self.client.get(reverse('responses-list'), {'organization_id': self.org.pk})
        self.assertEqual(response.status_code, 200)
        self.client.force_authenticate(user=None)
        self.assertIn(self.client.get(reverse('responses-list'), {'organization_id': self.org.pk}).status_code, (401, 403))

    def test_foreign_assignment_inaccessible_even_when_member_of_both_orgs(self):
        OrganizationRole.objects.create(user=self.evaluator, organization=self.other_org)
        other_assignment = EvaluationAssignment.objects.create(
            evaluator_id=self.evaluator, evaluatee_id=self.evaluatee, form_id=self.other_form,
        )
        response = self.client.post(self.draft_url, {
            'assignment_id': other_assignment.pk,
            'responses': [self.answer(question_id=self.foreign_question.pk)],
        }, format='json')
        self.assertEqual(response.status_code, 404)
        self.assertEqual(self.client.get(reverse('assignments-detail', args=[other_assignment.pk])).status_code, 404)

    def test_generic_create_and_partial_update_share_validation(self):
        url = reverse('responses-list')
        self.assertEqual(self.client.post(url, {'assignment_id': self.assignment.pk, **self.answer(3)}, format='json').status_code, 201)
        row = Response.objects.get()
        detail = reverse('responses-detail', args=[row.pk])
        self.assertEqual(self.client.patch(detail, {'score_value': 6}, format='json').status_code, 400)
        self.assertEqual(self.client.patch(detail, {'question_id': self.foreign_question.pk}, format='json').status_code, 400)
        self.assertEqual(self.client.patch(detail, {'score_value': 5}, format='json').status_code, 200)
        self.assertEqual(Response.objects.get().score_value, 5)

    def test_assignment_state_cannot_be_modified_through_generic_crud(self):
        url = reverse('assignments-detail', args=[self.assignment.pk])
        self.assertEqual(self.client.patch(url, {'status': 'Completed'}, format='json').status_code, 405)

    def test_evaluatee_cannot_bypass_response_permissions_using_assignment_action(self):
        self.draft([self.answer(3)])
        self.client.force_authenticate(self.evaluatee)
        self.assertEqual(self.client.get(reverse('assignments-responses', args=[self.assignment.pk])).status_code, 403)

    def test_large_weights_remain_finite_in_released_performance(self):
        Question.objects.filter(pk=self.question.pk).update(weight=1e308)
        self.assertEqual(self.submit([self.answer(3)]).status_code, 200)
        EvaluationForm.objects.filter(pk=self.form.pk).update(results_released=True, is_active=False)
        self.client.force_authenticate(self.evaluatee)
        response = self.client.get(reverse('assignments-my-performance'))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['overallScore'], 3)
        self.assertEqual(response.data['overallMaxScore'], 5)
        self.assertEqual(response.data['categoryScores'][0]['score'], 3)
