"""
PositionType ViewSet.
"""

from rest_framework import viewsets, permissions
from rest_framework.exceptions import ValidationError

from apps.audit.utils import log_action, AuditActions
from ..models import PositionType, Membership
from ..serializers import PositionTypeSerializer
from ..access import active_organization, EvaluationOrganizationPermission


class PositionTypeViewSet(viewsets.ModelViewSet):
    """ViewSet for PositionType CRUD"""
    queryset = PositionType.objects.filter(is_active=True)
    serializer_class = PositionTypeSerializer
    permission_classes = [
        permissions.IsAuthenticated, EvaluationOrganizationPermission,
    ]

    def get_queryset(self):
        queryset = super().get_queryset()
        org_id = active_organization(self.request)
        if org_id:
            queryset = queryset.filter(organization_id=org_id)
        return queryset.select_related('organization_id').order_by(
            'rank', 'id',
        )

    def perform_create(self, serializer):
        position = serializer.save()
        log_action(
            self.request.user,
            AuditActions.POSITION_CREATED,
            self.request,
            organization_id=position.organization_id_id,
            position_id=position.pk,
            name=position.name,
        )

    def perform_update(self, serializer):
        previous = serializer.instance
        changed_fields = sorted(
            name for name, value in serializer.validated_data.items()
            if getattr(previous, name) != value
        )
        position = serializer.save()
        if changed_fields:
            log_action(
                self.request.user,
                AuditActions.POSITION_UPDATED,
                self.request,
                organization_id=position.organization_id_id,
                position_id=position.pk,
                name=position.name,
                fields=','.join(changed_fields),
            )

    def perform_destroy(self, instance):
        if Membership.objects.filter(
            position_id=instance, is_active=True,
        ).exists():
            raise ValidationError({
                'error': (
                    'Cannot delete position type if active members are '
                    'still holding it.'
                ),
            })

        instance.is_active = False
        instance.save()
        log_action(
            self.request.user,
            AuditActions.POSITION_DEACTIVATED,
            self.request,
            organization_id=instance.organization_id_id,
            position_id=instance.pk,
            name=instance.name,
        )
