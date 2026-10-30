from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import Membership


@receiver(post_save, sender=Membership)
def auto_assign_on_membership_activation(sender, instance, created, **kwargs):
    """
    When a Membership is created or re-activated, check all active EvaluationForms
    in that org and apply any matching AssignmentRules for this member.
    """
    if not instance.is_active:
        return

    # Lazy import to avoid circular dependency
    from apps.evaluations.models import EvaluationForm

    org = instance.unit_id.organization_id
    forms = EvaluationForm.objects.filter(
        organization_id=org,
        is_active=True, is_deleted=False, results_released=False,
    ).prefetch_related('assignment_rules__evaluator_unit', 'assignment_rules__evaluator_position', 'assignment_rules__evaluatee_unit', 'assignment_rules__evaluatee_position')

    for form in forms:
        if not form.questions.exists():
            continue
        rules = form.assignment_rules.all()
        for rule in rules:
            # Check if this member's unit/position matches the evaluator side
            ev_unit_match = (rule.evaluator_unit is None or rule.evaluator_unit == instance.unit_id)
            ev_pos_match  = (rule.evaluator_position is None or rule.evaluator_position == instance.position_id)

            # Check if this member's unit/position matches the evaluatee side
            ee_unit_match = (rule.evaluatee_unit is None or rule.evaluatee_unit == instance.unit_id)
            ee_pos_match  = (rule.evaluatee_position is None or rule.evaluatee_position == instance.position_id)

            if ev_unit_match and ev_pos_match:
                # This member is a new evaluator — only generate their outgoing assignments
                _apply_rule_for_single_evaluator(rule, form, instance.user_id)

            if ee_unit_match and ee_pos_match:
                # This member is a new evaluatee — only generate incoming assignments for them
                _apply_rule_for_single_evaluatee(rule, form, instance.user_id)


def _apply_rule_for_single_evaluator(rule, form, ev_user):
    from apps.evaluations.services import generate_rule_assignments
    generate_rule_assignments(rule, form, evaluator_id=ev_user.pk)


def _apply_rule_for_single_evaluatee(rule, form, ee_user):
    from apps.evaluations.services import generate_rule_assignments
    generate_rule_assignments(rule, form, evaluatee_id=ee_user.pk)
