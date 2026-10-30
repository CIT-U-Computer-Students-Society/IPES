from datetime import date
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from apps.evaluations.models import (
    AssignmentRule,
    EvaluationAssignment,
    EvaluationForm,
    Question,
)
from apps.organizations.models import (
    Membership,
    Organization,
    OrganizationRole,
    OrganizationUnit,
    PositionType,
    UnitType,
)
from apps.users.models import User


class MembershipReactivationTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.password = 'Pass123!Secure'
        cls.org = Organization.objects.create(
            name='Reactivation Org',
            code='REACT1',
            description='Test Organization',
            period_year_start=date(2026, 1, 1),
            is_active=True,
        )
        cls.admin_user = User.objects.create_user(
            username='react_admin',
            email='react_admin@cit.edu',
            password=cls.password,
            first_name='Admin',
            last_name='User',
        )
        OrganizationRole.objects.create(
            user=cls.admin_user,
            organization=cls.org,
            role='Admin',
            is_active=True,
        )

        cls.member_user = User.objects.create_user(
            username='react_member',
            email='react_member@cit.edu',
            password=cls.password,
            first_name='Member',
            last_name='User',
        )
        OrganizationRole.objects.create(
            user=cls.member_user,
            organization=cls.org,
            role='Member',
            is_active=True,
        )

        cls.unit_type = UnitType.objects.create(
            organization_id=cls.org,
            name='Tech Committee',
        )
        cls.unit = OrganizationUnit.objects.create(
            organization_id=cls.org,
            type_id=cls.unit_type,
            name='QA Unit',
            is_active=True,
        )
        cls.position = PositionType.objects.create(
            organization_id=cls.org,
            name='QA Engineer',
            rank=2,
            is_active=True,
        )

    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(self.admin_user)
        self.client.credentials(HTTP_X_ORGANIZATION_ID=str(self.org.id))

    def test_readd_previously_removed_position_reactivates_membership(self):
        """Adding a previously removed unit/position reactivates the row."""
        membership = Membership.objects.create(
            user_id=self.member_user,
            unit_id=self.unit,
            position_id=self.position,
            date_start=date(2026, 1, 1),
            date_end=date(2026, 6, 1),
            is_active=False,
        )
        initial_id = membership.id

        url = reverse('memberships-list')
        resp = self.client.post(url, {
            'user_id': self.member_user.id,
            'unit_id': self.unit.id,
            'position_id': self.position.id,
        }, format='json')

        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(resp.data['id'], initial_id)

        # Assert row reactivated and unique constraint maintained
        membership.refresh_from_db()
        self.assertTrue(membership.is_active)
        self.assertIsNone(membership.date_end)
        self.assertEqual(membership.date_start, timezone.now().date())
        self.assertEqual(
            Membership.objects.filter(
                user_id=self.member_user,
                unit_id=self.unit,
                position_id=self.position,
            ).count(),
            1,
        )

    def test_patch_inactive_membership_reactivates_successfully(self):
        """PATCHing an inactive membership with is_active: true reactivates."""
        membership = Membership.objects.create(
            user_id=self.member_user,
            unit_id=self.unit,
            position_id=self.position,
            date_start=date(2026, 1, 1),
            date_end=date(2026, 5, 1),
            is_active=False,
        )

        url = reverse('memberships-detail', kwargs={'pk': membership.id})
        resp = self.client.patch(url, {'is_active': True}, format='json')

        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        membership.refresh_from_db()
        self.assertTrue(membership.is_active)
        self.assertIsNone(membership.date_end)
        self.assertEqual(membership.date_start, timezone.now().date())

    def test_duplicate_active_membership_rejected_with_400(self):
        """Active membership cannot be duplicated."""
        Membership.objects.create(
            user_id=self.member_user,
            unit_id=self.unit,
            position_id=self.position,
            date_start=date(2026, 1, 1),
            is_active=True,
        )

        url = reverse('memberships-list')
        resp = self.client.post(url, {
            'user_id': self.member_user.id,
            'unit_id': self.unit.id,
            'position_id': self.position.id,
        }, format='json')

        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn(
            'already exists',
            str(resp.data),
        )

    def test_list_memberships_defaults_to_active_only(self):
        """List action returns only active memberships by default."""
        m_active = Membership.objects.create(
            user_id=self.admin_user,
            unit_id=self.unit,
            position_id=self.position,
            date_start=date(2026, 1, 1),
            is_active=True,
        )
        m_inactive = Membership.objects.create(
            user_id=self.member_user,
            unit_id=self.unit,
            position_id=self.position,
            date_start=date(2026, 1, 1),
            date_end=date(2026, 6, 1),
            is_active=False,
        )

        url = reverse('memberships-list')
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        results = (
            resp.data.get('results', resp.data)
            if isinstance(resp.data, dict)
            else resp.data
        )
        ids = [r['id'] for r in results]
        self.assertIn(m_active.id, ids)
        self.assertNotIn(m_inactive.id, ids)

    def test_list_memberships_supports_is_active_filter(self):
        """List action supports filtering for inactive memberships."""
        m_inactive = Membership.objects.create(
            user_id=self.member_user,
            unit_id=self.unit,
            position_id=self.position,
            date_start=date(2026, 1, 1),
            date_end=date(2026, 6, 1),
            is_active=False,
        )

        url = reverse('memberships-list')
        resp = self.client.get(url, {'is_active': 'false'})
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        results = (
            resp.data.get('results', resp.data)
            if isinstance(resp.data, dict)
            else resp.data
        )
        ids = [r['id'] for r in results]
        self.assertIn(m_inactive.id, ids)

    def test_reactivation_triggers_auto_assignment_generation(self):
        """Reactivating a membership triggers evaluation assignment signals."""
        form = EvaluationForm.objects.create(
            organization_id=self.org,
            title='Annual Peer Review',
            description='Peer review form',
            start_date=date(2026, 1, 1),
            end_date=date(2026, 12, 31),
            is_active=True,
            results_released=False,
        )
        Question.objects.create(
            form_id=form, text='Rate performance', input_type='rating',
            order=1, is_required=True,
        )
        AssignmentRule.objects.create(
            form_id=form,
            evaluator_unit=self.unit,
            evaluator_position=self.position,
            evaluatee_unit=self.unit,
            evaluatee_position=self.position,
        )

        # Peer evaluator
        peer = User.objects.create_user(
            username='peer_qa',
            email='peer_qa@cit.edu',
            password=self.password,
        )
        OrganizationRole.objects.create(
            user=peer,
            organization=self.org,
            role='Member',
            is_active=True,
        )
        Membership.objects.create(
            user_id=peer,
            unit_id=self.unit,
            position_id=self.position,
            date_start=date(2026, 1, 1),
            is_active=True,
        )

        # Inactive membership to reactivate
        Membership.objects.create(
            user_id=self.member_user,
            unit_id=self.unit,
            position_id=self.position,
            date_start=date(2026, 1, 1),
            date_end=date(2026, 6, 1),
            is_active=False,
        )

        # Reactivate via POST
        url = reverse('memberships-list')
        resp = self.client.post(url, {
            'user_id': self.member_user.id,
            'unit_id': self.unit.id,
            'position_id': self.position.id,
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)

        # Assert assignment generated for this reactivated member
        has_assignment = EvaluationAssignment.objects.filter(
            form_id=form,
            evaluator_id=self.member_user,
            evaluatee_id=peer,
        ).exists()
        self.assertTrue(has_assignment)
