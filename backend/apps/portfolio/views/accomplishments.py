"""
Accomplishment ViewSet — CRUD, verification, summary statistics, profiles.

The repeated admin-check pattern is centralised into ``_check_org_admin``
so that each action stays concise and readable.
"""

from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError
from django.db import transaction
from django.db.models import Count
from django.utils import timezone

from apps.audit.utils import log_action, AuditActions
from apps.organizations.access import active_organization
from apps.organizations.models import Organization
from apps.validation import positive_id

from ..models import Accomplishment
from ..serializers import (
    AccomplishmentSerializer,
    AccomplishmentCreateSerializer,
    AccomplishmentListSerializer,
    AccomplishmentUpdateSerializer,
    AccomplishmentVerifySerializer,
)


def _check_org_admin(user, org_id):
    """Return True if user is an active Admin for org_id, False otherwise."""
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
        raw = self.request.headers.get('X-Organization-Id')
        if raw is None or str(raw).strip() == '':
            return None
        return positive_id(raw, 'organization_id')

    def _resolve_organization_id(self, request=None, allow_none=True):
        """
        Resolve and validate organization_id from header and query parameters.
        Ensures consistent 400 ValidationErrors for malformed, nonnumeric,
        or mismatched IDs.
        """
        req = request or self.request
        header_org = req.headers.get('X-Organization-Id')
        query_org = req.query_params.get('organization_id')
        if header_org is not None and str(header_org).strip() == '':
            header_org = None
        if query_org is not None and str(query_org).strip() == '':
            query_org = None

        if header_org and query_org and str(header_org) != str(query_org):
            raise ValidationError({
                'organization_id': (
                    'Organization header and parameter must match.'
                )
            })

        raw_org = query_org or header_org
        if not raw_org:
            if not allow_none:
                raise ValidationError({
                    'organization_id': (
                        'An active organization must be selected.'
                    )
                })
            return None

        return positive_id(raw_org, 'organization_id')

    def get_queryset(self):
        """Filter accomplishments by org, role, and query parameters."""
        queryset = Accomplishment.objects.all()
        user = self.request.user

        is_global_admin = user.is_staff or user.is_superuser
        org_id = self._resolve_organization_id()

        # Optional filters
        user_id_param = self.request.query_params.get('user_id')
        user_id = (
            positive_id(user_id_param, 'user_id')
            if user_id_param
            else None
        )

        is_org_admin = False
        if not org_id and not is_global_admin:
            queryset = queryset.filter(user_id=user)
        elif org_id and not is_global_admin:
            is_org_admin = _check_org_admin(user, org_id)
            if not is_org_admin:
                queryset = queryset.filter(
                    user_id=user,
                    organization_id=org_id,
                )
            else:
                queryset = queryset.filter(organization_id=org_id)
        elif org_id and is_global_admin:
            queryset = queryset.filter(organization_id=org_id)

        if user_id and (is_global_admin or is_org_admin):
            queryset = queryset.filter(user_id=user_id)

        status_param = self.request.query_params.get('status')
        type_param = self.request.query_params.get('type')

        if status_param:
            queryset = queryset.filter(status=status_param)
        if type_param:
            queryset = queryset.filter(type=type_param)

        return (
            queryset.select_related('user_id', 'verified_by')
            .order_by('-date_completed', '-id')
        )

    def create(self, request, *args, **kwargs):
        org_id = self._resolve_organization_id(request, allow_none=False)
        if not Organization.objects.filter(pk=org_id).exists():
            raise ValidationError({
                'organization_id': 'Organization not found.'
            })
        active_organization(request)
        return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        """Auto-set user_id and organization_id from request, then log."""
        org_id = active_organization(self.request)
        organization = Organization.objects.get(pk=org_id)

        accomplishment = serializer.save(
            user_id=self.request.user,
            organization_id=organization,
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
        """Allow only owners to edit accomplishments under lock."""
        with transaction.atomic():
            accomplishment = (
                Accomplishment.objects.select_for_update()
                .filter(pk=kwargs.get('pk'))
                .first()
            )
            if not accomplishment:
                return Response(
                    {'detail': 'Not found.'},
                    status=status.HTTP_404_NOT_FOUND
                )

            if accomplishment.user_id != request.user:
                return Response(
                    {'error': 'You can only edit your own accomplishments'},
                    status=status.HTTP_403_FORBIDDEN
                )

            if accomplishment.status not in ['Pending', 'Rejected']:
                return Response(
                    {
                        'error': (
                            'You can only edit pending or rejected'
                            ' accomplishments'
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )

            return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        """Allow only owners to delete pending or rejected accomplishments."""
        with transaction.atomic():
            pk = kwargs.get('pk')
            accomplishment = (
                Accomplishment.objects.select_for_update()
                .filter(pk=pk)
                .first()
            )
            if not accomplishment:
                return Response(
                    {'detail': 'Not found.'},
                    status=status.HTTP_404_NOT_FOUND
                )

            scoped_exists = (
                self.filter_queryset(self.get_queryset())
                .filter(pk=pk)
                .exists()
            )
            if not scoped_exists:
                return Response(
                    {'detail': 'Not found.'},
                    status=status.HTTP_404_NOT_FOUND
                )

            if accomplishment.user_id != request.user:
                return Response(
                    {'error': 'You can only delete your own accomplishments'},
                    status=status.HTTP_403_FORBIDDEN
                )

            if accomplishment.status not in ['Pending', 'Rejected']:
                return Response(
                    {
                        'error': (
                            'You can only delete pending or rejected'
                            ' accomplishments'
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )

            self.perform_destroy(accomplishment)
            return Response(status=status.HTTP_204_NO_CONTENT)

    def perform_destroy(self, instance):
        """Delete accomplishment and log the audit event."""
        org_id = instance.organization_id_id
        acc_id = str(instance.id)
        title = instance.title
        status_val = instance.status

        super().perform_destroy(instance)

        log_action(
            self.request.user,
            AuditActions.ACCOMPLISHMENT_DELETED,
            self.request,
            organization_id=org_id,
            accomplishment_id=acc_id,
            title=title,
            status=status_val
        )

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
        org_id = self._resolve_organization_id(request)

        if not is_global_admin:
            if not org_id:
                return Response(
                    {'error': 'organization_id is required'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            if not _check_org_admin(user, org_id):
                return Response(
                    {'error': 'Unauthorized'},
                    status=status.HTTP_403_FORBIDDEN
                )

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
        org_id = self._resolve_organization_id(request)

        if not is_global_admin:
            if not org_id:
                return Response(
                    {'error': 'organization_id is required'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            if not _check_org_admin(user, org_id):
                return Response(
                    {'error': 'Unauthorized'},
                    status=status.HTTP_403_FORBIDDEN
                )

        # Scope directly by org FK
        if org_id:
            queryset = Accomplishment.objects.filter(organization_id=org_id)
        else:
            queryset = Accomplishment.objects.all()

        user_id_param = request.query_params.get('user_id')
        if user_id_param:
            user_id = positive_id(user_id_param, 'user_id')
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
        header_org = self.request.headers.get('X-Organization-Id')
        query_org = request.query_params.get('organization_id')
        body_org = (
            request.data.get('organization_id')
            if isinstance(request.data, dict)
            else None
        )
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
        org_id = (
            positive_id(selectors[0], 'organization_id')
            if selectors
            else None
        )

        if not is_global_admin:
            if not org_id:
                return Response(
                    {'error': 'organization_id is required'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            if not _check_org_admin(user, org_id):
                return Response(
                    {'error': 'Unauthorized'},
                    status=status.HTTP_403_FORBIDDEN
                )

        with transaction.atomic():
            accomplishment = (
                Accomplishment.objects.select_for_update()
                .filter(pk=pk)
                .first()
            )
            if not accomplishment:
                return Response(
                    {'detail': 'Not found.'},
                    status=status.HTTP_404_NOT_FOUND
                )

            # Ensure accomplishment belongs to the org
            if not is_global_admin and org_id:
                if str(accomplishment.organization_id_id) != str(org_id):
                    return Response(
                        {'error': 'Unauthorized'},
                        status=status.HTTP_403_FORBIDDEN
                    )

            if accomplishment.status != 'Pending':
                return Response(
                    {'error': 'Can only verify pending accomplishments'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            serializer = AccomplishmentVerifySerializer(data=request.data)
            serializer.is_valid(raise_exception=True)

            new_status = serializer.validated_data['status']
            has_comments = 'comments' in serializer.validated_data
            comments = serializer.validated_data.get('comments')

            update_fields = {
                'status': new_status,
                'verified_by': request.user,
                'updated_at': timezone.now(),
            }
            if has_comments:
                update_fields['comments'] = comments

            updated_count = Accomplishment.objects.filter(
                pk=accomplishment.pk, status='Pending'
            ).update(**update_fields)
            if updated_count == 0:
                return Response(
                    {'error': 'Can only verify pending accomplishments'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            accomplishment.refresh_from_db()

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
                'message': (
                    f'Accomplishment '
                    f'{serializer.validated_data["status"].lower()} '
                    f'successfully'
                ),
                'accomplishment': response_serializer.data
            })

    @action(detail=False, methods=['get'])
    def evaluatee_profile(self, request):
        """
        Return a specific user's Verified accomplishments + org unit info,
        for use by evaluators filling out a peer evaluation form.
        """
        evaluatee_id_param = request.query_params.get('user_id')
        header_org = self.request.headers.get('X-Organization-Id')
        query_org = request.query_params.get('organization_id')
        if header_org is not None and str(header_org).strip() == '':
            header_org = None
        if query_org is not None and str(query_org).strip() == '':
            query_org = None
        if header_org and query_org and str(header_org) != str(query_org):
            raise ValidationError({
                'organization_id': (
                    'Organization header and parameter must match.'
                )
            })
        raw_org = query_org or header_org

        if not evaluatee_id_param or not raw_org:
            return Response(
                {'error': 'user_id and organization_id are required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        org_id = positive_id(raw_org, 'organization_id')
        evaluatee_id = positive_id(evaluatee_id_param, 'user_id')

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

        eval_user = evaluatee_role.user
        return Response({
            'evaluatee_name': eval_user.get_full_name() or eval_user.email,
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
