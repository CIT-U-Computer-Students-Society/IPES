from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.audit.models import AuditLog
from apps.organizations.models import Organization, OrganizationRole
from apps.users.models import User


class AuditTenantScopingTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.password = 'Pass123!Secure'
        cls.admin_user = User.objects.create_user(
            username='audit_org_admin',
            email='audit_org_admin@cit.edu',
            password=cls.password,
            first_name='Admin',
            last_name='User',
        )
        cls.member_user = User.objects.create_user(
            username='audit_org_member',
            email='audit_org_member@cit.edu',
            password=cls.password,
            first_name='Member',
            last_name='User',
        )
        cls.outsider_user = User.objects.create_user(
            username='audit_outsider',
            email='audit_outsider@cit.edu',
            password=cls.password,
            first_name='Outsider',
            last_name='User',
        )
        cls.superuser = User.objects.create_superuser(
            username='audit_super',
            email='audit_super@cit.edu',
            password=cls.password,
            first_name='Super',
            last_name='User',
        )

        cls.org_a = Organization.objects.create(
            name='Tenant Org Alpha',
            code='ALPHA99',
            description='First tenant organization',
            period_year_start='2026-01-01',
            is_active=True,
        )
        cls.org_b = Organization.objects.create(
            name='Tenant Org Beta',
            code='BETA99',
            description='Second tenant organization',
            period_year_start='2026-01-01',
            is_active=True,
        )

        OrganizationRole.objects.create(
            user=cls.admin_user,
            organization=cls.org_a,
            role='Admin',
            is_active=True,
        )
        OrganizationRole.objects.create(
            user=cls.member_user,
            organization=cls.org_a,
            role='Member',
            is_active=True,
        )

        cls.log_a = AuditLog.objects.create(
            user_id=cls.admin_user,
            organization_id=cls.org_a,
            action='org_a.test_action',
            ip_address='192.168.1.10',
        )
        cls.log_b = AuditLog.objects.create(
            user_id=cls.admin_user,
            organization_id=cls.org_b,
            action='org_b.test_action',
            ip_address='192.168.1.20',
        )

    def setUp(self):
        self.client = APIClient()

    def test_admin_header_only_scopes_to_org(self):
        """Admin sending X-Organization-Id retrieves org logs."""
        self.client.force_authenticate(self.admin_user)
        url = reverse('audit-list')
        resp = self.client.get(
            url,
            HTTP_X_ORGANIZATION_ID=str(self.org_a.id),
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        results = (
            resp.data.get('results', resp.data)
            if isinstance(resp.data, dict)
            else resp.data
        )
        log_ids = [r['id'] for r in results]
        self.assertIn(self.log_a.id, log_ids)
        self.assertNotIn(self.log_b.id, log_ids)

    def test_admin_header_only_detail_retrieval(self):
        """Admin sending X-Organization-Id can retrieve detail log."""
        self.client.force_authenticate(self.admin_user)
        url = reverse('audit-detail', kwargs={'pk': self.log_a.id})
        resp = self.client.get(
            url,
            HTTP_X_ORGANIZATION_ID=str(self.org_a.id),
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data['id'], self.log_a.id)

    def test_admin_header_only_cross_tenant_detail_blocked(self):
        """Admin cannot retrieve detail log of another organization."""
        self.client.force_authenticate(self.admin_user)
        url = reverse('audit-detail', kwargs={'pk': self.log_b.id})
        resp = self.client.get(
            url,
            HTTP_X_ORGANIZATION_ID=str(self.org_a.id),
        )
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)

    def test_admin_query_param_only_scopes_to_org(self):
        """Admin sending organization_id query parameter retrieves logs."""
        self.client.force_authenticate(self.admin_user)
        url = reverse('audit-list')
        resp = self.client.get(url, {'organization_id': self.org_a.id})
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        results = (
            resp.data.get('results', resp.data)
            if isinstance(resp.data, dict)
            else resp.data
        )
        log_ids = [r['id'] for r in results]
        self.assertIn(self.log_a.id, log_ids)
        self.assertNotIn(self.log_b.id, log_ids)

    def test_matching_header_and_query_param_accepted(self):
        """Matching header and query param are accepted without conflict."""
        self.client.force_authenticate(self.admin_user)
        url = reverse('audit-list')
        resp = self.client.get(
            url,
            {'organization_id': self.org_a.id},
            HTTP_X_ORGANIZATION_ID=str(self.org_a.id),
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        results = (
            resp.data.get('results', resp.data)
            if isinstance(resp.data, dict)
            else resp.data
        )
        log_ids = [r['id'] for r in results]
        self.assertIn(self.log_a.id, log_ids)

    def test_conflicting_header_and_query_param_rejected(self):
        """Conflicting header and query parameter return 400 Bad Request."""
        self.client.force_authenticate(self.admin_user)
        url = reverse('audit-list')
        resp = self.client.get(
            url,
            {'organization_id': self.org_b.id},
            HTTP_X_ORGANIZATION_ID=str(self.org_a.id),
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('organization_id', resp.data)
        self.assertIn(
            'Organization header and parameter must match.',
            str(resp.data['organization_id']),
        )

    def test_member_cannot_read_audit_logs_via_header(self):
        """Regular member role cannot view audit logs via header."""
        self.client.force_authenticate(self.member_user)
        url = reverse('audit-list')
        resp = self.client.get(
            url,
            HTTP_X_ORGANIZATION_ID=str(self.org_a.id),
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        results = (
            resp.data.get('results', resp.data)
            if isinstance(resp.data, dict)
            else resp.data
        )
        self.assertEqual(len(results), 0)

        detail_url = reverse('audit-detail', kwargs={'pk': self.log_a.id})
        det_resp = self.client.get(
            detail_url,
            HTTP_X_ORGANIZATION_ID=str(self.org_a.id),
        )
        self.assertEqual(det_resp.status_code, status.HTTP_404_NOT_FOUND)

    def test_outsider_cannot_read_audit_logs(self):
        """User with no role in org receives empty list and 404 on detail."""
        self.client.force_authenticate(self.outsider_user)
        url = reverse('audit-list')
        resp = self.client.get(
            url,
            HTTP_X_ORGANIZATION_ID=str(self.org_a.id),
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        results = (
            resp.data.get('results', resp.data)
            if isinstance(resp.data, dict)
            else resp.data
        )
        self.assertEqual(len(results), 0)

        detail_url = reverse('audit-detail', kwargs={'pk': self.log_a.id})
        det_resp = self.client.get(
            detail_url,
            HTTP_X_ORGANIZATION_ID=str(self.org_a.id),
        )
        self.assertEqual(det_resp.status_code, status.HTTP_404_NOT_FOUND)

    def test_regular_admin_without_tenant_selector_gets_empty_list(self):
        """Regular admin without tenant selector receives empty list."""
        self.client.force_authenticate(self.admin_user)
        url = reverse('audit-list')
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        results = (
            resp.data.get('results', resp.data)
            if isinstance(resp.data, dict)
            else resp.data
        )
        self.assertEqual(len(results), 0)

    def test_invalid_organization_id_rejected(self):
        """Non-numeric or invalid organization_id returns 400 Bad Request."""
        self.client.force_authenticate(self.admin_user)
        url = reverse('audit-list')
        resp = self.client.get(url, HTTP_X_ORGANIZATION_ID='invalid_org')
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('organization_id', resp.data)

    def test_header_only_custom_actions_scoped(self):
        """Custom audit sub-actions respect header tenant scoping."""
        self.client.force_authenticate(self.admin_user)

        # 1. recent
        recent_url = reverse('audit-recent')
        rec_resp = self.client.get(
            recent_url,
            HTTP_X_ORGANIZATION_ID=str(self.org_a.id),
        )
        self.assertEqual(rec_resp.status_code, status.HTTP_200_OK)
        rec_ids = [r['id'] for r in rec_resp.data]
        self.assertIn(self.log_a.id, rec_ids)
        self.assertNotIn(self.log_b.id, rec_ids)

        # 2. by_user
        by_user_url = reverse('audit-by-user')
        bu_resp = self.client.get(
            by_user_url,
            {'user_id': self.admin_user.id},
            HTTP_X_ORGANIZATION_ID=str(self.org_a.id),
        )
        self.assertEqual(bu_resp.status_code, status.HTTP_200_OK)
        bu_ids = [r['id'] for r in bu_resp.data]
        self.assertIn(self.log_a.id, bu_ids)
        self.assertNotIn(self.log_b.id, bu_ids)

        # 3. by_action
        by_action_url = reverse('audit-by-action')
        ba_resp = self.client.get(
            by_action_url,
            {'action': 'test_action'},
            HTTP_X_ORGANIZATION_ID=str(self.org_a.id),
        )
        self.assertEqual(ba_resp.status_code, status.HTTP_200_OK)
        ba_ids = [r['id'] for r in ba_resp.data]
        self.assertIn(self.log_a.id, ba_ids)
        self.assertNotIn(self.log_b.id, ba_ids)

    def test_superuser_without_tenant_sees_all(self):
        """Superuser without tenant selector sees cross-tenant logs."""
        self.client.force_authenticate(self.superuser)
        url = reverse('audit-list')
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        results = (
            resp.data.get('results', resp.data)
            if isinstance(resp.data, dict)
            else resp.data
        )
        log_ids = [r['id'] for r in results]
        self.assertIn(self.log_a.id, log_ids)
        self.assertIn(self.log_b.id, log_ids)

    def test_superuser_with_header_is_scoped(self):
        """Superuser with header selector is scoped to that organization."""
        self.client.force_authenticate(self.superuser)
        url = reverse('audit-list')
        resp = self.client.get(
            url,
            HTTP_X_ORGANIZATION_ID=str(self.org_a.id),
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        results = (
            resp.data.get('results', resp.data)
            if isinstance(resp.data, dict)
            else resp.data
        )
        log_ids = [r['id'] for r in results]
        self.assertIn(self.log_a.id, log_ids)
        self.assertNotIn(self.log_b.id, log_ids)

    def test_superuser_conflicting_selectors_rejected(self):
        """Superuser with conflicting selectors gets 400 Bad Request."""
        self.client.force_authenticate(self.superuser)
        url = reverse('audit-list')
        resp = self.client.get(
            url,
            {'organization_id': self.org_b.id},
            HTTP_X_ORGANIZATION_ID=str(self.org_a.id),
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
