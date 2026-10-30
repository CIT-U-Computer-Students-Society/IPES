"""Managed-user responses expose membership details only for the selected tenant."""

from datetime import date

from django.urls import reverse
from rest_framework.test import APITestCase

from apps.organizations.models import (
    Membership, Organization, OrganizationRole, OrganizationUnit, PositionType, UnitType,
)
from apps.users.models import User


class TenantMembershipPrivacyTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        cls.org_a = Organization.objects.create(name='Public A', code='ORG-A', description='A', email='a@example.test', period_year_start=date(2026, 1, 1))
        cls.org_b = Organization.objects.create(name='Private B', code='ORG-B', description='B', email='private@example.test', period_year_start=date(2026, 1, 1))
        cls.org_c = Organization.objects.create(name='Inactive role C', code='ORG-C', description='C', period_year_start=date(2026, 1, 1))
        cls.admin = User.objects.create_user(username='admin', email='admin@example.test')
        cls.shared = User.objects.create_user(username='shared', email='shared@example.test')
        OrganizationRole.objects.create(user=cls.admin, organization=cls.org_a, role='Admin')
        OrganizationRole.objects.create(user=cls.shared, organization=cls.org_a, role='Member')
        OrganizationRole.objects.create(user=cls.shared, organization=cls.org_b, role='Admin')
        OrganizationRole.objects.create(user=cls.shared, organization=cls.org_c, role='Member', is_active=False)
        a_type = UnitType.objects.create(organization_id=cls.org_a, name='Committee')
        b_type = UnitType.objects.create(organization_id=cls.org_b, name='Private type')
        a_unit = OrganizationUnit.objects.create(organization_id=cls.org_a, type_id=a_type, name='A unit')
        b_unit = OrganizationUnit.objects.create(organization_id=cls.org_b, type_id=b_type, name='Private unit')
        a_first = PositionType.objects.create(organization_id=cls.org_a, name='A first', rank=1)
        a_second = PositionType.objects.create(organization_id=cls.org_a, name='A second', rank=2)
        a_old = PositionType.objects.create(organization_id=cls.org_a, name='A inactive', rank=3)
        b_position = PositionType.objects.create(organization_id=cls.org_b, name='Private position', rank=1)
        for unit, position, active in ((a_unit, a_first, True), (a_unit, a_second, True),
                                       (a_unit, a_old, False), (b_unit, b_position, True)):
            Membership.objects.create(user_id=cls.shared, unit_id=unit, position_id=position,
                                      date_start=date(2026, 1, 1), is_active=active)

    def test_admin_list_and_detail_expose_only_selected_organization(self):
        self.client.force_authenticate(self.admin)
        self.client.credentials(HTTP_X_ORGANIZATION_ID=str(self.org_a.pk))
        listing = self.client.get(reverse('users-list'))
        self.assertEqual(listing.status_code, 200, listing.data)
        listed = next(row for row in listing.data['results'] if row['id'] == self.shared.pk)
        detail = self.client.get(reverse('users-detail', args=[self.shared.pk]))
        self.assertEqual(detail.status_code, 200, detail.data)
        for payload in (listed, detail.data):
            with self.subTest(endpoint='list' if payload is listed else 'detail'):
                memberships = payload['memberships']
                self.assertEqual({m['organization_id'] for m in memberships}, {self.org_a.pk})
                self.assertEqual({m['position_name'] for m in memberships}, {'A first', 'A second'})
                self.assertEqual({m['role'] for m in memberships}, {'Member'})
                self.assertNotIn('private@example.test', str(payload))
                self.assertNotIn('Private unit', str(payload))
                self.assertNotIn('Private position', str(payload))

    def test_admin_switching_tenant_sees_only_the_selected_memberships(self):
        OrganizationRole.objects.create(user=self.admin, organization=self.org_b, role='Admin')
        self.client.force_authenticate(self.admin)
        for org, expected_position in ((self.org_a, 'A first'), (self.org_b, 'Private position')):
            with self.subTest(organization=org.pk):
                self.client.credentials(HTTP_X_ORGANIZATION_ID=str(org.pk))
                response = self.client.get(reverse('users-detail', args=[self.shared.pk]))
                self.assertEqual(response.status_code, 200, response.data)
                self.assertEqual({m['organization_id'] for m in response.data['memberships']}, {org.pk})
                self.assertIn(expected_position, {m['position_name'] for m in response.data['memberships']})

    def test_self_profile_keeps_active_organizations_for_selector(self):
        self.client.force_authenticate(self.shared)
        self.client.credentials(HTTP_X_ORGANIZATION_ID=str(self.org_a.pk))
        response = self.client.get(reverse('auth-me'))
        self.assertEqual(response.status_code, 200, response.data)
        memberships = response.data['memberships']
        self.assertEqual({m['organization_id'] for m in memberships}, {self.org_a.pk, self.org_b.pk})
        b_membership = next(m for m in memberships if m['organization_id'] == self.org_b.pk)
        self.assertEqual(b_membership['role'], 'Admin')
        self.assertEqual(b_membership['position_name'], 'Private position')
        self.assertNotIn('A inactive', {m['position_name'] for m in memberships})

    def test_unverified_tenant_context_does_not_expose_shared_user(self):
        self.client.force_authenticate(self.admin)
        for org in (None, self.org_b):
            with self.subTest(org=org):
                self.client.credentials(**({'HTTP_X_ORGANIZATION_ID': str(org.pk)} if org else {}))
                listing = self.client.get(reverse('users-list'))
                self.assertEqual(listing.status_code, 200)
                self.assertEqual(listing.data['results'], [])
                self.assertEqual(self.client.get(reverse('users-detail', args=[self.shared.pk])).status_code, 404)
