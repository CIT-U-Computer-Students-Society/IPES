"""
Regression tests: closed evaluation forms excluded from my_pending (#237).
"""

from datetime import date
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.evaluations.models import (
    EvaluationAssignment,
    EvaluationForm,
    Question,
)
from apps.organizations.models import Organization, OrganizationRole
from apps.users.models import User


class PendingQueueClosedFormsTests(APITestCase):
    def setUp(self):
        self.password = 'StrongP@ssw0rd!123'
        self.org = Organization.objects.create(
            name='Pending Queue Org',
            code='PQO',
            period_year_start=date(2026, 1, 1),
        )

        self.evaluator = User.objects.create_user(
            username='evaluator_user',
            email='evaluator@cit.edu',
            password=self.password,
        )
        OrganizationRole.objects.create(
            user=self.evaluator,
            organization=self.org,
            role='Member',
            is_active=True,
        )

        self.evaluatee = User.objects.create_user(
            username='evaluatee_user',
            email='evaluatee@cit.edu',
            password=self.password,
        )
        OrganizationRole.objects.create(
            user=self.evaluatee,
            organization=self.org,
            role='Member',
            is_active=True,
        )

        # Active form
        self.active_form = EvaluationForm.objects.create(
            organization_id=self.org,
            title='Active Term Form',
            start_date=date(2026, 1, 1),
            end_date=date(2026, 12, 31),
            is_active=True,
            results_released=False,
            is_deleted=False,
        )
        self.active_question = Question.objects.create(
            form_id=self.active_form,
            text='Active Question',
            input_type='rating',
            order=1,
            weight=1.0,
            min_value=1,
            max_value=5,
        )

        # Inactive / Closed form
        self.inactive_form = EvaluationForm.objects.create(
            organization_id=self.org,
            title='Inactive Closed Form',
            start_date=date(2026, 1, 1),
            end_date=date(2026, 12, 31),
            is_active=False,
            results_released=False,
            is_deleted=False,
        )
        self.inactive_question = Question.objects.create(
            form_id=self.inactive_form,
            text='Inactive Question',
            input_type='rating',
            order=1,
            weight=1.0,
            min_value=1,
            max_value=5,
        )

        # Released form
        self.released_form = EvaluationForm.objects.create(
            organization_id=self.org,
            title='Released Form',
            start_date=date(2026, 1, 1),
            end_date=date(2026, 12, 31),
            is_active=True,
            results_released=True,
            is_deleted=False,
        )
        self.released_question = Question.objects.create(
            form_id=self.released_form,
            text='Released Question',
            input_type='rating',
            order=1,
            weight=1.0,
            min_value=1,
            max_value=5,
        )

        # Soft-deleted form
        self.deleted_form = EvaluationForm.objects.create(
            organization_id=self.org,
            title='Deleted Form',
            start_date=date(2026, 1, 1),
            end_date=date(2026, 12, 31),
            is_active=True,
            results_released=False,
            is_deleted=True,
        )

        # Assignments
        self.assign_active = EvaluationAssignment.objects.create(
            form_id=self.active_form,
            evaluator_id=self.evaluator,
            evaluatee_id=self.evaluatee,
            status='Pending',
        )
        self.assign_inactive = EvaluationAssignment.objects.create(
            form_id=self.inactive_form,
            evaluator_id=self.evaluator,
            evaluatee_id=self.evaluatee,
            status='Pending',
        )
        self.assign_released = EvaluationAssignment.objects.create(
            form_id=self.released_form,
            evaluator_id=self.evaluator,
            evaluatee_id=self.evaluatee,
            status='In Progress',
        )
        self.assign_deleted = EvaluationAssignment.objects.create(
            form_id=self.deleted_form,
            evaluator_id=self.evaluator,
            evaluatee_id=self.evaluatee,
            status='Pending',
        )

        self.client.force_authenticate(user=self.evaluator)
        self.client.credentials(HTTP_X_ORGANIZATION_ID=str(self.org.id))

    def test_my_pending_returns_only_active_unreleased_forms(self):
        """my_pending only returns assignments for open forms."""
        url = reverse('assignments-my-pending')
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

        returned_ids = [item['id'] for item in resp.data]
        self.assertIn(self.assign_active.id, returned_ids)
        self.assertNotIn(self.assign_inactive.id, returned_ids)
        self.assertNotIn(self.assign_released.id, returned_ids)
        self.assertNotIn(self.assign_deleted.id, returned_ids)

        active_item = next(
            item for item in resp.data if item['id'] == self.assign_active.id
        )
        self.assertTrue(active_item['form_is_active'])
        self.assertFalse(active_item['form_results_released'])
        self.assertFalse(active_item['is_closed'])

    def test_history_list_includes_closed_forms(self):
        """General assignment list marks closed forms with is_closed=True."""
        url = reverse('assignments-list')
        resp = self.client.get(url, {'evaluator_id': self.evaluator.id})
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

        if isinstance(resp.data, dict) and 'results' in resp.data:
            results = resp.data['results']
        else:
            results = resp.data
        data_by_id = {item['id']: item for item in results}
        self.assertIn(self.assign_active.id, data_by_id)
        self.assertIn(self.assign_inactive.id, data_by_id)
        self.assertIn(self.assign_released.id, data_by_id)
        # Soft-deleted forms are excluded from get_queryset
        self.assertNotIn(self.assign_deleted.id, data_by_id)

        self.assertFalse(data_by_id[self.assign_active.id]['is_closed'])
        self.assertTrue(data_by_id[self.assign_inactive.id]['is_closed'])
        self.assertTrue(data_by_id[self.assign_released.id]['is_closed'])

    def test_my_completed_preserves_completed_assignments(self):
        """my_completed includes completed evaluations even on closed forms."""
        self.assign_inactive.status = 'Completed'
        self.assign_inactive.total_score = 4.5
        self.assign_inactive.save()

        url = reverse('assignments-my-completed')
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

        returned_ids = [item['id'] for item in resp.data]
        self.assertIn(self.assign_inactive.id, returned_ids)

    def test_submitting_on_closed_form_fails_with_400(self):
        """Submitting responses for a closed form returns 400 Bad Request."""
        url = reverse(
            'assignments-submit', kwargs={'pk': self.assign_inactive.id}
        )
        payload = {
            'responses': [
                {
                    'question_id': self.inactive_question.id,
                    'score_value': 4,
                }
            ]
        }
        resp = self.client.post(url, payload, format='json')
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn(
            'not accepting responses',
            str(resp.data.get('error', ''))
        )
