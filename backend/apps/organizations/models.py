from django.conf import settings
from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator, FileExtensionValidator
from django.core.exceptions import ValidationError


class RelatedOrganizationModel(models.Model):
    """Validate relationships on ordinary saves as well as serializer writes."""

    class Meta:
        abstract = True

    def save(self, *args, **kwargs):
        self.clean()
        return super().save(*args, **kwargs)

class Organization(models.Model):
    name = models.CharField(max_length=255)
    code = models.CharField(max_length=50, unique=True)
    display_picture = models.ImageField(upload_to='organizations/pictures/', blank=True, null=True, validators=[FileExtensionValidator(['jpg', 'jpeg', 'png', 'gif'])])
    description = models.TextField()
    email = models.EmailField(blank=True, null=True)
    period_year_start = models.DateField()
    period_year_end = models.DateField(null=True, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        constraints = [models.CheckConstraint(
            condition=models.Q(period_year_end__isnull=True) | models.Q(period_year_end__gte=models.F('period_year_start')),
            name='organization_valid_period',
        )]

    def clean(self):
        if self.period_year_end and self.period_year_start and self.period_year_end < self.period_year_start:
            raise ValidationError({'period_year_end': 'End date must be on or after start date.'})

class UnitType(models.Model):
    organization_id = models.ForeignKey(Organization, on_delete=models.CASCADE)
    name = models.CharField(max_length=100)
    is_active = models.BooleanField(default=True)

class OrganizationUnit(RelatedOrganizationModel):
    organization_id = models.ForeignKey(Organization, on_delete=models.CASCADE)
    type_id = models.ForeignKey(UnitType, on_delete=models.CASCADE)
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    is_active = models.BooleanField(default=True)

    def clean(self):
        if self.type_id_id and self.organization_id_id and self.type_id.organization_id_id != self.organization_id_id:
            raise ValidationError({'type_id': 'Unit type must belong to the same organization.'})

class PositionType(models.Model):
    organization_id = models.ForeignKey(Organization, on_delete=models.CASCADE)
    name = models.CharField(max_length=100)
    rank = models.IntegerField(
        help_text='1 for Head, higher numbers for lower rank',
        validators=[MinValueValidator(1), MaxValueValidator(100)]
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        constraints = [models.CheckConstraint(
            condition=models.Q(rank__gte=1, rank__lte=100), name='position_rank_range',
        )]

class Membership(RelatedOrganizationModel):
    user_id = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='memberships')
    unit_id = models.ForeignKey(OrganizationUnit, on_delete=models.CASCADE, related_name='members')
    position_id = models.ForeignKey(PositionType, on_delete=models.PROTECT)
    
    date_start = models.DateField()
    date_end = models.DateField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    
    class Meta:
        # Prevent duplicate membership entries for the same user/unit/position
        # It's allowed to have the same unit or the same position separately,
        # but not both identical together for the same user.
        unique_together = ('user_id', 'unit_id', 'position_id')
        constraints = [models.CheckConstraint(
            condition=models.Q(date_end__isnull=True) | models.Q(date_end__gte=models.F('date_start')),
            name='membership_valid_period',
        )]

    def clean(self):
        if self.unit_id_id and self.position_id_id and self.unit_id.organization_id_id != self.position_id.organization_id_id:
            raise ValidationError({'position_id': 'Position and unit must belong to the same organization.'})
        if self.date_start and self.date_end and self.date_end < self.date_start:
            raise ValidationError({'date_end': 'End date must be on or after start date.'})

class OrganizationRole(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='organization_roles')
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='user_roles')
    
    ROLE_CHOICES = (
        ('Admin', 'Admin'),
        ('Member', 'Member'),
    )
    role = models.CharField(max_length=50, choices=ROLE_CHOICES, default='Member')
    is_active = models.BooleanField(default=True)
    
    class Meta:
        unique_together = ('user', 'organization')
        constraints = [models.CheckConstraint(
            condition=models.Q(role__in=['Admin', 'Member']), name='organization_role_valid',
        )]

class JoinRequest(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='join_requests')
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='join_requests')
    
    STATUS_CHOICES = (
        ('Pending', 'Pending'),
        ('Approved', 'Approved'),
        ('Rejected', 'Rejected'),
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Pending')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        unique_together = ('user', 'organization')
        constraints = [models.CheckConstraint(
            condition=models.Q(status__in=['Pending', 'Approved', 'Rejected']), name='join_request_status_valid',
        )]
