"""
Tests for organization and user identifier validation across endpoints.
Verifies malformed, absent, blank, nonpositive, oversized, and mismatched IDs
return controlled HTTP 400 validation errors rather than uncaught 500s.
"""

from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from apps.organizations.models import (
    Membership,
    Organization,
    OrganizationRole,
    OrganizationUnit,
    PositionType,
    UnitType,
)
from apps.portfolio.models import Accomplishment
from apps.users.models import User


class PortfolioOrgIdValidationTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(
            username='eval_member',
            email='member@cit.edu',
            password='password123',
            first_name='Member',
            last_name='User',
        )
        cls.admin_user = User.objects.create_user(
            username='eval_admin',
            email='admin@cit.edu',
            password='password123',
            first_name='Admin',
            last_name='User',
        )
        cls.org = Organization.objects.create(
            name='Test Org',
            code='TORG',
            description='Test Org Description',
            period_year_start='2026-01-01',
        )
        OrganizationRole.objects.create(
            user=cls.user,
            organization=cls.org,
            role='Member',
            is_active=True,
        )
        OrganizationRole.objects.create(
            user=cls.admin_user,
            organization=cls.org,
            role='Admin',
            is_active=True,
        )

        cls.unit_type = UnitType.objects.create(
            organization_id=cls.org,
            name='Department',
            )
        cls.unit = OrganizationUnit.objects.create(
            organization_id=cls.org,
            name='Engineering',
            type_id=cls.unit_type,
        )
        cls.position = PositionType.objects.create(
            organization_id=cls.org,
            name='Developer',
            rank=1,
        )
        cls.membership = Membership.objects.create(
            user_id=cls.user,
            unit_id=cls.unit,
            position_id=cls.position,
            date_start='2026-01-01',
            is_active=True,
        )

        cls.accomplishment = Accomplishment.objects.create(
            user_id=cls.user,
            organization_id=cls.org,
            title='Initial Work',
            description='Project description',
            type='Project',
            date_completed=timezone.now(),
            status='Pending',
        )

    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(self.user)

        self.admin_client = APIClient()
        self.admin_client.force_authenticate(self.admin_user)

    def test_list_rejects_malformed_header_organization_id(self):
        url = reverse('accomplishments-list')
        malformed_values = ['not-an-id', '0', '-5', '99999999999999', '12abc']
        for bad_id in malformed_values:
            with self.subTest(bad_id=bad_id):
                response = self.client.get(
                    url,
                    HTTP_X_ORGANIZATION_ID=bad_id,
                )
                self.assertEqual(response.status_code, 400)
                self.assertIn('organization_id', response.data)

    def test_list_rejects_malformed_query_organization_id(self):
        url = reverse('accomplishments-list')
        malformed_values = ['not-an-id', '0', '-1', '99999999999999']
        for bad_id in malformed_values:
            with self.subTest(bad_id=bad_id):
                response = self.client.get(
                    url,
                    {'organization_id': bad_id},
                )
                self.assertEqual(response.status_code, 400)
                self.assertIn('organization_id', response.data)

    def test_list_rejects_mismatched_header_and_query_organization_id(self):
        url = reverse('accomplishments-list')
        response = self.client.get(
            url,
            {'organization_id': '2'},
            HTTP_X_ORGANIZATION_ID='1',
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn('organization_id', response.data)
        self.assertIn('must match', str(response.data['organization_id']))

    def test_list_rejects_malformed_query_user_id(self):
        url = reverse('accomplishments-list')
        malformed_users = ['not-an-id', '0', '-1', '99999999999999']
        for bad_user in malformed_users:
            with self.subTest(bad_user=bad_user):
                response = self.client.get(
                    url,
                    {'user_id': bad_user},
                    HTTP_X_ORGANIZATION_ID=str(self.org.pk),
                )
                self.assertEqual(response.status_code, 400)
                self.assertIn('user_id', response.data)

    def test_list_allows_absent_organization_and_returns_own_records(self):
        url = reverse('accomplishments-list')
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['count'], 1)
        self.assertEqual(
            response.data['results'][0]['title'],
            self.accomplishment.title,
        )

    def test_list_with_valid_organization_succeeds(self):
        url = reverse('accomplishments-list')
        response = self.client.get(
            url,
            HTTP_X_ORGANIZATION_ID=str(self.org.pk),
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['count'], 1)

    def test_create_rejects_malformed_header_organization_id(self):
        url = reverse('accomplishments-list')
        payload = {
            'title': 'New Project',
            'description': 'Description',
            'type': 'Project',
            'date_completed': '2026-02-01',
        }
        malformed_values = ['not-an-id', '0', '-5', '99999999999999']
        for bad_id in malformed_values:
            with self.subTest(bad_id=bad_id):
                response = self.client.post(
                    url,
                    payload,
                    HTTP_X_ORGANIZATION_ID=bad_id,
                )
                self.assertEqual(response.status_code, 400)
                self.assertIn('organization_id', response.data)

    def test_create_rejects_absent_and_blank_organization_id(self):
        url = reverse('accomplishments-list')
        payload = {
            'title': 'New Project',
            'description': 'Description',
            'type': 'Project',
            'date_completed': '2026-02-01',
        }
        # Absent header
        res_absent = self.client.post(url, payload)
        self.assertEqual(res_absent.status_code, 400)
        self.assertIn('organization_id', res_absent.data)

        # Empty header
        res_empty = self.client.post(url, payload, HTTP_X_ORGANIZATION_ID='')
        self.assertEqual(res_empty.status_code, 400)
        self.assertIn('organization_id', res_empty.data)

        # Whitespace header
        res_ws = self.client.post(url, payload, HTTP_X_ORGANIZATION_ID='   ')
        self.assertEqual(res_ws.status_code, 400)
        self.assertIn('organization_id', res_ws.data)

    def test_create_rejects_nonexistent_valid_organization_id(self):
        url = reverse('accomplishments-list')
        payload = {
            'title': 'New Project',
            'description': 'Description',
            'type': 'Project',
            'date_completed': '2026-02-01',
        }
        response = self.client.post(
            url,
            payload,
            HTTP_X_ORGANIZATION_ID='999999',
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn('organization_id', response.data)
        self.assertIn(
            'Organization not found.',
            str(response.data['organization_id']),
        )

    def test_create_with_valid_organization_succeeds(self):
        url = reverse('accomplishments-list')
        payload = {
            'title': 'Valid Submission',
            'description': 'Valid Description',
            'type': 'Project',
            'date_completed': '2026-02-01',
        }
        response = self.client.post(
            url,
            payload,
            HTTP_X_ORGANIZATION_ID=str(self.org.pk),
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['title'], 'Valid Submission')

    def test_summary_rejects_malformed_selectors(self):
        url = reverse('accomplishments-summary')
        # Bad header
        res1 = self.admin_client.get(
            url,
            HTTP_X_ORGANIZATION_ID='not-an-id',
        )
        self.assertEqual(res1.status_code, 400)
        self.assertIn('organization_id', res1.data)

        # Bad query org
        res2 = self.admin_client.get(
            url,
            {'organization_id': '0'},
        )
        self.assertEqual(res2.status_code, 400)
        self.assertIn('organization_id', res2.data)

        # Bad user_id query
        res3 = self.admin_client.get(
            url,
            {'user_id': 'not-an-id'},
            HTTP_X_ORGANIZATION_ID=str(self.org.pk),
        )
        self.assertEqual(res3.status_code, 400)
        self.assertIn('user_id', res3.data)

    def test_summary_with_valid_organization_succeeds(self):
        url = reverse('accomplishments-summary')
        response = self.admin_client.get(
            url,
            HTTP_X_ORGANIZATION_ID=str(self.org.pk),
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['total'], 1)
        self.assertEqual(response.data['pending'], 1)

    def test_pending_rejects_malformed_selectors(self):
        url = reverse('accomplishments-pending')
        res1 = self.admin_client.get(
            url,
            HTTP_X_ORGANIZATION_ID='not-an-id',
        )
        self.assertEqual(res1.status_code, 400)
        self.assertIn('organization_id', res1.data)

        res2 = self.admin_client.get(
            url,
            {'organization_id': '-5'},
        )
        self.assertEqual(res2.status_code, 400)
        self.assertIn('organization_id', res2.data)

    def test_verify_rejects_malformed_selectors(self):
        url = reverse(
            'accomplishments-verify',
            kwargs={'pk': self.accomplishment.pk},
        )
        payload = {'status': 'Verified'}
        res1 = self.admin_client.post(
            url,
            payload,
            HTTP_X_ORGANIZATION_ID='not-an-id',
        )
        self.assertEqual(res1.status_code, 400)
        self.assertIn('organization_id', res1.data)

        res2 = self.admin_client.post(
            f'{url}?organization_id=0',
            payload,
        )
        self.assertEqual(res2.status_code, 400)
        self.assertIn('organization_id', res2.data)

    def test_evaluatee_profile_rejects_malformed_selectors(self):
        url = reverse('accomplishments-evaluatee-profile')

        # Malformed org header
        res1 = self.client.get(
            url,
            {'user_id': str(self.user.pk)},
            HTTP_X_ORGANIZATION_ID='not-an-id',
        )
        self.assertEqual(res1.status_code, 400)
        self.assertIn('organization_id', res1.data)

        # Malformed user_id
        res2 = self.client.get(
            url,
            {'user_id': 'not-an-id'},
            HTTP_X_ORGANIZATION_ID=str(self.org.pk),
        )
        self.assertEqual(res2.status_code, 400)
        self.assertIn('user_id', res2.data)

        # Zero user_id
        res3 = self.client.get(
            url,
            {'user_id': '0'},
            HTTP_X_ORGANIZATION_ID=str(self.org.pk),
        )
        self.assertEqual(res3.status_code, 400)
        self.assertIn('user_id', res3.data)

        # Missing parameters
        res4 = self.client.get(url)
        self.assertEqual(res4.status_code, 400)
        self.assertEqual(
            res4.data['error'],
            'user_id and organization_id are required',
        )
