"""
Membership ViewSet — CRUD with admin authorization checks.
"""

from rest_framework import viewsets, permissions, status
from rest_framework.response import Response
from django.utils import timezone

from ..models import OrganizationUnit, Membership, OrganizationRole
from ..serializers import MembershipSerializer
from ..access import active_organization, EvaluationOrganizationPermission


class MembershipViewSet(viewsets.ModelViewSet):
    """ViewSet for Membership CRUD"""
    queryset = Membership.objects.filter(is_active=True)
    serializer_class = MembershipSerializer
    permission_classes = [permissions.IsAuthenticated, EvaluationOrganizationPermission]

    def get_queryset(self):
        queryset = super().get_queryset().filter(unit_id__organization_id=active_organization(self.request))
        user_id = self.request.query_params.get('user_id')
        unit_id = self.request.query_params.get('unit_id')
        if user_id:
            queryset = queryset.filter(user_id=user_id)
        if unit_id:
            queryset = queryset.filter(unit_id=unit_id)
        return queryset.select_related('user_id', 'unit_id', 'position_id').order_by('id')

    def create(self, request, *args, **kwargs):
        """Override create to validate Admin role before allowing new membership creation"""
        unit_id = request.data.get('unit_id')
        user_id = request.data.get('user_id')

        if not unit_id or not user_id:
            return Response({'error': 'unit_id and user_id are required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            unit = OrganizationUnit.objects.get(id=unit_id)
            org = unit.organization_id
        except OrganizationUnit.DoesNotExist:
            return Response({'error': 'Invalid unit'}, status=status.HTTP_400_BAD_REQUEST)

        if not OrganizationRole.objects.filter(user=request.user, organization=org, role='Admin').exists():
            return Response(
                {'error': 'Not authorized to add memberships to this organization'},
                status=status.HTTP_403_FORBIDDEN,
            )

        return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        """Automatically set start date when creating a membership"""
        serializer.save(
            date_start=timezone.now().date(),
            is_active=True
        )

    def perform_update(self, serializer):
        """Automatically set end date when deactivating a membership"""
        instance = serializer.save()
        if not instance.is_active and not instance.date_end:
            instance.date_end = timezone.now().date()
            instance.save(update_fields=['date_end'])

    def perform_destroy(self, instance):
        instance.is_active = False
        instance.date_end = timezone.now().date()
        instance.save(update_fields=['is_active', 'date_end'])
