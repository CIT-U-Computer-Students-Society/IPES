from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from apps.audit.models import AuditLog
from apps.organizations.models import Organization, OrganizationRole
from apps.portfolio.models import Accomplishment
from apps.users.models import User


class AccomplishmentSubmissionEligibilityTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.active_org = Organization.objects.create(
            name='Active Org',
            code='ACTORG',
            description='Active org for eligibility tests',
            period_year_start='2026-01-01',
            is_active=True,
        )
        cls.inactive_org = Organization.objects.create(
            name='Inactive Org',
            code='INACTORG',
            description='Inactive org for eligibility tests',
            period_year_start='2026-01-01',
            is_active=False,
        )

        cls.active_member = User.objects.create_user(
            username='active_member',
            email='active_member@cit.edu',
            password='password123',
        )
        OrganizationRole.objects.create(
            user=cls.active_member,
            organization=cls.active_org,
            role='Member',
            is_active=True,
        )

        cls.active_admin = User.objects.create_user(
            username='active_admin',
            email='active_admin@cit.edu',
            password='password123',
        )
        OrganizationRole.objects.create(
            user=cls.active_admin,
            organization=cls.active_org,
            role='Admin',
            is_active=True,
        )

        cls.removed_member = User.objects.create_user(
            username='removed_member',
            email='removed_member@cit.edu',
            password='password123',
        )
        OrganizationRole.objects.create(
            user=cls.removed_member,
            organization=cls.active_org,
            role='Member',
            is_active=False,
        )

        cls.unaffiliated_user = User.objects.create_user(
            username='unaffiliated',
            email='unaffiliated@cit.edu',
            password='password123',
        )

        cls.superuser = User.objects.create_superuser(
            username='superuser',
            email='superuser@cit.edu',
            password='password123',
        )

        cls.inactive_org_member = User.objects.create_user(
            username='inactive_member',
            email='inactive_member@cit.edu',
            password='password123',
        )
        OrganizationRole.objects.create(
            user=cls.inactive_org_member,
            organization=cls.inactive_org,
            role='Member',
            is_active=True,
        )

        cls.url = reverse('accomplishments-list')

    def setUp(self):
        self.client = APIClient()

    def _payload(self, title='Test Accomplishment'):
        return {
            'title': title,
            'description': 'Description of achievement',
            'type': 'project',
            'date_completed': timezone.now().isoformat(),
        }

    def test_active_member_submission_succeeds(self):
        self.client.force_authenticate(self.active_member)
        response = self.client.post(
            self.url,
            self._payload(title='Member Work'),
            format='json',
            HTTP_X_ORGANIZATION_ID=str(self.active_org.pk),
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(
            Accomplishment.objects.filter(
                user_id=self.active_member,
                organization_id=self.active_org,
                title='Member Work',
            ).count(),
            1,
        )
        self.assertTrue(
            AuditLog.objects.filter(
                organization_id=self.active_org,
                user_id=self.active_member,
                action__startswith='accomplishment.created',
            ).exists()
        )

    def test_active_admin_submission_succeeds(self):
        self.client.force_authenticate(self.active_admin)
        response = self.client.post(
            self.url,
            self._payload(title='Admin Work'),
            format='json',
            HTTP_X_ORGANIZATION_ID=str(self.active_org.pk),
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(
            Accomplishment.objects.filter(
                user_id=self.active_admin,
                organization_id=self.active_org,
            ).count(),
            1,
        )

    def test_superuser_submission_to_active_org_succeeds(self):
        self.client.force_authenticate(self.superuser)
        response = self.client.post(
            self.url,
            self._payload(title='Superuser Work'),
            format='json',
            HTTP_X_ORGANIZATION_ID=str(self.active_org.pk),
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(
            Accomplishment.objects.filter(
                user_id=self.superuser,
                organization_id=self.active_org,
            ).count(),
            1,
        )

    def test_unaffiliated_user_cannot_submit(self):
        self.client.force_authenticate(self.unaffiliated_user)
        response = self.client.post(
            self.url,
            self._payload(title='Intruder Work'),
            format='json',
            HTTP_X_ORGANIZATION_ID=str(self.active_org.pk),
        )
        self.assertEqual(response.status_code, 403)
        self.assertFalse(
            Accomplishment.objects.filter(
                title='Intruder Work'
            ).exists()
        )
        self.assertFalse(
            AuditLog.objects.filter(
                user_id=self.unaffiliated_user
            ).exists()
        )

    def test_removed_member_cannot_submit(self):
        self.client.force_authenticate(self.removed_member)
        response = self.client.post(
            self.url,
            self._payload(title='Removed Member Work'),
            format='json',
            HTTP_X_ORGANIZATION_ID=str(self.active_org.pk),
        )
        self.assertEqual(response.status_code, 403)
        self.assertFalse(
            Accomplishment.objects.filter(
                title='Removed Member Work'
            ).exists()
        )
        self.assertFalse(
            AuditLog.objects.filter(
                user_id=self.removed_member
            ).exists()
        )

    def test_submission_to_inactive_organization_forbidden(self):
        self.client.force_authenticate(self.inactive_org_member)
        response = self.client.post(
            self.url,
            self._payload(title='Inactive Org Work'),
            format='json',
            HTTP_X_ORGANIZATION_ID=str(self.inactive_org.pk),
        )
        self.assertEqual(response.status_code, 403)
        self.assertFalse(
            Accomplishment.objects.filter(
                title='Inactive Org Work'
            ).exists()
        )
        self.assertFalse(
            AuditLog.objects.filter(
                organization_id=self.inactive_org
            ).exists()
        )

    def test_superuser_cannot_submit_to_inactive_organization(self):
        self.client.force_authenticate(self.superuser)
        response = self.client.post(
            self.url,
            self._payload(title='Superuser Inactive Org Work'),
            format='json',
            HTTP_X_ORGANIZATION_ID=str(self.inactive_org.pk),
        )
        self.assertEqual(response.status_code, 403)
        self.assertFalse(
            Accomplishment.objects.filter(
                title='Superuser Inactive Org Work'
            ).exists()
        )

    def test_missing_organization_header_returns_bad_request(self):
        self.client.force_authenticate(self.active_member)
        response = self.client.post(
            self.url,
            self._payload(title='Missing Org Header'),
            format='json',
        )
        self.assertEqual(response.status_code, 400)
        self.assertFalse(
            Accomplishment.objects.filter(
                title='Missing Org Header'
            ).exists()
        )

    def test_invalid_organization_header_returns_bad_request(self):
        self.client.force_authenticate(self.active_member)
        for invalid_id in ('abc', '-5', '0', '999999999999999'):
            with self.subTest(invalid_id=invalid_id):
                response = self.client.post(
                    self.url,
                    self._payload(title=f'Invalid Org {invalid_id}'),
                    format='json',
                    HTTP_X_ORGANIZATION_ID=invalid_id,
                )
                self.assertEqual(response.status_code, 400)

    def test_mismatched_header_and_query_param_returns_bad_request(self):
        self.client.force_authenticate(self.active_member)
        response = self.client.post(
            f"{self.url}?organization_id=9999",
            self._payload(title='Mismatched Org'),
            format='json',
            HTTP_X_ORGANIZATION_ID=str(self.active_org.pk),
        )
        self.assertEqual(response.status_code, 400)
