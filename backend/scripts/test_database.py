"""Provision only the isolated test cluster/databases. Run from backend/."""

import argparse
import json
import os
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from IPES.testing import (  # noqa: E402
    CONTROL_DATABASE,
    INSTANCE_MARKER,
    connection_options,
    create_database,
    drop_database,
    validate_instance,
)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "action", choices=["check", "create", "drop", "bootstrap"]
    )
    parser.add_argument("--name")
    parser.add_argument("--token")
    args = parser.parse_args()
    if args.action == "bootstrap":
        import psycopg
        from psycopg import sql

        options = connection_options()
        options.update(
            user="ipes_test_bootstrap",
            password=os.environ["IPES_TEST_BOOTSTRAP_PASSWORD"],
        )
        with psycopg.connect(**options, autocommit=True) as conn:
            conn.execute(
                sql.SQL(
                    "CREATE ROLE ipes_test LOGIN CREATEDB "
                    "NOSUPERUSER NOCREATEROLE PASSWORD {}"
                ).format(sql.Literal(connection_options()["password"]))
            )
            conn.execute(
                sql.SQL("COMMENT ON DATABASE {} IS {}").format(
                    sql.Identifier(CONTROL_DATABASE),
                    sql.Literal(INSTANCE_MARKER),
                )
            )
    elif args.action == "create":
        create_database(args.name, args.token)
    elif args.action == "drop":
        drop_database(args.name, args.token)
    print(json.dumps({"engine": "postgresql", "version": validate_instance()}))


if __name__ == "__main__":
    main()
