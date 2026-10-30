"""Individual assignments are work records, while received results are aggregates."""

from django.urls import reverse
from rest_framework.test import APITestCase

from apps.evaluations.models import EvaluationAssignment, EvaluationForm
from apps.organizations.models import OrganizationRole
from .fixtures import EvaluationFixtures


class AssignmentVisibilityTests(EvaluationFixtures, APITestCase):
    def setUp(self):
        self.client.credentials(HTTP_X_ORGANIZATION_ID=str(self.org.pk))
        self.client.force_authenticate(self.evaluator)
        response = self.client.post(
            reverse('assignments-submit', args=[self.assignment.pk]),
            {'responses': [{'question_id': self.question.pk, 'score_value': 4}]},
            format='json',
        )
        self.assertEqual(response.status_code, 200, response.data)

    def set_released(self, released):
        EvaluationForm.objects.filter(pk=self.form.pk).update(results_released=released)

    def test_incoming_records_are_hidden_before_and_after_release(self):
        self.client.force_authenticate(self.evaluatee)
        for released in (False, True):
            self.set_released(released)
            with self.subTest(released=released):
                for params in ({}, {'evaluator_id': self.evaluator.pk}, {'form_id': self.form.pk}):
                    response = self.client.get(reverse('assignments-list'), params)
                    self.assertEqual(response.status_code, 200)
                    self.assertEqual(response.data['count'], 0)
                    self.assertEqual(response.data['results'], [])
                for route in ('assignments-detail', 'assignments-responses'):
                    response = self.client.get(reverse(route, args=[self.assignment.pk]))
                    self.assertEqual(response.status_code, 404)
                performance = self.client.get(reverse('assignments-my-performance'))
                self.assertEqual(performance.status_code, 200)
                self.assertEqual(performance.data['evaluatorCount'], int(released))
                self.assertEqual(performance.data['overallScore'], 4 if released else 0)

    def test_evaluator_and_admin_retain_individual_record_access(self):
        for released in (False, True):
            self.set_released(released)
            for user in (self.evaluator, self.admin):
                self.client.force_authenticate(user)
                with self.subTest(released=released, user=user.email):
                    listing = self.client.get(reverse('assignments-list'))
                    self.assertEqual(listing.status_code, 200)
                    self.assertEqual(listing.data['count'], 1)
                    detail = self.client.get(reverse('assignments-detail', args=[self.assignment.pk]))
                    self.assertEqual(detail.status_code, 200)
                    self.assertEqual(detail.data['evaluator_id'], self.evaluator.pk)
                    self.assertEqual(detail.data['evaluator_email'], self.evaluator.email)
                    self.assertEqual(detail.data['total_score'], 4)
                    answers = self.client.get(reverse('assignments-responses', args=[self.assignment.pk]))
                    self.assertEqual(answers.status_code, 200)
                    self.assertEqual(answers.data[0]['score_value'], 4)

    def test_member_sees_outgoing_and_self_evaluations_only(self):
        outgoing = EvaluationAssignment.objects.create(
            evaluator_id=self.evaluatee, evaluatee_id=self.evaluator, form_id=self.form,
        )
        own = EvaluationAssignment.objects.create(
            evaluator_id=self.evaluatee, evaluatee_id=self.evaluatee, form_id=self.form,
        )
        self.client.force_authenticate(self.evaluatee)
        response = self.client.get(reverse('assignments-list'))
        self.assertEqual({row['id'] for row in response.data['results']}, {outgoing.pk, own.pk})
        pending = self.client.get(reverse('assignments-my-pending'))
        self.assertEqual({row['id'] for row in pending.data}, {outgoing.pk, own.pk})
        detail = self.client.get(reverse('assignments-detail', args=[own.pk]))
        self.assertEqual(detail.status_code, 200)
        self.client.force_authenticate(self.evaluator)
        completed = self.client.get(reverse('assignments-my-completed'))
        self.assertEqual([row['id'] for row in completed.data], [self.assignment.pk])

    def test_admin_in_another_organization_cannot_read_records(self):
        OrganizationRole.objects.create(user=self.outsider, organization=self.other_org, role='Admin')
        self.client.force_authenticate(self.outsider)
        for released in (False, True):
            self.set_released(released)
            with self.subTest(released=released):
                self.client.credentials(HTTP_X_ORGANIZATION_ID=str(self.org.pk))
                self.assertEqual(self.client.get(reverse('assignments-list')).status_code, 403)
                self.assertEqual(self.client.get(
                    reverse('assignments-detail', args=[self.assignment.pk]),
                ).status_code, 403)
                self.client.credentials(HTTP_X_ORGANIZATION_ID=str(self.other_org.pk))
                listing = self.client.get(reverse('assignments-list'))
                self.assertEqual(listing.status_code, 200)
                self.assertEqual(listing.data['results'], [])
                self.assertEqual(self.client.get(
                    reverse('assignments-detail', args=[self.assignment.pk]),
                ).status_code, 404)
