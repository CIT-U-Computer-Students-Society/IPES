"""Audit actor names must be searchable without crossing tenant boundaries."""

import csv
import io
from datetime import date

from django.urls import reverse
from rest_framework.test import APITestCase

from apps.audit.models import AuditLog
from apps.organizations.models import Organization, OrganizationRole
from apps.users.models import User


class AuditActorNameSearchTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        cls.org = Organization.objects.create(
            name='Tenant A', code='NAME-A', description='A', period_year_start=date(2026, 1, 1),
        )
        cls.other_org = Organization.objects.create(
            name='Tenant B', code='NAME-B', description='B', period_year_start=date(2026, 1, 1),
        )
        cls.admin = User.objects.create_user(username='admin', email='admin@example.test')
        cls.member = User.objects.create_user(username='member', email='member@example.test')
        cls.actor = User.objects.create_user(
            username='actor', email='actor@example.test', first_name='Zinnia', last_name='Quartz',
        )
        cls.other_actor = User.objects.create_user(
            username='other', email='other@example.test', first_name='Zinnia', last_name='Quartz',
        )
        OrganizationRole.objects.create(user=cls.admin, organization=cls.org, role='Admin')
        OrganizationRole.objects.create(user=cls.member, organization=cls.org, role='Member')
        cls.event = AuditLog.objects.create(user_id=cls.actor, organization_id=cls.org, action='event.local')
        AuditLog.objects.create(user_id=cls.other_actor, organization_id=cls.other_org, action='event.private')
        AuditLog.objects.create(user_id=None, organization_id=cls.org, action='event.system')
        for i in range(25):
            AuditLog.objects.create(user_id=cls.admin, organization_id=cls.org, action=f'event.noise.{i}')

    def setUp(self):
        self.client.force_authenticate(self.admin)
        self.client.credentials(HTTP_X_ORGANIZATION_ID=str(self.org.pk))

    def test_first_and_last_name_match_before_pagination_in_list_and_search(self):
        for term in ('zInNiA', 'QUARTZ', 'inni', 'uart'):
            with self.subTest(term=term):
                listing = self.client.get(reverse('audit-list'), {'q': term})
                self.assertEqual(listing.status_code, 200, listing.data)
                self.assertEqual(listing.data['count'], 1)
                self.assertEqual([row['id'] for row in listing.data['results']], [self.event.pk])
                search = self.client.get(reverse('audit-search'), {'q': term})
                self.assertEqual(search.status_code, 200, search.data)
                self.assertEqual([row['id'] for row in search.data], [self.event.pk])

    def test_csv_export_uses_same_tenant_scoped_actor_name_filter(self):
        for term in ('zinnia', 'quartz'):
            with self.subTest(term=term):
                response = self.client.get(reverse('audit-export-csv'), {'q': term})
                self.assertEqual(response.status_code, 200)
                rows = list(csv.reader(io.StringIO(response.content.decode('utf-8'))))
                self.assertEqual(len(rows), 2)
                self.assertEqual(rows[1][1:4], ['Zinnia Quartz', self.actor.email, 'event.local'])
                self.assertNotIn('event.private', response.content.decode('utf-8'))

    def test_member_cannot_search_or_export_other_users_events(self):
        self.client.force_authenticate(self.member)
        listing = self.client.get(reverse('audit-list'), {'q': 'Zinnia'})
        self.assertEqual(listing.status_code, 200)
        self.assertEqual(listing.data['count'], 0)
        export = self.client.get(reverse('audit-export-csv'), {'q': 'Zinnia'})
        self.assertEqual(export.status_code, 200)
        self.assertEqual(len(list(csv.reader(io.StringIO(export.content.decode('utf-8'))))), 1)
