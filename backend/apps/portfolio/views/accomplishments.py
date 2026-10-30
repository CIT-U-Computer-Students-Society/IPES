"""
Accomplishment ViewSet — CRUD, verification, summary statistics, profiles.

The repeated admin-check pattern is centralised into ``_check_org_admin``
so that each action stays concise and readable.
"""

from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError
from django.db.models import Count

from apps.audit.utils import log_action, AuditActions
from apps.organizations.access import active_organization
from apps.organizations.models import Organization

from ..models import Accomplishment
from ..serializers import (
    AccomplishmentSerializer,
    AccomplishmentCreateSerializer,
    AccomplishmentListSerializer,
    AccomplishmentUpdateSerializer,
    AccomplishmentVerifySerializer,
)


def _check_org_admin(user, org_id):
    """Return True if *user* is an active Admin for *org_id*, False otherwise."""
    from apps.organizations.models import OrganizationRole
    return OrganizationRole.objects.filter(
        user_id=user,
        organization_id=org_id,
        role='Admin',
        is_active=True,
    ).exists()


class AccomplishmentViewSet(viewsets.ModelViewSet):
    """ViewSet for Accomplishment CRUD operations"""
    queryset = Accomplishment.objects.all()
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        if self.action == 'create':
            return AccomplishmentCreateSerializer
        elif self.action in ['update', 'partial_update']:
            return AccomplishmentUpdateSerializer
        elif self.action == 'list':
            return AccomplishmentListSerializer
        return AccomplishmentSerializer

    def _get_org_id_from_request(self):
        """Return the active organization ID from the request header."""
        return self.request.headers.get('X-Organization-Id')

    def get_queryset(self):
        """Filter accomplishments based on organization, user role, and parameters"""
        queryset = Accomplishment.objects.all()
        user = self.request.user

        is_global_admin = user.is_staff or user.is_superuser
        header_org = self._get_org_id_from_request()
        query_org = self.request.query_params.get('organization_id')
        if header_org and query_org and str(header_org) != str(query_org):
            raise ValidationError({
                'organization_id': (
                    'Organization header and parameter must match.'
                )
            })
        org_id = query_org or header_org

        if not org_id and not is_global_admin:
            return (
                queryset.filter(user_id=user)
                .select_related('user_id', 'verified_by')
                .order_by('-date_completed', '-id')
            )

        is_org_admin = False
        if org_id and not is_global_admin:
            is_org_admin = _check_org_admin(user, org_id)

            if not is_org_admin:
                return (
                    queryset.filter(user_id=user, organization_id=org_id)
                    .select_related('user_id', 'verified_by')
                    .order_by('-date_completed', '-id')
                )

            queryset = queryset.filter(organization_id=org_id)

        elif org_id and is_global_admin:
            queryset = queryset.filter(organization_id=org_id)

        # Optional filters
        user_id = self.request.query_params.get('user_id')
        status_param = self.request.query_params.get('status')
        type_param = self.request.query_params.get('type')

        if user_id and (is_global_admin or is_org_admin):
            queryset = queryset.filter(user_id=user_id)
        if status_param:
            queryset = queryset.filter(status=status_param)
        if type_param:
            queryset = queryset.filter(type=type_param)

        return queryset.select_related('user_id', 'verified_by').order_by('-date_completed', '-id')

    def create(self, request, *args, **kwargs):
        active_organization(request)
        return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        """Auto-set user_id and organization_id from request, then log."""
        org_id = active_organization(self.request)
        organization = Organization.objects.get(pk=org_id)

        accomplishment = serializer.save(
            user_id=self.request.user, organization_id=organization
        )
        log_action(
            self.request.user,
            AuditActions.ACCOMPLISHMENT_CREATED,
            self.request,
            organization_id=organization.id,
            accomplishment_id=str(accomplishment.id),
            title=accomplishment.title
        )

    def perform_update(self, serializer):
        """Update accomplishment and log the change"""
        instance = self.get_object()
        update_kwargs = {}

        if instance.status == 'Rejected':
            update_kwargs['status'] = 'Pending'
            update_kwargs['verified_by'] = None
            update_kwargs['comments'] = None

        accomplishment = serializer.save(**update_kwargs)
        log_action(
            self.request.user,
            AuditActions.ACCOMPLISHMENT_UPDATED,
            self.request,
            organization_id=accomplishment.organization_id_id,
            accomplishment_id=str(accomplishment.id),
            title=accomplishment.title,
            status=accomplishment.status
        )

    def update(self, request, *args, **kwargs):
        """Override update to allow only owners to edit pending/rejected accomplishments"""
        accomplishment = self.get_object()

        if accomplishment.user_id != request.user:
            return Response(
                {'error': 'You can only edit your own accomplishments'},
                status=status.HTTP_403_FORBIDDEN
            )

        if accomplishment.status not in ['Pending', 'Rejected']:
            return Response(
                {'error': 'You can only edit pending or rejected accomplishments'},
                status=status.HTTP_400_BAD_REQUEST
            )

        return super().update(request, *args, **kwargs)

    # ------------------------------------------------------------------
    # Actions
    # ------------------------------------------------------------------

    @action(detail=False, methods=['get'])
    def my(self, request):
        """Get current user's accomplishments scoped to the active org"""
        accomplishments = self.get_queryset().filter(user_id=request.user)
        serializer = AccomplishmentListSerializer(accomplishments, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def pending(self, request):
        """Get accomplishments pending verification (Admin only)"""
        user = request.user
        is_global_admin = user.is_staff or user.is_superuser
        org_id = (
            request.query_params.get('organization_id')
            or self._get_org_id_from_request()
        )

        if not is_global_admin:
            if not org_id:
                return Response({'error': 'organization_id is required'}, status=status.HTTP_400_BAD_REQUEST)

            if not _check_org_admin(user, org_id):
                return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)

        accomplishments = self.get_queryset().filter(status='Pending')
        serializer = AccomplishmentListSerializer(accomplishments, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def by_type(self, request):
        """Filter accomplishments by type"""
        type_param = request.query_params.get('type')
        if not type_param:
            return Response(
                {'error': 'type parameter is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        accomplishments = self.get_queryset().filter(type=type_param)
        serializer = AccomplishmentListSerializer(accomplishments, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def summary(self, request):
        """Get summary statistics for accomplishments"""
        user = request.user
        is_global_admin = user.is_staff or user.is_superuser
        org_id = (
            request.query_params.get('organization_id')
            or self._get_org_id_from_request()
        )

        if not is_global_admin:
            if not org_id:
                return Response({'error': 'organization_id is required'}, status=status.HTTP_400_BAD_REQUEST)

            if not _check_org_admin(user, org_id):
                return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)

        # Scope directly by org FK
        if org_id:
            queryset = Accomplishment.objects.filter(organization_id=org_id)
        else:
            queryset = Accomplishment.objects.all()

        user_id = request.query_params.get('user_id')
        if user_id:
            queryset = queryset.filter(user_id=user_id)

        total = queryset.count()
        verified = queryset.filter(status='Verified').count()
        pending_count = queryset.filter(status='Pending').count()
        rejected = queryset.filter(status='Rejected').count()

        by_type = dict(
            queryset.values('type')
            .annotate(count=Count('id'))
            .values_list('type', 'count')
        )

        return Response({
            'total': total,
            'verified': verified,
            'pending': pending_count,
            'rejected': rejected,
            'by_type': by_type
        })

    @action(detail=True, methods=['post'])
    def verify(self, request, pk=None):
        """Verify or reject an accomplishment (Admin only)"""
        accomplishment = self.get_object()

        user = request.user
        is_global_admin = user.is_staff or user.is_superuser
        header_org = self._get_org_id_from_request()
        query_org = request.query_params.get('organization_id')
        body_org = request.data.get('organization_id')
        selectors = [
            s for s in (header_org, query_org, body_org)
            if s is not None and str(s).strip() != ''
        ]
        if len(set(str(s) for s in selectors)) > 1:
            raise ValidationError({
                'organization_id': (
                    'Conflicting organization selectors provided.'
                )
            })
        org_id = str(selectors[0]) if selectors else None

        if not is_global_admin:
            if not org_id:
                return Response({'error': 'organization_id is required'}, status=status.HTTP_400_BAD_REQUEST)

            if not _check_org_admin(user, org_id):
                return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)

        # Ensure accomplishment belongs to the org
        if not is_global_admin and org_id:
            if str(accomplishment.organization_id_id) != str(org_id):
                return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)

        if accomplishment.status != 'Pending':
            return Response(
                {'error': 'Can only verify pending accomplishments'},
                status=status.HTTP_400_BAD_REQUEST
            )

        serializer = AccomplishmentVerifySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        accomplishment.status = serializer.validated_data['status']
        accomplishment.verified_by = request.user

        if 'comments' in serializer.validated_data:
            accomplishment.comments = serializer.validated_data['comments']

        accomplishment.save()

        audit_action = (
            AuditActions.ACCOMPLISHMENT_VERIFIED
            if accomplishment.status == 'Verified'
            else AuditActions.ACCOMPLISHMENT_REJECTED
        )
        log_action(
            request.user,
            audit_action,
            request,
            organization_id=accomplishment.organization_id_id,
            accomplishment_id=str(accomplishment.id),
            title=accomplishment.title,
            status=accomplishment.status
        )

        response_serializer = AccomplishmentSerializer(accomplishment)
        return Response({
            'message': f'Accomplishment {serializer.validated_data["status"].lower()} successfully',
            'accomplishment': response_serializer.data
        })

    @action(detail=False, methods=['get'])
    def evaluatee_profile(self, request):
        """
        Return a specific user's Verified accomplishments + org unit info,
        for use by evaluators filling out a peer evaluation form.
        """
        evaluatee_id = request.query_params.get('user_id')
        header_org = self._get_org_id_from_request()
        query_org = request.query_params.get('organization_id')
        if header_org and query_org and str(header_org) != str(query_org):
            raise ValidationError({
                'organization_id': (
                    'Organization header and parameter must match.'
                )
            })
        org_id = query_org or header_org

        if not evaluatee_id or not org_id:
            return Response(
                {'error': 'user_id and organization_id are required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        from apps.organizations.models import Membership, OrganizationRole

        requester_is_member = OrganizationRole.objects.filter(
            user_id=request.user.id,
            organization_id=org_id,
            is_active=True
        ).exists()
        if not requester_is_member:
            return Response(
                {'error': 'You are not a member of this organization'},
                status=status.HTTP_403_FORBIDDEN
            )

        evaluatee_role = OrganizationRole.objects.filter(
            user_id=evaluatee_id,
            organization_id=org_id,
            is_active=True
        ).select_related('user').first()

        if not evaluatee_role:
            return Response(
                {'error': 'Evaluatee is not a member of this organization'},
                status=status.HTTP_404_NOT_FOUND
            )

        evaluatee_membership = Membership.objects.filter(
            user_id=evaluatee_id,
            unit_id__organization_id=org_id,
            is_active=True
        ).select_related('unit_id', 'position_id').first()

        accomplishments = Accomplishment.objects.filter(
            user_id=evaluatee_id,
            organization_id=org_id,
            status='Verified'
        ).order_by('-date_completed', '-id')

        serializer = AccomplishmentListSerializer(accomplishments, many=True)

        return Response({
            'evaluatee_name': evaluatee_role.user.get_full_name() or evaluatee_role.user.email,
            'unit_name': (
                evaluatee_membership.unit_id.name
                if evaluatee_membership and evaluatee_membership.unit_id
                else None
            ),
            'position_name': (
                evaluatee_membership.position_id.name
                if evaluatee_membership and evaluatee_membership.position_id
                else None
            ),
            'accomplishments': serializer.data,
        })

    @action(detail=False, methods=['get'])
    def verified(self, request):
        """Get verified accomplishments"""
        accomplishments = self.get_queryset().filter(status='Verified')
        serializer = AccomplishmentListSerializer(accomplishments, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def rejected(self, request):
        """Get rejected accomplishments"""
        accomplishments = self.get_queryset().filter(status='Rejected')
        serializer = AccomplishmentListSerializer(accomplishments, many=True)
        return Response(serializer.data)
