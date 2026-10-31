"""
Tests for accomplishment query filtering across member, admin, and global.
Verifies that status and type query parameters are applied to the authorized
scoped queryset for all callers, including regular members.
"""

from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from apps.organizations.models import Organization, OrganizationRole
from apps.portfolio.models import Accomplishment
from apps.users.models import User


class AccomplishmentQueryFiltersTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.member1 = User.objects.create_user(
            username='filter_member1',
            email='member1@cit.edu',
            password='password123',
            first_name='Member',
            last_name='One',
        )
        cls.member2 = User.objects.create_user(
            username='filter_member2',
            email='member2@cit.edu',
            password='password123',
            first_name='Member',
            last_name='Two',
        )
        cls.admin_user = User.objects.create_user(
            username='filter_admin',
            email='admin@cit.edu',
            password='password123',
            first_name='Admin',
            last_name='User',
        )
        cls.global_admin = User.objects.create_user(
            username='filter_global_admin',
            email='globaladmin@cit.edu',
            password='password123',
            is_staff=True,
            is_superuser=True,
        )

        cls.org1 = Organization.objects.create(
            name='Org One',
            code='ORG1',
            description='First Test Org',
            period_year_start='2026-01-01',
        )
        cls.org2 = Organization.objects.create(
            name='Org Two',
            code='ORG2',
            description='Second Test Org',
            period_year_start='2026-01-01',
        )

        OrganizationRole.objects.create(
            user=cls.member1,
            organization=cls.org1,
            role='Member',
            is_active=True,
        )
        OrganizationRole.objects.create(
            user=cls.member2,
            organization=cls.org1,
            role='Member',
            is_active=True,
        )
        OrganizationRole.objects.create(
            user=cls.admin_user,
            organization=cls.org1,
            role='Admin',
            is_active=True,
        )
        OrganizationRole.objects.create(
            user=cls.member1,
            organization=cls.org2,
            role='Member',
            is_active=True,
        )

        now = timezone.now()

        # Member 1 records in Org 1
        cls.m1_pending_proj = Accomplishment.objects.create(
            user_id=cls.member1,
            organization_id=cls.org1,
            title='Pending Project',
            description='Pending description',
            type='Project',
            status='Pending',
            date_completed=now,
        )
        cls.m1_verified_award = Accomplishment.objects.create(
            user_id=cls.member1,
            organization_id=cls.org1,
            title='Verified Award',
            description='Award description',
            type='Award',
            status='Verified',
            date_completed=now,
        )
        cls.m1_rejected_proj = Accomplishment.objects.create(
            user_id=cls.member1,
            organization_id=cls.org1,
            title='Rejected Project',
            description='Rejected description',
            type='Project',
            status='Rejected',
            date_completed=now,
        )
        cls.m1_verified_proj = Accomplishment.objects.create(
            user_id=cls.member1,
            organization_id=cls.org1,
            title='Verified Project',
            description='Verified proj description',
            type='Project',
            status='Verified',
            date_completed=now,
        )

        # Member 2 records in Org 1
        cls.m2_verified_award = Accomplishment.objects.create(
            user_id=cls.member2,
            organization_id=cls.org1,
            title='Member2 Award',
            description='M2 award description',
            type='Award',
            status='Verified',
            date_completed=now,
        )

        # Member 1 record in Org 2
        cls.m1_org2_award = Accomplishment.objects.create(
            user_id=cls.member1,
            organization_id=cls.org2,
            title='Org2 Award',
            description='Org2 award description',
            type='Award',
            status='Verified',
            date_completed=now,
        )

    def setUp(self):
        self.member_client = APIClient()
        self.member_client.force_authenticate(self.member1)

        self.admin_client = APIClient()
        self.admin_client.force_authenticate(self.admin_user)

        self.global_client = APIClient()
        self.global_client.force_authenticate(self.global_admin)

    def test_member_list_filters_by_status(self):
        url = reverse('accomplishments-list')

        # Filter: status=Verified
        res_v = self.member_client.get(
            url,
            {'status': 'Verified'},
            HTTP_X_ORGANIZATION_ID=str(self.org1.pk),
        )
        self.assertEqual(res_v.status_code, 200)
        self.assertEqual(res_v.data['count'], 2)
        titles = [r['title'] for r in res_v.data['results']]
        self.assertIn('Verified Award', titles)
        self.assertIn('Verified Project', titles)
        self.assertNotIn('Pending Project', titles)

        # Filter: status=Pending
        res_p = self.member_client.get(
            url,
            {'status': 'Pending'},
            HTTP_X_ORGANIZATION_ID=str(self.org1.pk),
        )
        self.assertEqual(res_p.status_code, 200)
        self.assertEqual(res_p.data['count'], 1)
        self.assertEqual(res_p.data['results'][0]['title'], 'Pending Project')

        # Filter: status=Rejected
        res_r = self.member_client.get(
            url,
            {'status': 'Rejected'},
            HTTP_X_ORGANIZATION_ID=str(self.org1.pk),
        )
        self.assertEqual(res_r.status_code, 200)
        self.assertEqual(res_r.data['count'], 1)
        self.assertEqual(res_r.data['results'][0]['title'], 'Rejected Project')

    def test_member_list_filters_by_type(self):
        url = reverse('accomplishments-list')

        # Filter: type=Award
        res_award = self.member_client.get(
            url,
            {'type': 'Award'},
            HTTP_X_ORGANIZATION_ID=str(self.org1.pk),
        )
        self.assertEqual(res_award.status_code, 200)
        self.assertEqual(res_award.data['count'], 1)
        self.assertEqual(
            res_award.data['results'][0]['title'],
            'Verified Award',
        )

        # Filter: type=Project
        res_proj = self.member_client.get(
            url,
            {'type': 'Project'},
            HTTP_X_ORGANIZATION_ID=str(self.org1.pk),
        )
        self.assertEqual(res_proj.status_code, 200)
        self.assertEqual(res_proj.data['count'], 3)
        titles = [r['title'] for r in res_proj.data['results']]
        self.assertIn('Pending Project', titles)
        self.assertIn('Rejected Project', titles)
        self.assertIn('Verified Project', titles)

    def test_member_list_filters_by_status_and_type_combined(self):
        url = reverse('accomplishments-list')

        # Combined: status=Verified and type=Award
        response = self.member_client.get(
            url,
            {'status': 'Verified', 'type': 'Award'},
            HTTP_X_ORGANIZATION_ID=str(self.org1.pk),
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['count'], 1)
        self.assertEqual(
            response.data['results'][0]['title'],
            'Verified Award',
        )

        # Combined: status=Pending and type=Project
        res_pending_proj = self.member_client.get(
            url,
            {'status': 'Pending', 'type': 'Project'},
            HTTP_X_ORGANIZATION_ID=str(self.org1.pk),
        )
        self.assertEqual(res_pending_proj.status_code, 200)
        self.assertEqual(res_pending_proj.data['count'], 1)
        self.assertEqual(
            res_pending_proj.data['results'][0]['title'],
            'Pending Project',
        )

        # Combined: non-matching combination
        res_empty = self.member_client.get(
            url,
            {'status': 'Rejected', 'type': 'Award'},
            HTTP_X_ORGANIZATION_ID=str(self.org1.pk),
        )
        self.assertEqual(res_empty.status_code, 200)
        self.assertEqual(res_empty.data['count'], 0)

    def test_member_my_action_respects_status_and_type_filters(self):
        url = reverse('accomplishments-my')

        # /my/?status=Verified&type=Award
        response = self.member_client.get(
            url,
            {'status': 'Verified', 'type': 'Award'},
            HTTP_X_ORGANIZATION_ID=str(self.org1.pk),
        )
        self.assertEqual(response.status_code, 200)
        data = (
            response.data
            if isinstance(response.data, list)
            else response.data.get('results', [])
        )
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]['title'], 'Verified Award')

        # /my/?status=Pending
        res_p = self.member_client.get(
            url,
            {'status': 'Pending'},
            HTTP_X_ORGANIZATION_ID=str(self.org1.pk),
        )
        self.assertEqual(res_p.status_code, 200)
        data_p = (
            res_p.data
            if isinstance(res_p.data, list)
            else res_p.data.get('results', [])
        )
        self.assertEqual(len(data_p), 1)
        self.assertEqual(data_p[0]['title'], 'Pending Project')

    def test_member_cannot_broaden_access_via_user_id(self):
        url = reverse('accomplishments-list')

        # As member1, request member2's user_id
        response = self.member_client.get(
            url,
            {'user_id': str(self.member2.pk), 'status': 'Verified'},
            HTTP_X_ORGANIZATION_ID=str(self.org1.pk),
        )
        self.assertEqual(response.status_code, 200)
        # Must only return member1's accomplishments, NOT member2's
        titles = [r['title'] for r in response.data['results']]
        self.assertNotIn('Member2 Award', titles)
        for r in response.data['results']:
            self.assertEqual(r['user_id'], self.member1.pk)

    def test_admin_list_can_filter_by_user_id_status_and_type(self):
        url = reverse('accomplishments-list')

        # Admin queries all Verified accomplishments in org1 (count: 3)
        res_all_v = self.admin_client.get(
            url,
            {'status': 'Verified'},
            HTTP_X_ORGANIZATION_ID=str(self.org1.pk),
        )
        self.assertEqual(res_all_v.status_code, 200)
        self.assertEqual(res_all_v.data['count'], 3)

        # Admin queries Verified accomplishments for member2 specifically
        res_m2 = self.admin_client.get(
            url,
            {'user_id': str(self.member2.pk), 'status': 'Verified'},
            HTTP_X_ORGANIZATION_ID=str(self.org1.pk),
        )
        self.assertEqual(res_m2.status_code, 200)
        self.assertEqual(res_m2.data['count'], 1)
        self.assertEqual(res_m2.data['results'][0]['title'], 'Member2 Award')

    def test_organization_isolation_with_filters(self):
        url = reverse('accomplishments-list')

        # Query Org 1 for Verified Award -> should not return Org 2 Award
        response = self.member_client.get(
            url,
            {'status': 'Verified', 'type': 'Award'},
            HTTP_X_ORGANIZATION_ID=str(self.org1.pk),
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['count'], 1)
        self.assertEqual(
            response.data['results'][0]['title'],
            'Verified Award',
        )

        # Query Org 2 for Verified Award -> returns Org 2 Award
        response2 = self.member_client.get(
            url,
            {'status': 'Verified', 'type': 'Award'},
            HTTP_X_ORGANIZATION_ID=str(self.org2.pk),
        )
        self.assertEqual(response2.status_code, 200)
        self.assertEqual(response2.data['count'], 1)
        self.assertEqual(response2.data['results'][0]['title'], 'Org2 Award')

    def test_member_without_organization_header_filters_own_records(self):
        url = reverse('accomplishments-list')

        # Without organization header, caller gets their own records
        response = self.member_client.get(
            url,
            {'status': 'Verified', 'type': 'Award'},
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['count'], 2)
        titles = [r['title'] for r in response.data['results']]
        self.assertIn('Verified Award', titles)
        self.assertIn('Org2 Award', titles)

    def test_global_admin_filters_across_all_or_scoped_organization(self):
        url = reverse('accomplishments-list')

        # Global admin without header -> all Verified Awards (3 total)
        res_all = self.global_client.get(
            url,
            {'status': 'Verified', 'type': 'Award'},
        )
        self.assertEqual(res_all.status_code, 200)
        self.assertEqual(res_all.data['count'], 3)

        # Global admin scoped to Org 1 -> only Org 1 Verified Awards (2 total)
        res_org1 = self.global_client.get(
            url,
            {'status': 'Verified', 'type': 'Award'},
            HTTP_X_ORGANIZATION_ID=str(self.org1.pk),
        )
        self.assertEqual(res_org1.status_code, 200)
        self.assertEqual(res_org1.data['count'], 2)
