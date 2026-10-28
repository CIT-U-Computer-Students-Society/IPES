"""Locking integration tests run only on databases with real row locks."""

from concurrent.futures import ThreadPoolExecutor
from datetime import date
from threading import Barrier

from django.db import close_old_connections, connections
from django.test import TransactionTestCase, skipUnlessDBFeature
from django.urls import reverse
from rest_framework.test import APIClient

from apps.evaluations.models import EvaluationAssignment, EvaluationForm, Question, Response
from apps.organizations.models import Organization, OrganizationRole
from apps.users.models import User


class ConcurrentAnswerTests(TransactionTestCase):
    @skipUnlessDBFeature('has_select_for_update')
    def test_concurrent_submissions_have_one_winner_and_one_answer(self):
        org = Organization.objects.create(name='Concurrent', code='CONCURRENT', period_year_start=date(2026, 1, 1))
        user = User.objects.create_user(username='concurrent', email='concurrent@example.test')
        peer = User.objects.create_user(username='peer', email='peer@example.test')
        OrganizationRole.objects.create(user=user, organization=org)
        form = EvaluationForm.objects.create(organization_id=org, title='Concurrent', start_date=date(2026, 1, 1), end_date=date(2026, 12, 31))
        question = Question.objects.create(form_id=form, text='Score', input_type='rating', order=1, weight=1)
        assignment = EvaluationAssignment.objects.create(form_id=form, evaluator_id=user, evaluatee_id=peer)
        barrier = Barrier(2)

        def submit(score):
            close_old_connections()
            try:
                client = APIClient()
                client.force_authenticate(user)
                client.credentials(HTTP_X_ORGANIZATION_ID=str(org.pk))
                barrier.wait(timeout=10)
                response = client.post(reverse('assignments-submit', args=[assignment.pk]), {
                    'responses': [{'question_id': question.pk, 'score_value': score}],
                }, format='json')
                return response.status_code, score
            finally:
                connections.close_all()

        with ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(submit, [1, 5]))
        self.assertEqual(sorted(status for status, _ in results), [200, 400])
        winner = next(score for status, score in results if status == 200)
        self.assertEqual(Response.objects.get().score_value, winner)
        assignment.refresh_from_db()
        self.assertEqual(assignment.status, 'Completed')
        self.assertEqual(assignment.total_score, winner)
