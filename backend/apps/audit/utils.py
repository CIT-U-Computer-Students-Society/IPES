import logging
from django.db import transaction
from django.utils import timezone
from .models import AuditLog

logger = logging.getLogger(__name__)


def get_client_ip(request):
    """Extract client IP address from request"""
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        ip = x_forwarded_for.split(',')[0].strip()
    else:
        ip = request.META.get('REMOTE_ADDR')
    return ip


def log_action(user, action, request=None, organization_id=None, **extra_data):
    """
    Helper function to create audit log entries
    
    Args:
        user: User instance or None
        action: String describing the action (e.g., 'user.login', 'form.created')
        request: Optional Django request object for IP extraction
        organization_id: The ID of the organization the action belongs to, if applicable.
        **extra_data: Additional context to store with the action
    """
    ip_address = None
    if request:
        ip_address = get_client_ip(request)
        
        # Optionally try to pull organization_id from HTTP headers if missing
        if not organization_id and 'HTTP_X_ORGANIZATION_ID' in request.META:
            org_id = request.META.get('HTTP_X_ORGANIZATION_ID')
            if org_id and str(org_id).isdigit():
                organization_id = int(org_id)
    
    # Create action string with extra data if provided
    action_string = action
    if extra_data:
        extra_str = ', '.join(f"{k}={v}" for k, v in extra_data.items())
        action_string = f"{action} ({extra_str})"
    
    try:
        # Roll back a failed audit insert to its own savepoint, preserving any
        # surrounding business transaction before the error is suppressed.
        with transaction.atomic():
            AuditLog.objects.create(
                user_id=user,
                organization_id_id=organization_id,
                action=action_string,
                ip_address=ip_address
            )
    except Exception as e:
        # Don't let logging failures break the main application
        logger.error(f"Failed to create audit log: {e}")


# Predefined action constants for consistency
FORMULA_PREFIXES = ('=', '+', '-', '@')


def sanitize_csv_cell(value) -> str:
    """
    Neutralize CSV / spreadsheet formula injection.

    Spreadsheet applications (Excel, LibreOffice Calc, Google Sheets) evaluate
    cells starting with '=', '+', '-', or '@' as formulas. Leading whitespace
    or control characters (\\t, \\r, \\n) can also be ignored by spreadsheet
    parsers before formula execution.

    Prefixing such cells with a single quote (') forces spreadsheet software to
    treat the contents as a plain text string literal while preserving
    readability.
    """
    if value is None:
        return ''
    text = str(value)
    stripped = text.lstrip(" \t\r\n")
    if (
        stripped.startswith(FORMULA_PREFIXES)
        or text.startswith(('\t', '\r', '\n'))
    ):
        return f"'{text}"
    return text


class AuditActions:
    # User actions
    USER_LOGIN = 'user.login'
    USER_LOGOUT = 'user.logout'
    USER_CREATED = 'user.created'
    USER_UPDATED = 'user.updated'
    USER_DEACTIVATED = 'user.deactivated'
    USER_ACTIVATED = 'user.activated'
    
    # Organization actions
    ORG_CREATED = 'organization.created'
    ORG_UPDATED = 'organization.updated'
    ORG_DEACTIVATED = 'organization.deactivated'
    ORG_JOIN_REQUESTED = 'organization.join_requested'
    ORG_JOIN_APPROVED = 'organization.join_approved'
    ORG_JOIN_REJECTED = 'organization.join_rejected'
    
    # Evaluation form actions
    FORM_CREATED = 'evaluation.form_created'
    FORM_UPDATED = 'evaluation.form_updated'
    FORM_PUBLISHED = 'evaluation.form_published'
    FORM_UNPUBLISHED = 'evaluation.form_unpublished'
    FORM_DELETED = 'evaluation.form_deleted'
    FORM_DUPLICATED = 'evaluation.form_duplicated'
    
    # Evaluation submission actions
    EVALUATION_STARTED = 'evaluation.started'
    EVALUATION_SUBMITTED = 'evaluation.submitted'
    EVALUATION_COMPLETED = 'evaluation.completed'
    
    # Assignment actions
    ASSIGNMENT_CREATED = 'assignment.created'
    ASSIGNMENT_UPDATED = 'assignment.updated'
    ASSIGNMENTS_GENERATED = 'assignment.generated'
    
    # Accomplishment actions
    ACCOMPLISHMENT_CREATED = 'accomplishment.created'
    ACCOMPLISHMENT_UPDATED = 'accomplishment.updated'
    ACCOMPLISHMENT_VERIFIED = 'accomplishment.verified'
    ACCOMPLISHMENT_REJECTED = 'accomplishment.rejected'
    
    # Admin actions
    ADMIN_SETTINGS_CHANGED = 'admin.settings_changed'
    ADMIN_EXPORT_DATA = 'admin.export_data'
