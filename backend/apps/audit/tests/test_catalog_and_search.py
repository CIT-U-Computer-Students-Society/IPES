"""Audit catalogs and searches must preserve authorized tenant scope."""

from datetime import date

from django.urls import reverse
from rest_framework.test import APITestCase

from apps.audit.models import AuditLog
from apps.organizations.models import Organization, OrganizationRole
from apps.users.models import User


class AuditCatalogAndSearchTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        cls.org_a = Organization.objects.create(name='A', code='AUD-A', description='A', period_year_start=date(2026, 1, 1))
        cls.org_b = Organization.objects.create(name='B', code='AUD-B', description='B', period_year_start=date(2026, 1, 1))
        cls.admin = User.objects.create_user(username='admin', email='admin@example.test')
        cls.member = User.objects.create_user(username='member', email='member@example.test')
        cls.outsider = User.objects.create_user(username='outsider', email='outsider@example.test')
        cls.platform = User.objects.create_superuser(username='platform', email='platform@example.test', password='platform-pass')
        OrganizationRole.objects.create(user=cls.admin, organization=cls.org_a, role='Admin')
        OrganizationRole.objects.create(user=cls.member, organization=cls.org_a, role='Member')
        cls.event_a = AuditLog.objects.create(user_id=cls.admin, organization_id=cls.org_a,
                                              action='target.action (contact=a@example.test)', ip_address='10.1.2.3')
        cls.event_b = AuditLog.objects.create(user_id=cls.outsider, organization_id=cls.org_b,
                                              action='private.action (contact=b@example.test)', ip_address='10.9.8.7')

    def auth(self, user, org=None):
        self.client.force_authenticate(user)
        self.client.credentials(**({'HTTP_X_ORGANIZATION_ID': str(org.pk)} if org else {}))

    def test_action_catalog_scopes_tenants_and_denies_unprivileged_users(self):
        self.auth(self.admin, self.org_a)
        response = self.client.get(reverse('audit-actions'))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data, [self.event_a.action])
        for user in (self.member, self.outsider):
            with self.subTest(user=user.email):
                self.auth(user, self.org_a)
                response = self.client.get(reverse('audit-actions'))
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.data, [])
        self.auth(self.admin, self.org_a)
        conflict = self.client.get(reverse('audit-actions'), {'organization_id': self.org_b.pk})
        self.assertEqual(conflict.status_code, 400)
        self.assertIn('organization_id', conflict.data)

    def test_revoked_role_and_inactive_organization_cannot_read_catalog(self):
        self.auth(self.admin, self.org_a)
        OrganizationRole.objects.filter(user=self.admin, organization=self.org_a).update(is_active=False)
        self.assertEqual(self.client.get(reverse('audit-actions')).data, [])
        OrganizationRole.objects.filter(user=self.admin, organization=self.org_a).update(is_active=True)
        self.org_a.is_active = False
        self.org_a.save(update_fields=['is_active'])
        self.assertEqual(self.client.get(reverse('audit-actions')).data, [])

    def test_platform_scope_and_filters_apply_to_action_catalog(self):
        self.auth(self.platform)
        response = self.client.get(reverse('audit-actions'))
        self.assertEqual(set(response.data), {self.event_a.action, self.event_b.action})
        self.auth(self.platform, self.org_a)
        self.assertEqual(self.client.get(reverse('audit-actions')).data, [self.event_a.action])
        self.assertEqual(self.client.get(reverse('audit-actions'), {'action': 'missing'}).data, [])
        invalid = self.client.get(reverse('audit-actions'), {'start_date': '2026-02-30'})
        self.assertEqual(invalid.status_code, 400)
        self.assertIn('start_date', invalid.data)

    def test_list_search_applies_before_pagination_and_respects_tenant(self):
        for i in range(25):
            AuditLog.objects.create(user_id=self.admin, organization_id=self.org_a, action=f'noise.{i}')
        self.auth(self.admin, self.org_a)
        for term in ('target.action', '10.1.2.3'):
            with self.subTest(term=term):
                response = self.client.get(reverse('audit-list'), {'q': term})
                self.assertEqual(response.status_code, 200, response.data)
                self.assertEqual(response.data['count'], 1)
                self.assertEqual(response.data['results'][0]['id'], self.event_a.pk)
        absent = self.client.get(reverse('audit-list'), {'q': 'private.action'})
        self.assertEqual(absent.status_code, 200)
        self.assertEqual(absent.data['count'], 0)
        self.assertEqual(self.client.get(reverse('audit-list'), {'q': 'no-such-event'}).data['count'], 0)
        email = self.client.get(reverse('audit-list'), {'q': self.admin.email})
        self.assertEqual(email.data['count'], 26)

    def test_search_action_and_list_agree_for_same_filters(self):
        self.auth(self.admin, self.org_a)
        params = {'q': 'target.action'}
        listing = self.client.get(reverse('audit-list'), params)
        search = self.client.get(reverse('audit-search'), params)
        self.assertEqual(listing.status_code, 200)
        self.assertEqual(search.status_code, 200)
        self.assertEqual([x['id'] for x in listing.data['results']], [x['id'] for x in search.data])
