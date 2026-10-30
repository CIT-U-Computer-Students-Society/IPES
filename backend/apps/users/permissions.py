from rest_framework import permissions

class IsAdmin(permissions.BasePermission):
    """
    Custom permission to only allow Admins to access the view.
    """

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
            
        if request.user.is_staff or request.user.is_superuser:
            return True
            
        # Check if the user has an 'Admin' role in ANY active organization
        return request.user.organization_roles.filter(is_active=True, role__iexact='admin').exists()


class IsPlatformAdministrator(permissions.BasePermission):
    """Global account changes require a platform superuser."""

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_superuser)
