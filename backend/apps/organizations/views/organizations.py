"""
Organization ViewSet — CRUD, join-by-code, member management, analytics.
"""

from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.exceptions import MethodNotAllowed, PermissionDenied
from django.db.models import Count, Avg, Q
from django.utils import timezone

from apps.audit.utils import log_action, AuditActions
from apps.organizations.access import active_organization, is_organization_admin

from ..models import (
    Organization, UnitType, OrganizationUnit, PositionType,
    Membership, JoinRequest, OrganizationRole,
)
from ..serializers import OrganizationSerializer


class OrganizationViewSet(viewsets.ModelViewSet):
    """ViewSet for Organization CRUD"""
    queryset = Organization.objects.filter(is_active=True)
    serializer_class = OrganizationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def update(self, request, *args, **kwargs):
        org = self.get_object()
        org_id = active_organization(request)
        if org.pk != org_id or not is_organization_admin(request, org_id):
            raise PermissionDenied('Only an administrator of the active organization can update it.')
        return super().update(request, *args, **kwargs)

    def perform_update(self, serializer):
        previous = serializer.instance
        changed_fields = sorted(
            name for name, value in serializer.validated_data.items()
            if getattr(previous, name) != value
        )
        org = serializer.save()
        if changed_fields:
            log_action(
                self.request.user, AuditActions.ORG_UPDATED, self.request,
                organization_id=org.pk, fields=','.join(changed_fields),
            )

    def destroy(self, request, *args, **kwargs):
        """Organization removal must use the confirmed soft-deactivation flow."""
        raise MethodNotAllowed('DELETE', detail='Use the delete-organization action to deactivate an organization.')

    def create(self, request, *args, **kwargs):
        """Override create to provide specific validation errors for duplicate codes."""
        code = request.data.get('code')
        if code:
            existing_org = Organization.objects.filter(code=code).first()
            if existing_org:
                if existing_org.is_active:
                    return Response(
                        {'error': f'The code "{code}" is currently in use by another active organization.'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                else:
                    return Response(
                        {'error': f'The code "{code}" belonged to a deleted organization and is permanently retired.'},
                        status=status.HTTP_400_BAD_REQUEST
                    )

        return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        """Log organization creation and assign founder as Admin"""
        org = serializer.save()

        OrganizationRole.objects.create(
            user=self.request.user,
            organization=org,
            role='Admin'
        )

        log_action(
            self.request.user,
            AuditActions.ORG_CREATED,
            self.request,
            org_name=org.name,
            org_id=str(org.id)
        )

    @action(detail=False, methods=['post'])
    def join_by_code(self, request):
        """Allows users to submit a join request using a unique organization code"""
        code = request.data.get('code')
        if not code:
            return Response({'error': 'Code is required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            org = Organization.objects.get(code=code, is_active=True)
        except Organization.DoesNotExist:
            return Response({'error': 'Invalid organization code'}, status=status.HTTP_404_NOT_FOUND)

        if OrganizationRole.objects.filter(user=request.user, organization=org, is_active=True).exists():
            return Response(
                {'error': 'You are already a member of this organization'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if JoinRequest.objects.filter(user=request.user, organization=org, status='Pending').exists():
            return Response(
                {'error': 'You already have a pending join request'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        JoinRequest.objects.update_or_create(
            user=request.user,
            organization=org,
            defaults={'status': 'Pending'}
        )

        log_action(
            request.user,
            AuditActions.ORG_JOIN_REQUESTED,
            request,
            org_name=org.name
        )

        return Response({'message': 'Join request submitted successfully'}, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='remove-member')
    def remove_member(self, request, pk=None):
        """
        Organizational-level removal of a member.
        Deactivates the OrganizationRole and all active Memberships for the user.
        """
        org = self.get_object()
        user_id = request.data.get('user_id')

        if not user_id:
            return Response({'error': 'user_id is required'}, status=status.HTTP_400_BAD_REQUEST)

        if not OrganizationRole.objects.filter(
            user=request.user, organization=org, role='Admin', is_active=True
        ).exists():
            return Response(
                {'error': 'Not authorized to remove members from this organization'},
                status=status.HTTP_403_FORBIDDEN,
            )

        if str(user_id) == str(request.user.id):
            return Response(
                {'error': 'You cannot remove yourself from the organization.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        role = OrganizationRole.objects.filter(user_id=user_id, organization=org).first()
        if role:
            role.is_active = False
            role.save()

        current_date = timezone.now().date()
        Membership.objects.filter(
            user_id=user_id,
            unit_id__organization_id=org,
            is_active=True
        ).update(is_active=False, date_end=current_date)

        from apps.users.models import User
        target_user = User.objects.filter(id=user_id).first()
        log_action(
            request.user,
            AuditActions.USER_DEACTIVATED,
            request,
            org_name=org.name,
            target_user_email=target_user.email if target_user else f"User ID: {user_id}"
        )

        return Response({'message': 'Member removed from organization successfully'})

    @action(detail=True, methods=['post'], url_path='set-member-role')
    def set_member_role(self, request, pk=None):
        """
        Update a user's role (Admin/Member) within the organization.
        Only Admins can call this.
        """
        org = self.get_object()
        user_id = request.data.get('user_id')
        new_role = request.data.get('role')

        if not user_id or not new_role:
            return Response({'error': 'user_id and role are required'}, status=status.HTTP_400_BAD_REQUEST)

        if new_role not in ('Admin', 'Member'):
            return Response({'error': 'role must be "Admin" or "Member"'}, status=status.HTTP_400_BAD_REQUEST)

        if not OrganizationRole.objects.filter(
            user=request.user, organization=org, role='Admin', is_active=True
        ).exists():
            return Response(
                {'error': 'Not authorized to change roles in this organization'},
                status=status.HTTP_403_FORBIDDEN,
            )

        if str(request.user.id) == str(user_id) and new_role == 'Member':
            return Response(
                {'error': 'You cannot revoke your own admin privileges.'},
                status=status.HTTP_403_FORBIDDEN
            )

        org_role = OrganizationRole.objects.filter(user_id=user_id, organization=org).first()
        if not org_role:
            return Response(
                {'error': 'User does not have an OrganizationRole in this org'},
                status=status.HTTP_404_NOT_FOUND,
            )

        org_role.role = new_role
        org_role.save(update_fields=['role'])

        from apps.users.models import User
        target_user = User.objects.filter(id=user_id).first()
        log_action(
            request.user,
            AuditActions.USER_UPDATED,
            request,
            target_user_email=target_user.email if target_user else f'User ID: {user_id}',
            detail=f'Role changed to {new_role} in {org.name}'
        )

        return Response({'message': f'Role updated to {new_role} successfully'})

    @action(detail=True, methods=['post'], url_path='delete-organization')
    def delete_organization(self, request, pk=None):
        """
        Permanently soft-delete an organization and cascade deactivations.
        Requires the Head Administrator's password and the correct organization code.
        """
        org = self.get_object()
        code = request.data.get('code')
        password = request.data.get('password')

        if not code or not password:
            return Response(
                {'error': 'Both organization code and your admin password are required.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if code != org.code:
            return Response(
                {'error': 'The provided organization code does not match.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if not request.user.check_password(password):
            return Response(
                {'error': 'Incorrect password.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        is_admin = OrganizationRole.objects.filter(
            user=request.user,
            organization=org,
            role='Admin',
            is_active=True
        ).exists()

        if not is_admin:
            return Response(
                {'error': 'Only Administrators can delete this organization.'},
                status=status.HTTP_403_FORBIDDEN
            )

        current_date = timezone.now().date()

        Membership.objects.filter(
            unit_id__organization_id=org,
            is_active=True
        ).update(is_active=False, date_end=current_date)

        PositionType.objects.filter(
            organization_id=org,
            is_active=True
        ).update(is_active=False)

        OrganizationUnit.objects.filter(
            organization_id=org,
            is_active=True
        ).update(is_active=False)

        UnitType.objects.filter(
            organization_id=org,
            is_active=True
        ).update(is_active=False)

        JoinRequest.objects.filter(
            organization=org,
            status='Pending'
        ).update(status='Rejected')

        org.is_active = False
        org.save()

        log_action(
            request.user,
            AuditActions.ORG_UPDATED,
            request,
            detail="Organization formally deleted (soft-deactivated) by Head Admin",
            org_name=org.name,
            org_id=str(org.id)
        )

        return Response(
            {'message': f'Organization {org.name} has been successfully deleted.'},
            status=status.HTTP_200_OK
        )

    @action(detail=False, methods=['get'])
    def unit_completion_stats(self, request):
        """
        Get evaluation completion statistics by unit.
        """
        from apps.evaluations.models import EvaluationAssignment

        org_id = request.query_params.get('organization_id')
        if org_id:
            units = OrganizationUnit.objects.filter(organization_id=org_id, is_active=True)
        else:
            units = OrganizationUnit.objects.filter(is_active=True)

        stats = []
        for unit in units:
            member_user_ids = Membership.objects.filter(
                unit_id=unit,
                is_active=True
            ).values_list('user_id', flat=True)

            if not member_user_ids:
                stats.append({
                    'unit_id': unit.id,
                    'unit_name': unit.name,
                    'unit_type': unit.type_id.name if unit.type_id else None,
                    'total_members': 0,
                    'total_assignments': 0,
                    'completed_assignments': 0,
                    'completion_percentage': 0
                })
                continue

            assignments = EvaluationAssignment.objects.filter(
                evaluatee_id__in=member_user_ids
            )

            total = assignments.count()
            completed = assignments.filter(status='Completed').count()

            completion_percentage = round((completed / total * 100), 1) if total > 0 else 0

            stats.append({
                'unit_id': unit.id,
                'unit_name': unit.name,
                'unit_type': unit.type_id.name if unit.type_id else None,
                'total_members': len(member_user_ids),
                'total_assignments': total,
                'completed_assignments': completed,
                'completion_percentage': completion_percentage
            })

        stats.sort(key=lambda x: x['completion_percentage'], reverse=True)

        return Response(stats)

    @action(detail=False, methods=['get'])
    def analytics_summary(self, request):
        """
        Get comprehensive analytics summary for the dashboard.
        """
        from apps.evaluations.models import EvaluationAssignment
        from apps.users.models import User

        org_id = request.query_params.get('organization_id')

        if org_id:
            units_qs = OrganizationUnit.objects.filter(organization_id=org_id, is_active=True)
            memberships_qs = Membership.objects.filter(
                unit_id__in=units_qs,
                is_active=True
            )
        else:
            memberships_qs = Membership.objects.filter(is_active=True)
            units_qs = OrganizationUnit.objects.filter(
                id__in=memberships_qs.values('unit_id'),
                is_active=True
            )

        total_members = memberships_qs.values('user_id').distinct().count()
        total_units = units_qs.count()

        total_users = User.objects.filter(is_active=True).count()

        if org_id:
            member_user_ids = memberships_qs.values_list('user_id', flat=True)
            assignments = EvaluationAssignment.objects.filter(
                evaluatee_id__in=member_user_ids
            )
        else:
            assignments = EvaluationAssignment.objects.all()

        total_assignments = assignments.count()
        completed_assignments = assignments.filter(status='Completed').count()
        pending_assignments = assignments.filter(status='Pending').count()

        overall_completion = (
            round((completed_assignments / total_assignments * 100), 1)
            if total_assignments > 0
            else 0
        )

        return Response({
            'total_organizations': Organization.objects.filter(is_active=True).count(),
            'total_units': total_units,
            'total_members': total_members,
            'total_users': total_users,
            'total_assignments': total_assignments,
            'completed_assignments': completed_assignments,
            'pending_assignments': pending_assignments,
            'overall_completion_rate': overall_completion
        })
