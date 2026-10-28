"""Resolve the active tenant consistently for evaluation API requests."""

from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import BasePermission

from .models import Organization, OrganizationRole
from apps.validation import positive_id


def active_organization(request):
    header = request.headers.get('X-Organization-Id')
    parameter = request.query_params.get('organization_id')
    if header and parameter and header != parameter:
        raise ValidationError({'organization_id': 'Organization header and parameter must match.'})
    org_id = positive_id(header or parameter, 'organization_id')
    if getattr(request, '_verified_organization', None) != org_id:
        if request.user.is_superuser:
            allowed = Organization.objects.filter(pk=org_id, is_active=True).exists()
        else:
            allowed = OrganizationRole.objects.filter(
                user=request.user, organization_id=org_id,
                organization__is_active=True, is_active=True,
            ).exists()
        if not allowed:
            raise PermissionDenied('You are not an active member of this organization.')
        request._verified_organization = org_id
    return org_id


def is_organization_admin(request, org_id):
    return request.user.is_superuser or OrganizationRole.objects.filter(
        user=request.user, organization_id=org_id, role='Admin', is_active=True,
    ).exists()


def require_organization_admin(request):
    org_id = active_organization(request)
    if not is_organization_admin(request, org_id):
        raise PermissionDenied('Only an organization administrator can perform this action.')
    return org_id


class EvaluationOrganizationPermission(BasePermission):
    """All reads require membership; administrative writes require an active admin role."""

    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        if request.method in ('GET', 'HEAD', 'OPTIONS') or view.action == 'submit':
            active_organization(request)
        else:
            require_organization_admin(request)
        return True
