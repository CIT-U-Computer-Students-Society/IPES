from datetime import date
from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.audit.models import AuditLog
from apps.organizations.models import (
    JoinRequest,
    Membership,
    Organization,
    OrganizationRole,
    OrganizationUnit,
    PositionType,
    UnitType,
)
from apps.users.models import User


class JoinRequestAtomicApprovalTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.password = 'Pass123!Secure'
        cls.org = Organization.objects.create(
            name='Atomic Org',
            code='ATOM1',
            description='Test Organization',
            period_year_start=date(2026, 1, 1),
            is_active=True,
        )
        cls.admin_user = User.objects.create_user(
            username='atomic_admin',
            email='atomic_admin@cit.edu',
            password=cls.password,
            first_name='Admin',
            last_name='User',
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
            name='Development',
            is_active=True,
        )
        cls.position = PositionType.objects.create(
            organization_id=cls.org,
            name='Lead',
            rank=1,
            is_active=True,
        )

    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(self.admin_user)
        self.client.credentials(HTTP_X_ORGANIZATION_ID=str(self.org.id))

    def _create_applicant_and_request(self, username, email):
        applicant = User.objects.create_user(
            username=username,
            email=email,
            password=self.password,
            first_name='Applicant',
            last_name='User',
        )
        join_req = JoinRequest.objects.create(
            user=applicant,
            organization=self.org,
            status='Pending',
        )
        return applicant, join_req

    def test_invalid_role_returns_400_and_leaves_no_records(self):
        """Invalid role returns HTTP 400 without persisting membership."""
        applicant, req = self._create_applicant_and_request(
            'bad_role_user', 'bad_role@cit.edu'
        )
        url = reverse('join-requests-approve', kwargs={'pk': req.id})
        resp = self.client.post(url, {
            'unit_id': self.unit.id,
            'position_id': self.position.id,
            'role': 'InvalidSuperAdmin',
        }, format='json')

        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('Invalid role', resp.data.get('error', ''))

        # Assert no partial persistence
        self.assertFalse(
            Membership.objects.filter(user_id=applicant).exists()
        )
        self.assertFalse(
            OrganizationRole.objects.filter(
                user=applicant, organization=self.org
            ).exists()
        )
        req.refresh_from_db()
        self.assertEqual(req.status, 'Pending')
        self.assertFalse(
            AuditLog.objects.filter(
                organization_id=self.org,
                action__contains=applicant.email,
            ).exists()
        )

    def test_invalid_unit_id_returns_400_and_leaves_no_records(self):
        """Nonexistent unit ID returns 400 and creates no records."""
        applicant, req = self._create_applicant_and_request(
            'bad_unit_user', 'bad_unit@cit.edu'
        )
        url = reverse('join-requests-approve', kwargs={'pk': req.id})
        resp = self.client.post(url, {
            'unit_id': 99999,
            'position_id': self.position.id,
            'role': 'Member',
        }, format='json')

        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(
            Membership.objects.filter(user_id=applicant).exists()
        )
        self.assertFalse(
            OrganizationRole.objects.filter(
                user=applicant, organization=self.org
            ).exists()
        )
        req.refresh_from_db()
        self.assertEqual(req.status, 'Pending')

    def test_missing_unit_or_position_returns_400(self):
        """Missing unit_id or position_id returns 400."""
        applicant, req = self._create_applicant_and_request(
            'missing_params_user', 'missing@cit.edu'
        )
        url = reverse('join-requests-approve', kwargs={'pk': req.id})
        resp = self.client.post(url, {'role': 'Member'}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_inactive_applicant_account_returns_400(self):
        """Inactive user account cannot be approved by org admin."""
        applicant, req = self._create_applicant_and_request(
            'inactive_user', 'inactive@cit.edu'
        )
        applicant.is_active = False
        applicant.save(update_fields=['is_active'])

        url = reverse('join-requests-approve', kwargs={'pk': req.id})
        resp = self.client.post(url, {
            'unit_id': self.unit.id,
            'position_id': self.position.id,
            'role': 'Member',
        }, format='json')

        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('inactive', resp.data.get('error', '').lower())
        self.assertFalse(
            Membership.objects.filter(user_id=applicant).exists()
        )
        req.refresh_from_db()
        self.assertEqual(req.status, 'Pending')

    def test_successful_approval_creates_role_membership_and_audit(self):
        """Valid approval establishes role, membership, and approved status."""
        applicant, req = self._create_applicant_and_request(
            'good_user', 'good@cit.edu'
        )
        url = reverse('join-requests-approve', kwargs={'pk': req.id})
        resp = self.client.post(url, {
            'unit_id': self.unit.id,
            'position_id': self.position.id,
            'role': 'Member',
        }, format='json')

        self.assertEqual(resp.status_code, status.HTTP_200_OK)

        # Verify OrganizationRole created
        role = OrganizationRole.objects.get(
            user=applicant, organization=self.org
        )
        self.assertEqual(role.role, 'Member')
        self.assertTrue(role.is_active)

        # Verify Membership created
        membership = Membership.objects.get(
            user_id=applicant, unit_id=self.unit, position_id=self.position
        )
        self.assertTrue(membership.is_active)

        # Verify JoinRequest updated
        req.refresh_from_db()
        self.assertEqual(req.status, 'Approved')

        # Verify AuditLog created
        self.assertTrue(
            AuditLog.objects.filter(
                organization_id=self.org,
                action__startswith='organization.join_approved',
            ).exists()
        )

    def test_already_approved_request_cannot_be_approved_or_rejected(self):
        """Approved requests cannot be re-approved or rejected."""
        applicant, req = self._create_applicant_and_request(
            'done_user', 'done@cit.edu'
        )
        req.status = 'Approved'
        req.save(update_fields=['status'])

        approve_url = reverse('join-requests-approve', kwargs={'pk': req.id})
        app_resp = self.client.post(approve_url, {
            'unit_id': self.unit.id,
            'position_id': self.position.id,
            'role': 'Member',
        }, format='json')
        self.assertEqual(app_resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('not pending', app_resp.data.get('error', '').lower())

        reject_url = reverse('join-requests-reject', kwargs={'pk': req.id})
        rej_resp = self.client.post(reject_url, format='json')
        self.assertEqual(rej_resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('not pending', rej_resp.data.get('error', '').lower())

    def test_already_rejected_request_cannot_be_approved_or_rejected(self):
        """Rejected requests cannot be approved or re-rejected."""
        applicant, req = self._create_applicant_and_request(
            'rejected_user', 'rejected@cit.edu'
        )
        req.status = 'Rejected'
        req.save(update_fields=['status'])

        approve_url = reverse('join-requests-approve', kwargs={'pk': req.id})
        app_resp = self.client.post(approve_url, {
            'unit_id': self.unit.id,
            'position_id': self.position.id,
            'role': 'Member',
        }, format='json')
        self.assertEqual(app_resp.status_code, status.HTTP_400_BAD_REQUEST)

        reject_url = reverse('join-requests-reject', kwargs={'pk': req.id})
        rej_resp = self.client.post(reject_url, format='json')
        self.assertEqual(rej_resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_successful_rejection_atomic(self):
        """Rejecting pending join request marks it Rejected and audits."""
        applicant, req = self._create_applicant_and_request(
            'to_reject_user', 'to_reject@cit.edu'
        )
        reject_url = reverse('join-requests-reject', kwargs={'pk': req.id})
        rej_resp = self.client.post(reject_url, format='json')

        self.assertEqual(rej_resp.status_code, status.HTTP_200_OK)
        req.refresh_from_db()
        self.assertEqual(req.status, 'Rejected')
        self.assertFalse(
            Membership.objects.filter(user_id=applicant).exists()
        )
        self.assertTrue(
            AuditLog.objects.filter(
                organization_id=self.org,
                action__startswith='organization.join_rejected',
            ).exists()
        )
