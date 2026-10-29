"""Pure safety checks also run when the PostgreSQL service is unavailable."""

import os
import unittest
from unittest.mock import patch

from IPES.testing import (
    INSTANCE_MARKER,
    TEST_ROLE,
    connection_options,
    database_name,
    run_id,
    validate_instance,
    validate_database,
    drop_database,
)


class DatabaseSafetyTests(unittest.TestCase):
    def test_development_credentials_are_not_used(self):
        with patch.dict(
            os.environ,
            {
                "DB_HOST": "production.invalid",
                "DB_PASSWORD": "must-not-be-used",
            },
            clear=True,
        ):
            options = connection_options()
            self.assertEqual(options["host"], "127.0.0.1")
            self.assertEqual(options["user"], TEST_ROLE)
            self.assertNotEqual(options["password"], "must-not-be-used")

    def test_remote_database_refused(self):
        with patch.dict(
            os.environ, {"IPES_TEST_HOST": "production.invalid"}, clear=True
        ):
            with self.assertRaises(ValueError):
                connection_options()

    def test_ci_service_requires_explicit_ci(self):
        with patch.dict(
            os.environ, {"IPES_TEST_HOST": "postgres"}, clear=True
        ):
            with self.assertRaises(ValueError):
                connection_options()
            os.environ["CI"] = "true"
            self.assertEqual(connection_options()["host"], "postgres")

    def test_database_names_are_exact_and_bounded(self):
        for name in (
            "postgres",
            "ipes_test_control",
            "ipes_e2e_",
            "ipes_e2e_x;DROP DATABASE postgres",
            "../ipes_e2e_x",
            "ipes_e2e_" + "x" * 33,
        ):
            with self.subTest(name=name), self.assertRaises(ValueError):
                database_name(name)
        self.assertEqual(database_name("ipes_e2e_run_123"), "ipes_e2e_run_123")

    def test_invalid_run_id_refused(self):
        with patch.dict(os.environ, {"IPES_TEST_RUN_ID": "../production"}):
            with self.assertRaises(ValueError):
                run_id()

    @patch("IPES.testing.psycopg.connect")
    def test_instance_must_have_marker_and_restricted_role(self, connect):
        cursor = (
            connect.return_value.__enter__.return_value.execute.return_value
        )
        for row in (
            (None, TEST_ROLE, False, True, False, "17"),
            (INSTANCE_MARKER, TEST_ROLE, True, True, False, "17"),
            (INSTANCE_MARKER, TEST_ROLE, False, True, True, "17"),
        ):
            cursor.fetchone.return_value = row
            with self.assertRaises(ValueError):
                validate_instance()
        cursor.fetchone.return_value = (
            INSTANCE_MARKER,
            TEST_ROLE,
            False,
            True,
            False,
            "17.6",
        )
        self.assertEqual(validate_instance(), "17.6")

    @patch("IPES.testing.validate_instance")
    @patch("IPES.testing.psycopg.connect")
    def test_foreign_database_marker_refused(self, connect, validate):
        cursor = (
            connect.return_value.__enter__.return_value.execute.return_value
        )
        cursor.fetchone.return_value = ("foreign marker", TEST_ROLE)
        with self.assertRaises(ValueError):
            validate_database("ipes_e2e_run", "a" * 32)

    @patch(
        "IPES.testing.validate_database",
        side_effect=ValueError("foreign database"),
    )
    @patch("IPES.testing.psycopg.connect")
    def test_drop_does_not_connect_after_failed_ownership_check(
        self, connect, validate
    ):
        with self.assertRaises(ValueError):
            drop_database("ipes_e2e_run", "a" * 32)
        connect.assert_not_called()


if __name__ == "__main__":
    unittest.main()
