"""Transactional answer persistence and bounded assignment generation."""

from itertools import islice
from math import fsum

from django.core.exceptions import ValidationError as ModelValidationError
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError

from apps.audit.utils import AuditActions, log_action
from apps.organizations.access import active_organization
from apps.organizations.models import Membership
from .models import EvaluationAssignment, EvaluationForm, Response
from .serializers import AnswerBatchSerializer


def weighted_average(values):
    values = list(values)
    scale = max((weight for _, weight in values), default=1)
    denominator = fsum(weight / scale for _, weight in values) if scale else 0
    return fsum(score * (weight / scale) for score, weight in values) / denominator if denominator else None


def locked_assignment(request, assignment_id):
    org_id = active_organization(request)
    try:
        assignment = EvaluationAssignment.objects.select_for_update().get(
            pk=assignment_id, form_id__organization_id=org_id,
            form_id__is_deleted=False,
        )
    except EvaluationAssignment.DoesNotExist as exc:
        raise NotFound('Assignment not found.') from exc
    if assignment.evaluator_id_id != request.user.pk:
        raise PermissionDenied('Only the evaluator can change these responses.')
    if assignment.status == 'Completed':
        raise ValidationError({'error': 'This evaluation has already been submitted.'})
    if not assignment.form_id.is_active or assignment.form_id.results_released:
        raise ValidationError({'error': 'This evaluation form is not accepting responses.'})
    return assignment


@transaction.atomic
def save_answers(request, assignment_id, payload, *, submit=False, replace=True):
    # Lock before checking status so concurrent draft saves and submissions serialize.
    assignment = locked_assignment(request, assignment_id)
    serializer = AnswerBatchSerializer(data=payload)
    serializer.is_valid(raise_exception=True)
    answers = serializer.validated_data['responses']
    questions = {q.pk: q for q in assignment.form_id.questions.all()}
    if submit and not questions:
        raise ValidationError({'responses': 'The form has no questions.'})
    rows = []
    for answer in answers:
        question = questions.get(answer['question_id'])
        if question is None:
            raise ValidationError({'question_id': 'Question must belong to the assignment form.'})
        row = Response(assignment_id=assignment, question_id=question,
                       score_value=answer['score_value'], text=answer['text'])
        try:
            row.clean()
        except ModelValidationError as exc:
            raise ValidationError(exc.message_dict) from exc
        rows.append(row)
    if submit:
        by_question = {row.question_id_id: row for row in rows}
        for question in questions.values():
            row = by_question.get(question.pk)
            answered = row is not None and (
                row.score_value is not None
                if question.input_type in ('rating', 'number', 'dropdown')
                else bool(row.text and row.text.strip())
            )
            if question.is_required and not answered:
                raise ValidationError({'responses': f'Question {question.pk} requires an answer.'})
    if rows:
        Response.objects.bulk_create(
            rows, update_conflicts=True, unique_fields=['assignment_id', 'question_id'],
            update_fields=['score_value', 'text'], batch_size=500,
        )
    if replace:
        assignment.responses.exclude(question_id_id__in=[row.question_id_id for row in rows]).delete()
    if submit:
        weighted = [(row.score_value, row.question_id.weight) for row in rows
                    if row.score_value is not None and row.question_id.weight]
        assignment.total_score = weighted_average(weighted)
        assignment.status = 'Completed'
        assignment.submitted_at = timezone.now()
        assignment.save(update_fields=['status', 'submitted_at', 'total_score'])
        log_action(
            request.user, AuditActions.EVALUATION_SUBMITTED, request,
            organization_id=assignment.form_id.organization_id_id,
            assignment_id=str(assignment.pk), evaluatee_id=str(assignment.evaluatee_id_id),
            score=str(assignment.total_score),
        )
    elif assignment.status == 'Pending' and rows:
        assignment.status = 'In Progress'
        assignment.save(update_fields=['status'])
    return assignment, list(assignment.responses.filter(
        question_id_id__in=[row.question_id_id for row in rows],
    ).select_related('question_id').order_by('question_id__order', 'id'))


def member_ids(form, unit_id=None, position_id=None):
    qs = Membership.objects.filter(
        unit_id__organization_id_id=form.organization_id_id,
        unit_id__is_active=True, position_id__is_active=True,
        user_id__is_active=True, is_active=True,
    ).exclude(unit_id__type_id__name='System')
    if unit_id is not None:
        qs = qs.filter(unit_id_id=unit_id)
    if position_id is not None:
        qs = qs.filter(position_id_id=position_id)
    return list(qs.order_by('user_id_id').values_list('user_id_id', flat=True).distinct())


@transaction.atomic
def generate_rule_assignments(rule, form, *, evaluator_id=None, evaluatee_id=None):
    form = EvaluationForm.objects.select_for_update().get(pk=form.pk)
    if not form.is_active or form.is_deleted or form.results_released:
        return 0
    rule.clean()
    evaluators = member_ids(form, rule.evaluator_unit_id, rule.evaluator_position_id)
    evaluatees = member_ids(form, rule.evaluatee_unit_id, rule.evaluatee_position_id)
    if evaluator_id is not None:
        evaluators = [uid for uid in evaluators if uid == evaluator_id]
    if evaluatee_id is not None:
        evaluatees = [uid for uid in evaluatees if uid == evaluatee_id]
    before = EvaluationAssignment.objects.filter(form_id=form).count()
    pairs = ((ev, ee) for ev in evaluators for ee in evaluatees if not rule.exclude_self or ev != ee)
    while batch := list(islice(pairs, 500)):
        EvaluationAssignment.objects.bulk_create([
            EvaluationAssignment(form_id=form, evaluator_id_id=ev, evaluatee_id_id=ee)
            for ev, ee in batch
        ], ignore_conflicts=True, batch_size=500)
    return EvaluationAssignment.objects.filter(form_id=form).count() - before
