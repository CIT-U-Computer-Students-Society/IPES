"""
Analytics helper for EvaluationForm.

Extracts the heavy analytics computation from the ViewSet so that
``EvaluationFormViewSet.analytics`` remains a thin action.
"""

from django.db.models import Avg, Count, Q

from ..models import EvaluationForm, EvaluationAssignment, Response


def compute_form_analytics(form: EvaluationForm, *, include_raw=False) -> dict:
    """Return a comprehensive analytics dict for *form*."""

    # 1. Basic stats
    assignments = EvaluationAssignment.objects.filter(form_id=form)
    total_evaluations = assignments.count()
    completed = assignments.filter(status='Completed')
    completed_count = completed.count()

    participation_rate = (
        round((completed_count / total_evaluations * 100), 1)
        if total_evaluations > 0
        else 0
    )
    overall_score = completed.aggregate(avg=Avg('total_score'))['avg']
    overall_score = round(overall_score, 2) if overall_score is not None else 0.0

    # 2. Category data (top-6 highest-scoring questions)
    question_stats = (
        Response.objects.filter(
            assignment_id__form_id=form,
            assignment_id__status='Completed',
            score_value__isnull=False,
        )
        .values('question_id', 'question_id__text')
        .annotate(avg_score=Avg('score_value'))
        .order_by('-avg_score')[:6]
    )

    category_data = []
    for qs in question_stats:
        text = qs['question_id__text']
        short_name = (text[:15] + '...') if len(text) > 15 else text
        category_data.append({
            'name': short_name,
            'score': round(qs['avg_score'], 1),
        })

    # 3. Top performers & unit breakdown
    from apps.organizations.models import Membership

    memberships = Membership.objects.filter(
        unit_id__organization_id=form.organization_id,
        is_active=True,
    ).select_related('user_id', 'unit_id')

    user_units: dict[int, str] = {}
    for m in memberships:
        user_units[m.user_id_id] = m.unit_id.name if m.unit_id else 'Unknown'

    evaluatee_stats = (
        assignments.values(
            'evaluatee_id',
            'evaluatee_id__first_name',
            'evaluatee_id__last_name',
        )
        .annotate(
            total=Count('id'),
            completed=Count('id', filter=Q(status='Completed')),
            avg_score=Avg('total_score', filter=Q(status='Completed')),
        )
        .order_by('-avg_score')
    )

    top_performers: list[dict] = []
    rank = 1
    unit_stats_map: dict[str, dict] = {}

    for es in evaluatee_stats:
        uid = es['evaluatee_id']
        unit_name = user_units.get(uid, 'Unknown')
        name = (
            f"{es['evaluatee_id__first_name']} {es['evaluatee_id__last_name'][0]}."
            if es['evaluatee_id__last_name']
            else es['evaluatee_id__first_name']
        )

        if es['avg_score'] is not None and rank <= 5:
            top_performers.append({
                'rank': rank,
                'name': name,
                'unit': unit_name,
                'score': round(es['avg_score'], 1),
                'trend': 'same',
            })
            rank += 1

        if unit_name not in unit_stats_map:
            unit_stats_map[unit_name] = {
                'members': set(),
                'total_assignments': 0,
                'completed_assignments': 0,
                'sum_score': 0,
                'scored_count': 0,
            }

        usm = unit_stats_map[unit_name]
        usm['members'].add(uid)
        usm['total_assignments'] += es['total']
        usm['completed_assignments'] += es['completed']
        if es['avg_score'] is not None:
            usm['sum_score'] += es['avg_score']
            usm['scored_count'] += 1

    unit_breakdown: list[dict] = []
    unit_data: list[dict] = []
    colors = [
        '#4f46e5', '#06b6d4', '#10b981', '#f59e0b', '#ec4899',
        '#8b5cf6', '#ef4444', '#14b8a6', '#f97316', '#6366f1',
    ]

    c_idx = 0
    for uname, metrics in unit_stats_map.items():
        avg = (
            (metrics['sum_score'] / metrics['scored_count'])
            if metrics['scored_count'] > 0
            else 0
        )
        comp = (
            (metrics['completed_assignments'] / metrics['total_assignments'] * 100)
            if metrics['total_assignments'] > 0
            else 0
        )

        unit_breakdown.append({
            'unit': uname,
            'members': len(metrics['members']),
            'avgScore': round(avg, 1),
            'completion': round(comp, 0),
        })

        if avg > 0:
            unit_data.append({
                'name': uname,
                'value': round(avg, 1),
                'color': colors[c_idx % len(colors)],
            })
            c_idx += 1

    unit_breakdown.sort(key=lambda x: x['avgScore'], reverse=True)

    # 4. Raw data (for export)
    raw_data = []
    if include_raw:
        raw_responses = Response.objects.filter(
            assignment_id__form_id=form,
            assignment_id__status='Completed',
        ).select_related(
            'assignment_id',
            'assignment_id__evaluator_id',
            'assignment_id__evaluatee_id',
            'question_id',
        )

        for r in raw_responses:
            evaluator = r.assignment_id.evaluator_id
            evaluatee = r.assignment_id.evaluatee_id
            raw_data.append({
                'evaluator_name': (
                    f"{evaluator.first_name} {evaluator.last_name}".strip()
                    if evaluator
                    else 'Unknown'
                ),
                'evaluatee_name': (
                    f"{evaluatee.first_name} {evaluatee.last_name}".strip()
                    if evaluatee
                    else 'Unknown'
                ),
                'question_text': r.question_id.text,
                'score': r.score_value,
                'text_response': r.text,
                'submitted_at': (
                    r.assignment_id.submitted_at.isoformat()
                    if r.assignment_id.submitted_at
                    else None
                ),
            })

    return {
        'form_details': {
            'title': form.title,
            'description': form.description,
            'created_at': form.created_at.isoformat() if form.created_at else None,
            'end_date': form.end_date.isoformat() if form.end_date else None,
            'is_active': form.is_active,
            'results_released': form.results_released,
        },
        'overall_score': overall_score,
        'total_evaluations': total_evaluations,
        'participation_rate': participation_rate,
        'category_data': category_data,
        'top_performers': top_performers[:5],
        'unit_breakdown': unit_breakdown,
        'unit_data': unit_data,
        'raw_data': raw_data,
    }
