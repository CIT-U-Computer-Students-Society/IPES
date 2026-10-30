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
