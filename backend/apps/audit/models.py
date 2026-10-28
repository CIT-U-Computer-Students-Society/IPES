from django.db import models
from django.conf import settings

class AuditLog(models.Model):
    user_id = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='audit_logs')
    organization_id = models.ForeignKey('organizations.Organization', on_delete=models.CASCADE, null=True, blank=True, related_name='audit_logs')
    action = models.CharField(max_length=255)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    datetime = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [models.Index(fields=['organization_id', '-datetime'], name='audit_org_datetime_idx')]
