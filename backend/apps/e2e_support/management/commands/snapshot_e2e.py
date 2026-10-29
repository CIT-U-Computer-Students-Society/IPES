import json
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.core.serializers.json import DjangoJSONEncoder
from django.db import connection, transaction
from django.utils import timezone
from django.contrib.sessions.models import Session

from apps.organizations.models import (
    Organization,
    JoinRequest,
    OrganizationRole,
)
from apps.evaluations.models import (
    EvaluationForm,
    Question,
    EvaluationAssignment,
    Response,
)
from apps.portfolio.models import Accomplishment
from apps.audit.models import AuditLog
from IPES.testing import validate_database


class Command(BaseCommand):
    help = "Read committed, allowlisted evidence; arbitrary SQL is refused."

    def add_arguments(self, parser):
        parser.add_argument("--organization", type=int, required=True)

    def handle(self, *args, **options):
        validate_database(settings.E2E_DATABASE, settings.E2E_TOKEN)
        org_id = options["organization"]
        if not Organization.objects.filter(
            pk=org_id, code__startswith="E2E"
        ).exists():
            raise CommandError(
                "Snapshot target is not a synthetic E2E organization."
            )
        with transaction.atomic():
            with connection.cursor() as cursor:
                cursor.execute(
                    "SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY"
                )
                cursor.execute("SHOW server_version")
                version = cursor.fetchone()[0]
            forms = EvaluationForm.objects.filter(organization_id_id=org_id)
            assignments = EvaluationAssignment.objects.filter(
                form_id__in=forms
            )
            users = set(
                OrganizationRole.objects.filter(
                    organization_id=org_id,
                ).values_list("user_id", flat=True)
            )
            active_sessions = sum(
                str(session.get_decoded().get("_auth_user_id"))
                in {str(user) for user in users}
                for session in Session.objects.filter(
                    expire_date__gt=timezone.now(),
                ).iterator()
            )
            data = {
                "capturedAt": timezone.now(),
                "engine": connection.vendor,
                "serverVersion": version,
                "organizationId": org_id,
                "sessions": [{"active_count": active_sessions}],
                "organizations": list(
                    Organization.objects.filter(pk=org_id).values(
                        "id", "name", "is_active"
                    )
                ),
                "joinRequests": list(
                    JoinRequest.objects.filter(organization_id=org_id)
                    .order_by("id")
                    .values("id", "user_id", "status")
                ),
                "forms": list(
                    forms.order_by("id").values(
                        "id",
                        "title",
                        "is_active",
                        "is_deleted",
                        "results_released",
                    )
                ),
                "questions": list(
                    Question.objects.filter(form_id__in=forms)
                    .order_by("id")
                    .values("id", "form_id_id", "text", "weight", "order")
                ),
                "assignments": list(
                    assignments.order_by("id").values(
                        "id",
                        "form_id_id",
                        "evaluator_id_id",
                        "evaluatee_id_id",
                        "status",
                        "total_score",
                        "submitted_at",
                    )
                ),
                "responses": list(
                    Response.objects.filter(assignment_id__in=assignments)
                    .order_by("id")
                    .values(
                        "id",
                        "assignment_id_id",
                        "question_id_id",
                        "score_value",
                        "text",
                    )
                ),
                "accomplishments": list(
                    Accomplishment.objects.filter(organization_id_id=org_id)
                    .order_by("id")
                    .values(
                        "id",
                        "user_id_id",
                        "title",
                        "status",
                        "verified_by_id",
                        "comments",
                    )
                ),
                "audit": list(
                    AuditLog.objects.filter(organization_id_id=org_id)
                    .order_by("id")
                    .values("id", "action", "user_id_id")
                ),
            }
        self.stdout.write(json.dumps(data, cls=DjangoJSONEncoder))
