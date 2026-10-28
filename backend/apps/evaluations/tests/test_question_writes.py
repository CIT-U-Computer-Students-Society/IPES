"""Exercise schema validation through every question mutation endpoint."""

from django.urls import reverse
from rest_framework.test import APITestCase

from apps.evaluations.models import EvaluationAssignment, Question
from .fixtures import EvaluationFixtures


class QuestionWriteTests(EvaluationFixtures, APITestCase):
    def setUp(self):
        self.client.force_authenticate(self.admin)
        self.client.credentials(HTTP_X_ORGANIZATION_ID=str(self.org.pk))

    def question_data(self, **values):
        return {'text': 'New', 'input_type': 'rating', 'order': 2, 'min_value': 1, 'max_value': 5, **values}

    def test_single_bulk_and_nested_create_validate_question_partitions(self):
        for invalid in ({'order': 0}, {'weight': -1}, {'weight': 'NaN'}, {'weight': True}, {'input_type': 'invalid'}, {'min_value': 6}):
            data = self.question_data(**invalid)
            requests = [
                (reverse('questions-list'), {**data, 'form_id': self.form.pk}),
                (reverse('questions-bulk-create'), {'form_id': self.form.pk, 'questions': [self.question_data(), data]}),
                (reverse('forms-list'), {'organization_id': self.org.pk, 'title': 'Nested', 'start_date': '2026-01-01', 'end_date': '2026-12-31', 'questions': [data]}),
            ]
            for url, payload in requests:
                with self.subTest(invalid=invalid, url=url):
                    self.assertEqual(self.client.post(url, payload, format='json').status_code, 400)
                    self.assertEqual(Question.objects.filter(form_id=self.form).count(), 1)

    def test_bulk_create_rejects_malformed_shapes(self):
        for questions in (None, 'invalid', {}, [None], ['invalid']):
            with self.subTest(questions=questions):
                response = self.client.post(reverse('questions-bulk-create'), {'form_id': self.form.pk, 'questions': questions}, format='json')
                self.assertEqual(response.status_code, 400)

    def test_reorder_lower_boundary_and_content_changes_reset_scores(self):
        url = reverse('questions-reorder', args=[self.question.pk])
        for order, code in ((-1, 400), (0, 400), (1, 200)):
            with self.subTest(order=order):
                self.assertEqual(self.client.post(url, {'order': order}, format='json').status_code, code)
        EvaluationAssignment.objects.filter(pk=self.assignment.pk).update(status='Completed', total_score=4)
        self.assertEqual(self.client.patch(reverse('questions-detail', args=[self.question.pk]), {'weight': 2}, format='json').status_code, 200)
        self.assignment.refresh_from_db()
        self.assertEqual(self.assignment.status, 'In Progress')
        self.assertIsNone(self.assignment.total_score)
        self.assertIsNone(self.assignment.submitted_at)

    def test_foreign_parent_cannot_be_used_or_reassigned(self):
        self.assertEqual(self.client.post(reverse('questions-list'), {**self.question_data(), 'form_id': self.other_form.pk}, format='json').status_code, 400)
        self.assertEqual(self.client.post(reverse('questions-bulk-create'), {'form_id': self.other_form.pk, 'questions': [self.question_data()]}, format='json').status_code, 404)
        self.assertEqual(self.client.patch(reverse('questions-detail', args=[self.question.pk]), {'form_id': self.other_form.pk}, format='json').status_code, 400)

    def test_form_id_invalid_equivalence_partitions(self):
        for value in (None, '', 0, -1, True, 'abc', 2147483648):
            for route in ('questions-bulk-create', 'assignment-rules-generate'):
                with self.subTest(value=value, route=route):
                    response = self.client.post(reverse(route), {'form_id': value, 'questions': []}, format='json')
                    self.assertEqual(response.status_code, 400)
