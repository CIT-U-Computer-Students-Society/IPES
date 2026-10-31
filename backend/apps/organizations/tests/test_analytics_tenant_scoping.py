"""
Regression tests for organization analytics tenant isolation and scoping.
Covers Issue #269.
"""

from datetime import date, timedelta
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.evaluations.models import EvaluationAssignment, EvaluationForm
from apps.organizations.models import (
    Membership, Organization, OrganizationRole, OrganizationUnit,
    PositionType, UnitType,
)
from apps.users.models import User


class AnalyticsTenantScopingTests(APITestCase):
    """
    Ensure unit_completion_stats and analytics_summary enforce tenant
    authorization and scope assignment counts strictly to the active
    organization.
    """

    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        today = timezone.now().date()
        cls.org_a = Organization.objects.create(
            name='Org Alpha',
            code='ALPHA',
            description='Alpha Org',
            period_year_start=date(2026, 1, 1),
            is_active=True,
        )
        cls.org_b = Organization.objects.create(
            name='Org Beta',
            code='BETA',
            description='Beta Org',
            period_year_start=date(2026, 1, 1),
            is_active=True,
        )
        cls.org_inactive = Organization.objects.create(
            name='Org Inactive',
            code='INACT',
            description='Inactive Org',
            period_year_start=date(2026, 1, 1),
            is_active=False,
        )

        cls.admin_a = User.objects.create_user(
            username='admin_a', email='admin_a@test.org'
        )
        cls.member_shared = User.objects.create_user(
            username='shared_user', email='shared@test.org'
        )
        cls.evaluator = User.objects.create_user(
            username='evaluator', email='evaluator@test.org'
        )
        cls.unrelated = User.objects.create_user(
            username='unrelated', email='unrelated@test.org'
        )
        cls.inactive_user = User.objects.create_user(
            username='inactive_user', email='inactive@test.org'
        )

        # Organization roles
        OrganizationRole.objects.create(
            user=cls.admin_a, organization=cls.org_a, role='Admin',
            is_active=True,
        )
        OrganizationRole.objects.create(
            user=cls.member_shared, organization=cls.org_a, role='Member',
            is_active=True,
        )
        OrganizationRole.objects.create(
            user=cls.member_shared, organization=cls.org_b, role='Member',
            is_active=True,
        )
        OrganizationRole.objects.create(
            user=cls.evaluator, organization=cls.org_a, role='Member',
            is_active=True,
        )
        OrganizationRole.objects.create(
            user=cls.evaluator, organization=cls.org_b, role='Member',
            is_active=True,
        )
        OrganizationRole.objects.create(
            user=cls.unrelated, organization=cls.org_b, role='Member',
            is_active=True,
        )
        OrganizationRole.objects.create(
            user=cls.inactive_user, organization=cls.org_inactive,
            role='Member', is_active=True,
        )

        # Units and positions in Org A
        cls.unit_type_a = UnitType.objects.create(
            name='Committee', organization_id=cls.org_a,
        )
        cls.unit_a = OrganizationUnit.objects.create(
            name='Unit A', organization_id=cls.org_a,
            type_id=cls.unit_type_a, is_active=True,
        )
        cls.pos_a = PositionType.objects.create(
            name='Officer', rank=1, organization_id=cls.org_a,
            is_active=True,
        )
        Membership.objects.create(
            user_id=cls.member_shared, unit_id=cls.unit_a,
            position_id=cls.pos_a, is_active=True, date_start=today,
        )

        # Units and positions in Org B
        cls.unit_type_b = UnitType.objects.create(
            name='Department', organization_id=cls.org_b,
        )
        cls.unit_b = OrganizationUnit.objects.create(
            name='Unit B', organization_id=cls.org_b,
            type_id=cls.unit_type_b, is_active=True,
        )
        cls.pos_b = PositionType.objects.create(
            name='Lead', rank=1, organization_id=cls.org_b,
            is_active=True,
        )
        Membership.objects.create(
            user_id=cls.member_shared, unit_id=cls.unit_b,
            position_id=cls.pos_b, is_active=True, date_start=today,
        )

        # Evaluation forms
        cls.form_a = EvaluationForm.objects.create(
            organization_id=cls.org_a,
            title='Form Alpha Active',
            start_date=today,
            end_date=today + timedelta(days=7),
            is_active=True,
            is_deleted=False,
            created_by=cls.admin_a,
        )
        cls.form_b = EvaluationForm.objects.create(
            organization_id=cls.org_b,
            title='Form Beta Active',
            start_date=today,
            end_date=today + timedelta(days=7),
            is_active=True,
            is_deleted=False,
            created_by=cls.admin_a,
        )
        cls.form_a_deleted = EvaluationForm.objects.create(
            organization_id=cls.org_a,
            title='Form Alpha Deleted',
            start_date=today,
            end_date=today + timedelta(days=7),
            is_active=True,
            is_deleted=True,
            created_by=cls.admin_a,
        )

        # Evaluation assignments
        # 1. Org A active form assignment for shared member (Completed)
        EvaluationAssignment.objects.create(
            evaluator_id=cls.evaluator,
            evaluatee_id=cls.member_shared,
            form_id=cls.form_a,
            status='Completed',
        )
        # 2. Org B active form assignment for shared member (Pending)
        EvaluationAssignment.objects.create(
            evaluator_id=cls.evaluator,
            evaluatee_id=cls.member_shared,
            form_id=cls.form_b,
            status='Pending',
        )
        # 3. Org A deleted form assignment for shared member (Pending)
        EvaluationAssignment.objects.create(
            evaluator_id=cls.evaluator,
            evaluatee_id=cls.member_shared,
            form_id=cls.form_a_deleted,
            status='Pending',
        )

        cls.unit_stats_url = reverse('organizations-unit-completion-stats')
        cls.analytics_url = reverse('organizations-analytics-summary')

    def test_unit_completion_stats_tenant_isolation(self):
        """
        Verify unit completion stats count only active assignments from
        non-deleted forms belonging to the active organization.
        """
        self.client.force_authenticate(self.admin_a)
        self.client.credentials(HTTP_X_ORGANIZATION_ID=str(self.org_a.id))

        response = self.client.get(self.unit_stats_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)

        unit_stat = response.data[0]
        self.assertEqual(unit_stat['unit_id'], self.unit_a.id)
        self.assertEqual(unit_stat['unit_name'], 'Unit A')
        self.assertEqual(unit_stat['total_members'], 1)
        # Should count ONLY the 1 completed assignment from form_a in Org A
        self.assertEqual(unit_stat['total_assignments'], 1)
        self.assertEqual(unit_stat['completed_assignments'], 1)
        self.assertEqual(unit_stat['completion_percentage'], 100.0)

    def test_analytics_summary_tenant_isolation(self):
        """
        Verify analytics summary isolates tenant totals and does not leak
        global database metrics or assignments from other organizations.
        """
        self.client.force_authenticate(self.admin_a)
        self.client.credentials(HTTP_X_ORGANIZATION_ID=str(self.org_a.id))

        response = self.client.get(self.analytics_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        data = response.data
        self.assertEqual(data['total_organizations'], 1)
        self.assertEqual(data['total_units'], 1)
        self.assertEqual(data['total_members'], 1)
        # 3 users in Org A: admin_a, member_shared, evaluator
        self.assertEqual(data['total_users'], 3)
        self.assertEqual(data['total_assignments'], 1)
        self.assertEqual(data['completed_assignments'], 1)
        self.assertEqual(data['pending_assignments'], 0)
        self.assertEqual(data['overall_completion_rate'], 100.0)

    def test_query_param_only_works_when_authorized_and_valid(self):
        """
        Verify query parameter without header succeeds when authorized.
        """
        self.client.force_authenticate(self.admin_a)
        response = self.client.get(
            f'{self.analytics_url}?organization_id={self.org_a.id}'
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['total_assignments'], 1)
        self.assertEqual(response.data['completed_assignments'], 1)

    def test_conflicting_organization_header_and_parameter_rejected(self):
        """
        Conflicting X-Organization-Id header and organization_id parameter
        must return HTTP 400 Bad Request.
        """
        self.client.force_authenticate(self.admin_a)
        self.client.credentials(HTTP_X_ORGANIZATION_ID=str(self.org_a.id))

        for url in (self.unit_stats_url, self.analytics_url):
            with self.subTest(url=url):
                response = self.client.get(
                    f'{url}?organization_id={self.org_b.id}'
                )
                self.assertEqual(
                    response.status_code, status.HTTP_400_BAD_REQUEST
                )
                self.assertIn('organization_id', response.data)

    def test_missing_tenant_context_rejected(self):
        """
        Requests without header or parameter must return HTTP 400 Bad Request.
        """
        self.client.force_authenticate(self.admin_a)

        for url in (self.unit_stats_url, self.analytics_url):
            with self.subTest(url=url):
                response = self.client.get(url)
                self.assertEqual(
                    response.status_code, status.HTTP_400_BAD_REQUEST
                )
                self.assertIn('organization_id', response.data)

    def test_unrelated_user_forbidden(self):
        """
        An authenticated user without membership in the target organization
        must receive HTTP 403 Forbidden.
        """
        self.client.force_authenticate(self.unrelated)
        self.client.credentials(HTTP_X_ORGANIZATION_ID=str(self.org_a.id))

        for url in (self.unit_stats_url, self.analytics_url):
            with self.subTest(url=url):
                response = self.client.get(url)
                self.assertEqual(
                    response.status_code, status.HTTP_403_FORBIDDEN
                )

    def test_inactive_organization_forbidden(self):
        """
        Requests for an inactive organization must receive HTTP 403 Forbidden.
        """
        self.client.force_authenticate(self.inactive_user)
        self.client.credentials(
            HTTP_X_ORGANIZATION_ID=str(self.org_inactive.id)
        )

        for url in (self.unit_stats_url, self.analytics_url):
            with self.subTest(url=url):
                response = self.client.get(url)
                self.assertEqual(
                    response.status_code, status.HTTP_403_FORBIDDEN
                )

    def test_soft_deleted_users_excluded_from_total_users(self):
        """
        Soft-deleted users must not be counted in analytics total_users.
        """
        self.member_shared.is_active = False
        self.member_shared.save()

        self.client.force_authenticate(self.admin_a)
        self.client.credentials(HTTP_X_ORGANIZATION_ID=str(self.org_a.id))
        response = self.client.get(
            f'{self.analytics_url}?organization_id={self.org_a.id}'
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        roles_count = OrganizationRole.objects.filter(
            organization_id=self.org_a.id,
            is_active=True,
            user__is_active=True,
        ).values('user_id').distinct().count()
        self.assertEqual(roles_count, 2)
        self.assertEqual(response.data['total_users'], 2)
