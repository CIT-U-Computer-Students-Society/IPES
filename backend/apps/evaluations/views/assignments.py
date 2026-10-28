"""
EvaluationAssignment ViewSet — CRUD, pending/completed lists, performance data, submit.
"""

from rest_framework import viewsets, permissions
from rest_framework.decorators import action
from rest_framework.response import Response as DRFResponse
from rest_framework.exceptions import PermissionDenied
from django.db import models
from apps.organizations.access import active_organization, is_organization_admin
from ..services import save_answers, weighted_average
from apps.validation import positive_id


from ..models import EvaluationForm, Question, EvaluationAssignment, Response
from ..serializers import (
    EvaluationAssignmentSerializer,
    ResponseSerializer,
)


class EvaluationAssignmentViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for EvaluationAssignment CRUD operations"""
    queryset = EvaluationAssignment.objects.all()
    serializer_class = EvaluationAssignmentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        """Filter assignments based on user role"""
        queryset = EvaluationAssignment.objects.all()
        user = self.request.user

        # Exclude assignments for deleted forms
        queryset = queryset.filter(form_id__is_deleted=False)

        org_id = active_organization(self.request)
        form_id = self.request.query_params.get('form_id')
        evaluator_id = self.request.query_params.get('evaluator_id')
        status_param = self.request.query_params.get('status')

        is_admin = is_organization_admin(self.request, org_id)

        if org_id:
            queryset = queryset.filter(form_id__organization_id=org_id)

        # Regular members can only see their own assignments
        if not is_admin:
            from django.db.models import Q
            queryset = queryset.filter(Q(evaluatee_id=user) | Q(evaluator_id=user))
            if org_id:
                queryset = queryset.filter(form_id__organization_id=org_id)

        if form_id:
            queryset = queryset.filter(form_id=positive_id(form_id, 'form_id'))
        if evaluator_id:
            queryset = queryset.filter(evaluator_id=positive_id(evaluator_id, 'evaluator_id'))
        if status_param:
            queryset = queryset.filter(status=status_param)

        return queryset.select_related(
            'evaluator_id', 'evaluatee_id', 'form_id'
        ).order_by('-id')

    @action(detail=False, methods=['get'])
    def my_pending(self, request):
        """Get pending and in-progress evaluations for current user"""
        assignments = self.get_queryset().filter(
            evaluator_id=request.user,
            status__in=['Pending', 'In Progress']
        )
        serializer = EvaluationAssignmentSerializer(assignments, many=True)
        return DRFResponse(serializer.data)

    @action(detail=False, methods=['get'])
    def my_completed(self, request):
        """Get completed evaluations for current user"""
        assignments = self.get_queryset().filter(
            evaluator_id=request.user,
            status='Completed'
        )
        serializer = EvaluationAssignmentSerializer(assignments, many=True)
        return DRFResponse(serializer.data)

    @action(detail=False, methods=['get'])
    def my_performance(self, request):
        """Get aggregate performance data from received evaluations for a specific form or latest released form"""
        user = request.user
        form_id = request.query_params.get('form_id')
        org_id = active_organization(request)

        all_evaluatee_assignments = EvaluationAssignment.objects.filter(
            evaluatee_id=user,
            status='Completed', form_id__is_deleted=False,
        ).select_related('form_id')

        if org_id:
            all_evaluatee_assignments = all_evaluatee_assignments.filter(form_id__organization_id=org_id)

        released_form_ids = EvaluationForm.objects.filter(
            id__in=all_evaluatee_assignments.values_list('form_id', flat=True),
            results_released=True
        ).order_by('-end_date', '-id').values_list('id', flat=True)

        if not released_form_ids:
            return DRFResponse({
                'overallScore': 0,
                'overallMaxScore': 5,
                'categoryScores': [],
                'feedbackComments': [],
                'evaluationHistory': [],
                'available_forms': [],
                'evaluatorCount': 0,
                'selectedFormId': None
            })

        available_forms = (
            EvaluationForm.objects
            .filter(id__in=released_form_ids)
            .values('id', 'title')
            .order_by('-end_date', '-id')
        )

        # Determine selected form
        selected_form_id = None
        if form_id:
            try:
                selected_form_id = int(form_id)
                if selected_form_id not in released_form_ids:
                    selected_form_id = released_form_ids[0]
            except (ValueError, TypeError):
                selected_form_id = released_form_ids[0]
        else:
            selected_form_id = released_form_ids[0]

        assignments = all_evaluatee_assignments.filter(form_id_id=selected_form_id)

        overall_score = assignments.aggregate(avg=models.Avg('total_score'))['avg'] or 0
        overall_score = round(overall_score, 1)
        evaluator_count = assignments.count()

        # Overall max score
        form_questions = Question.objects.filter(form_id_id=selected_form_id)
        overall_max_score = weighted_average([
            (q.score_bounds()[1], q.weight) for q in form_questions if q.weight
        ])
        overall_max_score = round(overall_max_score, 1) if overall_max_score is not None else 5

        # Evaluation history
        history_map = {}
        for assignment in all_evaluatee_assignments:
            if assignment.form_id.results_released:
                title = assignment.form_id.title
                if title not in history_map:
                    history_map[title] = {'score_sum': 0, 'count': 0, 'evaluators': set()}
                if assignment.total_score is not None:
                    history_map[title]['score_sum'] += assignment.total_score
                    history_map[title]['count'] += 1
                    history_map[title]['evaluators'].add(assignment.evaluator_id_id)

        evaluation_history = []
        for period, data in history_map.items():
            if data['count'] > 0:
                evaluation_history.append({
                    'period': period,
                    'score': round(data['score_sum'] / data['count'], 1),
                    'evaluators': len(data['evaluators'])
                })

        # Category scores and feedback
        responses = Response.objects.filter(
            assignment_id__in=assignments
        ).select_related('question_id')

        category_map = {}
        feedback_comments = []
        comment_id = 1

        for response in responses:
            question = response.question_id
            category = (question.text[:30] + '...') if len(question.text) > 30 else question.text

            question_max = question.max_value if question.max_value is not None else (100 if question.input_type == 'number' else 5)

            if category not in category_map:
                category_map[category] = {'scores': [], 'maximums': []}

            if response.score_value is not None and question.weight:
                category_map[category]['scores'].append((response.score_value, question.weight))
                category_map[category]['maximums'].append((question_max, question.weight))

            if response.text and response.text.strip():
                feedback_type = 'info'
                if response.score_value is not None and question_max > 0:
                    score_ratio = response.score_value / question_max
                    feedback_type = 'positive' if score_ratio >= 0.8 else 'constructive'

                feedback_comments.append({
                    'id': comment_id,
                    'text': response.text.strip(),
                    'type': feedback_type
                })
                comment_id += 1

        category_scores = []
        for name, data in category_map.items():
            if data['scores']:
                avg_score = round(weighted_average(data['scores']), 1)
                avg_max = round(weighted_average(data['maximums']), 1)
                category_scores.append({
                    'name': name,
                    'score': avg_score,
                    'maxScore': avg_max
                })

        return DRFResponse({
            'overallScore': overall_score,
            'overallMaxScore': overall_max_score,
            'categoryScores': category_scores,
            'feedbackComments': feedback_comments[:10],
            'evaluationHistory': evaluation_history,
            'available_forms': list(available_forms),
            'evaluatorCount': evaluator_count,
            'selectedFormId': selected_form_id
        })

    @action(detail=True, methods=['get'])
    def responses(self, request, pk=None):
        """Get all responses for an assignment"""
        assignment = self.get_object()
        if assignment.evaluator_id_id != request.user.pk and not is_organization_admin(request, active_organization(request)):
            raise PermissionDenied('Only the evaluator or an administrator can view these answers.')
        responses = Response.objects.filter(assignment_id=assignment).select_related('question_id')
        serializer = ResponseSerializer(responses, many=True)
        return DRFResponse(serializer.data)

    @action(detail=True, methods=['post'])
    def submit(self, request, pk=None):
        """Submit an evaluation with responses"""
        assignment = self.get_object()
        assignment, responses = save_answers(request, assignment.pk, request.data, submit=True)
        return DRFResponse({
            'message': 'Evaluation submitted successfully',
            'assignment': EvaluationAssignmentSerializer(assignment).data,
            'responses': ResponseSerializer(responses, many=True).data,
        })
