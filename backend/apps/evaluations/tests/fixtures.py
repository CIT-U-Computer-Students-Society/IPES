from datetime import date

from apps.evaluations.models import EvaluationAssignment, EvaluationForm, Question
from apps.organizations.models import Organization, OrganizationRole
from apps.users.models import User


class EvaluationFixtures:
    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        cls.org = Organization.objects.create(name='One', code='ONE', period_year_start=date(2026, 1, 1))
        cls.other_org = Organization.objects.create(name='Two', code='TWO', period_year_start=date(2026, 1, 1))
        cls.evaluator = User.objects.create_user(username='evaluator', email='evaluator@example.test')
        cls.evaluatee = User.objects.create_user(username='evaluatee', email='evaluatee@example.test')
        cls.admin = User.objects.create_user(username='admin', email='admin@example.test')
        cls.outsider = User.objects.create_user(username='outsider', email='outsider@example.test')
        for user, role in ((cls.evaluator, 'Member'), (cls.evaluatee, 'Member'), (cls.admin, 'Admin')):
            OrganizationRole.objects.create(user=user, organization=cls.org, role=role)
        cls.form = EvaluationForm.objects.create(
            organization_id=cls.org, title='One', start_date=date(2026, 1, 1), end_date=date(2026, 12, 31),
        )
        cls.other_form = EvaluationForm.objects.create(
            organization_id=cls.other_org, title='Two', start_date=date(2026, 1, 1), end_date=date(2026, 12, 31),
        )
        cls.question = Question.objects.create(
            form_id=cls.form, text='Rating', input_type='rating', order=1, weight=1, min_value=1, max_value=5,
        )
        cls.foreign_question = Question.objects.create(
            form_id=cls.other_form, text='Foreign', input_type='rating', order=1, weight=1,
        )
        cls.assignment = EvaluationAssignment.objects.create(
            form_id=cls.form, evaluator_id=cls.evaluator, evaluatee_id=cls.evaluatee,
        )
