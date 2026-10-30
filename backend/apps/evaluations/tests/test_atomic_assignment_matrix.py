"""
Regression tests verifying atomic assignment rule matrix generation (#239).

Verifies that if any rule fails during multi-rule assignment generation,
earlier assignments are rolled back atomically, zero assignments remain,
and no misleading audit log entry is committed.
"""

from datetime import date
from unittest.mock import patch
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.audit.models import AuditLog
from apps.audit.utils import AuditActions
import apps.evaluations.views.rules as rules_views
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


class AtomicAssignmentMatrixTests(APITestCase):
    def setUp(self):
        self.password = 'StrongP@ssw0rd!123'
        self.org = Organization.objects.create(
            name='Atomic Matrix Org',
            code='ATOMMAT',
            period_year_start=date(2026, 1, 1),
        )

        self.admin = User.objects.create_user(
            username='matrix_admin',
            email='matrix_admin@cit.edu',
            password=self.password,
        )
        OrganizationRole.objects.create(
            user=self.admin,
            organization=self.org,
            role='Admin',
            is_active=True,
        )

        self.user_a = User.objects.create_user(
            username='matrix_user_a',
            email='matrix_a@cit.edu',
            password=self.password,
        )
        OrganizationRole.objects.create(
            user=self.user_a,
            organization=self.org,
            role='Member',
            is_active=True,
        )

        self.user_b = User.objects.create_user(
            username='matrix_user_b',
            email='matrix_b@cit.edu',
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
            name='Team',
        )
        self.unit = OrganizationUnit.objects.create(
            organization_id=self.org,
            type_id=self.unit_type,
            name='Development',
            is_active=True,
        )
        self.position = PositionType.objects.create(
            organization_id=self.org,
            name='Developer',
            rank=2,
            is_active=True,
        )

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

        self.form = EvaluationForm.objects.create(
            organization_id=self.org,
            title='Peer & Self Evaluation Form',
            start_date=date(2026, 1, 1),
            end_date=date(2026, 12, 31),
            is_active=True,
            results_released=False,
            is_deleted=False,
        )

        Question.objects.create(
            form_id=self.form,
            text='Code Quality and Contribution',
            input_type='rating',
            order=1,
            weight=1.0,
            is_required=True,
            min_value=1,
            max_value=5,
        )

        # Rule 1: Exclude self (generates 2 cross-assignments: A->B, B->A)
        self.rule_cross = AssignmentRule.objects.create(
            form_id=self.form,
            exclude_self=True,
        )
        # Rule 2: Include self (generates 2 self-assignments: A->A, B->B)
        self.rule_self = AssignmentRule.objects.create(
            form_id=self.form,
            exclude_self=False,
        )

        self.client.force_authenticate(user=self.admin)
        self.client.credentials(HTTP_X_ORGANIZATION_ID=str(self.org.id))

    def test_successful_multi_rule_generation_commits_matrix_and_audit(self):
        """Applying rules generates full matrix and records single audit."""
        url = reverse('assignment-rules-generate')
        resp = self.client.post(url, {'form_id': self.form.id}, format='json')

        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(resp.data.get('created'), 4)

        # Total 4 assignments created: A->B, B->A, A->A, B->B
        assignments = EvaluationAssignment.objects.filter(form_id=self.form)
        self.assertEqual(assignments.count(), 4)

        # Exactly 1 audit log entry
        audit_qs = AuditLog.objects.filter(
            organization_id=self.org,
            action__startswith=AuditActions.ASSIGNMENTS_GENERATED,
        )
        self.assertEqual(audit_qs.count(), 1)
        audit_entry = audit_qs.first()
        self.assertIn('assignments_created=4', audit_entry.action)
        self.assertIn(f'form_id={self.form.id}', audit_entry.action)

    def test_failure_in_later_rule_rolls_back_earlier_assignments_and_audit(
        self,
    ):
        """A failure in rule 2 rolls back rule 1 assignments."""
        url = reverse('assignment-rules-generate')

        real_apply_rule = rules_views._apply_rule
        call_count = [0]

        def fail_on_second_rule(rule, form):
            call_count[0] += 1
            if call_count[0] > 1:
                raise RuntimeError("Simulated mid-batch failure")
            return real_apply_rule(rule, form)

        with patch.object(
            rules_views, '_apply_rule', side_effect=fail_on_second_rule
        ):
            with self.assertRaises(RuntimeError):
                self.client.post(
                    url, {'form_id': self.form.id}, format='json'
                )

        # Rule 1 was applied first and generated assignments in transaction
        self.assertEqual(call_count[0], 2)

        # Because batch is wrapped in transaction.atomic(), rollback occurred
        remaining = EvaluationAssignment.objects.filter(form_id=self.form)
        self.assertEqual(remaining.count(), 0)

        # No audit log entry was written
        audit_qs = AuditLog.objects.filter(
            organization_id=self.org,
            action__startswith=AuditActions.ASSIGNMENTS_GENERATED,
        )
        self.assertEqual(audit_qs.count(), 0)

    def test_retry_after_failure_generates_complete_matrix(self):
        """Retrying generation after a rolled-back failure succeeds."""
        url = reverse('assignment-rules-generate')

        real_apply_rule = rules_views._apply_rule
        call_count = [0]

        def fail_on_second_rule(rule, form):
            call_count[0] += 1
            if call_count[0] > 1:
                raise RuntimeError("Simulated failure on first attempt")
            return real_apply_rule(rule, form)

        with patch.object(
            rules_views, '_apply_rule', side_effect=fail_on_second_rule
        ):
            with self.assertRaises(RuntimeError):
                self.client.post(
                    url, {'form_id': self.form.id}, format='json'
                )

        self.assertEqual(
            EvaluationAssignment.objects.filter(form_id=self.form).count(), 0
        )

        # Retry without failure
        retry_resp = self.client.post(
            url, {'form_id': self.form.id}, format='json'
        )
        self.assertEqual(retry_resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(retry_resp.data.get('created'), 4)
        self.assertEqual(
            EvaluationAssignment.objects.filter(form_id=self.form).count(), 4
        )

        audit_qs = AuditLog.objects.filter(
            organization_id=self.org,
            action__startswith=AuditActions.ASSIGNMENTS_GENERATED,
        )
        self.assertEqual(audit_qs.count(), 1)
        self.assertIn('assignments_created=4', audit_qs.first().action)

    def test_inactive_form_rejected_before_and_inside_transaction(self):
        """Inactive forms return 400 and create no assignments."""
        self.form.is_active = False
        self.form.save(update_fields=['is_active'])

        url = reverse('assignment-rules-generate')
        resp = self.client.post(url, {'form_id': self.form.id}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(
            EvaluationAssignment.objects.filter(form_id=self.form).count(), 0
        )

    def test_released_form_rejected(self):
        """Forms with released results return 400 and create no assignments."""
        self.form.results_released = True
        self.form.save(update_fields=['results_released'])

        url = reverse('assignment-rules-generate')
        resp = self.client.post(url, {'form_id': self.form.id}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(
            EvaluationAssignment.objects.filter(form_id=self.form).count(), 0
        )
