"""Approval and rejection require current active tenant administration."""

from datetime import date

from django.urls import reverse
from rest_framework.test import APITestCase

from apps.organizations.models import (
    JoinRequest, Organization, OrganizationRole, OrganizationUnit, PositionType, UnitType,
)
from apps.users.models import User


class JoinRequestApprovalAccessTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        cls.org = Organization.objects.create(name='One', code='ONE', description='Test', period_year_start=date(2026, 1, 1))
        cls.other_org = Organization.objects.create(name='Two', code='TWO', description='Other', period_year_start=date(2026, 1, 1))
        cls.admin = User.objects.create_user(username='admin', email='admin@example.test')
        cls.revoked = User.objects.create_user(username='revoked', email='revoked@example.test')
        cls.member = User.objects.create_user(username='member', email='member@example.test')
        cls.other_admin = User.objects.create_user(username='other-admin', email='other-admin@example.test')
        cls.applicant = User.objects.create_user(username='applicant', email='applicant@example.test')
        OrganizationRole.objects.create(user=cls.admin, organization=cls.org, role='Admin')
        OrganizationRole.objects.create(user=cls.revoked, organization=cls.org, role='Admin', is_active=False)
        OrganizationRole.objects.create(user=cls.member, organization=cls.org, role='Member')
        OrganizationRole.objects.create(user=cls.other_admin, organization=cls.other_org, role='Admin')
        cls.application = JoinRequest.objects.create(user=cls.applicant, organization=cls.org)
        cls.revoked_application = JoinRequest.objects.create(user=cls.revoked, organization=cls.org)
        unit_type = UnitType.objects.create(organization_id=cls.org, name='Department')
        cls.unit = OrganizationUnit.objects.create(organization_id=cls.org, type_id=unit_type, name='Unit')
        cls.position = PositionType.objects.create(organization_id=cls.org, name='Officer', rank=1)

    def action(self, name, application=None):
        target = application or self.application
        return self.client.post(reverse(f'join-requests-{name}', args=[target.pk]), {
            'unit_id': self.unit.pk, 'position_id': self.position.pk, 'role': 'Admin',
        }, format='json')

    def test_revoked_admin_cannot_approve_or_reject_even_own_request(self):
        self.client.force_authenticate(self.revoked)
        self.client.credentials(HTTP_X_ORGANIZATION_ID=str(self.org.pk))
        for name in ('approve', 'reject'):
            for application in (self.application, self.revoked_application):
                with self.subTest(action=name, own=application == self.revoked_application):
                    self.assertEqual(self.action(name, application).status_code, 403)
                    application.refresh_from_db()
                    self.assertEqual(application.status, 'Pending')
        self.assertFalse(OrganizationRole.objects.filter(user=self.applicant, organization=self.org).exists())

    def test_admin_of_inactive_organization_has_no_authority(self):
        self.org.is_active = False
        self.org.save(update_fields=['is_active'])
        self.client.force_authenticate(self.admin)
        self.client.credentials(HTTP_X_ORGANIZATION_ID=str(self.org.pk))
        for name in ('approve', 'reject'):
            with self.subTest(action=name):
                self.assertEqual(self.action(name).status_code, 403)
                self.application.refresh_from_db()
                self.assertEqual(self.application.status, 'Pending')

    def test_member_and_admin_of_other_tenant_cannot_manage_request(self):
        for user, org in ((self.member, self.org), (self.other_admin, self.org), (self.other_admin, self.other_org)):
            self.client.force_authenticate(user)
            self.client.credentials(HTTP_X_ORGANIZATION_ID=str(org.pk))
            for name in ('approve', 'reject'):
                with self.subTest(user=user.username, action=name):
                    self.assertIn(self.action(name).status_code, (403, 404))
                    self.application.refresh_from_db()
                    self.assertEqual(self.application.status, 'Pending')
        self.assertFalse(OrganizationRole.objects.filter(user=self.applicant, organization=self.org).exists())

    def test_matching_active_admin_can_approve_and_reject(self):
        self.client.force_authenticate(self.admin)
        self.client.credentials(HTTP_X_ORGANIZATION_ID=str(self.org.pk))
        self.assertEqual(self.action('approve').status_code, 200)
        self.application.refresh_from_db()
        self.assertEqual(self.application.status, 'Approved')
        self.assertTrue(OrganizationRole.objects.filter(
            user=self.applicant, organization=self.org, role='Admin', is_active=True,
        ).exists())
        self.assertEqual(self.action('reject', self.revoked_application).status_code, 200)
        self.revoked_application.refresh_from_db()
        self.assertEqual(self.revoked_application.status, 'Rejected')

    def test_missing_or_conflicting_tenant_context_is_rejected(self):
        self.client.force_authenticate(self.admin)
        self.client.credentials()
        self.assertEqual(self.action('reject').status_code, 400)
        self.client.credentials(HTTP_X_ORGANIZATION_ID=str(self.org.pk))
        url = reverse('join-requests-reject', args=[self.application.pk])
        self.assertEqual(self.client.post(url, {'organization_id': self.other_org.pk}, format='json',
                                          QUERY_STRING=f'organization_id={self.other_org.pk}').status_code, 400)
        self.application.refresh_from_db()
        self.assertEqual(self.application.status, 'Pending')
