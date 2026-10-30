"""Tenant authorization and lifecycle rules for organization updates."""

from datetime import date

from django.urls import reverse
from rest_framework.test import APITestCase

from apps.audit.models import AuditLog
from apps.organizations.models import Organization, OrganizationRole
from apps.users.models import User


class OrganizationUpdateTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        cls.org = Organization.objects.create(
            name='Original', code='ONE', description='Original description', period_year_start=date(2026, 1, 1),
        )
        cls.other = Organization.objects.create(
            name='Other', code='TWO', description='Other', period_year_start=date(2026, 1, 1),
        )
        cls.admin = User.objects.create_user(username='admin', email='admin@example.test')
        cls.member = User.objects.create_user(username='member', email='member@example.test')
        cls.revoked = User.objects.create_user(username='revoked', email='revoked@example.test')
        cls.outsider = User.objects.create_user(username='outsider', email='outsider@example.test')
        OrganizationRole.objects.create(user=cls.admin, organization=cls.org, role='Admin')
        OrganizationRole.objects.create(user=cls.member, organization=cls.org, role='Member')
        OrganizationRole.objects.create(user=cls.revoked, organization=cls.org, role='Admin', is_active=False)
        OrganizationRole.objects.create(user=cls.outsider, organization=cls.other, role='Admin')
        cls.url = reverse('organizations-detail', args=[cls.org.pk])

    def test_unauthorized_users_cannot_update_or_deactivate(self):
        for user, active_org in ((self.member, self.org), (self.revoked, self.org),
                                 (self.outsider, self.org), (self.outsider, self.other)):
            self.client.force_authenticate(user)
            self.client.credentials(HTTP_X_ORGANIZATION_ID=str(active_org.pk))
            for method in (self.client.patch, self.client.put):
                with self.subTest(user=user.username, organization=active_org.pk, method=method.__name__):
                    response = method(self.url, {
                        'name': 'Unauthorized', 'code': 'ONE', 'description': 'Changed',
                        'period_year_start': '2026-01-01', 'is_active': False,
                    }, format='json')
                    self.assertEqual(response.status_code, 403, response.data)
                    self.org.refresh_from_db()
                    self.assertEqual(self.org.name, 'Original')
                    self.assertTrue(self.org.is_active)
                    self.assertFalse(AuditLog.objects.exists())

    def test_active_admin_can_patch_and_put_with_audited_changes(self):
        self.client.force_authenticate(self.admin)
        self.client.credentials(HTTP_X_ORGANIZATION_ID=str(self.org.pk))
        response = self.client.patch(self.url, {'name': 'Renamed'}, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        event = AuditLog.objects.get()
        self.assertEqual(event.user_id, self.admin)
        self.assertEqual(event.organization_id, self.org)
        self.assertIn('organization.updated', event.action)
        self.assertIn('name', event.action)
        response = self.client.put(self.url, {
            'name': 'Renamed', 'code': 'ONE', 'description': 'New description',
            'period_year_start': '2026-01-01', 'is_active': True,
        }, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        self.org.refresh_from_db()
        self.assertEqual(self.org.description, 'New description')
        self.assertEqual(AuditLog.objects.filter(organization_id=self.org, user_id=self.admin).count(), 2)

    def test_deactivation_and_invalid_updates_leave_state_and_audit_unchanged(self):
        self.client.force_authenticate(self.admin)
        self.client.credentials(HTTP_X_ORGANIZATION_ID=str(self.org.pk))
        for payload in ({'is_active': False, 'name': 'Changed'}, {'period_year_end': '2025-01-01'}):
            with self.subTest(payload=payload):
                response = self.client.patch(self.url, payload, format='json')
                self.assertEqual(response.status_code, 400, response.data)
                self.org.refresh_from_db()
                self.assertTrue(self.org.is_active)
                self.assertEqual(self.org.name, 'Original')
                self.assertFalse(AuditLog.objects.exists())

    def test_update_requires_matching_active_organization(self):
        self.client.force_authenticate(self.admin)
        self.client.credentials()
        self.assertEqual(self.client.patch(self.url, {'name': 'No context'}, format='json').status_code, 400)
        self.client.credentials(HTTP_X_ORGANIZATION_ID=str(self.other.pk))
        self.assertEqual(self.client.patch(self.url, {'name': 'Wrong context'}, format='json').status_code, 403)
        self.assertFalse(AuditLog.objects.exists())
