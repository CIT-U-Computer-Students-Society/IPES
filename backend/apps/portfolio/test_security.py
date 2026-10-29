from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from apps.organizations.models import Organization, OrganizationRole
from apps.portfolio.models import Accomplishment
from apps.portfolio.serializers import (
    AccomplishmentCreateSerializer, AccomplishmentUpdateSerializer,
)
from apps.users.models import User


class InjectionSecurityTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(
            username='injection', email='injection@cit.edu',
            password='password123',
        )
        cls.org = Organization.objects.create(
            name='Security test', code='SECURITY', description='',
            period_year_start='2026-01-01',
        )
        OrganizationRole.objects.create(
            user=cls.user, organization=cls.org, role='Admin',
        )
        cls.payload = "' OR 1=1; --"
        for kind in ('Project', cls.payload):
            Accomplishment.objects.create(
                user_id=cls.user, organization_id=cls.org, title=kind,
                description=kind, type=kind, date_completed=timezone.now(),
            )

    def test_api_filter_treats_sql_payload_as_literal_data(self):
        client = APIClient()
        client.force_authenticate(self.user)
        response = client.get(
            reverse('accomplishments-list'), {'type': self.payload},
            HTTP_X_ORGANIZATION_ID=str(self.org.pk),
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['count'], 1)
        self.assertEqual(response.data['results'][0]['title'], self.payload)
        self.assertEqual(Accomplishment.objects.count(), 2)

    def test_proof_links_reject_executable_schemes_on_create_and_update(self):
        serializers = (
            AccomplishmentCreateSerializer, AccomplishmentUpdateSerializer,
        )
        payloads = (
            'javascript:alert(1)', 'JaVaScRiPt:alert(1)',
            'data:text/html,<script>alert(1)</script>',
            'ftp://example.com/proof',
        )
        for serializer in serializers:
            for payload in payloads:
                with self.subTest(
                    serializer=serializer.__name__, payload=payload,
                ):
                    form = serializer(
                        data={'proof_link': payload}, partial=True,
                    )
                    self.assertFalse(form.is_valid())
                    self.assertIn('proof_link', form.errors)
            form = serializer(
                data={'proof_link': 'https://example.com/proof'}, partial=True,
            )
            self.assertTrue(form.is_valid(), form.errors)
