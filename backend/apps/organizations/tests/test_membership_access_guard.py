from datetime import date
from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.organizations.models import (
    Membership,
    Organization,
    OrganizationRole,
    OrganizationUnit,
    PositionType,
    UnitType,
)
from apps.users.models import User


class MembershipAccessGuardTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.password = 'Pass123!Secure'
        cls.org_a = Organization.objects.create(
            name='Org Alpha',
            code='ALPHA88',
            description='First organization',
            period_year_start=date(2026, 1, 1),
            is_active=True,
        )
        cls.org_b = Organization.objects.create(
            name='Org Beta',
            code='BETA88',
            description='Second organization',
            period_year_start=date(2026, 1, 1),
            is_active=True,
        )

        cls.admin_user = User.objects.create_user(
            username='guard_admin',
            email='guard_admin@cit.edu',
            password=cls.password,
            first_name='Admin',
            last_name='User',
        )
        OrganizationRole.objects.create(
            user=cls.admin_user,
            organization=cls.org_a,
            role='Admin',
            is_active=True,
        )

        cls.active_member = User.objects.create_user(
            username='guard_member',
            email='guard_member@cit.edu',
            password=cls.password,
            first_name='Active',
            last_name='Member',
        )
        OrganizationRole.objects.create(
            user=cls.active_member,
            organization=cls.org_a,
            role='Member',
            is_active=True,
        )

        cls.revoked_member = User.objects.create_user(
            username='guard_revoked',
            email='guard_revoked@cit.edu',
            password=cls.password,
            first_name='Revoked',
            last_name='Member',
        )
        OrganizationRole.objects.create(
            user=cls.revoked_member,
            organization=cls.org_a,
            role='Member',
            is_active=False,
        )

        cls.unrelated_user = User.objects.create_user(
            username='guard_unrelated',
            email='guard_unrelated@cit.edu',
            password=cls.password,
            first_name='Unrelated',
            last_name='User',
        )

        cls.unit_type_a = UnitType.objects.create(
            organization_id=cls.org_a,
            name='Alpha Committee',
        )
        cls.unit_a = OrganizationUnit.objects.create(
            organization_id=cls.org_a,
            type_id=cls.unit_type_a,
            name='Engineering',
            is_active=True,
        )
        cls.inactive_unit_a = OrganizationUnit.objects.create(
            organization_id=cls.org_a,
            type_id=cls.unit_type_a,
            name='Old Engineering',
            is_active=False,
        )

        cls.position_a = PositionType.objects.create(
            organization_id=cls.org_a,
            name='Developer',
            rank=2,
            is_active=True,
        )
        cls.inactive_position_a = PositionType.objects.create(
            organization_id=cls.org_a,
            name='Intern',
            rank=3,
            is_active=False,
        )

        cls.unit_type_b = UnitType.objects.create(
            organization_id=cls.org_b,
            name='Beta Committee',
        )
        cls.unit_b = OrganizationUnit.objects.create(
            organization_id=cls.org_b,
            type_id=cls.unit_type_b,
            name='Beta Logistics',
            is_active=True,
        )
        cls.position_b = PositionType.objects.create(
            organization_id=cls.org_b,
            name='Coordinator',
            rank=1,
            is_active=True,
        )

    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(self.admin_user)
        self.client.credentials(HTTP_X_ORGANIZATION_ID=str(self.org_a.id))

    def test_create_membership_fails_without_organization_role(self):
        """Creating membership for user with no org role returns 400."""
        url = reverse('memberships-list')
        resp = self.client.post(url, {
            'user_id': self.unrelated_user.id,
            'unit_id': self.unit_a.id,
            'position_id': self.position_a.id,
        }, format='json')

        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('user_id', resp.data)
        self.assertIn(
            'User must have an active organization role',
            str(resp.data['user_id']),
        )
        self.assertFalse(
            Membership.objects.filter(
                user_id=self.unrelated_user, unit_id=self.unit_a
            ).exists()
        )

    def test_create_membership_fails_with_inactive_organization_role(self):
        """Membership creation with deactivated org role returns 400."""
        url = reverse('memberships-list')
        resp = self.client.post(url, {
            'user_id': self.revoked_member.id,
            'unit_id': self.unit_a.id,
            'position_id': self.position_a.id,
        }, format='json')

        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('user_id', resp.data)
        self.assertFalse(
            Membership.objects.filter(
                user_id=self.revoked_member, unit_id=self.unit_a
            ).exists()
        )

    def test_create_membership_fails_for_inactive_user_account(self):
        """Creating membership for globally deactivated account returns 400."""
        self.active_member.is_active = False
        self.active_member.save(update_fields=['is_active'])

        url = reverse('memberships-list')
        resp = self.client.post(url, {
            'user_id': self.active_member.id,
            'unit_id': self.unit_a.id,
            'position_id': self.position_a.id,
        }, format='json')

        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('user_id', resp.data)
        self.assertIn('inactive', str(resp.data['user_id']).lower())

    def test_create_membership_succeeds_with_active_organization_role(self):
        """Creating membership for user with active role succeeds."""
        url = reverse('memberships-list')
        resp = self.client.post(url, {
            'user_id': self.active_member.id,
            'unit_id': self.unit_a.id,
            'position_id': self.position_a.id,
        }, format='json')

        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertTrue(
            Membership.objects.filter(
                user_id=self.active_member,
                unit_id=self.unit_a,
                position_id=self.position_a,
                is_active=True,
            ).exists()
        )

    def test_create_membership_fails_with_inactive_unit(self):
        """Cannot assign membership to an inactive unit."""
        url = reverse('memberships-list')
        resp = self.client.post(url, {
            'user_id': self.active_member.id,
            'unit_id': self.inactive_unit_a.id,
            'position_id': self.position_a.id,
        }, format='json')

        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('unit_id', resp.data)

    def test_create_membership_fails_with_inactive_position(self):
        """Cannot assign membership to an inactive position."""
        url = reverse('memberships-list')
        resp = self.client.post(url, {
            'user_id': self.active_member.id,
            'unit_id': self.unit_a.id,
            'position_id': self.inactive_position_a.id,
        }, format='json')

        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('position_id', resp.data)

    def test_create_membership_fails_with_cross_org_position(self):
        """Position must belong to the unit's organization."""
        url = reverse('memberships-list')
        resp = self.client.post(url, {
            'user_id': self.active_member.id,
            'unit_id': self.unit_a.id,
            'position_id': self.position_b.id,
        }, format='json')

        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('position_id', resp.data)

    def test_transfer_membership_to_user_without_role_fails(self):
        """Updating membership to a user without active role returns 400."""
        membership = Membership.objects.create(
            user_id=self.active_member,
            unit_id=self.unit_a,
            position_id=self.position_a,
            date_start=date(2026, 1, 1),
            is_active=True,
        )
        url = reverse('memberships-detail', kwargs={'pk': membership.id})
        resp = self.client.patch(url, {
            'user_id': self.unrelated_user.id,
        }, format='json')

        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('user_id', resp.data)
        membership.refresh_from_db()
        self.assertEqual(membership.user_id, self.active_member)

    def test_deactivate_membership_succeeds_even_when_role_inactive(self):
        """Deactivating an existing membership does not require active role."""
        membership = Membership.objects.create(
            user_id=self.revoked_member,
            unit_id=self.unit_a,
            position_id=self.position_a,
            date_start=date(2026, 1, 1),
            is_active=True,
        )
        url = reverse('memberships-detail', kwargs={'pk': membership.id})
        resp = self.client.patch(url, {'is_active': False}, format='json')

        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        membership.refresh_from_db()
        self.assertFalse(membership.is_active)

    def test_outsider_cannot_create_membership(self):
        """Non-admin user receives 403 Forbidden creating membership."""
        self.client.force_authenticate(self.active_member)
        url = reverse('memberships-list')
        resp = self.client.post(url, {
            'user_id': self.active_member.id,
            'unit_id': self.unit_a.id,
            'position_id': self.position_a.id,
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)
