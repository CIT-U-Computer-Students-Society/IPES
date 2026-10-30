from django.test import TestCase, RequestFactory
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from apps.audit.models import AuditLog
from apps.audit.utils import log_action, AuditActions
from apps.organizations.models import (
    Organization,
    OrganizationRole,
    OrganizationUnit,
    UnitType,
    PositionType,
    JoinRequest,
)
from apps.portfolio.models import Accomplishment
from apps.users.models import User


class AuditAttributionTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.password = 'Pass123!Secure'
        cls.admin_user = User.objects.create_user(
            username='admin_attr',
            email='admin_attr@cit.edu',
            password=cls.password,
            first_name='Admin',
            last_name='User',
        )
        cls.member_user = User.objects.create_user(
            username='member_attr',
            email='member_attr@cit.edu',
            password=cls.password,
            first_name='Member',
            last_name='User',
        )
        cls.candidate_user = User.objects.create_user(
            username='candidate_attr',
            email='candidate_attr@cit.edu',
            password=cls.password,
            first_name='Candidate',
            last_name='User',
        )
        cls.candidate_user2 = User.objects.create_user(
            username='candidate_attr2',
            email='candidate_attr2@cit.edu',
            password=cls.password,
            first_name='Candidate Two',
            last_name='User',
        )

        cls.org_a = Organization.objects.create(
            name='Org Alpha',
            code='ALPHA123',
            description='First organization',
            period_year_start='2026-01-01',
            is_active=True,
        )
        cls.org_b = Organization.objects.create(
            name='Org Beta',
            code='BETA123',
            description='Second organization',
            period_year_start='2026-01-01',
            is_active=True,
        )

        OrganizationRole.objects.create(
            user=cls.admin_user,
            organization=cls.org_a,
            role='Admin',
            is_active=True,
        )
        OrganizationRole.objects.create(
            user=cls.admin_user,
            organization=cls.org_b,
            role='Admin',
            is_active=True,
        )
        OrganizationRole.objects.create(
            user=cls.member_user,
            organization=cls.org_a,
            role='Member',
            is_active=True,
        )
        OrganizationRole.objects.create(
            user=cls.member_user,
            organization=cls.org_b,
            role='Member',
            is_active=True,
        )

        cls.unit_type = UnitType.objects.create(
            organization_id=cls.org_b,
            name='Committee',
        )
        cls.unit_b = OrganizationUnit.objects.create(
            organization_id=cls.org_b,
            name='Logistics',
            type_id=cls.unit_type,
        )
        cls.pos_b = PositionType.objects.create(
            organization_id=cls.org_b,
            name='Officer',
            rank=2,
        )

    def test_log_action_does_not_trust_unverified_header_fallback(self):
        """log_action must never attribute to unverified request header."""
        factory = RequestFactory()
        request = factory.post(
            '/api/users/login/',
            HTTP_X_ORGANIZATION_ID=str(self.org_a.id)
        )

        log_action(self.admin_user, 'user.test_action', request=request)

        log = AuditLog.objects.filter(
            user_id=self.admin_user,
            action='user.test_action'
        ).latest('id')
        self.assertIsNone(log.organization_id)

    def test_log_action_accepts_model_instance_or_id(self):
        """log_action accepts Organization instance or integer ID."""
        log_action(
            self.admin_user,
            'test.with_instance',
            organization_id=self.org_a
        )
        log1 = AuditLog.objects.filter(
            action='test.with_instance'
        ).latest('id')
        self.assertEqual(log1.organization_id, self.org_a)

        log_action(
            self.admin_user,
            'test.with_id',
            organization_id=self.org_b.id
        )
        log2 = AuditLog.objects.filter(action='test.with_id').latest('id')
        self.assertEqual(log2.organization_id, self.org_b)

    def test_organization_creation_attributes_audit_to_new_organization(self):
        """Organization creation records audit log under the new org."""
        client = APIClient()
        client.force_authenticate(self.admin_user)
        response = client.post(reverse('organizations-list'), {
            'name': 'Org Gamma',
            'code': 'GAMMA123',
            'description': 'Org Gamma Description',
            'period_year_start': '2026-01-01',
        })
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        new_org_id = response.data['id']

        log = AuditLog.objects.filter(
            action__startswith=AuditActions.ORG_CREATED
        ).latest('id')
        self.assertIsNotNone(log.organization_id)
        self.assertEqual(log.organization_id_id, new_org_id)

    def test_organization_creation_with_stale_header_attributes_new_org(self):
        """Organization creation attributes to new org even with a header."""
        client = APIClient()
        client.force_authenticate(self.admin_user)
        client.credentials(HTTP_X_ORGANIZATION_ID=str(self.org_b.id))
        response = client.post(reverse('organizations-list'), {
            'name': 'Org Delta',
            'code': 'DELTA123',
            'description': 'Org Delta Description',
            'period_year_start': '2026-01-01',
        })
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        new_org_id = response.data['id']

        log = AuditLog.objects.filter(
            action__startswith=AuditActions.ORG_CREATED
        ).latest('id')
        self.assertEqual(log.organization_id_id, new_org_id)
        self.assertNotEqual(log.organization_id_id, self.org_b.id)

    def test_set_member_role_with_mismatched_header_is_rejected(self):
        """Role update fails with 400 when X-Organization-Id conflicts."""
        client = APIClient()
        client.force_authenticate(self.admin_user)
        client.credentials(HTTP_X_ORGANIZATION_ID=str(self.org_b.id))
        url = reverse(
            'organizations-set-member-role',
            kwargs={'pk': self.org_a.id}
        )
        response = client.post(
            url,
            {'user_id': self.member_user.id, 'role': 'Admin'}
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('organization_id', response.data)

    def test_set_member_role_attributes_audit_to_target_organization(self):
        """Role update records audit event under target organization."""
        client = APIClient()
        client.force_authenticate(self.admin_user)
        client.credentials(HTTP_X_ORGANIZATION_ID=str(self.org_a.id))
        url = reverse(
            'organizations-set-member-role',
            kwargs={'pk': self.org_a.id}
        )
        response = client.post(
            url,
            {'user_id': self.member_user.id, 'role': 'Admin'}
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        log = AuditLog.objects.filter(
            action__startswith=AuditActions.USER_UPDATED
        ).latest('id')
        self.assertEqual(log.organization_id, self.org_a)
        self.assertIn(self.member_user.email, log.action)

    def test_remove_member_with_mismatched_header_is_rejected(self):
        """Member removal fails with 400 when header conflicts with org."""
        client = APIClient()
        client.force_authenticate(self.admin_user)
        client.credentials(HTTP_X_ORGANIZATION_ID=str(self.org_b.id))
        url = reverse(
            'organizations-remove-member',
            kwargs={'pk': self.org_a.id}
        )
        response = client.post(url, {'user_id': self.member_user.id})

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('organization_id', response.data)

    def test_remove_member_attributes_audit_to_target_organization(self):
        """Member removal records audit event under target organization."""
        client = APIClient()
        client.force_authenticate(self.admin_user)
        client.credentials(HTTP_X_ORGANIZATION_ID=str(self.org_a.id))
        url = reverse(
            'organizations-remove-member',
            kwargs={'pk': self.org_a.id}
        )
        response = client.post(url, {'user_id': self.member_user.id})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        log = AuditLog.objects.filter(
            action__startswith=AuditActions.USER_DEACTIVATED
        ).latest('id')
        self.assertEqual(log.organization_id, self.org_a)

    def test_join_by_code_attributes_audit_to_target_organization(self):
        """join_by_code attributes audit log to the organization joined."""
        client = APIClient()
        client.force_authenticate(self.candidate_user)
        client.credentials(HTTP_X_ORGANIZATION_ID=str(self.org_a.id))
        response = client.post(
            reverse('organizations-join-by-code'),
            {'code': self.org_b.code}
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        log = AuditLog.objects.filter(
            action__startswith=AuditActions.ORG_JOIN_REQUESTED
        ).latest('id')
        self.assertEqual(log.organization_id, self.org_b)

    def test_delete_organization_with_mismatched_header_is_rejected(self):
        """delete_organization fails with 400 when header conflicts."""
        client = APIClient()
        client.force_authenticate(self.admin_user)
        client.credentials(HTTP_X_ORGANIZATION_ID=str(self.org_b.id))
        url = reverse(
            'organizations-delete-organization',
            kwargs={'pk': self.org_a.id}
        )
        response = client.post(url, {
            'code': self.org_a.code,
            'password': self.password,
        })

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('organization_id', response.data)

    def test_delete_organization_attributes_audit_to_target_organization(self):
        """delete_organization records soft deletion under deleted org."""
        client = APIClient()
        client.force_authenticate(self.admin_user)
        client.credentials(HTTP_X_ORGANIZATION_ID=str(self.org_a.id))
        url = reverse(
            'organizations-delete-organization',
            kwargs={'pk': self.org_a.id}
        )
        response = client.post(url, {
            'code': self.org_a.code,
            'password': self.password,
        })

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        log = AuditLog.objects.filter(
            action__startswith=AuditActions.ORG_UPDATED
        ).latest('id')
        self.assertEqual(log.organization_id, self.org_a)

    def test_join_request_approval_rejection_attributes_target_org(self):
        """JoinRequest approve and reject attribute audit events correctly."""
        req1 = JoinRequest.objects.create(
            user=self.candidate_user,
            organization=self.org_b,
            status='Pending',
        )
        client = APIClient()
        client.force_authenticate(self.admin_user)
        client.credentials(HTTP_X_ORGANIZATION_ID=str(self.org_b.id))

        approve_url = reverse('join-requests-approve', kwargs={'pk': req1.id})
        resp = client.post(approve_url, {
            'unit_id': self.unit_b.id,
            'position_id': self.pos_b.id,
            'role': 'Member',
        })
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        log_app = AuditLog.objects.filter(
            action__startswith=AuditActions.ORG_JOIN_APPROVED
        ).latest('id')
        self.assertEqual(log_app.organization_id, self.org_b)

        req2 = JoinRequest.objects.create(
            user=self.candidate_user2,
            organization=self.org_b,
            status='Pending',
        )
        reject_url = reverse('join-requests-reject', kwargs={'pk': req2.id})
        resp_rej = client.post(reject_url)
        self.assertEqual(resp_rej.status_code, status.HTTP_200_OK)
        log_rej = AuditLog.objects.filter(
            action__startswith=AuditActions.ORG_JOIN_REJECTED
        ).latest('id')
        self.assertEqual(log_rej.organization_id, self.org_b)

    def test_accomplishment_verification_conflicting_selectors_rejected(self):
        """Accomplishment verification rejects conflicting selectors."""
        accomplishment = Accomplishment.objects.create(
            user_id=self.member_user,
            organization_id=self.org_b,
            title='Beta Accomplishment',
            description='Test',
            type='Project',
            date_completed=timezone.now(),
            status='Pending',
        )
        client = APIClient()
        client.force_authenticate(self.admin_user)
        client.credentials(HTTP_X_ORGANIZATION_ID=str(self.org_a.id))
        url = (
            reverse('accomplishments-verify', kwargs={'pk': accomplishment.id})
            + f'?organization_id={self.org_b.id}'
        )
        response = client.post(url, {'status': 'Verified'})

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('organization_id', response.data)

    def test_accomplishment_verification_attributes_audit_to_org(self):
        """Verification attributes audit to accomplishment org."""
        accomplishment = Accomplishment.objects.create(
            user_id=self.member_user,
            organization_id=self.org_b,
            title='Beta Accomplishment Valid',
            description='Test',
            type='Project',
            date_completed=timezone.now(),
            status='Pending',
        )
        client = APIClient()
        client.force_authenticate(self.admin_user)
        client.credentials(HTTP_X_ORGANIZATION_ID=str(self.org_b.id))
        url = reverse(
            'accomplishments-verify',
            kwargs={'pk': accomplishment.id}
        )
        response = client.post(url, {'status': 'Verified'})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        log = AuditLog.objects.filter(
            action__startswith=AuditActions.ACCOMPLISHMENT_VERIFIED
        ).latest('id')
        self.assertEqual(log.organization_id, self.org_b)

    def test_accomplishment_creation_and_update_attribute_audit_to_org(self):
        """Creating and updating accomplishment attributes to its org."""
        client = APIClient()
        client.force_authenticate(self.member_user)
        client.credentials(HTTP_X_ORGANIZATION_ID=str(self.org_b.id))

        # Create
        create_resp = client.post(reverse('accomplishments-list'), {
            'title': 'New Paper',
            'description': 'Research paper',
            'type': 'project',
            'date_completed': timezone.now().isoformat(),
        })
        self.assertEqual(create_resp.status_code, status.HTTP_201_CREATED)
        acc_id = create_resp.data['id']
        log_create = AuditLog.objects.filter(
            action__startswith=AuditActions.ACCOMPLISHMENT_CREATED
        ).latest('id')
        self.assertEqual(log_create.organization_id, self.org_b)

        # Update
        update_resp = client.patch(
            reverse('accomplishments-detail', kwargs={'pk': acc_id}),
            {'title': 'Updated Paper Title'}
        )
        self.assertEqual(update_resp.status_code, status.HTTP_200_OK)
        log_upd = AuditLog.objects.filter(
            action__startswith=AuditActions.ACCOMPLISHMENT_UPDATED
        ).latest('id')
        self.assertEqual(log_upd.organization_id, self.org_b)

    def test_accomplishment_queryset_and_profile_reject_mismatches(self):
        """Listing and profile reject mismatched header/param."""
        client = APIClient()
        client.force_authenticate(self.admin_user)
        client.credentials(HTTP_X_ORGANIZATION_ID=str(self.org_a.id))

        list_resp = client.get(
            reverse('accomplishments-list')
            + f'?organization_id={self.org_b.id}'
        )
        self.assertEqual(list_resp.status_code, status.HTTP_400_BAD_REQUEST)

        prof_url = (
            reverse('accomplishments-evaluatee-profile')
            + f'?user_id={self.member_user.id}&organization_id={self.org_b.id}'
        )
        prof_resp = client.get(prof_url)
        self.assertEqual(prof_resp.status_code, status.HTTP_400_BAD_REQUEST)
