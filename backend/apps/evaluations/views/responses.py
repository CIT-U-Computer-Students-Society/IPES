"""Tenant-scoped response reads and transactional evaluator-only writes."""

from django.db import transaction
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response as DRFResponse

from apps.organizations.access import active_organization, is_organization_admin
from apps.validation import positive_id
from ..models import Response
from ..serializers import ResponseSerializer
from ..services import locked_assignment, save_answers


class ResponseViewSet(viewsets.ModelViewSet):
    queryset = Response.objects.all()
    serializer_class = ResponseSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        org_id = active_organization(self.request)
        queryset = Response.objects.filter(
            assignment_id__form_id__organization_id=org_id,
            assignment_id__form_id__is_deleted=False,
        )
        if not is_organization_admin(self.request, org_id):
            queryset = queryset.filter(assignment_id__evaluator_id=self.request.user)
        for name in ('assignment_id', 'question_id'):
            value = self.request.query_params.get(name)
            if value:
                queryset = queryset.filter(**{name: positive_id(value, name)})
        return queryset.select_related('assignment_id', 'question_id').order_by('id')

    def create(self, request, *args, **kwargs):
        assignment_id = request.data.get('assignment_id')
        self._validate_assignment_id(assignment_id)
        _, rows = save_answers(request, assignment_id, {'responses': [request.data]}, replace=False)
        return DRFResponse(ResponseSerializer(rows[0]).data, status=status.HTTP_201_CREATED)

    @transaction.atomic
    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        locked_assignment(request, instance.assignment_id_id)
        instance.refresh_from_db()
        for name, expected in (('assignment_id', instance.assignment_id_id), ('question_id', instance.question_id_id)):
            if name in request.data and str(request.data[name]) != str(expected):
                raise ValidationError({name: 'Response relationships cannot be changed.'})
        answer = {
            'question_id': instance.question_id_id,
            'score_value': request.data.get('score_value', instance.score_value),
            'text': request.data.get('text', instance.text),
        }
        _, rows = save_answers(request, instance.assignment_id_id, {'responses': [answer]}, replace=False)
        return DRFResponse(ResponseSerializer(rows[0]).data)

    @transaction.atomic
    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        locked_assignment(request, instance.assignment_id_id)
        instance.delete()
        return DRFResponse(status=status.HTTP_204_NO_CONTENT)

    @staticmethod
    def _validate_assignment_id(value):
        return positive_id(value, 'assignment_id')

    @action(detail=False, methods=['post'])
    def bulk_create(self, request):
        assignment_id = request.data.get('assignment_id')
        self._validate_assignment_id(assignment_id)
        _, rows = save_answers(request, assignment_id, request.data)
        return DRFResponse(ResponseSerializer(rows, many=True).data, status=status.HTTP_201_CREATED)
