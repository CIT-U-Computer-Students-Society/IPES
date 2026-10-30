from rest_framework import serializers
from .models import (
    Organization, UnitType, OrganizationUnit, PositionType,
    Membership, JoinRequest, OrganizationRole,
)
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
        """Ensure active user access, organization match, and uniqueness."""
        data = super().validate(data)
        user = data.get('user_id') or (
            self.instance.user_id if self.instance else None
        )
        unit = data.get('unit_id') or (
            self.instance.unit_id if self.instance else None
        )
        position = data.get('position_id') or (
            self.instance.position_id if self.instance else None
        )

        req = self.context.get('request')
        if unit and req and unit.organization_id_id != active_organization(req):
            raise serializers.ValidationError(
                {'unit_id': 'Use a unit in the active organization.'}
            )

        if (
            unit and position and
            unit.organization_id_id != position.organization_id_id
        ):
            raise serializers.ValidationError({
                'position_id': (
                    'Position and unit must belong to the same organization.'
                )
            })

        is_create = self.instance is None
        if is_create:
            is_changing_assignment = False
        else:
            changed_user = (
                data.get('user_id') is not None and
                data.get('user_id') != self.instance.user_id
            )
            changed_unit = (
                data.get('unit_id') is not None and
                data.get('unit_id') != self.instance.unit_id
            )
            changed_pos = (
                data.get('position_id') is not None and
                data.get('position_id') != self.instance.position_id
            )
            reactivated = (
                data.get('is_active') is True and
                not self.instance.is_active
            )
            is_changing_assignment = (
                changed_user or changed_unit or changed_pos or reactivated
            )

        if is_create or is_changing_assignment:
            if user and unit:
                if not user.is_active:
                    raise serializers.ValidationError({
                        'user_id': 'Target user account is inactive.'
                    })
                if not OrganizationRole.objects.filter(
                    user=user,
                    organization_id=unit.organization_id_id,
                    is_active=True,
                ).exists():
                    raise serializers.ValidationError({
                        'user_id': (
                            'User must have an active organization role '
                            'in this organization.'
                        )
                    })
            if unit and not unit.is_active:
                raise serializers.ValidationError(
                    {'unit_id': 'Unit is inactive.'}
                )
            if position and not position.is_active:
                raise serializers.ValidationError(
                    {'position_id': 'Position is inactive.'}
                )

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
