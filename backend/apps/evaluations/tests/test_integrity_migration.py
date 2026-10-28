"""Exercise upgrades with legacy duplicates, rather than only a fresh schema."""

from datetime import date

from django.db import connection, IntegrityError, transaction
from django.db.migrations.executor import MigrationExecutor
from django.test import TransactionTestCase


class AnswerIntegrityMigrationTests(TransactionTestCase):
    migrate_from = [('evaluations', '0009_alter_assignmentrule_id_and_more')]
    migrate_to = [('evaluations', '0010_response_integrity_indexes')]

    def setUp(self):
        super().setUp()
        executor = MigrationExecutor(connection)
        executor.migrate(self.migrate_from)
        # Keep unrelated apps at their actual current schema (e.g. users no longer
        # has its legacy role column); only evaluations is rolled back.
        self.other_leaves = [node for node in executor.loader.graph.leaf_nodes() if node[0] != 'evaluations']
        self.old_apps = executor.loader.project_state(self.migrate_from + self.other_leaves).apps
        Organization = self.old_apps.get_model('organizations', 'Organization')
        User = self.old_apps.get_model('users', 'User')
        Form = self.old_apps.get_model('evaluations', 'EvaluationForm')
        Question = self.old_apps.get_model('evaluations', 'Question')
        Assignment = self.old_apps.get_model('evaluations', 'EvaluationAssignment')
        self.Responses = self.old_apps.get_model('evaluations', 'Response')
        org = Organization.objects.create(name='Legacy', code='LEGACY', period_year_start=date(2026, 1, 1))
        evaluator = User.objects.create(username='legacy1', email='legacy1@example.test', password='!')
        evaluatee = User.objects.create(username='legacy2', email='legacy2@example.test', password='!')
        self.form = Form.objects.create(organization_id=org, title='Legacy', start_date=date(2026, 1, 1), end_date=date(2026, 12, 31))
        self.question = Question.objects.create(form_id=self.form, text='Score', input_type='rating', order=1, weight=1)
        self.assignment = Assignment.objects.create(form_id=self.form, evaluator_id=evaluator, evaluatee_id=evaluatee, status='Completed', total_score=3)

    def tearDown(self):
        try:
            MigrationExecutor(connection).migrate(self.migrate_to)
        finally:
            super().tearDown()

    def test_keeps_latest_answer_recalculates_score_and_enforces_uniqueness(self):
        self.Responses.objects.create(assignment_id=self.assignment, question_id=self.question, score_value=1)
        latest = self.Responses.objects.create(assignment_id=self.assignment, question_id=self.question, score_value=5)
        executor = MigrationExecutor(connection)
        executor.migrate(self.migrate_to)
        apps = executor.loader.project_state(self.migrate_to + self.other_leaves).apps
        Responses = apps.get_model('evaluations', 'Response')
        self.assertEqual(Responses.objects.get().pk, latest.pk)
        self.assertEqual(Responses.objects.get().score_value, 5)
        self.assertEqual(apps.get_model('evaluations', 'EvaluationAssignment').objects.get().total_score, 5)
        with self.assertRaises(IntegrityError), transaction.atomic():
            Responses.objects.create(assignment_id_id=self.assignment.pk, question_id_id=self.question.pk, score_value=4)
        # Re-running after rollback also handles a database already free of duplicates.
        executor = MigrationExecutor(connection)
        executor.migrate(self.migrate_from)
        MigrationExecutor(connection).migrate(self.migrate_to)
        self.assertEqual(Responses.objects.count(), 1)

    def test_cross_form_legacy_records_fail_preflight_without_deleting_them(self):
        Form = self.old_apps.get_model('evaluations', 'EvaluationForm')
        other = Form.objects.create(organization_id=self.form.organization_id, title='Other', start_date=date(2026, 1, 1), end_date=date(2026, 12, 31))
        Question = self.old_apps.get_model('evaluations', 'Question')
        foreign = Question.objects.create(form_id=other, text='Foreign', input_type='rating', order=1)
        row = self.Responses.objects.create(assignment_id=self.assignment, question_id=foreign, score_value=3)
        try:
            with self.assertRaisesMessage(RuntimeError, 'Cross-form responses exist'):
                MigrationExecutor(connection).migrate(self.migrate_to)
            self.assertTrue(self.Responses.objects.filter(pk=row.pk).exists())
        finally:
            self.Responses.objects.filter(pk=row.pk).delete()
