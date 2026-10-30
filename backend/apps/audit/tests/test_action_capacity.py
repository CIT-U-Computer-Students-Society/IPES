"""Valid entity metadata must remain complete in PostgreSQL audit records."""

from datetime import date

from django.urls import reverse
from rest_framework.test import APITestCase

from apps.audit.models import AuditLog
from apps.audit.utils import log_action
from apps.evaluations.models import EvaluationForm
from apps.organizations.models import Organization, OrganizationRole
from apps.users.models import User


class AuditActionCapacityTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        cls.org = Organization.objects.create(name='One', code='ONE', description='Test', period_year_start=date(2026, 1, 1))
        cls.admin = User.objects.create_user(username='admin', email='admin@example.test')
        OrganizationRole.objects.create(user=cls.admin, organization=cls.org, role='Admin')

    def setUp(self):
        self.client.force_authenticate(self.admin)
        self.client.credentials(HTTP_X_ORGANIZATION_ID=str(self.org.pk))

    def test_maximum_form_title_and_event_context_are_persisted_and_readable(self):
        title = 'x' * 255
        response = self.client.post(reverse('forms-list'), {
            'organization_id': self.org.pk, 'title': title,
            'start_date': '2026-01-01', 'end_date': '2026-12-31',
        }, format='json')
        self.assertEqual(response.status_code, 201, response.data)
        form = EvaluationForm.objects.get(pk=response.data['id'])
        rows = AuditLog.objects.filter(organization_id=self.org, action__startswith='evaluation.form_created')
        self.assertEqual(rows.count(), 1)
        event = rows.get()
        self.assertGreater(len(event.action), 255)
        self.assertIn(f'form_title={title}', event.action)
        self.assertIn(f'form_id={form.pk}', event.action)
        listing = self.client.get(reverse('audit-list'), {'organization_id': self.org.pk})
        self.assertEqual(listing.status_code, 200, listing.data)
        self.assertEqual(listing.data['results'][0]['action'], event.action)

    def test_large_metadata_value_is_preserved_without_truncation(self):
        detail = 'context-' + ('é' * 4096) + '-end'
        log_action(self.admin, 'test.long_event', organization_id=self.org.pk, detail=detail)
        event = AuditLog.objects.get(organization_id=self.org)
        self.assertEqual(event.action, f'test.long_event (detail={detail})')
