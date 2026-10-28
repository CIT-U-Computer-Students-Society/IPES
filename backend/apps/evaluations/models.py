from django.db import models
from django.conf import settings
from django.core.exceptions import ValidationError
from math import isfinite

from apps.organizations.models import Organization, RelatedOrganizationModel

class EvaluationForm(models.Model):
    organization_id = models.ForeignKey(Organization, on_delete=models.CASCADE)
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, default='')
    start_date = models.DateField()
    end_date = models.DateField()
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    is_active = models.BooleanField(default=True)
    results_released = models.BooleanField(default=False)
    is_deleted = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [models.CheckConstraint(
            condition=models.Q(end_date__gte=models.F('start_date')), name='evaluation_form_valid_dates',
        )]

    def clean(self):
        if self.start_date and self.end_date and self.end_date < self.start_date:
            raise ValidationError({'end_date': 'End date must be on or after start date.'})

class Question(models.Model):
    form_id = models.ForeignKey(EvaluationForm, on_delete=models.CASCADE, related_name='questions')
    text = models.TextField(max_length=500)
    input_type = models.CharField(max_length=50)
    order = models.IntegerField()
    weight = models.FloatField(null=True, blank=True)
    is_required = models.BooleanField(default=True)
    min_value = models.IntegerField(null=True, blank=True)
    max_value = models.IntegerField(null=True, blank=True)

    INPUT_TYPES = ['rating', 'number', 'text', 'textarea', 'dropdown', 'checkbox']

    class Meta:
        constraints = [
            models.CheckConstraint(condition=models.Q(order__gte=1), name='question_order_positive'),
            models.CheckConstraint(
                condition=models.Q(weight__isnull=True) | models.Q(weight__gte=0, weight__lte=1.7976931348623157e308),
                name='question_weight_valid',
            ),
            models.CheckConstraint(
                condition=models.Q(min_value__isnull=True) | models.Q(max_value__isnull=True) | models.Q(max_value__gte=models.F('min_value')),
                name='question_bounds_valid',
            ),
            models.CheckConstraint(condition=models.Q(input_type__in=['rating', 'number', 'text', 'textarea', 'dropdown', 'checkbox']), name='question_input_type_valid'),
        ]

    def score_bounds(self):
        return (
            self.min_value if self.min_value is not None else 0,
            self.max_value if self.max_value is not None else (100 if self.input_type == 'number' else 5),
        )

    def clean(self):
        errors = {}
        if self.input_type not in self.INPUT_TYPES:
            errors['input_type'] = 'Unsupported question type.'
        if self.order is not None and self.order < 1:
            errors['order'] = 'Order must be at least 1.'
        if self.weight is not None and (not isfinite(self.weight) or self.weight < 0):
            errors['weight'] = 'Weight must be finite and nonnegative.'
        if self.input_type in ('rating', 'number', 'dropdown') and self.score_bounds()[0] > self.score_bounds()[1]:
            errors['max_value'] = 'Maximum must be at least the minimum, including default bounds.'
        elif self.min_value is not None and self.max_value is not None and self.min_value > self.max_value:
            errors['max_value'] = 'Maximum must be at least the minimum.'
        if errors:
            raise ValidationError(errors)

class EvaluationAssignment(models.Model):
    evaluator_id = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='assignments_as_evaluator')
    evaluatee_id = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='assignments_as_evaluatee')
    form_id = models.ForeignKey(EvaluationForm, on_delete=models.CASCADE)
    status = models.CharField(max_length=50, default='Pending')
    submitted_at = models.DateTimeField(null=True, blank=True)
    total_score = models.FloatField(null=True, blank=True)

    class Meta:
        unique_together = [('evaluator_id', 'evaluatee_id', 'form_id')]
        indexes = [
            models.Index(fields=['form_id', 'status'], name='assignment_form_status_idx'),
            models.Index(fields=['evaluatee_id', 'status', 'form_id'], name='assignment_received_idx'),
            models.Index(fields=['evaluator_id', 'status', '-id'], name='assignment_pending_idx'),
        ]
        constraints = [models.CheckConstraint(
            condition=models.Q(status__in=['Pending', 'In Progress', 'Completed']), name='assignment_status_valid',
        )]

class AssignmentRule(RelatedOrganizationModel):
    """Defines which groups should evaluate which groups for a given form."""
    form_id            = models.ForeignKey(EvaluationForm, on_delete=models.CASCADE, related_name='assignment_rules')
    evaluator_unit     = models.ForeignKey('organizations.OrganizationUnit', null=True, blank=True, on_delete=models.SET_NULL, related_name='+')
    evaluator_position = models.ForeignKey('organizations.PositionType', null=True, blank=True, on_delete=models.SET_NULL, related_name='+')
    evaluatee_unit     = models.ForeignKey('organizations.OrganizationUnit', null=True, blank=True, on_delete=models.SET_NULL, related_name='+')
    evaluatee_position = models.ForeignKey('organizations.PositionType', null=True, blank=True, on_delete=models.SET_NULL, related_name='+')
    exclude_self       = models.BooleanField(default=True)

    def clean(self):
        if not self.form_id_id:
            return
        for name in ('evaluator_unit', 'evaluator_position', 'evaluatee_unit', 'evaluatee_position'):
            related = getattr(self, name)
            if related and related.organization_id_id != self.form_id.organization_id_id:
                raise ValidationError({name: 'Rule filters must belong to the form organization.'})

    def __str__(self):
        ev_unit = self.evaluator_unit.name if self.evaluator_unit else 'Any Unit'
        ev_pos  = self.evaluator_position.name if self.evaluator_position else 'Any Position'
        ee_unit = self.evaluatee_unit.name if self.evaluatee_unit else 'Any Unit'
        ee_pos  = self.evaluatee_position.name if self.evaluatee_position else 'Any Position'
        return f'[{ev_unit} / {ev_pos}] → [{ee_unit} / {ee_pos}]'

class Response(RelatedOrganizationModel):
    assignment_id = models.ForeignKey(EvaluationAssignment, on_delete=models.CASCADE, related_name='responses')
    question_id = models.ForeignKey(Question, on_delete=models.CASCADE)
    score_value = models.FloatField(null=True, blank=True)
    text = models.TextField(null=True, blank=True)

    class Meta:
        constraints = [models.UniqueConstraint(
            fields=['assignment_id', 'question_id'], name='response_assignment_question_unique',
        )]

    def clean(self):
        if not self.assignment_id_id or not self.question_id_id:
            return
        question = self.question_id
        if question.form_id_id != self.assignment_id.form_id_id:
            raise ValidationError({'question_id': 'Question must belong to the assignment form.'})
        if self.score_value is not None:
            low, high = question.score_bounds()
            if question.input_type not in ('rating', 'number', 'dropdown'):
                raise ValidationError({'score_value': 'This question accepts text only.'})
            if not isfinite(self.score_value) or not low <= self.score_value <= high:
                raise ValidationError({'score_value': f'Score must be finite and between {low} and {high}.'})
