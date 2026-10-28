"""
UnitType and OrganizationUnit ViewSets.
"""

from rest_framework import viewsets, permissions
from django.db.models import Count, Q

from ..models import OrganizationUnit, UnitType, Membership
from ..serializers import UnitTypeSerializer, OrganizationUnitSerializer
from ..access import active_organization, EvaluationOrganizationPermission


class UnitTypeViewSet(viewsets.ModelViewSet):
    """ViewSet for UnitType CRUD"""
    queryset = UnitType.objects.filter(is_active=True)
    serializer_class = UnitTypeSerializer
    permission_classes = [permissions.IsAuthenticated, EvaluationOrganizationPermission]

    def get_queryset(self):
        queryset = super().get_queryset()
        org_id = active_organization(self.request)
        if org_id:
            queryset = queryset.filter(organization_id=org_id)
        return queryset.select_related('organization_id').order_by('id')

    def perform_destroy(self, instance):
        from rest_framework.exceptions import ValidationError
        if OrganizationUnit.objects.filter(type_id=instance, is_active=True).exists():
            raise ValidationError({'error': 'Cannot delete unit type if active units are still assigned to it.'})

        instance.is_active = False
        instance.save()


class OrganizationUnitViewSet(viewsets.ModelViewSet):
    """ViewSet for OrganizationUnit CRUD"""
    queryset = OrganizationUnit.objects.filter(is_active=True)
    serializer_class = OrganizationUnitSerializer
    permission_classes = [permissions.IsAuthenticated, EvaluationOrganizationPermission]

    def get_queryset(self):
        queryset = super().get_queryset()
        org_id = active_organization(self.request)
        if org_id:
            queryset = queryset.filter(organization_id=org_id)

        queryset = queryset.annotate(
            members_count=Count('members', filter=Q(members__is_active=True))
        )
        return queryset.select_related('organization_id', 'type_id').order_by('id')

    def perform_destroy(self, instance):
        if instance.members.filter(is_active=True).exists():
            from rest_framework.exceptions import ValidationError
            raise ValidationError("Cannot delete unit with active members.")

        instance.is_active = False
        instance.save()
        Membership.objects.filter(unit_id=instance, is_active=True).update(is_active=False)
