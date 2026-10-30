"""Tenant access must not grant authority over global user accounts."""

from datetime import date

from django.urls import reverse
from rest_framework.test import APITestCase

from apps.organizations.models import (
    JoinRequest, Membership, Organization, OrganizationRole, OrganizationUnit, PositionType, UnitType,
)
from apps.users.models import User


class GlobalAccountAuthorizationTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        cls.org_a = Organization.objects.create(name='A', code='ORG-A', description='A', period_year_start=date(2026, 1, 1))
        cls.org_b = Organization.objects.create(name='B', code='ORG-B', description='B', period_year_start=date(2026, 1, 1))
        cls.tenant_admin = User.objects.create_user(username='tenant-admin', email='tenant@example.test', password='tenant-pass')
        cls.member = User.objects.create_user(username='shared', email='shared@example.test', password='original-pass')
        cls.staff = User.objects.create_user(username='staff', email='staff@example.test', password='staff-pass', is_staff=True)
        cls.platform = User.objects.create_superuser(username='platform', email='platform@example.test', password='platform-pass')
        cls.inactive = User.objects.create_user(username='inactive', email='inactive@example.test', password='inactive-pass', is_active=False)
        for user, role in ((cls.tenant_admin, 'Admin'), (cls.member, 'Member'), (cls.staff, 'Member'), (cls.platform, 'Member')):
            OrganizationRole.objects.create(user=user, organization=cls.org_a, role=role)
        OrganizationRole.objects.create(user=cls.member, organization=cls.org_b, role='Admin')
        cls.request = JoinRequest.objects.create(user=cls.inactive, organization=cls.org_a)
        unit_type = UnitType.objects.create(organization_id=cls.org_a, name='Department')
        cls.unit = OrganizationUnit.objects.create(organization_id=cls.org_a, type_id=unit_type, name='Unit')
        cls.position = PositionType.objects.create(organization_id=cls.org_a, name='Officer', rank=1)

    def authenticate(self, user):
        self.client.force_authenticate(user)
        self.client.credentials(HTTP_X_ORGANIZATION_ID=str(self.org_a.pk))

    def test_tenant_admin_and_staff_cannot_mutate_global_accounts(self):
        for actor in (self.tenant_admin, self.staff):
            self.authenticate(actor)
            for target in (self.member, self.staff, self.platform, self.tenant_admin):
                url = reverse('users-detail', args=[target.pk])
                payload = {'email': 'hijack@example.test', 'username': 'hijack', 'is_active': False}
                for method in (self.client.patch, self.client.put):
                    with self.subTest(actor=actor.email, target=target.email, method=method.__name__):
                        self.assertEqual(method(url, payload, format='json').status_code, 403)
                self.assertEqual(self.client.delete(url).status_code, 403)
                response = self.client.post(reverse('users-set-password', args=[target.pk]),
                                            {'password': 'replacement123'}, format='json')
                self.assertEqual(response.status_code, 403)
                target.refresh_from_db()
                self.assertNotEqual(target.email, 'hijack@example.test')
                self.assertTrue(target.is_active)
                self.assertFalse(target.check_password('replacement123'))
            self.assertEqual(self.client.post(reverse('users-list'), {
                'email': 'new@example.test', 'password': 'replacement123',
            }, format='json').status_code, 403)
        self.assertFalse(User.objects.filter(email='new@example.test').exists())
        self.member.refresh_from_db()
        self.assertTrue(self.member.check_password('original-pass'))
        self.assertTrue(OrganizationRole.objects.filter(user=self.member, organization=self.org_b, role='Admin').exists())

    def test_platform_superuser_can_manage_global_accounts_with_tenant_context(self):
        self.authenticate(self.platform)
        url = reverse('users-detail', args=[self.member.pk])
        response = self.client.patch(url, {'email': 'updated@example.test'}, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        response = self.client.post(reverse('users-set-password', args=[self.member.pk]),
                                    {'password': 'replacement123'}, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        self.member.refresh_from_db()
        self.assertEqual(self.member.email, 'updated@example.test')
        self.assertTrue(self.member.check_password('replacement123'))
        self.assertEqual(self.client.delete(url).status_code, 204)
        self.member.refresh_from_db()
        self.assertFalse(self.member.is_active)
        self.assertTrue(User.objects.filter(pk=self.member.pk).exists())
        created = self.client.post(reverse('users-list'), {
            'email': 'created@example.test', 'password': 'replacement123',
        }, format='json')
        self.assertEqual(created.status_code, 201, created.data)

    def test_self_profile_and_organization_membership_management_remain_available(self):
        self.authenticate(self.member)
        response = self.client.patch(reverse('auth-me'), {'first_name': 'Updated'}, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        self.member.refresh_from_db()
        self.assertEqual(self.member.first_name, 'Updated')
        self.authenticate(self.tenant_admin)
        response = self.client.post(reverse('organizations-remove-member', args=[self.org_a.pk]),
                                    {'user_id': self.member.pk}, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        self.member.refresh_from_db()
        self.assertTrue(self.member.is_active)
        self.assertFalse(OrganizationRole.objects.get(user=self.member, organization=self.org_a).is_active)
        self.assertTrue(OrganizationRole.objects.get(user=self.member, organization=self.org_b).is_active)

    def test_join_approval_does_not_reactivate_global_user(self):
        self.authenticate(self.tenant_admin)
        response = self.client.post(reverse('join-requests-approve', args=[self.request.pk]), {
            'unit_id': self.unit.pk, 'position_id': self.position.pk,
        }, format='json')
        self.assertEqual(response.status_code, 400, response.data)
        self.inactive.refresh_from_db()
        self.request.refresh_from_db()
        self.assertFalse(self.inactive.is_active)
        self.assertEqual(self.request.status, 'Pending')
        self.assertFalse(OrganizationRole.objects.filter(user=self.inactive, organization=self.org_a).exists())
        self.assertFalse(Membership.objects.filter(user_id=self.inactive).exists())
