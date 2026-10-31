"""
UnitType and OrganizationUnit ViewSets.
"""

from rest_framework import viewsets, permissions
from rest_framework.exceptions import ValidationError
from django.db.models import Count, Q

from apps.audit.utils import log_action, AuditActions
from ..models import OrganizationUnit, UnitType, Membership
from ..serializers import UnitTypeSerializer, OrganizationUnitSerializer
from ..access import active_organization, EvaluationOrganizationPermission


class UnitTypeViewSet(viewsets.ModelViewSet):
    """ViewSet for UnitType CRUD"""
    queryset = UnitType.objects.filter(is_active=True)
    serializer_class = UnitTypeSerializer
    permission_classes = [
        permissions.IsAuthenticated, EvaluationOrganizationPermission,
    ]

    def get_queryset(self):
        queryset = super().get_queryset()
        org_id = active_organization(self.request)
        if org_id:
            queryset = queryset.filter(organization_id=org_id)
        return queryset.select_related('organization_id').order_by('id')

    def perform_create(self, serializer):
        unit_type = serializer.save()
        log_action(
            self.request.user,
            AuditActions.UNIT_TYPE_CREATED,
            self.request,
            organization_id=unit_type.organization_id_id,
            unit_type_id=unit_type.pk,
            name=unit_type.name,
        )

    def perform_update(self, serializer):
        previous = serializer.instance
        changed_fields = sorted(
            name for name, value in serializer.validated_data.items()
            if getattr(previous, name) != value
        )
        unit_type = serializer.save()
        if changed_fields:
            log_action(
                self.request.user,
                AuditActions.UNIT_TYPE_UPDATED,
                self.request,
                organization_id=unit_type.organization_id_id,
                unit_type_id=unit_type.pk,
                name=unit_type.name,
                fields=','.join(changed_fields),
            )

    def perform_destroy(self, instance):
        if OrganizationUnit.objects.filter(
            type_id=instance, is_active=True,
        ).exists():
            raise ValidationError({
                'error': (
                    'Cannot delete unit type if active units are still '
                    'assigned to it.'
                ),
            })

        instance.is_active = False
        instance.save()
        log_action(
            self.request.user,
            AuditActions.UNIT_TYPE_DEACTIVATED,
            self.request,
            organization_id=instance.organization_id_id,
            unit_type_id=instance.pk,
            name=instance.name,
        )


class OrganizationUnitViewSet(viewsets.ModelViewSet):
    """ViewSet for OrganizationUnit CRUD"""
    queryset = OrganizationUnit.objects.filter(is_active=True)
    serializer_class = OrganizationUnitSerializer
    permission_classes = [
        permissions.IsAuthenticated, EvaluationOrganizationPermission,
    ]

    def get_queryset(self):
        queryset = super().get_queryset()
        org_id = active_organization(self.request)
        if org_id:
            queryset = queryset.filter(organization_id=org_id)

        queryset = queryset.annotate(
            members_count=Count('members', filter=Q(members__is_active=True))
        )
        return queryset.select_related(
            'organization_id', 'type_id',
        ).order_by('id')

    def perform_create(self, serializer):
        unit = serializer.save()
        log_action(
            self.request.user,
            AuditActions.UNIT_CREATED,
            self.request,
            organization_id=unit.organization_id_id,
            unit_id=unit.pk,
            name=unit.name,
        )

    def perform_update(self, serializer):
        previous = serializer.instance
        changed_fields = sorted(
            name for name, value in serializer.validated_data.items()
            if getattr(previous, name) != value
        )
        unit = serializer.save()
        if changed_fields:
            log_action(
                self.request.user,
                AuditActions.UNIT_UPDATED,
                self.request,
                organization_id=unit.organization_id_id,
                unit_id=unit.pk,
                name=unit.name,
                fields=','.join(changed_fields),
            )

    def perform_destroy(self, instance):
        if instance.members.filter(is_active=True).exists():
            raise ValidationError("Cannot delete unit with active members.")

        instance.is_active = False
        instance.save()
        Membership.objects.filter(
            unit_id=instance, is_active=True,
        ).update(is_active=False)
        log_action(
            self.request.user,
            AuditActions.UNIT_DEACTIVATED,
            self.request,
            organization_id=instance.organization_id_id,
            unit_id=instance.pk,
            name=instance.name,
        )
