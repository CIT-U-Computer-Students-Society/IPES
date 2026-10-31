"""
AssignmentRule ViewSet and the ``_apply_rule`` helper.
"""

from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response as DRFResponse
from django.db import transaction

from apps.audit.utils import log_action, AuditActions

from ..models import EvaluationForm, AssignmentRule
from ..services import generate_rule_assignments
from apps.organizations.access import active_organization, EvaluationOrganizationPermission
from django.shortcuts import get_object_or_404
from ..serializers import AssignmentRuleSerializer
from apps.validation import positive_id


def _apply_rule(rule, form):
    """Apply a single AssignmentRule, creating missing EvaluationAssignments.
    Returns the count of newly created assignments."""
    return generate_rule_assignments(rule, form)


class AssignmentRuleViewSet(viewsets.ModelViewSet):
    """ViewSet for AssignmentRule CRUD and assignment generation."""
    queryset = AssignmentRule.objects.all()
    serializer_class = AssignmentRuleSerializer
    permission_classes = [permissions.IsAuthenticated, EvaluationOrganizationPermission]
    http_method_names = ['get', 'post', 'delete', 'head', 'options']

    def get_queryset(self):
        qs = AssignmentRule.objects.filter(
            form_id__organization_id=active_organization(self.request), form_id__is_deleted=False,
        ).select_related('evaluator_unit', 'evaluator_position', 'evaluatee_unit', 'evaluatee_position', 'form_id')
        form_id = self.request.query_params.get('form_id')
        return qs.filter(form_id=positive_id(form_id, 'form_id')) if form_id else qs

    @action(detail=False, methods=['post'])
    def generate(self, request):
        """Apply all rules for a form and generate EvaluationAssignment rows."""
        form_id = positive_id(request.data.get('form_id'), 'form_id')
        form = get_object_or_404(
            EvaluationForm, id=form_id, organization_id=active_organization(request), is_deleted=False,
        )

        if not form.is_active or form.results_released:
            return DRFResponse(
                {'error': 'Assignments can only be generated for active forms.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if not form.questions.exists():
            return DRFResponse(
                {'error': 'Form must have at least one question before assignments can be generated.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        rules = form.assignment_rules.select_related('form_id', 'evaluator_unit', 'evaluatee_unit', 'evaluator_position', 'evaluatee_position')
        if not rules.exists():
            return DRFResponse(
                {'error': 'No assignment rules defined for this form.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        with transaction.atomic():
            form = EvaluationForm.objects.select_for_update().get(pk=form.pk)
            if not form.is_active or form.results_released:
                return DRFResponse(
                    {'error': 'Assignments can only be generated for active forms.'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            total_created = 0
            for rule in rules:
                total_created += _apply_rule(rule, form)

            log_action(
                request.user,
                AuditActions.ASSIGNMENTS_GENERATED,
                request,
                organization_id=form.organization_id_id,
                form_id=str(form.id),
                assignments_created=str(total_created)
            )

        return DRFResponse(
            {'message': f'{total_created} assignment(s) created.', 'created': total_created},
            status=status.HTTP_201_CREATED
        )
