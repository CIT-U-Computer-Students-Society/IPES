"""Organization deletion must preserve the organization and its audit history."""

from datetime import date

from django.db.models.deletion import ProtectedError
from django.urls import reverse
from rest_framework.test import APITestCase

from apps.audit.models import AuditLog
from apps.organizations.models import Organization, OrganizationRole
from apps.users.models import User


class OrganizationDeletionTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        cls.organization = Organization.objects.create(
            name='Organization', code='ORG', description='Test', period_year_start=date(2026, 1, 1),
        )
        cls.admin = User.objects.create_user(username='admin', email='admin@example.test', password='secret123')
        cls.member = User.objects.create_user(username='member', email='member@example.test', password='secret123')
        cls.outsider = User.objects.create_user(username='outsider', email='outsider@example.test', password='secret123')
        OrganizationRole.objects.create(user=cls.admin, organization=cls.organization, role='Admin')
        OrganizationRole.objects.create(user=cls.member, organization=cls.organization, role='Member')
        cls.audit = AuditLog.objects.create(
            user_id=cls.admin, organization_id=cls.organization, action='historical event',
        )

    def test_generic_delete_rejected_for_all_roles_and_preserves_history(self):
        url = reverse('organizations-detail', args=[self.organization.pk])
        for user in (self.outsider, self.member, self.admin):
            with self.subTest(user=user.username):
                self.client.force_authenticate(user)
                response = self.client.delete(url)
                self.assertEqual(response.status_code, 405)
                self.assertTrue(Organization.objects.filter(pk=self.organization.pk, is_active=True).exists())
                self.assertTrue(AuditLog.objects.filter(pk=self.audit.pk, organization_id=self.organization).exists())

    def test_only_authorized_confirmed_soft_deletion_preserves_history(self):
        url = reverse('organizations-delete-organization', args=[self.organization.pk])
        for user in (self.outsider, self.member):
            with self.subTest(user=user.username):
                self.client.force_authenticate(user)
                response = self.client.post(url, {'code': 'ORG', 'password': 'secret123'}, format='json')
                self.assertEqual(response.status_code, 403)
                self.assertTrue(Organization.objects.filter(pk=self.organization.pk, is_active=True).exists())
        self.client.force_authenticate(self.admin)
        response = self.client.post(url, {'code': 'ORG', 'password': 'wrong'}, format='json')
        self.assertEqual(response.status_code, 400)
        self.assertTrue(Organization.objects.filter(pk=self.organization.pk, is_active=True).exists())
        response = self.client.post(url, {'code': 'ORG', 'password': 'secret123'}, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertTrue(Organization.objects.filter(pk=self.organization.pk, is_active=False).exists())
        self.assertTrue(AuditLog.objects.filter(pk=self.audit.pk, organization_id=self.organization).exists())

    def test_orm_parent_deletion_cannot_cascade_through_audit_history(self):
        with self.assertRaises(ProtectedError):
            self.organization.delete()
        self.assertTrue(Organization.objects.filter(pk=self.organization.pk).exists())
        self.assertTrue(AuditLog.objects.filter(pk=self.audit.pk).exists())
