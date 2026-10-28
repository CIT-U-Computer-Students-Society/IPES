from rest_framework import serializers
from .models import EvaluationForm, Question, EvaluationAssignment, AssignmentRule, Response
from apps.validation import ValidatedModelSerializer, FiniteFloatField
from apps.organizations.access import active_organization


class ScopedEvaluationSerializer(ValidatedModelSerializer):
    def validate(self, attrs):
        attrs = super().validate(attrs)
        request = self.context.get('request')
        if request:
            org_id = active_organization(request)
            organization = attrs.get('organization_id')
            form = attrs.get('form_id')
            if organization and organization.pk != org_id:
                raise serializers.ValidationError({'organization_id': 'Use the active organization.'})
            if form and (form.organization_id_id != org_id or form.is_deleted):
                raise serializers.ValidationError({'form_id': 'Form must belong to the active organization.'})
        if self.instance:
            for name in ('organization_id', 'form_id'):
                value = attrs.get(name)
                if value and value.pk != getattr(self.instance, name + '_id'):
                    raise serializers.ValidationError({name: 'The parent relationship cannot be changed.'})
        return attrs


class QuestionSerializer(ScopedEvaluationSerializer):
    """Serializer for Question model"""
    weight = FiniteFloatField(required=False, allow_null=True)
    
    class Meta:
        model = Question
        fields = ['id', 'form_id', 'text', 'input_type', 'order', 'weight', 'is_required', 'min_value', 'max_value']
        read_only_fields = ['id']


class QuestionCreateSerializer(ValidatedModelSerializer):
    """Serializer for creating questions with validation"""
    weight = FiniteFloatField(required=False, allow_null=True)
    
    class Meta:
        model = Question
        fields = ['id', 'text', 'input_type', 'order', 'weight', 'is_required', 'min_value', 'max_value']
        read_only_fields = ['id']
    
    def validate_input_type(self, value):
        """Validate input type is allowed"""
        allowed_types = ['rating', 'text', 'dropdown', 'checkbox', 'textarea', 'number']
        if value not in allowed_types:
            raise serializers.ValidationError(
                f"Input type must be one of: {', '.join(allowed_types)}"
            )
        return value


class EvaluationFormSerializer(ScopedEvaluationSerializer):
    """Serializer for EvaluationForm model"""
    questions = QuestionSerializer(many=True, read_only=True)
    created_by_name = serializers.CharField(source='created_by.email', read_only=True)
    
    class Meta:
        model = EvaluationForm
        fields = [
            'id', 'organization_id', 'title', 'description', 
            'start_date', 'end_date', 'created_by', 'created_by_name',
            'is_active', 'results_released', 'created_at', 'updated_at', 'questions'
        ]
        read_only_fields = ['id', 'created_by', 'created_at', 'updated_at']


class EvaluationFormCreateSerializer(ScopedEvaluationSerializer):
    """Serializer for creating evaluation forms with nested questions"""
    questions = QuestionCreateSerializer(many=True, required=False)
    
    class Meta:
        model = EvaluationForm
        fields = [
            'id', 'organization_id', 'title', 'description', 
            'start_date', 'end_date', 'is_active', 'results_released', 'questions'
        ]
        read_only_fields = ['id']
    
    def validate(self, attrs):
        """Validate form dates"""
        attrs = super().validate(attrs)
        start_date = attrs.get('start_date')
        end_date = attrs.get('end_date')
        
        if start_date and end_date and start_date > end_date:
            raise serializers.ValidationError({
                'end_date': 'End date must be after start date'
            })
        
        return attrs
    
    def create(self, validated_data):
        """Create form with nested questions"""
        questions_data = validated_data.pop('questions', [])
        form = EvaluationForm.objects.create(**validated_data)
        
        for question_data in questions_data:
            Question.objects.create(form_id=form, **question_data)
        
        return form


class AssignmentRuleSerializer(ScopedEvaluationSerializer):
    """Serializer for AssignmentRule model"""
    evaluator_unit_name     = serializers.CharField(source='evaluator_unit.name', read_only=True, default=None)
    evaluator_position_name = serializers.CharField(source='evaluator_position.name', read_only=True, default=None)
    evaluatee_unit_name     = serializers.CharField(source='evaluatee_unit.name', read_only=True, default=None)
    evaluatee_position_name = serializers.CharField(source='evaluatee_position.name', read_only=True, default=None)

    class Meta:
        model = AssignmentRule
        fields = [
            'id', 'form_id',
            'evaluator_unit', 'evaluator_unit_name',
            'evaluator_position', 'evaluator_position_name',
            'evaluatee_unit', 'evaluatee_unit_name',
            'evaluatee_position', 'evaluatee_position_name',
            'exclude_self',
        ]
        read_only_fields = ['id']


class EvaluationAssignmentSerializer(serializers.ModelSerializer):
    """Serializer for EvaluationAssignment model"""
    evaluator_email = serializers.CharField(source='evaluator_id.email', read_only=True)
    evaluator_name = serializers.SerializerMethodField()
    evaluatee_email = serializers.CharField(source='evaluatee_id.email', read_only=True)
    evaluatee_name = serializers.SerializerMethodField()
    form_title = serializers.CharField(source='form_id.title', read_only=True)
    
    class Meta:
        model = EvaluationAssignment
        fields = [
            'id', 'evaluator_id', 'evaluator_email', 'evaluator_name',
            'evaluatee_id', 'evaluatee_email', 'evaluatee_name',
            'form_id', 'form_title', 'status',
            'submitted_at', 'total_score'
        ]
        read_only_fields = ['id', 'status', 'submitted_at', 'total_score']
    
    def get_evaluator_name(self, obj):
        user = obj.evaluator_id
        if user:
            full_name = f"{user.first_name} {user.last_name}".strip()
            return full_name if full_name else user.email
        return None
    
    def get_evaluatee_name(self, obj):
        user = obj.evaluatee_id
        if user:
            full_name = f"{user.first_name} {user.last_name}".strip()
            return full_name if full_name else user.email
        return None


class ResponseSerializer(serializers.ModelSerializer):
    """Serializer for Response model"""
    question_text = serializers.CharField(source='question_id.text', read_only=True)
    
    class Meta:
        model = Response
        fields = ['id', 'assignment_id', 'question_id', 'question_text', 'score_value', 'text']
        read_only_fields = ['id']


class AnswerSerializer(serializers.Serializer):
    question_id = serializers.IntegerField(min_value=1)
    score_value = FiniteFloatField(required=False, allow_null=True, default=None)
    text = serializers.CharField(required=False, allow_null=True, allow_blank=True, default='')


class AnswerBatchSerializer(serializers.Serializer):
    responses = AnswerSerializer(many=True)

    def validate_responses(self, answers):
        ids = [answer['question_id'] for answer in answers]
        if len(ids) != len(set(ids)):
            raise serializers.ValidationError('Each question may appear only once.')
        return answers


class QuestionBatchSerializer(serializers.Serializer):
    form_id = serializers.IntegerField(min_value=1, max_value=2147483647)
    questions = QuestionCreateSerializer(many=True)
