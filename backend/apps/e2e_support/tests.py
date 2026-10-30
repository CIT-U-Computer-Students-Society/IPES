import io
import json
from unittest.mock import patch

from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import TestCase, TransactionTestCase, override_settings

from .management.commands.seed_e2e import Command as SeedCommand
from .management.commands.snapshot_e2e import Command as SnapshotCommand
from apps.evaluations.models import Response
from apps.organizations.models import Organization


@override_settings(E2E_DATABASE="ipes_e2e_fixture", E2E_TOKEN="a" * 32)
class FixtureTests(TestCase):
    @patch("apps.e2e_support.management.commands.seed_e2e.validate_database")
    def test_seed_creates_preconditions_without_final_responses(
        self, validate
    ):
        output = io.StringIO()
        call_command(
            SeedCommand(),
            namespace="seed-fixture",
            scenario="S03",
            stdout=output,
        )
        fixture = json.loads(output.getvalue())
        self.assertEqual(Organization.objects.count(), 2)
        self.assertEqual(Response.objects.count(), 0)
        self.assertIn("assignmentId", fixture)
        with self.assertRaises(CommandError):
            call_command(
                SeedCommand(),
                namespace="seed-fixture",
                scenario="S03",
                stdout=io.StringIO(),
            )

    @patch("apps.e2e_support.management.commands.seed_e2e.validate_database")
    def test_bad_namespace_cannot_write(self, validate):
        with self.assertRaises(CommandError):
            call_command(SeedCommand(), namespace="../foreign", scenario="S03")
        self.assertEqual(Organization.objects.count(), 0)

    @patch("apps.e2e_support.management.commands.seed_e2e.validate_database")
    def test_form_creation_scenario_has_no_seeded_form(self, validate):
        output = io.StringIO()
        call_command(
            SeedCommand(),
            namespace="form-fixture",
            scenario="S02",
            stdout=output,
        )
        self.assertNotIn("formId", json.loads(output.getvalue()))


@override_settings(E2E_DATABASE="ipes_e2e_fixture", E2E_TOKEN="a" * 32)
class SnapshotTests(TransactionTestCase):
    @patch("apps.e2e_support.management.commands.seed_e2e.validate_database")
    @patch(
        "apps.e2e_support.management.commands.snapshot_e2e.validate_database"
    )
    def test_snapshot_is_scoped_and_redacts_credentials(
        self, validate_snapshot, validate_seed
    ):
        fixture_output = io.StringIO()
        call_command(
            SeedCommand(),
            namespace="snapshot-fixture",
            scenario="S03",
            stdout=fixture_output,
        )
        fixture = json.loads(fixture_output.getvalue())
        output = io.StringIO()
        call_command(
            SnapshotCommand(),
            organization=fixture["organization"]["id"],
            stdout=output,
        )
        snapshot = json.loads(output.getvalue())
        self.assertEqual(snapshot["engine"], "postgresql")
        self.assertEqual(len(snapshot["organizations"]), 1)
        self.assertEqual(snapshot["responses"], [])
        self.assertNotIn(
            fixture["users"]["member"]["password"], output.getvalue()
        )
        self.assertNotIn("session_key", output.getvalue())
        self.assertEqual(snapshot["assignments"][0]["status"], "Pending")
