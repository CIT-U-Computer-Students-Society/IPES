"""
JoinRequest ViewSet — scoped reads, approve, and reject actions.
"""

from rest_framework import mixins, viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError
from django.db.models import Q
from django.utils import timezone

from apps.audit.utils import log_action, AuditActions
from apps.organizations.access import is_organization_admin
from apps.validation import positive_id

from ..models import (
    Organization, OrganizationUnit, PositionType, Membership, JoinRequest, OrganizationRole,
)
from ..serializers import JoinRequestSerializer


class JoinRequestViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    """Scoped join request reads and explicit approval actions."""
    queryset = JoinRequest.objects.all()
    serializer_class = JoinRequestSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        request = self.request
        header = request.headers.get('X-Organization-Id')
        parameter = request.query_params.get('organization_id')
        header_id = positive_id(header, 'organization_id') if header else None
        parameter_id = positive_id(parameter, 'organization_id') if parameter else None
        if header_id and parameter_id and header_id != parameter_id:
            raise ValidationError({'organization_id': 'Organization header and parameter must match.'})
        org_id = header_id or parameter_id

        # A requester can inspect their own application even before joining.
        # Administrators can inspect their active organization's applications.
        visible = Q(user_id=request.user.pk)
        if org_id and Organization.objects.filter(pk=org_id, is_active=True).exists():
            if is_organization_admin(request, org_id):
                visible |= Q(organization_id=org_id)
        queryset = JoinRequest.objects.filter(visible)
        if org_id:
            queryset = queryset.filter(organization_id=org_id)
        user_id = request.query_params.get('user_id')
        if user_id:
            queryset = queryset.filter(user_id=positive_id(user_id, 'user_id'))
        req_status = request.query_params.get('status')
        if req_status:
            queryset = queryset.filter(status=req_status)
        return queryset.select_related('organization', 'user').order_by('-id')

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """Admin action to approve a join request and assign user to a unit and position."""
        join_request = self.get_object()

        if not OrganizationRole.objects.filter(
            user=request.user, organization=join_request.organization, role='Admin'
        ).exists():
            return Response({'error': 'Not authorized'}, status=status.HTTP_403_FORBIDDEN)

        if join_request.status != 'Pending':
            return Response({'error': 'Request is not pending'}, status=status.HTTP_400_BAD_REQUEST)

        unit_id = request.data.get('unit_id')
        position_id = request.data.get('position_id')
        role_choice = request.data.get('role', 'Member')

        if not unit_id or not position_id:
            return Response(
                {'error': 'unit_id and position_id required to approve'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            unit = OrganizationUnit.objects.get(
                id=unit_id, organization_id=join_request.organization, is_active=True
            )
            position = PositionType.objects.get(
                id=position_id, organization_id=join_request.organization, is_active=True
            )
        except (OrganizationUnit.DoesNotExist, PositionType.DoesNotExist):
            return Response(
                {'error': 'Invalid unit or position IDs — they may have been deleted'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Re-activate user account if deactivated
        rejoining_user = join_request.user
        if not rejoining_user.is_active:
            rejoining_user.is_active = True
            rejoining_user.save(update_fields=['is_active'])

        # Re-activate prior deactivated membership or create new one
        existing_membership = Membership.objects.filter(
            user_id=rejoining_user,
            unit_id__organization_id=join_request.organization,
            is_active=False
        ).order_by('-date_end').first()

        if existing_membership:
            existing_membership.unit_id = unit
            existing_membership.position_id = position
            existing_membership.date_start = timezone.now().date()
            existing_membership.date_end = None
            existing_membership.is_active = True
            existing_membership.save()
        else:
            Membership.objects.create(
                user_id=rejoining_user,
                unit_id=unit,
                position_id=position,
                date_start=timezone.now().date(),
                is_active=True
            )

        OrganizationRole.objects.update_or_create(
            user=rejoining_user,
            organization=join_request.organization,
            defaults={'role': role_choice, 'is_active': True}
        )

        join_request.status = 'Approved'
        join_request.save()

        log_action(
            request.user,
            AuditActions.ORG_JOIN_APPROVED,
            request,
            target_user_email=join_request.user.email,
            org_name=join_request.organization.name
        )

        return Response({'message': 'Member approved and added successfully'})

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        """Admin action to reject a pending join request"""
        join_request = self.get_object()

        if not OrganizationRole.objects.filter(
            user=request.user, organization=join_request.organization, role='Admin'
        ).exists():
            return Response({'error': 'Not authorized'}, status=status.HTTP_403_FORBIDDEN)

        join_request.status = 'Rejected'
        join_request.save()

        log_action(
            request.user,
            AuditActions.ORG_JOIN_REJECTED,
            request,
            target_user_email=join_request.user.email,
            org_name=join_request.organization.name
        )

        return Response({'message': 'Join request rejected'})
