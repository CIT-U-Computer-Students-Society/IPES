from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.audit.models import AuditLog
from apps.audit.utils import AuditActions
from apps.evaluations.models import EvaluationForm, Question
from apps.organizations.models import Organization, OrganizationRole
from apps.users.models import User


class FormLifecycleAuditTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.password = 'Pass123!Secure'
        cls.admin_user = User.objects.create_user(
            username='form_audit_admin',
            email='form_audit_admin@cit.edu',
            password=cls.password,
            first_name='Admin',
            last_name='User',
        )
        cls.org = Organization.objects.create(
            name='Form Audit Org',
            code='FORMAUDIT',
            description='Test Organization',
            period_year_start='2026-01-01',
            is_active=True,
        )
        OrganizationRole.objects.create(
            user=cls.admin_user,
            organization=cls.org,
            role='Admin',
            is_active=True,
        )

    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(self.admin_user)
        self.client.credentials(HTTP_X_ORGANIZATION_ID=str(self.org.id))

    def test_form_activation_and_release_distinct_actions(self):
        """Form activation and release emit distinct audit actions."""
        form = EvaluationForm.objects.create(
            organization_id=self.org,
            title='Lifecycle Form',
            description='Test description',
            start_date='2026-01-01',
            end_date='2026-12-31',
            created_by=self.admin_user,
            is_active=False,
            results_released=False,
        )
        Question.objects.create(
            form_id=form,
            text='Rate performance',
            input_type='rating',
            order=1,
            weight=1.0,
            is_required=True,
        )

        # 1. Activate form
        activate_url = reverse('forms-activate', kwargs={'pk': form.id})
        act_resp = self.client.post(activate_url)
        self.assertEqual(act_resp.status_code, status.HTTP_200_OK)

        act_log = AuditLog.objects.filter(
            organization_id=self.org,
            action__startswith=AuditActions.FORM_PUBLISHED,
        ).latest('id')
        self.assertIn(f"form_id={form.id}", act_log.action)
        self.assertTrue(act_log.action.startswith('evaluation.form_published'))

        # 2. Release results
        release_url = reverse('forms-release-results', kwargs={'pk': form.id})
        rel_resp = self.client.post(release_url)
        self.assertEqual(rel_resp.status_code, status.HTTP_200_OK)

        rel_log = AuditLog.objects.filter(
            organization_id=self.org,
            action__startswith=AuditActions.FORM_RESULTS_RELEASED,
        ).latest('id')
        self.assertIn(f"form_id={form.id}", rel_log.action)
        self.assertTrue(
            rel_log.action.startswith('evaluation.results_released')
        )

        # 3. Assert they are strictly distinct actions
        self.assertNotEqual(
            act_log.action.split(' ')[0],
            rel_log.action.split(' ')[0],
        )

    def test_form_patch_emits_form_updated_audit_event(self):
        """Updating form details via PATCH emits evaluation.form_updated."""
        form = EvaluationForm.objects.create(
            organization_id=self.org,
            title='Original Title',
            description='Original Description',
            start_date='2026-01-01',
            end_date='2026-12-31',
            created_by=self.admin_user,
            is_active=False,
            results_released=False,
        )
        url = reverse('forms-detail', kwargs={'pk': form.id})
        response = self.client.patch(
            url,
            {'title': 'Updated Title', 'description': 'Updated Description'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        form.refresh_from_db()
        self.assertEqual(form.title, 'Updated Title')
        self.assertEqual(form.description, 'Updated Description')

        log = AuditLog.objects.filter(
            organization_id=self.org,
            action__startswith=AuditActions.FORM_UPDATED,
        ).latest('id')
        self.assertIn(f"form_id={form.id}", log.action)
        self.assertIn("form_title=Updated Title", log.action)
        self.assertTrue(log.action.startswith('evaluation.form_updated'))

    def test_form_put_emits_form_updated_audit_event(self):
        """Updating full form via PUT emits evaluation.form_updated."""
        form = EvaluationForm.objects.create(
            organization_id=self.org,
            title='Old Title',
            description='Old Description',
            start_date='2026-01-01',
            end_date='2026-12-31',
            created_by=self.admin_user,
            is_active=False,
            results_released=False,
        )
        url = reverse('forms-detail', kwargs={'pk': form.id})
        payload = {
            'organization_id': self.org.id,
            'title': 'New PUT Title',
            'description': 'New PUT Description',
            'start_date': '2026-02-01',
            'end_date': '2026-11-30',
            'is_active': False,
            'results_released': False,
        }
        response = self.client.put(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        log = AuditLog.objects.filter(
            organization_id=self.org,
            action__startswith=AuditActions.FORM_UPDATED,
        ).latest('id')
        self.assertIn(f"form_id={form.id}", log.action)
        self.assertIn("form_title=New PUT Title", log.action)

    def test_form_update_validation_failure_emits_no_audit_event(self):
        """Failed form update validation does not record an audit event."""
        form = EvaluationForm.objects.create(
            organization_id=self.org,
            title='Valid Title',
            description='Valid Description',
            start_date='2026-01-01',
            end_date='2026-12-31',
            created_by=self.admin_user,
            is_active=False,
            results_released=False,
        )
        initial_count = AuditLog.objects.filter(
            organization_id=self.org,
            action__startswith=AuditActions.FORM_UPDATED,
        ).count()

        url = reverse('forms-detail', kwargs={'pk': form.id})
        # Invalid date range: start_date after end_date
        response = self.client.patch(
            url,
            {'start_date': '2026-12-31', 'end_date': '2026-01-01'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

        form.refresh_from_db()
        self.assertEqual(str(form.start_date), '2026-01-01')

        new_count = AuditLog.objects.filter(
            organization_id=self.org,
            action__startswith=AuditActions.FORM_UPDATED,
        ).count()
        self.assertEqual(initial_count, new_count)

    def test_generic_update_rejects_lifecycle_status_mutation(self):
        """Generic update cannot change is_active or results_released."""
        form = EvaluationForm.objects.create(
            organization_id=self.org,
            title='Status Test Form',
            description='Description',
            start_date='2026-01-01',
            end_date='2026-12-31',
            created_by=self.admin_user,
            is_active=False,
            results_released=False,
        )
        url = reverse('forms-detail', kwargs={'pk': form.id})

        # Attempt to activate via PATCH
        patch_act = self.client.patch(url, {'is_active': True}, format='json')
        self.assertEqual(patch_act.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('is_active', patch_act.data)
        self.assertIn('dedicated lifecycle', str(patch_act.data['is_active']))

        # Attempt to release results via PATCH
        patch_rel = self.client.patch(
            url, {'results_released': True}, format='json'
        )
        self.assertEqual(patch_rel.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('results_released', patch_rel.data)
        self.assertIn(
            'dedicated lifecycle', str(patch_rel.data['results_released'])
        )

        form.refresh_from_db()
        self.assertFalse(form.is_active)
        self.assertFalse(form.results_released)
        self.assertFalse(
            AuditLog.objects.filter(
                organization_id=self.org,
                action__startswith=AuditActions.FORM_UPDATED,
            ).exists()
        )
