import hashlib
import json
import re
from datetime import timedelta

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from apps.users.models import User
from apps.organizations.models import (
    Organization,
    OrganizationRole,
    Membership,
    OrganizationUnit,
    UnitType,
    PositionType,
)
from apps.evaluations.models import (
    EvaluationForm,
    Question,
    EvaluationAssignment,
)
from IPES.testing import validate_database


class Command(BaseCommand):
    help = "Seed preconditions only in a marked disposable E2E database."

    def add_arguments(self, parser):
        parser.add_argument("--namespace", required=True)
        parser.add_argument(
            "--scenario",
            required=True,
            choices=[f"S{i:02}" for i in range(1, 12)],
        )

    @transaction.atomic
    def handle(self, *args, **options):
        validate_database(settings.E2E_DATABASE, settings.E2E_TOKEN)
        namespace = options["namespace"]
        if not re.fullmatch(r"[a-zA-Z0-9_-]{1,100}", namespace):
            raise CommandError("Invalid fixture namespace.")
        prefix = hashlib.sha256(namespace.encode()).hexdigest()[:12]
        if Organization.objects.filter(code=f"E2EA{prefix}").exists():
            raise CommandError(
                "Fixture namespace already exists; use a fresh namespace."
            )
        today = timezone.localdate()
        orgs = [
            Organization.objects.create(
                name=f"E2E {letter} {prefix}",
                code=f"E2E{letter}{prefix}",
                description="Synthetic acceptance-test organization",
                period_year_start=today - timedelta(days=30),
            )
            for letter in ("A", "B")
        ]
        password = f"E2E-{prefix}-password!"
        users = {}
        for role in ("admin", "member", "peer", "outsider"):
            users[role] = User.objects.create_user(
                username=f"{role}_{prefix}",
                email=f"{role}_{prefix}@example.test",
                password=password,
                first_name=role.capitalize(),
                last_name=prefix,
            )
        for index, org in enumerate(orgs):
            unit_type = UnitType.objects.create(
                organization_id=org, name="Committee"
            )
            unit = OrganizationUnit.objects.create(
                organization_id=org, type_id=unit_type, name="Research"
            )
            position = PositionType.objects.create(
                organization_id=org, name="Officer", rank=2
            )
            roles = (
                ("admin", "member", "peer")
                if index == 0
                else ("admin", "outsider")
            )
            for role in roles:
                OrganizationRole.objects.create(
                    user=users[role],
                    organization=org,
                    role="Admin" if role == "admin" else "Member",
                )
                Membership.objects.create(
                    user_id=users[role],
                    unit_id=unit,
                    position_id=position,
                    date_start=today,
                )
        manifest = {
            "schemaVersion": 1,
            "namespace": namespace,
            "scenario": options["scenario"],
            "organization": {
                "id": orgs[0].pk,
                "name": orgs[0].name,
                "code": orgs[0].code,
            },
            "foreignOrganization": {"id": orgs[1].pk, "name": orgs[1].name},
            "users": {
                key: {"id": user.pk, "email": user.email, "password": password}
                for key, user in users.items()
            },
            "title": f"E2E evaluation {prefix}",
        }
        if options["scenario"] != "S02":
            form = EvaluationForm.objects.create(
                organization_id=orgs[0],
                created_by=users["admin"],
                title=manifest["title"],
                start_date=today - timedelta(days=1),
                end_date=today + timedelta(days=30),
                is_active=True,
            )
            questions = [
                Question.objects.create(
                    form_id=form,
                    text=text,
                    input_type="rating",
                    order=index + 1,
                    weight=weight,
                    min_value=1,
                    max_value=5,
                )
                for index, (text, weight) in enumerate(
                    [("Communication", 1), ("Leadership", 3)]
                )
            ]
            assignment = EvaluationAssignment.objects.create(
                form_id=form,
                evaluator_id=users["member"],
                evaluatee_id=users["peer"],
            )
            manifest.update(
                formId=form.pk,
                assignmentId=assignment.pk,
                questionIds=[q.pk for q in questions],
            )
            if options["scenario"] == "S08":
                for index in range(20):
                    EvaluationForm.objects.create(
                        organization_id=orgs[0],
                        created_by=users["admin"],
                        title=f"E2E backlog {index} {prefix}",
                        start_date=today,
                        end_date=today + timedelta(days=30),
                        is_active=False,
                    )
        self.stdout.write(json.dumps(manifest))
