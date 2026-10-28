"""
PositionType ViewSet.
"""

from rest_framework import viewsets, permissions

from ..models import PositionType
from ..serializers import PositionTypeSerializer
from ..access import active_organization, EvaluationOrganizationPermission


class PositionTypeViewSet(viewsets.ModelViewSet):
    """ViewSet for PositionType CRUD"""
    queryset = PositionType.objects.filter(is_active=True)
    serializer_class = PositionTypeSerializer
    permission_classes = [permissions.IsAuthenticated, EvaluationOrganizationPermission]

    def get_queryset(self):
        queryset = super().get_queryset()
        org_id = active_organization(self.request)
        if org_id:
            queryset = queryset.filter(organization_id=org_id)
        return queryset.select_related('organization_id').order_by('rank', 'id')

    def perform_destroy(self, instance):
        from rest_framework.exceptions import ValidationError
        from ..models import Membership
        if Membership.objects.filter(position_id=instance, is_active=True).exists():
            raise ValidationError({'error': 'Cannot delete position type if active members are still holding it.'})

        instance.is_active = False
        instance.save()
