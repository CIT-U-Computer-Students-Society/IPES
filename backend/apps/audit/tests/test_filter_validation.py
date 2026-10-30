from datetime import datetime, timezone as dt_timezone
from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.audit.models import AuditLog
from apps.organizations.models import Organization, OrganizationRole
from apps.users.models import User


class AuditFilterValidationTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.password = 'Pass123!Secure'
        cls.admin_user = User.objects.create_user(
            username='audit_admin',
            email='audit_admin@cit.edu',
            password=cls.password,
            first_name='Audit',
            last_name='Admin',
        )
        cls.other_user = User.objects.create_user(
            username='audit_other',
            email='audit_other@cit.edu',
            password=cls.password,
            first_name='Other',
            last_name='User',
        )

        cls.org = Organization.objects.create(
            name='Audit Test Org',
            code='AUDITORG',
            description='Test Organization',
            period_year_start='2026-01-01',
            is_active=True,
        )
        OrganizationRole.objects.create(
            user=cls.admin_user,
            organization=cls.org,
            role='Admin',
            is_active=True,
        )

        # Base event for testing general filters
        cls.base_event = AuditLog.objects.create(
            user_id=cls.admin_user,
            organization_id=cls.org,
            action='base.event',
            ip_address='10.0.0.1',
        )

    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(self.admin_user)

    def test_invalid_organization_id_returns_400(self):
        """Malformed organization_id must return 400 Bad Request, not 500."""
        for bad_id in ('oops', '-1', '0', '99999999999999999999', 'null'):
            with self.subTest(bad_id=bad_id):
                response = self.client.get(
                    reverse('audit-list'),
                    {'organization_id': bad_id}
                )
                self.assertEqual(
                    response.status_code,
                    status.HTTP_400_BAD_REQUEST
                )
                self.assertIn('organization_id', response.data)

    def test_invalid_user_id_returns_400(self):
        """Malformed user_id must return 400 Bad Request, not 500."""
        for bad_id in ('oops', '-1', '0', '99999999999999999999', 'NaN'):
            with self.subTest(bad_id=bad_id):
                response = self.client.get(
                    reverse('audit-list'),
                    {'organization_id': self.org.id, 'user_id': bad_id}
                )
                self.assertEqual(
                    response.status_code,
                    status.HTTP_400_BAD_REQUEST
                )
                self.assertIn('user_id', response.data)

    def test_by_user_with_invalid_user_id_returns_400(self):
        """by_user action returns 400 when user_id is malformed."""
        response = self.client.get(
            reverse('audit-by-user'),
            {'organization_id': self.org.id, 'user_id': 'oops'}
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('user_id', response.data)

    def test_invalid_start_date_returns_400(self):
        """Malformed start_date returns 400 Bad Request, not 500."""
        response = self.client.get(
            reverse('audit-list'),
            {'organization_id': self.org.id, 'start_date': 'oops'}
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('start_date', response.data)

    def test_invalid_end_date_returns_400(self):
        """Malformed end_date returns 400 Bad Request, not 500."""
        response = self.client.get(
            reverse('audit-list'),
            {'organization_id': self.org.id, 'end_date': 'oops'}
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('end_date', response.data)

    def test_reversed_date_range_returns_400(self):
        """Reversed date range (start > end) returns 400 Bad Request."""
        response = self.client.get(
            reverse('audit-list'),
            {
                'organization_id': self.org.id,
                'start_date': '2026-10-30',
                'end_date': '2026-10-28',
            }
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('end_date', response.data)

    def test_reversed_datetime_range_returns_400(self):
        """Reversed datetime range returns 400 Bad Request."""
        response = self.client.get(
            reverse('audit-list'),
            {
                'organization_id': self.org.id,
                'start_date': '2026-10-28T14:00:00Z',
                'end_date': '2026-10-28T12:00:00Z',
            }
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('end_date', response.data)

    def test_invalid_ip_address_returns_400(self):
        """Malformed IP address returns 400 Bad Request, not 500."""
        response = self.client.get(
            reverse('audit-list'),
            {'organization_id': self.org.id, 'ip_address': 'oops'}
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('ip_address', response.data)

    def test_export_csv_with_invalid_parameter_returns_400(self):
        """CSV export returns 400 instead of 500 on malformed filter."""
        response = self.client.get(
            reverse('audit-export-csv'),
            {'organization_id': self.org.id, 'start_date': 'oops'}
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_stats_with_invalid_parameter_returns_400(self):
        """stats action returns 400 instead of 500 on malformed filter."""
        response = self.client.get(
            reverse('audit-stats'),
            {'organization_id': self.org.id, 'user_id': 'oops'}
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_by_date_with_invalid_date_returns_400(self):
        """by_date action returns 400 on malformed start_date or end_date."""
        response = self.client.get(
            reverse('audit-by-date'),
            {
                'organization_id': self.org.id,
                'start_date': 'oops',
                'end_date': '2026-10-28',
            }
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class AuditDateRangeInclusiveEndTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.password = 'Pass123!Secure'
        cls.admin_user = User.objects.create_user(
            username='date_admin',
            email='date_admin@cit.edu',
            password=cls.password,
        )
        cls.org = Organization.objects.create(
            name='Date Org',
            code='DATEORG',
            description='Date Test',
            period_year_start='2026-01-01',
            is_active=True,
        )
        OrganizationRole.objects.create(
            user=cls.admin_user,
            organization=cls.org,
            role='Admin',
            is_active=True,
        )

        # Create events on 2026-10-28 at different times
        cls.event_midnight = AuditLog.objects.create(
            user_id=cls.admin_user,
            organization_id=cls.org,
            action='event.midnight',
            ip_address='10.0.0.1',
        )
        AuditLog.objects.filter(pk=cls.event_midnight.pk).update(
            datetime=datetime(2026, 10, 28, 0, 0, 0, tzinfo=dt_timezone.utc)
        )

        cls.event_noon = AuditLog.objects.create(
            user_id=cls.admin_user,
            organization_id=cls.org,
            action='event.noon',
            ip_address='10.0.0.1',
        )
        AuditLog.objects.filter(pk=cls.event_noon.pk).update(
            datetime=datetime(2026, 10, 28, 12, 0, 0, tzinfo=dt_timezone.utc)
        )

        cls.event_night = AuditLog.objects.create(
            user_id=cls.admin_user,
            organization_id=cls.org,
            action='event.night',
            ip_address='10.0.0.1',
        )
        AuditLog.objects.filter(pk=cls.event_night.pk).update(
            datetime=datetime(2026, 10, 28, 23, 59, 59, tzinfo=dt_timezone.utc)
        )

        # Event on next day (2026-10-29 at 00:00:00)
        cls.event_next_day = AuditLog.objects.create(
            user_id=cls.admin_user,
            organization_id=cls.org,
            action='event.next_day',
            ip_address='10.0.0.1',
        )
        AuditLog.objects.filter(pk=cls.event_next_day.pk).update(
            datetime=datetime(2026, 10, 29, 0, 0, 0, tzinfo=dt_timezone.utc)
        )

    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(self.admin_user)

    def test_same_day_date_filter_includes_entire_day(self):
        """Filtering with same start and end date includes noon and night."""
        response = self.client.get(
            reverse('audit-list'),
            {
                'organization_id': self.org.id,
                'start_date': '2026-10-28',
                'end_date': '2026-10-28',
            }
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Should include all 3 events on Oct 28: midnight, noon, and night
        returned_actions = [r['action'] for r in response.data['results']]
        self.assertIn('event.midnight', returned_actions)
        self.assertIn('event.noon', returned_actions)
        self.assertIn('event.night', returned_actions)
        # Must NOT include next day event
        self.assertNotIn('event.next_day', returned_actions)
        self.assertEqual(len(returned_actions), 3)

    def test_by_date_action_includes_entire_day(self):
        """by_date endpoint includes noon and night events on selected date."""
        response = self.client.get(
            reverse('audit-by-date'),
            {
                'organization_id': self.org.id,
                'start_date': '2026-10-28',
                'end_date': '2026-10-28',
            }
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        returned_actions = [r['action'] for r in response.data]
        self.assertIn('event.midnight', returned_actions)
        self.assertIn('event.noon', returned_actions)
        self.assertIn('event.night', returned_actions)
        self.assertNotIn('event.next_day', returned_actions)

    def test_explicit_datetime_boundary_filtering(self):
        """Explicit datetime bounds filter with exact timestamps."""
        response = self.client.get(
            reverse('audit-list'),
            {
                'organization_id': self.org.id,
                'start_date': '2026-10-28T11:00:00Z',
                'end_date': '2026-10-28T13:00:00Z',
            }
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        returned_actions = [r['action'] for r in response.data['results']]
        # Only the noon event falls between 11:00 and 13:00
        self.assertEqual(returned_actions, ['event.noon'])

    def test_csv_export_includes_entire_selected_day(self):
        """CSV export with range includes daytime events on the end date."""
        response = self.client.get(
            reverse('audit-export-csv'),
            {
                'organization_id': self.org.id,
                'start_date': '2026-10-28',
                'end_date': '2026-10-28',
            }
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        content = response.content.decode('utf-8')
        self.assertIn('event.noon', content)
        self.assertIn('event.night', content)
        self.assertNotIn('event.next_day', content)
