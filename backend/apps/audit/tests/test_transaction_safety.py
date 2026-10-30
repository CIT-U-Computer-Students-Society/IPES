"""Audit database failures must not silently roll back business operations."""

from datetime import date

from django.db import connection, transaction
from django.urls import reverse
from rest_framework.test import APITransactionTestCase

from apps.audit.models import AuditLog
from apps.audit.utils import log_action
from apps.evaluations.models import EvaluationAssignment, EvaluationForm, Question, Response
from apps.organizations.models import Organization, OrganizationRole
from apps.users.models import User


def fail_audit_insert(execute, sql, params, many, context):
    if sql.lstrip().upper().startswith('INSERT INTO "AUDIT_AUDITLOG"'):
        # Cause a real PostgreSQL error inside the audit write's transaction.
        return execute('SELECT 1 / 0', None, False, context)
    return execute(sql, params, many, context)


class AuditTransactionSafetyTests(APITransactionTestCase):
    def setUp(self):
        self.org = Organization.objects.create(name='One', code='ONE', description='Test', period_year_start=date(2026, 1, 1))
        self.admin = User.objects.create_user(username='admin', email='admin@example.test')
        self.evaluator = User.objects.create_user(username='evaluator', email='evaluator@example.test')
        self.evaluatee = User.objects.create_user(username='evaluatee', email='evaluatee@example.test')
        OrganizationRole.objects.create(user=self.admin, organization=self.org, role='Admin')
        OrganizationRole.objects.create(user=self.evaluator, organization=self.org, role='Member')
        self.client.credentials(HTTP_X_ORGANIZATION_ID=str(self.org.pk))

    def test_form_creation_persists_when_audit_insert_fails(self):
        self.client.force_authenticate(self.admin)
        payload = {'organization_id': self.org.pk, 'title': 'Valid form',
                   'start_date': '2026-01-01', 'end_date': '2026-12-31'}
        with self.assertLogs('apps.audit.utils', level='ERROR'), connection.execute_wrapper(fail_audit_insert):
            response = self.client.post(reverse('forms-list'), payload, format='json')
        self.assertEqual(response.status_code, 201, response.data)
        self.assertTrue(EvaluationForm.objects.filter(pk=response.data['id'], title='Valid form').exists())
        self.assertFalse(AuditLog.objects.exists())

    def test_submission_persists_answers_and_score_when_audit_insert_fails(self):
        form = EvaluationForm.objects.create(organization_id=self.org, title='Form',
                                             start_date=date(2026, 1, 1), end_date=date(2026, 12, 31))
        question = Question.objects.create(form_id=form, text='Rating', input_type='rating', order=1, weight=1)
        assignment = EvaluationAssignment.objects.create(form_id=form, evaluator_id=self.evaluator, evaluatee_id=self.evaluatee)
        self.client.force_authenticate(self.evaluator)
        with self.assertLogs('apps.audit.utils', level='ERROR'), connection.execute_wrapper(fail_audit_insert):
            response = self.client.post(reverse('assignments-submit', args=[assignment.pk]),
                                        {'responses': [{'question_id': question.pk, 'score_value': 4}]}, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        assignment.refresh_from_db()
        self.assertEqual(assignment.status, 'Completed')
        self.assertEqual(assignment.total_score, 4)
        self.assertTrue(Response.objects.filter(assignment_id=assignment, question_id=question, score_value=4).exists())
        self.assertFalse(AuditLog.objects.exists())

    def test_failed_log_does_not_poison_enclosing_transaction(self):
        with transaction.atomic():
            with self.assertLogs('apps.audit.utils', level='ERROR'), connection.execute_wrapper(fail_audit_insert):
                log_action(self.admin, 'test.event', organization_id=self.org.pk)
            self.assertFalse(transaction.get_rollback())
            self.org.description = 'Persisted after audit failure'
            self.org.save(update_fields=['description'])
        self.org.refresh_from_db()
        self.assertEqual(self.org.description, 'Persisted after audit failure')
        self.assertFalse(AuditLog.objects.exists())
