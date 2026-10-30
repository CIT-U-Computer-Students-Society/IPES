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
    queryset = Membership.objects.all()
    serializer_class = MembershipSerializer
    permission_classes = [permissions.IsAuthenticated, EvaluationOrganizationPermission]

    def get_queryset(self):
        queryset = super().get_queryset().filter(
            unit_id__organization_id=active_organization(self.request)
        )
        if self.action == 'list':
            is_active_param = self.request.query_params.get('is_active')
            if is_active_param is not None:
                if is_active_param.lower() in ('true', '1'):
                    queryset = queryset.filter(is_active=True)
                elif is_active_param.lower() in ('false', '0'):
                    queryset = queryset.filter(is_active=False)
            else:
                queryset = queryset.filter(is_active=True)

        user_id = self.request.query_params.get('user_id')
        unit_id = self.request.query_params.get('unit_id')
        if user_id:
            queryset = queryset.filter(user_id=user_id)
        if unit_id:
            queryset = queryset.filter(unit_id=unit_id)
        return queryset.select_related(
            'user_id', 'unit_id', 'position_id'
        ).order_by('id')

    def create(self, request, *args, **kwargs):
        """Create a new membership or reactivate an existing inactive assignment."""
        unit_id = request.data.get('unit_id')
        user_id = request.data.get('user_id')
        position_id = request.data.get('position_id')

        if not unit_id or not user_id:
            return Response(
                {'error': 'unit_id and user_id are required'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            unit = OrganizationUnit.objects.get(id=unit_id)
            org = unit.organization_id
        except OrganizationUnit.DoesNotExist:
            return Response(
                {'error': 'Invalid unit'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        is_admin = (
            request.user.is_superuser or
            OrganizationRole.objects.filter(
                user=request.user,
                organization=org,
                role='Admin',
                is_active=True,
            ).exists()
        )
        if not is_admin:
            return Response(
                {'error': 'Not authorized to add memberships to this organization'},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Check if an inactive assignment already exists for this user+unit+position
        if position_id:
            inactive_membership = Membership.objects.filter(
                user_id=user_id,
                unit_id=unit_id,
                position_id=position_id,
                is_active=False,
            ).first()
            if inactive_membership:
                inactive_membership.is_active = True
                inactive_membership.date_start = timezone.now().date()
                inactive_membership.date_end = None
                inactive_membership.save()
                return Response(
                    self.get_serializer(inactive_membership).data,
                    status=status.HTTP_201_CREATED,
                )

        return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        """Automatically set start date when creating a membership"""
        serializer.save(
            date_start=timezone.now().date(),
            is_active=True,
        )

    def perform_update(self, serializer):
        """Set end date on deactivation or clear end date on reactivation"""
        instance = serializer.instance
        reactivated = (
            not instance.is_active and
            serializer.validated_data.get('is_active') is True
        )
        deactivated = (
            instance.is_active and
            serializer.validated_data.get('is_active') is False
        )

        if reactivated:
            serializer.validated_data['date_start'] = timezone.now().date()
            serializer.validated_data['date_end'] = None

        updated_instance = serializer.save()

        if deactivated and not updated_instance.date_end:
            updated_instance.date_end = timezone.now().date()
            updated_instance.save(update_fields=['date_end'])

    def perform_destroy(self, instance):
        instance.is_active = False
        instance.date_end = timezone.now().date()
        instance.save(update_fields=['is_active', 'date_end'])
