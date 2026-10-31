from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from apps.audit.models import AuditLog
from apps.organizations.models import (
    Membership, Organization, OrganizationRole, OrganizationUnit,
    PositionType, UnitType,
)
from apps.portfolio.models import Accomplishment
from apps.users.models import User


class AccomplishmentDeletionProtectionTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.org = Organization.objects.create(
            name='Deletion Test Org',
            code='DELORG',
            description='Org for deletion tests',
            period_year_start='2026-01-01',
            is_active=True,
        )

        cls.owner = User.objects.create_user(
            username='del_owner',
            email='del_owner@cit.edu',
            password='password123',
        )
        OrganizationRole.objects.create(
            user=cls.owner,
            organization=cls.org,
            role='Member',
            is_active=True,
        )

        cls.non_owner = User.objects.create_user(
            username='del_non_owner',
            email='del_non_owner@cit.edu',
            password='password123',
        )
        OrganizationRole.objects.create(
            user=cls.non_owner,
            organization=cls.org,
            role='Member',
            is_active=True,
        )

        cls.admin_user = User.objects.create_user(
            username='del_admin',
            email='del_admin@cit.edu',
            password='password123',
        )
        OrganizationRole.objects.create(
            user=cls.admin_user,
            organization=cls.org,
            role='Admin',
            is_active=True,
        )

        cls.unit_type = UnitType.objects.create(
            organization_id=cls.org,
            name='Committee',
        )
        cls.unit = OrganizationUnit.objects.create(
            organization_id=cls.org,
            type_id=cls.unit_type,
            name='Engineering',
        )
        cls.position = PositionType.objects.create(
            organization_id=cls.org,
            name='Lead',
            rank=1,
        )
        Membership.objects.create(
            user_id=cls.owner,
            unit_id=cls.unit,
            position_id=cls.position,
            is_active=True,
            date_start='2026-01-01',
        )

    def setUp(self):
        self.client = APIClient()

    def _create_accomplishment(self, user, status='Pending', title='Item'):
        return Accomplishment.objects.create(
            user_id=user,
            organization_id=self.org,
            title=title,
            description='Evidence text',
            type='project',
            status=status,
            date_completed=timezone.now(),
            verified_by=self.admin_user if status == 'Verified' else None,
        )

    def test_owner_cannot_delete_verified_accomplishment(self):
        verified_acc = self._create_accomplishment(
            self.owner, status='Verified', title='Verified Task'
        )
        self.client.force_authenticate(self.owner)
        url = reverse('accomplishments-detail', kwargs={'pk': verified_acc.pk})

        response = self.client.delete(
            url,
            HTTP_X_ORGANIZATION_ID=str(self.org.pk),
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.data.get('error'),
            'You can only delete pending or rejected accomplishments',
        )
        self.assertTrue(
            Accomplishment.objects.filter(pk=verified_acc.pk).exists()
        )
        self.assertFalse(
            AuditLog.objects.filter(
                action__startswith='accomplishment.deleted'
            ).exists()
        )

    def test_admin_cannot_delete_verified_accomplishment_of_other(self):
        verified_acc = self._create_accomplishment(
            self.owner, status='Verified', title='Member Verified Task'
        )
        self.client.force_authenticate(self.admin_user)
        url = reverse('accomplishments-detail', kwargs={'pk': verified_acc.pk})

        response = self.client.delete(
            url,
            HTTP_X_ORGANIZATION_ID=str(self.org.pk),
        )
        self.assertEqual(response.status_code, 403)
        self.assertEqual(
            response.data.get('error'),
            'You can only delete your own accomplishments',
        )
        self.assertTrue(
            Accomplishment.objects.filter(pk=verified_acc.pk).exists()
        )

    def test_admin_cannot_delete_own_verified_accomplishment(self):
        admin_acc = self._create_accomplishment(
            self.admin_user, status='Verified', title='Admin Verified Task'
        )
        self.client.force_authenticate(self.admin_user)
        url = reverse('accomplishments-detail', kwargs={'pk': admin_acc.pk})

        response = self.client.delete(
            url,
            HTTP_X_ORGANIZATION_ID=str(self.org.pk),
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.data.get('error'),
            'You can only delete pending or rejected accomplishments',
        )
        self.assertTrue(
            Accomplishment.objects.filter(pk=admin_acc.pk).exists()
        )

    def test_non_owner_member_cannot_delete_pending_accomplishment(self):
        pending_acc = self._create_accomplishment(
            self.owner, status='Pending', title='Member Pending Task'
        )
        self.client.force_authenticate(self.non_owner)
        url = reverse('accomplishments-detail', kwargs={'pk': pending_acc.pk})

        response = self.client.delete(
            url,
            HTTP_X_ORGANIZATION_ID=str(self.org.pk),
        )
        self.assertEqual(response.status_code, 404)
        self.assertTrue(
            Accomplishment.objects.filter(pk=pending_acc.pk).exists()
        )
        self.assertFalse(
            AuditLog.objects.filter(
                action__startswith='accomplishment.deleted'
            ).exists()
        )

    def test_admin_cannot_delete_member_pending_accomplishment(self):
        pending_acc = self._create_accomplishment(
            self.owner, status='Pending', title='Member Pending Task 2'
        )
        self.client.force_authenticate(self.admin_user)
        url = reverse('accomplishments-detail', kwargs={'pk': pending_acc.pk})

        response = self.client.delete(
            url,
            HTTP_X_ORGANIZATION_ID=str(self.org.pk),
        )
        self.assertEqual(response.status_code, 403)
        self.assertEqual(
            response.data.get('error'),
            'You can only delete your own accomplishments',
        )
        self.assertTrue(
            Accomplishment.objects.filter(pk=pending_acc.pk).exists()
        )

    def test_non_owner_member_cannot_delete_rejected_accomplishment(self):
        rejected_acc = self._create_accomplishment(
            self.owner, status='Rejected', title='Member Rejected Task'
        )
        self.client.force_authenticate(self.non_owner)
        url = reverse('accomplishments-detail', kwargs={'pk': rejected_acc.pk})

        response = self.client.delete(
            url,
            HTTP_X_ORGANIZATION_ID=str(self.org.pk),
        )
        self.assertEqual(response.status_code, 404)
        self.assertTrue(
            Accomplishment.objects.filter(pk=rejected_acc.pk).exists()
        )

    def test_owner_can_delete_pending_accomplishment(self):
        pending_acc = self._create_accomplishment(
            self.owner, status='Pending', title='Disposable Pending Task'
        )
        acc_id = pending_acc.pk
        self.client.force_authenticate(self.owner)
        url = reverse('accomplishments-detail', kwargs={'pk': acc_id})

        response = self.client.delete(
            url,
            HTTP_X_ORGANIZATION_ID=str(self.org.pk),
        )
        self.assertEqual(response.status_code, 204)
        self.assertFalse(
            Accomplishment.objects.filter(pk=acc_id).exists()
        )
        self.assertTrue(
            AuditLog.objects.filter(
                organization_id=self.org,
                user_id=self.owner,
                action__startswith='accomplishment.deleted',
            ).exists()
        )

    def test_owner_can_delete_rejected_accomplishment(self):
        rejected_acc = self._create_accomplishment(
            self.owner, status='Rejected', title='Disposable Rejected Task'
        )
        acc_id = rejected_acc.pk
        self.client.force_authenticate(self.owner)
        url = reverse('accomplishments-detail', kwargs={'pk': acc_id})

        response = self.client.delete(
            url,
            HTTP_X_ORGANIZATION_ID=str(self.org.pk),
        )
        self.assertEqual(response.status_code, 204)
        self.assertFalse(
            Accomplishment.objects.filter(pk=acc_id).exists()
        )
        self.assertTrue(
            AuditLog.objects.filter(
                organization_id=self.org,
                user_id=self.owner,
                action__startswith='accomplishment.deleted',
            ).exists()
        )

    def test_verified_accomplishment_remains_in_evaluatee_profile(self):
        verified_acc = self._create_accomplishment(
            self.owner, status='Verified', title='Permanent Evidence'
        )
        self.client.force_authenticate(self.owner)
        detail_url = reverse(
            'accomplishments-detail', kwargs={'pk': verified_acc.pk}
        )

        del_resp = self.client.delete(
            detail_url,
            HTTP_X_ORGANIZATION_ID=str(self.org.pk),
        )
        self.assertEqual(del_resp.status_code, 400)

        # Confirm visibility in evaluatee_profile
        profile_url = reverse('accomplishments-evaluatee-profile')
        query_str = (
            f"?user_id={self.owner.pk}&organization_id={self.org.pk}"
        )
        profile_resp = self.client.get(
            f"{profile_url}{query_str}",
            HTTP_X_ORGANIZATION_ID=str(self.org.pk),
        )
        self.assertEqual(profile_resp.status_code, 200)
        profile_items = profile_resp.data.get('accomplishments', [])
        item_ids = [item['id'] for item in profile_items]
        self.assertIn(verified_acc.pk, item_ids)
