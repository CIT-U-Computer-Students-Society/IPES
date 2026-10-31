"""
Regression tests for organization structure and membership audit logging.
Covers Issue #277.
"""

from datetime import date
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.audit.models import AuditLog
from apps.audit.utils import AuditActions
from apps.organizations.models import (
    Membership, Organization, OrganizationRole, OrganizationUnit,
    PositionType, UnitType,
)
from apps.users.models import User


class StructureAuditLoggingTests(APITestCase):
    """
    Verify administrative mutations to unit types, units, positions, and
    memberships emit audit logs with actor, authoritative organization,
    target identity, and changed-field context.
    """

    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        cls.org = Organization.objects.create(
            name='Alpha Org', code='ALPHA', description='Alpha Org',
            period_year_start=date(2026, 1, 1), is_active=True,
        )
        cls.other_org = Organization.objects.create(
            name='Beta Org', code='BETA', description='Beta Org',
            period_year_start=date(2026, 1, 1), is_active=True,
        )

        cls.admin = User.objects.create_user(
            username='admin_user', email='admin@alpha.org',
        )
        cls.member = User.objects.create_user(
            username='member_user', email='member@alpha.org',
        )
        cls.unrelated = User.objects.create_user(
            username='unrelated_user', email='unrelated@beta.org',
        )

        OrganizationRole.objects.create(
            user=cls.admin, organization=cls.org, role='Admin', is_active=True,
        )
        OrganizationRole.objects.create(
            user=cls.member, organization=cls.org, role='Member',
            is_active=True,
        )
        OrganizationRole.objects.create(
            user=cls.unrelated, organization=cls.other_org, role='Member',
            is_active=True,
        )

    def setUp(self):
        super().setUp()
        self.client.force_authenticate(self.admin)
        self.client.credentials(
            HTTP_X_ORGANIZATION_ID=str(self.org.id),
        )

    def test_unit_type_lifecycle_audited(self):
        """Unit type create, update, and deactivation emit audit logs."""
        # 1. Create
        url = reverse('unit-types-list')
        resp = self.client.post(url, {
            'name': 'Executive',
            'organization_id': self.org.id,
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        unit_type_id = resp.data['id']

        log = AuditLog.objects.filter(
            action__startswith=AuditActions.UNIT_TYPE_CREATED,
            organization_id_id=self.org.id,
        ).first()
        self.assertIsNotNone(log)
        self.assertEqual(log.user_id, self.admin)
        self.assertIn(f'unit_type_id={unit_type_id}', log.action)
        self.assertIn('name=Executive', log.action)

        # 2. Update
        detail_url = reverse('unit-types-detail', args=[unit_type_id])
        resp = self.client.patch(detail_url, {'name': 'Executive Council'})
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

        update_log = AuditLog.objects.filter(
            action__startswith=AuditActions.UNIT_TYPE_UPDATED,
            organization_id_id=self.org.id,
        ).first()
        self.assertIsNotNone(update_log)
        self.assertIn('fields=name', update_log.action)
        self.assertIn('name=Executive Council', update_log.action)

        # 3. Deactivate
        resp = self.client.delete(detail_url)
        self.assertEqual(resp.status_code, status.HTTP_204_NO_CONTENT)

        deact_log = AuditLog.objects.filter(
            action__startswith=AuditActions.UNIT_TYPE_DEACTIVATED,
            organization_id_id=self.org.id,
        ).first()
        self.assertIsNotNone(deact_log)

    def test_unit_lifecycle_audited(self):
        """Unit create, update, and deactivation emit audit logs."""
        unit_type = UnitType.objects.create(
            name='Standing Committee', organization_id=self.org,
        )

        # 1. Create
        url = reverse('units-list')
        resp = self.client.post(url, {
            'name': 'Logistics Committee',
            'organization_id': self.org.id,
            'type_id': unit_type.id,
            'description': 'Handles logistics',
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        unit_id = resp.data['id']

        log = AuditLog.objects.filter(
            action__startswith=AuditActions.UNIT_CREATED,
            organization_id_id=self.org.id,
        ).first()
        self.assertIsNotNone(log)
        self.assertEqual(log.user_id, self.admin)
        self.assertIn(f'unit_id={unit_id}', log.action)
        self.assertIn('name=Logistics Committee', log.action)

        # 2. Update
        detail_url = reverse('units-detail', args=[unit_id])
        resp = self.client.patch(detail_url, {'description': 'New desc'})
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

        update_log = AuditLog.objects.filter(
            action__startswith=AuditActions.UNIT_UPDATED,
            organization_id_id=self.org.id,
        ).first()
        self.assertIsNotNone(update_log)
        self.assertIn('fields=description', update_log.action)

        # 3. Deactivate
        resp = self.client.delete(detail_url)
        self.assertEqual(resp.status_code, status.HTTP_204_NO_CONTENT)

        deact_log = AuditLog.objects.filter(
            action__startswith=AuditActions.UNIT_DEACTIVATED,
            organization_id_id=self.org.id,
        ).first()
        self.assertIsNotNone(deact_log)

    def test_position_lifecycle_audited(self):
        """Position create, update, and deactivation emit audit logs."""
        # 1. Create
        url = reverse('positions-list')
        resp = self.client.post(url, {
            'name': 'Director',
            'rank': 2,
            'organization_id': self.org.id,
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        position_id = resp.data['id']

        log = AuditLog.objects.filter(
            action__startswith=AuditActions.POSITION_CREATED,
            organization_id_id=self.org.id,
        ).first()
        self.assertIsNotNone(log)
        self.assertEqual(log.user_id, self.admin)
        self.assertIn(f'position_id={position_id}', log.action)
        self.assertIn('name=Director', log.action)

        # 2. Update
        detail_url = reverse('positions-detail', args=[position_id])
        resp = self.client.patch(detail_url, {'rank': 1})
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

        update_log = AuditLog.objects.filter(
            action__startswith=AuditActions.POSITION_UPDATED,
            organization_id_id=self.org.id,
        ).first()
        self.assertIsNotNone(update_log)
        self.assertIn('fields=rank', update_log.action)

        # 3. Deactivate
        resp = self.client.delete(detail_url)
        self.assertEqual(resp.status_code, status.HTTP_204_NO_CONTENT)

        deact_log = AuditLog.objects.filter(
            action__startswith=AuditActions.POSITION_DEACTIVATED,
            organization_id_id=self.org.id,
        ).first()
        self.assertIsNotNone(deact_log)

    def test_membership_lifecycle_audited(self):
        """
        Positional membership creation, deactivation, and reactivation
        emit logs.
        """
        unit_type = UnitType.objects.create(
            name='UT1', organization_id=self.org, is_active=True,
        )
        unit = OrganizationUnit.objects.create(
            name='Unit 1', organization_id=self.org, is_active=True,
            type_id=unit_type,
        )
        pos = PositionType.objects.create(
            name='Pos 1', rank=1, organization_id=self.org, is_active=True,
        )

        # 1. Create membership
        url = reverse('memberships-list')
        resp = self.client.post(url, {
            'user_id': self.member.id,
            'unit_id': unit.id,
            'position_id': pos.id,
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        membership_id = resp.data['id']

        create_log = AuditLog.objects.filter(
            action__startswith=AuditActions.MEMBERSHIP_CREATED,
            organization_id_id=self.org.id,
        ).first()
        self.assertIsNotNone(create_log)
        self.assertIn(f'membership_id={membership_id}', create_log.action)
        self.assertIn(f'target_user_id={self.member.id}', create_log.action)

        # 2. Deactivate via PATCH is_active=False
        detail_url = reverse('memberships-detail', args=[membership_id])
        resp = self.client.patch(detail_url, {'is_active': False})
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

        deact_log = AuditLog.objects.filter(
            action__startswith=AuditActions.MEMBERSHIP_DEACTIVATED,
            organization_id_id=self.org.id,
        ).first()
        self.assertIsNotNone(deact_log)
        self.assertIn(f'membership_id={membership_id}', deact_log.action)

        # 3. Reactivate via POST existing inactive
        resp = self.client.post(url, {
            'user_id': self.member.id,
            'unit_id': unit.id,
            'position_id': pos.id,
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)

        react_log = AuditLog.objects.filter(
            action__startswith=AuditActions.MEMBERSHIP_ACTIVATED,
            organization_id_id=self.org.id,
        ).first()
        self.assertIsNotNone(react_log)

    def test_rejected_mutation_emits_no_audit_event(self):
        """Failed or unauthorized mutations must not write success events."""
        unit_type = UnitType.objects.create(
            name='UT Protected', organization_id=self.org, is_active=True,
        )
        unit = OrganizationUnit.objects.create(
            name='Unit Protected', organization_id=self.org, is_active=True,
            type_id=unit_type,
        )
        pos = PositionType.objects.create(
            name='Pos Protected', rank=1, organization_id=self.org,
            is_active=True,
        )
        Membership.objects.create(
            user_id=self.member, unit_id=unit, position_id=pos, is_active=True,
            date_start=date(2026, 1, 1),
        )

        initial_count = AuditLog.objects.count()

        # Attempt to delete unit that has active members -> rejected 400
        unit_url = reverse('units-detail', args=[unit.id])
        resp = self.client.delete(unit_url)
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(AuditLog.objects.count(), initial_count)

        # Attempt unauthorized update as unrelated user -> rejected 403
        self.client.force_authenticate(self.unrelated)
        resp = self.client.patch(unit_url, {'name': 'Hacked'})
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(AuditLog.objects.count(), initial_count)
