from datetime import date
from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.evaluations.models import (
    AssignmentRule,
    EvaluationAssignment,
    EvaluationForm,
    Question,
)
from apps.evaluations.services import generate_rule_assignments, member_ids
from apps.organizations.models import (
    Membership,
    Organization,
    OrganizationRole,
    OrganizationUnit,
    PositionType,
    UnitType,
)
from apps.users.models import User


class AssignmentGeneratorEligibilityTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.password = 'Pass123!Secure'
        cls.org_a = Organization.objects.create(
            name='Generator Org Alpha',
            code='GENA',
            description='First Test Org',
            period_year_start=date(2026, 1, 1),
            is_active=True,
        )
        cls.org_b = Organization.objects.create(
            name='Generator Org Beta',
            code='GENB',
            description='Second Test Org',
            period_year_start=date(2026, 1, 1),
            is_active=True,
        )

        cls.admin_user = User.objects.create_user(
            username='gen_admin',
            email='gen_admin@cit.edu',
            password=cls.password,
            first_name='Admin',
            last_name='User',
        )
        OrganizationRole.objects.create(
            user=cls.admin_user,
            organization=cls.org_a,
            role='Admin',
            is_active=True,
        )

        cls.unit_type = UnitType.objects.create(
            organization_id=cls.org_a,
            name='Engineering Committee',
        )
        cls.unit = OrganizationUnit.objects.create(
            organization_id=cls.org_a,
            type_id=cls.unit_type,
            name='Backend Devs',
            is_active=True,
        )
        cls.position = PositionType.objects.create(
            organization_id=cls.org_a,
            name='Software Engineer',
            rank=2,
            is_active=True,
        )

        # Active members
        cls.user_active1 = User.objects.create_user(
            username='active1',
            email='active1@cit.edu',
            password=cls.password,
        )
        OrganizationRole.objects.create(
            user=cls.user_active1,
            organization=cls.org_a,
            role='Member',
            is_active=True,
        )
        Membership.objects.create(
            user_id=cls.user_active1,
            unit_id=cls.unit,
            position_id=cls.position,
            date_start=date(2026, 1, 1),
            is_active=True,
        )

        cls.user_active2 = User.objects.create_user(
            username='active2',
            email='active2@cit.edu',
            password=cls.password,
        )
        OrganizationRole.objects.create(
            user=cls.user_active2,
            organization=cls.org_a,
            role='Member',
            is_active=True,
        )
        Membership.objects.create(
            user_id=cls.user_active2,
            unit_id=cls.unit,
            position_id=cls.position,
            date_start=date(2026, 1, 1),
            is_active=True,
        )

        # Revoked role member
        cls.user_revoked = User.objects.create_user(
            username='revoked_role',
            email='revoked_role@cit.edu',
            password=cls.password,
        )
        cls.revoked_role = OrganizationRole.objects.create(
            user=cls.user_revoked,
            organization=cls.org_a,
            role='Member',
            is_active=False,
        )
        Membership.objects.create(
            user_id=cls.user_revoked,
            unit_id=cls.unit,
            position_id=cls.position,
            date_start=date(2026, 1, 1),
            is_active=True,
        )

        # Member with role in Org B only
        cls.user_org_b = User.objects.create_user(
            username='org_b_only',
            email='org_b_only@cit.edu',
            password=cls.password,
        )
        OrganizationRole.objects.create(
            user=cls.user_org_b,
            organization=cls.org_b,
            role='Member',
            is_active=True,
        )
        Membership.objects.create(
            user_id=cls.user_org_b,
            unit_id=cls.unit,
            position_id=cls.position,
            date_start=date(2026, 1, 1),
            is_active=True,
        )

        # Form with question and wildcard rule
        cls.form = EvaluationForm.objects.create(
            organization_id=cls.org_a,
            title='Midyear Peer Evaluation',
            description='Peer review',
            start_date=date(2026, 1, 1),
            end_date=date(2026, 12, 31),
            is_active=True,
            results_released=False,
        )
        Question.objects.create(
            form_id=cls.form,
            text='Code quality rating',
            input_type='rating',
            order=1,
            weight=1.0,
        )
        cls.rule = AssignmentRule.objects.create(
            form_id=cls.form,
            evaluator_unit=cls.unit,
            evaluator_position=cls.position,
            evaluatee_unit=cls.unit,
            evaluatee_position=cls.position,
            exclude_self=True,
        )

    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(self.admin_user)
        self.client.credentials(HTTP_X_ORGANIZATION_ID=str(self.org_a.id))

    def test_member_ids_excludes_revoked_and_foreign_roles(self):
        """member_ids returns only users with active role in target org."""
        ids = member_ids(self.form, self.unit.id, self.position.id)
        self.assertIn(self.user_active1.id, ids)
        self.assertIn(self.user_active2.id, ids)
        self.assertNotIn(self.user_revoked.id, ids)
        self.assertNotIn(self.user_org_b.id, ids)

    def test_manual_rule_generation_excludes_revoked_member(self):
        """Generating assignments creates pairs only between active members."""
        created_count = generate_rule_assignments(self.rule, self.form)
        # Exactly 2 pairs: active1 -> active2 and active2 -> active1
        self.assertEqual(created_count, 2)

        assignments = EvaluationAssignment.objects.filter(form_id=self.form)
        evaluator_ids = set(assignments.values_list('evaluator_id', flat=True))
        evaluatee_ids = set(assignments.values_list('evaluatee_id', flat=True))

        self.assertNotIn(self.user_revoked.id, evaluator_ids)
        self.assertNotIn(self.user_revoked.id, evaluatee_ids)
        self.assertNotIn(self.user_org_b.id, evaluator_ids)
        self.assertNotIn(self.user_org_b.id, evaluatee_ids)

    def test_api_generation_endpoint_excludes_revoked_member(self):
        """API POST /api/assignment-rules/generate/ checks role status."""
        url = reverse('assignment-rules-generate')
        resp = self.client.post(url, {'form_id': self.form.id}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)

        assignments = EvaluationAssignment.objects.filter(form_id=self.form)
        for a in assignments:
            self.assertNotEqual(a.evaluator_id_id, self.user_revoked.id)
            self.assertNotEqual(a.evaluatee_id_id, self.user_revoked.id)

    def test_signal_generation_on_membership_activation_excludes_revoked(self):
        """Saving a membership does not pair with revoked peers."""
        # Clean any prior assignments
        EvaluationAssignment.objects.filter(form_id=self.form).delete()

        # Add a 3rd active user
        new_active = User.objects.create_user(
            username='active3',
            email='active3@cit.edu',
            password=self.password,
        )
        OrganizationRole.objects.create(
            user=new_active,
            organization=self.org_a,
            role='Member',
            is_active=True,
        )
        # Membership creation triggers auto_assign_on_membership_activation
        Membership.objects.create(
            user_id=new_active,
            unit_id=self.unit,
            position_id=self.position,
            date_start=date(2026, 1, 1),
            is_active=True,
        )

        assignments = EvaluationAssignment.objects.filter(form_id=self.form)
        evaluator_ids = set(assignments.values_list('evaluator_id', flat=True))
        evaluatee_ids = set(assignments.values_list('evaluatee_id', flat=True))

        self.assertIn(new_active.id, evaluator_ids)
        self.assertIn(new_active.id, evaluatee_ids)
        self.assertNotIn(self.user_revoked.id, evaluator_ids)
        self.assertNotIn(self.user_revoked.id, evaluatee_ids)

    def test_historical_completed_assignments_preserved(self):
        """Revoking a role does not purge or delete completed assignments."""
        assignment = EvaluationAssignment.objects.create(
            form_id=self.form,
            evaluator_id=self.user_active1,
            evaluatee_id=self.user_active2,
            status='Completed',
        )

        # Deactivate user_active1's role
        role1 = OrganizationRole.objects.get(
            user=self.user_active1, organization=self.org_a
        )
        role1.is_active = False
        role1.save(update_fields=['is_active'])

        # Re-run generator
        generate_rule_assignments(self.rule, self.form)

        # Assert completed assignment remains intact
        assignment.refresh_from_db()
        self.assertEqual(assignment.status, 'Completed')
        self.assertEqual(assignment.evaluator_id, self.user_active1)
        self.assertEqual(assignment.evaluatee_id, self.user_active2)
