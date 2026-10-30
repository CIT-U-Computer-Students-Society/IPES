"""Calendar and boundary errors must be client errors on audit reads."""

from datetime import date, datetime, timezone

from django.urls import reverse
from rest_framework.test import APITestCase

from apps.audit.models import AuditLog
from apps.organizations.models import Organization, OrganizationRole
from apps.users.models import User


class AuditCalendarBoundsTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        cls.org = Organization.objects.create(
            name='Audit', code='DATE', description='Test', period_year_start=date(2026, 1, 1),
        )
        cls.admin = User.objects.create_user(username='admin', email='admin@example.test')
        OrganizationRole.objects.create(user=cls.admin, organization=cls.org, role='Admin')
        event = AuditLog.objects.create(user_id=cls.admin, organization_id=cls.org, action='test.event')
        AuditLog.objects.filter(pk=event.pk).update(datetime=datetime(2026, 10, 1, tzinfo=timezone.utc))

    def setUp(self):
        self.client.force_authenticate(self.admin)
        self.client.credentials(HTTP_X_ORGANIZATION_ID=str(self.org.pk))

    def test_invalid_calendar_values_and_end_overflow_are_field_errors(self):
        cases = (('start_date', '2026-02-30'), ('start_date', '2026-13-01T10:00:00Z'),
                 ('end_date', '2026-11-31'), ('end_date', '9999-12-31'))
        for route in ('audit-list', 'audit-export-csv', 'audit-stats', 'audit-by-date'):
            for field, value in cases:
                with self.subTest(route=route, field=field, value=value):
                    params = {'start_date': '2026-01-01', 'end_date': '2026-12-31'}
                    params[field] = value
                    response = self.client.get(reverse(route), params)
                    self.assertEqual(response.status_code, 400, getattr(response, 'data', None))
                    self.assertIn(field, response.data)

    def test_reversed_range_at_exclusive_day_boundary_is_rejected(self):
        response = self.client.get(reverse('audit-list'), {
            'start_date': '2026-10-29T00:00:00Z', 'end_date': '2026-10-28',
        })
        self.assertEqual(response.status_code, 400, response.data)
        self.assertIn('end_date', response.data)

    def test_valid_leap_day_and_datetime_bounds_remain_valid(self):
        response = self.client.get(reverse('audit-list'), {
            'start_date': '2024-02-29', 'end_date': '2026-12-31T23:59:59Z',
        })
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['count'], 1)
