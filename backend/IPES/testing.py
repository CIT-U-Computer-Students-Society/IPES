"""Isolated PostgreSQL configuration. Never read application DB credentials."""

import json
import os
import re
import uuid

import psycopg
from psycopg import sql

INSTANCE_MARKER = "ipes-isolated-tests-v1"
CONTROL_DATABASE = "ipes_test_control"
TEST_ROLE = "ipes_test"


def connection_options():
    host = os.environ.get("IPES_TEST_HOST", "127.0.0.1")
    if host not in ("127.0.0.1", "localhost") and not (
        os.environ.get("CI") == "true" and host == "postgres"
    ):
        raise ValueError(
            "Tests require local PostgreSQL or the CI postgres service."
        )
    return {
        "host": host,
        "port": int(os.environ.get("IPES_TEST_PORT", "55432")),
        "user": TEST_ROLE,
        "password": os.environ.get("IPES_TEST_PASSWORD", "ipes_test_local"),
        "dbname": CONTROL_DATABASE,
        "sslmode": "disable",
        "connect_timeout": 5,
    }


def validate_instance():
    with psycopg.connect(**connection_options()) as conn:
        marker, role, superuser, createdb, createrole, version = conn.execute(
            "SELECT shobj_description(d.oid, 'pg_database'), current_user, "
            "r.rolsuper, r.rolcreatedb, r.rolcreaterole, "
            "current_setting('server_version') "
            "FROM pg_database d JOIN pg_roles r ON r.rolname=current_user "
            "WHERE d.datname=current_database()"
        ).fetchone()
        if (marker, role, superuser, createdb, createrole) != (
            INSTANCE_MARKER,
            TEST_ROLE,
            False,
            True,
            False,
        ):
            raise ValueError(
                "PostgreSQL test marker or restricted role does not match."
            )
        return version


def run_id():
    value = os.environ.get("IPES_TEST_RUN_ID") or uuid.uuid4().hex[:16]
    if not re.fullmatch(r"[a-z0-9_]{1,32}", value):
        raise ValueError("Invalid test run ID.")
    return value


def database_name(value):
    if not re.fullmatch(r"ipes_e2e_[a-z0-9_]{1,32}", value):
        raise ValueError(
            "Expected an exact run-specific ipes_e2e_ database name."
        )
    return value


def database_marker(name, token):
    return json.dumps(
        {"database": database_name(name), "token": token}, sort_keys=True
    )


def create_database(name, token):
    validate_instance()
    name = database_name(name)
    if not re.fullmatch(r"[a-f0-9]{32}", token):
        raise ValueError("Invalid ownership token.")
    with psycopg.connect(**connection_options(), autocommit=True) as conn:
        conn.execute(
            sql.SQL("CREATE DATABASE {}").format(sql.Identifier(name))
        )
        conn.execute(
            sql.SQL("COMMENT ON DATABASE {} IS {}").format(
                sql.Identifier(name), sql.Literal(database_marker(name, token))
            )
        )


def validate_database(name, token):
    validate_instance()
    name = database_name(name)
    with psycopg.connect(**connection_options()) as conn:
        row = conn.execute(
            "SELECT shobj_description(d.oid, 'pg_database'), "
            "pg_get_userbyid(d.datdba) "
            "FROM pg_database d WHERE d.datname=%s",
            (name,),
        ).fetchone()
        if row != (database_marker(name, token), TEST_ROLE):
            raise ValueError(
                "Database ownership/run marker mismatch; access refused."
            )


def drop_database(name, token):
    validate_database(name, token)
    with psycopg.connect(**connection_options(), autocommit=True) as conn:
        # Refuse active clients; never terminate another process's sessions.
        conn.execute(
            sql.SQL("DROP DATABASE {}").format(
                sql.Identifier(database_name(name))
            )
        )
