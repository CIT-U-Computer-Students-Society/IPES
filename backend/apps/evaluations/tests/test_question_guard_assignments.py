"""
Regression tests verifying question guard for assignments (#238).
"""

from datetime import date
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.evaluations.models import (
    AssignmentRule,
    EvaluationAssignment,
    EvaluationForm,
    Question,
)
from apps.evaluations.services import generate_rule_assignments
from apps.organizations.models import (
    Membership,
    Organization,
    OrganizationRole,
    OrganizationUnit,
    PositionType,
    UnitType,
)
from apps.users.models import User


class QuestionGuardAssignmentTests(APITestCase):
    def setUp(self):
        self.password = 'StrongP@ssw0rd!123'
        self.org = Organization.objects.create(
            name='Question Guard Org',
            code='QGO',
            period_year_start=date(2026, 1, 1),
        )

        self.admin = User.objects.create_user(
            username='qg_admin',
            email='admin@cit.edu',
            password=self.password,
        )
        OrganizationRole.objects.create(
            user=self.admin,
            organization=self.org,
            role='Admin',
            is_active=True,
        )

        self.user_a = User.objects.create_user(
            username='qg_user_a',
            email='user_a@cit.edu',
            password=self.password,
        )
        OrganizationRole.objects.create(
            user=self.user_a,
            organization=self.org,
            role='Member',
            is_active=True,
        )

        self.user_b = User.objects.create_user(
            username='qg_user_b',
            email='user_b@cit.edu',
            password=self.password,
        )
        OrganizationRole.objects.create(
            user=self.user_b,
            organization=self.org,
            role='Member',
            is_active=True,
        )

        self.unit_type = UnitType.objects.create(
            organization_id=self.org,
            name='Committee',
        )
        self.unit = OrganizationUnit.objects.create(
            organization_id=self.org,
            type_id=self.unit_type,
            name='Technical Committee',
        )
        self.position = PositionType.objects.create(
            organization_id=self.org,
            name='Member',
            rank=2,
        )

        # Base active form with NO questions initially
        self.form = EvaluationForm.objects.create(
            organization_id=self.org,
            title='Questionless Active Form',
            start_date=date(2026, 1, 1),
            end_date=date(2026, 12, 31),
            is_active=True,
            results_released=False,
            is_deleted=False,
        )

        # Wildcard rule: all members evaluate each other
        self.rule = AssignmentRule.objects.create(
            form_id=self.form,
            exclude_self=True,
        )

        self.client.force_authenticate(user=self.admin)
        self.client.credentials(HTTP_X_ORGANIZATION_ID=str(self.org.id))

    def test_membership_creation_ignores_questionless_form(self):
        """Creating membership does not auto-assign on questionless forms."""
        Membership.objects.create(
            user_id=self.user_a,
            unit_id=self.unit,
            position_id=self.position,
            date_start=date(2026, 1, 1),
            is_active=True,
        )
        Membership.objects.create(
            user_id=self.user_b,
            unit_id=self.unit,
            position_id=self.position,
            date_start=date(2026, 1, 1),
            is_active=True,
        )

        assignments = EvaluationAssignment.objects.filter(form_id=self.form)
        self.assertEqual(assignments.count(), 0)

    def test_membership_reactivation_ignores_questionless_form(self):
        """Reactivating membership omits questionless forms."""
        mem = Membership.objects.create(
            user_id=self.user_a,
            unit_id=self.unit,
            position_id=self.position,
            date_start=date(2026, 1, 1),
            is_active=False,
        )
        Membership.objects.create(
            user_id=self.user_b,
            unit_id=self.unit,
            position_id=self.position,
            date_start=date(2026, 1, 1),
            is_active=True,
        )

        # Reactivate membership for user_a
        mem.is_active = True
        mem.save()

        assignments = EvaluationAssignment.objects.filter(form_id=self.form)
        self.assertEqual(assignments.count(), 0)

    def test_question_deletion_prevents_subsequent_membership_generation(self):
        """Deleting the last question stops future membership auto-assign."""
        # Add 1 question first
        question = Question.objects.create(
            form_id=self.form,
            text='Performance Rating',
            input_type='rating',
            order=1,
            weight=1.0,
            min_value=1,
            max_value=5,
        )
        # Create membership for user_a
        Membership.objects.create(
            user_id=self.user_a,
            unit_id=self.unit,
            position_id=self.position,
            date_start=date(2026, 1, 1),
            is_active=True,
        )

        # Delete the question via the API endpoint
        url = reverse('questions-detail', kwargs={'pk': question.pk})
        resp = self.client.delete(url)
        self.assertEqual(resp.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(self.form.questions.exists())

        # Clear any prior assignments
        EvaluationAssignment.objects.filter(form_id=self.form).delete()

        # Add user_b membership now that the form has 0 questions
        Membership.objects.create(
            user_id=self.user_b,
            unit_id=self.unit,
            position_id=self.position,
            date_start=date(2026, 1, 1),
            is_active=True,
        )

        assignments = EvaluationAssignment.objects.filter(form_id=self.form)
        self.assertEqual(assignments.count(), 0)

    def test_generate_rule_assignments_direct_service_call_returns_zero(self):
        """Direct service call returns 0 when form has no questions."""
        Membership.objects.create(
            user_id=self.user_a,
            unit_id=self.unit,
            position_id=self.position,
            date_start=date(2026, 1, 1),
            is_active=True,
        )
        Membership.objects.create(
            user_id=self.user_b,
            unit_id=self.unit,
            position_id=self.position,
            date_start=date(2026, 1, 1),
            is_active=True,
        )

        created = generate_rule_assignments(self.rule, self.form)
        self.assertEqual(created, 0)
        qs = EvaluationAssignment.objects.filter(form_id=self.form)
        self.assertEqual(qs.count(), 0)

    def test_api_generation_rejects_questionless_form(self):
        """API generate endpoint returns 400 when form has no questions."""
        url = reverse('assignment-rules-generate')
        resp = self.client.post(url, {'form_id': self.form.id}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('at least one question', resp.data.get('error', ''))

    def test_adding_question_enables_subsequent_assignment_generation(self):
        """Adding a question makes form eligible for assignment generation."""
        Membership.objects.create(
            user_id=self.user_a,
            unit_id=self.unit,
            position_id=self.position,
            date_start=date(2026, 1, 1),
            is_active=True,
        )
        Membership.objects.create(
            user_id=self.user_b,
            unit_id=self.unit,
            position_id=self.position,
            date_start=date(2026, 1, 1),
            is_active=True,
        )

        # Initially 0 questions -> 0 assignments
        qs = EvaluationAssignment.objects.filter(form_id=self.form)
        self.assertEqual(qs.count(), 0)

        # Add a question via API
        url = reverse('questions-list')
        q_data = {
            'form_id': self.form.id,
            'text': 'Collaboration and Leadership',
            'input_type': 'rating',
            'order': 1,
            'weight': 1.0,
            'is_required': True,
            'min_value': 1,
            'max_value': 5,
        }
        create_resp = self.client.post(url, q_data, format='json')
        self.assertEqual(create_resp.status_code, status.HTTP_201_CREATED)
        self.assertTrue(self.form.questions.exists())

        # Now manual generate works
        gen_url = reverse('assignment-rules-generate')
        gen_resp = self.client.post(
            gen_url, {'form_id': self.form.id}, format='json'
        )
        self.assertEqual(gen_resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(qs.count(), 2)
