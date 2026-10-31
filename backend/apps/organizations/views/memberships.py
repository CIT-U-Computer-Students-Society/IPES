"""
Membership ViewSet — CRUD with admin authorization checks.
"""

from rest_framework import viewsets, permissions, status
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from apps.audit.utils import log_action, AuditActions
from ..models import Membership
from ..serializers import MembershipSerializer
from ..access import active_organization, EvaluationOrganizationPermission


class MembershipViewSet(viewsets.ModelViewSet):
    """ViewSet for Membership CRUD"""
    queryset = Membership.objects.all()
    serializer_class = MembershipSerializer
    permission_classes = [
        permissions.IsAuthenticated, EvaluationOrganizationPermission,
    ]

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

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        """Create or reactivate only after validating the same access rules."""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        existing = Membership.objects.select_for_update().filter(
            user_id=data['user_id'], unit_id=data['unit_id'],
            position_id=data['position_id'],
        ).first()
        if existing:
            if existing.is_active:
                raise ValidationError(
                    'This membership (user + unit + position) already exists.'
                )
            serializer = self.get_serializer(
                existing, data={'is_active': True}, partial=True,
            )
            serializer.is_valid(raise_exception=True)
            self.perform_update(serializer)
        else:
            self.perform_create(serializer)
        return Response(
            serializer.data, status=status.HTTP_201_CREATED,
            headers=self.get_success_headers(serializer.data),
        )

    def perform_create(self, serializer):
        """Automatically set start date when creating a membership"""
        membership = serializer.save(
            date_start=timezone.now().date(),
            is_active=True,
        )
        log_action(
            self.request.user,
            AuditActions.MEMBERSHIP_CREATED,
            self.request,
            organization_id=membership.unit_id.organization_id_id,
            membership_id=membership.pk,
            target_user_id=membership.user_id_id,
            unit_id=membership.unit_id_id,
            position_id=membership.position_id_id,
        )

    def perform_update(self, serializer):
        """Set end date on deactivation or clear end date on reactivation"""
        instance = serializer.instance
        previous_active = instance.is_active
        reactivated = (
            not previous_active and
            serializer.validated_data.get('is_active') is True
        )
        deactivated = (
            previous_active and
            serializer.validated_data.get('is_active') is False
        )
        changed_fields = sorted(
            name for name, value in serializer.validated_data.items()
            if getattr(instance, name) != value
        )

        if reactivated:
            serializer.validated_data['date_start'] = timezone.now().date()
            serializer.validated_data['date_end'] = None

        updated_instance = serializer.save()

        if deactivated and not updated_instance.date_end:
            updated_instance.date_end = timezone.now().date()
            updated_instance.save(update_fields=['date_end'])

        org_id = updated_instance.unit_id.organization_id_id
        if deactivated:
            log_action(
                self.request.user,
                AuditActions.MEMBERSHIP_DEACTIVATED,
                self.request,
                organization_id=org_id,
                membership_id=updated_instance.pk,
                target_user_id=updated_instance.user_id_id,
                unit_id=updated_instance.unit_id_id,
                position_id=updated_instance.position_id_id,
            )
        elif reactivated:
            log_action(
                self.request.user,
                AuditActions.MEMBERSHIP_ACTIVATED,
                self.request,
                organization_id=org_id,
                membership_id=updated_instance.pk,
                target_user_id=updated_instance.user_id_id,
                unit_id=updated_instance.unit_id_id,
                position_id=updated_instance.position_id_id,
            )
        elif changed_fields:
            log_action(
                self.request.user,
                AuditActions.MEMBERSHIP_UPDATED,
                self.request,
                organization_id=org_id,
                membership_id=updated_instance.pk,
                target_user_id=updated_instance.user_id_id,
                unit_id=updated_instance.unit_id_id,
                position_id=updated_instance.position_id_id,
                fields=','.join(changed_fields),
            )

    def perform_destroy(self, instance):
        instance.is_active = False
        instance.date_end = timezone.now().date()
        instance.save(update_fields=['is_active', 'date_end'])
        log_action(
            self.request.user,
            AuditActions.MEMBERSHIP_DEACTIVATED,
            self.request,
            organization_id=instance.unit_id.organization_id_id,
            membership_id=instance.pk,
            target_user_id=instance.user_id_id,
            unit_id=instance.unit_id_id,
            position_id=instance.position_id_id,
        )
