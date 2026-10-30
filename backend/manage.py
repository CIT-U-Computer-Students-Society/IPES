#!/usr/bin/env python
"""Django's command-line utility for administrative tasks."""

import os
import sys


def main():
    """Run administrative tasks."""
    testing = len(sys.argv) > 1 and sys.argv[1] == "test"
    if testing:
        explicit = next(
            (
                arg.split("=", 1)[1]
                for arg in sys.argv
                if arg.startswith("--settings=")
            ),
            None,
        )
        if "--settings" in sys.argv:
            explicit = sys.argv[sys.argv.index("--settings") + 1]
        selected = explicit or os.environ.get(
            "DJANGO_SETTINGS_MODULE", "IPES.settings_test"
        )
        if selected not in ("IPES.settings_test", "IPES.settings_e2e"):
            raise SystemExit(
                "Database tests require isolated PostgreSQL test settings."
            )
        os.environ["DJANGO_SETTINGS_MODULE"] = selected
    else:
        os.environ.setdefault("DJANGO_SETTINGS_MODULE", "IPES.settings")
    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError(
            "Couldn't import Django. Are you sure it's installed and "
            "available on your PYTHONPATH environment variable? Did you "
            "forget to activate a virtual environment?"
        ) from exc
    execute_from_command_line(sys.argv)


if __name__ == "__main__":
    main()
