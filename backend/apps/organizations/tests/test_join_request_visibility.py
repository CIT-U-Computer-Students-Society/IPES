"""Join-request ownership, tenant visibility, and immutable workflow boundaries."""

from datetime import date

from django.urls import reverse
from rest_framework.test import APITestCase

from apps.organizations.models import (
    JoinRequest, Organization, OrganizationRole, OrganizationUnit, PositionType, UnitType,
)
from apps.users.models import User


class JoinRequestVisibilityTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        cls.org_a = Organization.objects.create(name='A', code='ORG-A', description='A', period_year_start=date(2026, 1, 1))
        cls.org_b = Organization.objects.create(name='B', code='ORG-B', description='B', period_year_start=date(2026, 1, 1))
        cls.admin_a = User.objects.create_user(username='admin-a', email='admin-a@example.test', password='password-a')
        cls.member_a = User.objects.create_user(username='member-a', email='member-a@example.test')
        cls.owner = User.objects.create_user(username='owner', email='owner@example.test', password='owner-original')
        cls.other = User.objects.create_user(username='other', email='other@example.test')
        cls.outsider = User.objects.create_user(username='outsider', email='outsider@example.test')
        cls.revoked = User.objects.create_user(username='revoked', email='revoked@example.test')
        OrganizationRole.objects.create(user=cls.admin_a, organization=cls.org_a, role='Admin')
        OrganizationRole.objects.create(user=cls.member_a, organization=cls.org_a, role='Member')
        OrganizationRole.objects.create(user=cls.revoked, organization=cls.org_a, role='Admin', is_active=False)
        cls.a_request = JoinRequest.objects.create(user=cls.other, organization=cls.org_a)
        cls.b_request = JoinRequest.objects.create(user=cls.owner, organization=cls.org_b, status='Approved')
        cls.owner_a = JoinRequest.objects.create(user=cls.owner, organization=cls.org_a)
        unit_type = UnitType.objects.create(organization_id=cls.org_a, name='Department')
        cls.unit = OrganizationUnit.objects.create(organization_id=cls.org_a, type_id=unit_type, name='Unit')
        cls.position = PositionType.objects.create(organization_id=cls.org_a, name='Officer', rank=1)
        cls.list_url = reverse('join-requests-list')

    def set_user(self, user, org=None):
        self.client.force_authenticate(user)
        self.client.credentials(**({'HTTP_X_ORGANIZATION_ID': str(org.pk)} if org else {}))

    def ids(self, response):
        self.assertEqual(response.status_code, 200, response.data)
        return {item['id'] for item in response.data['results']}

    def test_owner_can_read_only_own_requests_without_membership(self):
        self.set_user(self.owner)
        self.assertEqual(self.ids(self.client.get(self.list_url)), {self.owner_a.pk, self.b_request.pk})
        self.assertEqual(self.client.get(reverse('join-requests-detail', args=[self.b_request.pk])).status_code, 200)
        self.assertEqual(self.client.get(reverse('join-requests-detail', args=[self.a_request.pk])).status_code, 404)
        self.set_user(self.owner, self.org_b)
        self.assertEqual(self.ids(self.client.get(self.list_url)), {self.b_request.pk})

    def test_active_tenant_admin_sees_only_selected_organization(self):
        self.set_user(self.admin_a, self.org_a)
        self.assertEqual(self.ids(self.client.get(self.list_url)), {self.a_request.pk, self.owner_a.pk})
        self.assertEqual(self.ids(self.client.get(self.list_url, {'status': 'Pending'})), {self.a_request.pk, self.owner_a.pk})
        self.assertEqual(self.client.get(reverse('join-requests-detail', args=[self.b_request.pk])).status_code, 404)
        self.set_user(self.admin_a)
        self.assertEqual(self.ids(self.client.get(self.list_url)), set())

    def test_non_admin_and_revoked_admin_cannot_view_others(self):
        for user in (self.member_a, self.revoked, self.outsider):
            with self.subTest(user=user.username):
                self.set_user(user, self.org_a)
                self.assertEqual(self.ids(self.client.get(self.list_url)), set())
                self.assertEqual(self.client.get(reverse('join-requests-detail', args=[self.a_request.pk])).status_code, 404)

    def test_generic_writes_cannot_modify_requester_organization_or_status(self):
        for user in (self.admin_a, self.owner, self.outsider):
            self.set_user(user, self.org_a)
            url = reverse('join-requests-detail', args=[self.owner_a.pk])
            payload = {'user': self.outsider.pk, 'organization': self.org_b.pk, 'status': 'Approved'}
            for method in (self.client.patch, self.client.put):
                self.assertEqual(method(url, payload, format='json').status_code, 405)
            self.assertEqual(self.client.delete(url).status_code, 405)
            self.assertEqual(self.client.post(self.list_url, payload, format='json').status_code, 405)
        self.owner_a.refresh_from_db()
        self.assertEqual((self.owner_a.user_id, self.owner_a.organization_id, self.owner_a.status),
                         (self.owner.pk, self.org_a.pk, 'Pending'))

    def test_cross_tenant_retarget_approval_and_password_reset_chain_is_blocked(self):
        self.set_user(self.admin_a, self.org_a)
        detail = reverse('join-requests-detail', args=[self.b_request.pk])
        self.assertEqual(self.client.patch(detail, {'organization': self.org_a.pk, 'status': 'Pending'}, format='json').status_code, 405)
        response = self.client.post(reverse('join-requests-approve', args=[self.b_request.pk]), {
            'unit_id': self.unit.pk, 'position_id': self.position.pk, 'role': 'Admin',
        }, format='json')
        self.assertEqual(response.status_code, 404)
        self.assertFalse(OrganizationRole.objects.filter(user=self.owner, organization=self.org_a).exists())
        response = self.client.post(reverse('users-set-password', args=[self.owner.pk]), {'password': 'replacement123'}, format='json')
        self.assertIn(response.status_code, (403, 404))
        self.owner.refresh_from_db()
        self.assertTrue(self.owner.check_password('owner-original'))
        self.b_request.refresh_from_db()
        self.assertEqual((self.b_request.organization_id, self.b_request.status), (self.org_b.pk, 'Approved'))

    def test_existing_onboarding_and_admin_approval_remain_available(self):
        self.set_user(self.outsider)
        response = self.client.post(reverse('organizations-join-by-code'), {'code': self.org_a.code}, format='json')
        self.assertEqual(response.status_code, 201, response.data)
        application = JoinRequest.objects.get(user=self.outsider, organization=self.org_a)
        self.set_user(self.admin_a, self.org_a)
        response = self.client.post(reverse('join-requests-approve', args=[application.pk]), {
            'unit_id': self.unit.pk, 'position_id': self.position.pk,
        }, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        application.refresh_from_db()
        self.assertEqual(application.status, 'Approved')
        self.assertTrue(OrganizationRole.objects.filter(user=self.outsider, organization=self.org_a, is_active=True).exists())

    def test_invalid_or_conflicting_selectors_do_not_bypass_scope(self):
        self.set_user(self.admin_a, self.org_a)
        self.assertEqual(self.client.get(self.list_url, {'organization_id': self.org_b.pk}).status_code, 400)
        self.assertEqual(self.client.get(self.list_url, {'user_id': 'bad'}).status_code, 400)
        self.set_user(self.admin_a)
        self.assertEqual(self.client.get(self.list_url, {'organization_id': 'bad'}).status_code, 400)
