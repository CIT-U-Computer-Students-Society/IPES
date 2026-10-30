"""Reactivated memberships must satisfy the same access rules as new ones."""

from datetime import date

from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from apps.organizations.models import Membership, Organization, OrganizationRole, OrganizationUnit, PositionType, UnitType
from apps.users.models import User


class ReactivationAccessValidationTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        cls.org = Organization.objects.create(name='One', code='ONE', description='Test', period_year_start=date(2026, 1, 1))
        cls.other_org = Organization.objects.create(name='Two', code='TWO', description='Other', period_year_start=date(2026, 1, 1))
        cls.admin = User.objects.create_user(username='admin', email='admin@example.test')
        cls.member = User.objects.create_user(username='member', email='member@example.test')
        OrganizationRole.objects.create(user=cls.admin, organization=cls.org, role='Admin')
        cls.role = OrganizationRole.objects.create(user=cls.member, organization=cls.org, role='Member')
        unit_type = UnitType.objects.create(organization_id=cls.org, name='Department')
        cls.unit = OrganizationUnit.objects.create(organization_id=cls.org, type_id=unit_type, name='Unit')
        cls.position = PositionType.objects.create(organization_id=cls.org, name='Officer', rank=1)
        cls.membership = Membership.objects.create(user_id=cls.member, unit_id=cls.unit, position_id=cls.position,
                                                    date_start=date(2026, 1, 1), date_end=date(2026, 2, 1), is_active=False)

    def setUp(self):
        self.client.force_authenticate(self.admin)
        self.client.credentials(HTTP_X_ORGANIZATION_ID=str(self.org.pk))
        self.url = reverse('memberships-list')
        self.payload = {'user_id': self.member.pk, 'unit_id': self.unit.pk, 'position_id': self.position.pk}

    def assert_reactivation_rejected(self, expected_field):
        response = self.client.post(self.url, self.payload, format='json')
        self.assertEqual(response.status_code, 400, response.data)
        self.assertIn(expected_field, response.data)
        self.membership.refresh_from_db()
        self.assertFalse(self.membership.is_active)
        self.assertEqual(self.membership.date_end, date(2026, 2, 1))

    def test_revoked_role_is_rejected(self):
        self.role.is_active = False
        self.role.save(update_fields=['is_active'])
        self.assert_reactivation_rejected('user_id')

    def test_missing_role_is_rejected(self):
        self.role.delete()
        self.assert_reactivation_rejected('user_id')

    def test_inactive_user_is_rejected(self):
        self.member.is_active = False
        self.member.save(update_fields=['is_active'])
        self.assert_reactivation_rejected('user_id')

    def test_inactive_unit_is_rejected(self):
        self.unit.is_active = False
        self.unit.save(update_fields=['is_active'])
        self.assert_reactivation_rejected('unit_id')

    def test_inactive_position_is_rejected(self):
        self.position.is_active = False
        self.position.save(update_fields=['is_active'])
        self.assert_reactivation_rejected('position_id')

    def test_foreign_organization_reactivation_is_rejected_even_for_admin_of_both(self):
        OrganizationRole.objects.create(user=self.admin, organization=self.other_org, role='Admin')
        OrganizationRole.objects.create(user=self.member, organization=self.other_org, role='Member')
        unit_type = UnitType.objects.create(organization_id=self.other_org, name='Other type')
        unit = OrganizationUnit.objects.create(organization_id=self.other_org, type_id=unit_type, name='Other unit')
        position = PositionType.objects.create(organization_id=self.other_org, name='Other position', rank=1)
        other = Membership.objects.create(user_id=self.member, unit_id=unit, position_id=position,
                                          date_start=date(2026, 1, 1), date_end=date(2026, 2, 1), is_active=False)
        response = self.client.post(self.url, {'user_id': self.member.pk, 'unit_id': unit.pk, 'position_id': position.pk}, format='json')
        self.assertEqual(response.status_code, 400, response.data)
        other.refresh_from_db()
        self.assertFalse(other.is_active)
        self.assertEqual(other.date_end, date(2026, 2, 1))

    def test_valid_reactivation_reuses_assignment_and_resets_dates(self):
        response = self.client.post(self.url, self.payload, format='json')
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data['id'], self.membership.pk)
        self.membership.refresh_from_db()
        self.assertTrue(self.membership.is_active)
        self.assertIsNone(self.membership.date_end)
        self.assertEqual(self.membership.date_start, timezone.now().date())
        self.assertEqual(Membership.objects.filter(user_id=self.member, unit_id=self.unit, position_id=self.position).count(), 1)

    def test_malformed_membership_id_fields_return_validation_errors(self):
        for field in ('user_id', 'unit_id', 'position_id'):
            with self.subTest(field=field):
                payload = {**self.payload, field: 'not-an-id'}
                response = self.client.post(self.url, payload, format='json')
                self.assertEqual(response.status_code, 400, response.data)
                self.assertIn(field, response.data)
        self.membership.refresh_from_db()
        self.assertFalse(self.membership.is_active)
