from rest_framework import serializers
from django.utils import timezone
from .models import Accomplishment


class AccomplishmentSerializer(serializers.ModelSerializer):
    """Serializer for Accomplishment model"""
    user_email = serializers.CharField(source='user_id.email', read_only=True)
    user_name = serializers.CharField(source='user_id.get_full_name', read_only=True)
    verified_by_email = serializers.CharField(source='verified_by.email', read_only=True)
    
    class Meta:
        model = Accomplishment
        fields = [
            'id', 'user_id', 'user_email', 'user_name', 'organization_id', 'title',
            'description', 'type', 'date_completed', 'proof_link',
            'status', 'verified_by', 'verified_by_email', 'comments',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'user_id', 'organization_id', 'status', 'verified_by', 'created_at', 'updated_at']


class AccomplishmentCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating accomplishments (auto-sets user from request)"""
    
    class Meta:
        model = Accomplishment
        fields = [
            'id', 'title', 'description', 'type',
            'date_completed', 'proof_link'
        ]
        read_only_fields = ['id']
        extra_kwargs = {
            'proof_link': {'required': False, 'allow_blank': True, 'allow_null': True}
        }
    
    def validate_proof_link(self, value):
        """Validate proof link is a valid URL if provided"""
        if not value:
            return None
            
        from django.core.validators import URLValidator
        from django.core.exceptions import ValidationError
        
        validator = URLValidator(schemes=['http', 'https'])
        try:
            validator(value)
        except ValidationError:
            raise serializers.ValidationError('Invalid URL format for proof_link')
        return value
    
    def validate_date_completed(self, value):
        """Validate date is not in the future"""
        if value > timezone.now():
            raise serializers.ValidationError('Date completed cannot be in the future')
        return value
    
    def validate_type(self, value):
        """Validate accomplishment type"""
        # Accept both Title Case (model default/admin) and lowercase (frontend)
        allowed_types = [
            'Project', 'Attendance', 'General', 'Event', 'Leadership', 'Other',
            'award', 'certification', 'project', 'training', 'presentation', 'publication', 'other'
        ]
        if value not in allowed_types:
            raise serializers.ValidationError(
                f"Type must be one of: {', '.join(allowed_types)}"
            )
        # Normalize to Title Case for database if needed, OR just keep as is if model allows
        # Let's keep as is for now to avoid breaking existing logic, 
        # but the model says max_length=50 so lowercase is fine.
        return value


class AccomplishmentListSerializer(serializers.ModelSerializer):
    """Extended serializer for list view with user info"""
    user_email = serializers.CharField(source='user_id.email', read_only=True)
    user_name = serializers.CharField(source='user_id.get_full_name', read_only=True)
    
    class Meta:
        model = Accomplishment
        fields = [
            'id', 'user_id', 'user_email', 'user_name', 'organization_id', 'title',
            'description', 'type', 'date_completed', 'proof_link', 'status',
            'comments', 'created_at', 'updated_at'
        ]


class AccomplishmentUpdateSerializer(serializers.ModelSerializer):
    """Serializer for members to update their pending/rejected accomplishments"""
    
    class Meta:
        model = Accomplishment
        fields = [
            'title', 'description', 'type',
            'date_completed', 'proof_link'
        ]
        extra_kwargs = {
            'proof_link': {'required': False, 'allow_blank': True, 'allow_null': True}
        }
    
    def validate_proof_link(self, value):
        """Validate proof link is a valid URL if provided"""
        if not value:
            return None
            
        from django.core.validators import URLValidator
        from django.core.exceptions import ValidationError
        
        validator = URLValidator(schemes=['http', 'https'])
        try:
            validator(value)
        except ValidationError:
            raise serializers.ValidationError('Invalid URL format for proof_link')
        return value
    
    def validate_date_completed(self, value):
        """Validate date is not in the future"""
        if value > timezone.now():
            raise serializers.ValidationError('Date completed cannot be in the future')
        return value
    
    def validate_type(self, value):
        """Validate accomplishment type"""
        allowed_types = [
            'Project', 'Attendance', 'General', 'Event', 'Leadership', 'Other',
            'award', 'certification', 'project', 'training', 'presentation', 'publication', 'other'
        ]
        if value not in allowed_types:
            raise serializers.ValidationError(
                f"Type must be one of: {', '.join(allowed_types)}"
            )
        return value

    def update(self, instance, validated_data):
        current_status = (
            Accomplishment.objects.filter(pk=instance.pk)
            .values_list('status', flat=True)
            .first()
        )
        if current_status not in ['Pending', 'Rejected']:
            raise serializers.ValidationError(
                {
                    'error': (
                        'You can only edit pending or rejected accomplishments'
                    )
                }
            )
        return super().update(instance, validated_data)


class AccomplishmentVerifySerializer(serializers.Serializer):
    """Serializer for verifying/rejecting accomplishments"""
    status = serializers.ChoiceField(choices=['Verified', 'Rejected'])
    comments = serializers.CharField(required=False, allow_blank=True, max_length=500)
    
    def validate_status(self, value):
        """Ensure only verification status changes"""
        if value not in ['Verified', 'Rejected']:
            raise serializers.ValidationError('Status must be Verified or Rejected')
        return value


class AccomplishmentSummarySerializer(serializers.Serializer):
    """Summary serializer for analytics"""
    total = serializers.IntegerField()
    verified = serializers.IntegerField()
    pending = serializers.IntegerField()
    rejected = serializers.IntegerField()
    by_type = serializers.DictField()
