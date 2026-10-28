from django.db import models
from django.conf import settings

class Accomplishment(models.Model):
    user_id = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='accomplishments')
    organization_id = models.ForeignKey('organizations.Organization', on_delete=models.CASCADE, related_name='accomplishments')
    title = models.CharField(max_length=255)
    description = models.TextField()
    type = models.CharField(max_length=50)
    date_completed = models.DateTimeField()
    proof_link = models.URLField(null=True, blank=True)
    status = models.CharField(max_length=50, default='Pending')
    verified_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='verified_accomplishments')
    comments = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, null=True)
    updated_at = models.DateTimeField(auto_now=True, null=True)

    class Meta:
        indexes = [models.Index(
            fields=['organization_id', 'status', '-date_completed', '-id'], name='accomplishment_queue_idx',
        )]
        constraints = [models.CheckConstraint(
            condition=models.Q(status__in=['Pending', 'Verified', 'Rejected']), name='accomplishment_status_valid',
        )]
