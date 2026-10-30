from rest_framework import serializers
from .models import Organization, UnitType, OrganizationUnit, PositionType, Membership, JoinRequest
from apps.validation import ValidatedModelSerializer
from .access import active_organization


class OrganizationChildSerializer(ValidatedModelSerializer):
    def validate(self, attrs):
        attrs = super().validate(attrs)
        request = self.context.get('request')
        organization = attrs.get('organization_id') or (self.instance.organization_id if self.instance else None)
        if request and organization and organization.pk != active_organization(request):
            raise serializers.ValidationError({'organization_id': 'Use the active organization.'})
        return attrs


class OrganizationSerializer(ValidatedModelSerializer):
    """Serializer for Organization model"""
    
    def validate_is_active(self, value):
        if self.instance and value != self.instance.is_active:
            raise serializers.ValidationError('Use the confirmed organization deactivation action.')
        return value

    class Meta:
        model = Organization
        fields = [
            'id', 'name', 'code', 'display_picture', 'description', 'email',
            'period_year_start', 'period_year_end', 'is_active'
        ]
        read_only_fields = ['id']


class UnitTypeSerializer(OrganizationChildSerializer):
    """Serializer for UnitType model"""
    organization_name = serializers.CharField(source='organization_id.name', read_only=True)
    
    class Meta:
        model = UnitType
        fields = ['id', 'organization_id', 'organization_name', 'name']
        read_only_fields = ['id']


class OrganizationUnitSerializer(OrganizationChildSerializer):
    """Serializer for OrganizationUnit model"""
    organization_name = serializers.CharField(source='organization_id.name', read_only=True)
    type_name = serializers.CharField(source='type_id.name', read_only=True)
    members_count = serializers.IntegerField(read_only=True, default=0)
    
    class Meta:
        model = OrganizationUnit
        fields = [
            'id', 'organization_id', 'organization_name', 
            'type_id', 'type_name', 'name', 'description', 'members_count'
        ]
        read_only_fields = ['id']


class PositionTypeSerializer(OrganizationChildSerializer):
    """Serializer for PositionType model"""
    organization_name = serializers.CharField(source='organization_id.name', read_only=True)
    
    class Meta:
        model = PositionType
        fields = ['id', 'organization_id', 'organization_name', 'name', 'rank']
        read_only_fields = ['id']


class MembershipSerializer(ValidatedModelSerializer):
    """Serializer for Membership model"""
    user_email = serializers.CharField(source='user_id.email', read_only=True)
    unit_name = serializers.CharField(source='unit_id.name', read_only=True)
    position_name = serializers.CharField(source='position_id.name', read_only=True)
    position_rank = serializers.IntegerField(source='position_id.rank', read_only=True)
    
    class Meta:
        model = Membership
        fields = [
            'id', 'user_id', 'user_email', 'unit_id', 'unit_name',
            'position_id', 'position_name', 'position_rank', 'date_start', 
            'date_end', 'is_active'
        ]
        read_only_fields = ['id', 'date_start', 'date_end']
        validators = []

    def validate(self, data):
        """Ensure uniqueness: a user cannot have the exact same unit+position entry twice."""
        data = super().validate(data)
        unit = data.get('unit_id') or (self.instance.unit_id if self.instance else None)
        if unit and self.context.get('request') and unit.organization_id_id != active_organization(self.context['request']):
            raise serializers.ValidationError({'unit_id': 'Use a unit in the active organization.'})
        # Only enforce on create (instance is None) or when unit/position/user are being changed
        user = data.get('user_id') or (self.instance.user_id if self.instance else None)
        unit = data.get('unit_id') or (self.instance.unit_id if self.instance else None)
        position = data.get('position_id') or (self.instance.position_id if self.instance else None)

        if user and unit and position:
            qs = Membership.objects.filter(
                user_id=user, unit_id=unit, position_id=position, is_active=True
            )
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.exists():
                raise serializers.ValidationError(
                    'This membership (user + unit + position) already exists.'
                )

        return data

class JoinRequestSerializer(serializers.ModelSerializer):
    """Serializer for JoinRequest model"""
    user_email = serializers.CharField(source='user.email', read_only=True)
    user_first_name = serializers.CharField(source='user.first_name', read_only=True)
    user_last_name = serializers.CharField(source='user.last_name', read_only=True)
    organization_name = serializers.CharField(source='organization.name', read_only=True)
    
    class Meta:
        model = JoinRequest
        fields = [
            'id', 'user', 'user_email', 'user_first_name', 'user_last_name',
            'organization', 'organization_name', 'status', 'created_at', 'updated_at'
        ]
        read_only_fields = fields
