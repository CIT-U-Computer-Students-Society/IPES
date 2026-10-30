import os
from pathlib import Path

from .settings_test import *  # noqa: F403
from .testing import validate_database

if os.environ.get("IPES_E2E") != "1":
    raise ValueError("E2E settings require IPES_E2E=1.")
E2E_DATABASE = os.environ["IPES_E2E_DATABASE"]
E2E_TOKEN = os.environ["IPES_E2E_TOKEN"]
validate_database(E2E_DATABASE, E2E_TOKEN)
DATABASES["default"]["NAME"] = E2E_DATABASE  # noqa: F405
INSTALLED_APPS = [*INSTALLED_APPS, "apps.e2e_support"]  # noqa: F405
MEDIA_ROOT = (
    Path(__file__).resolve().parent.parent / ".e2e" / E2E_DATABASE / "media"
)
SESSION_COOKIE_SECURE = False
CSRF_COOKIE_SECURE = False
SESSION_COOKIE_SAMESITE = "Lax"
CSRF_COOKIE_SAMESITE = "Lax"
CSRF_TRUSTED_ORIGINS = ["http://127.0.0.1:5175"]
CORS_ALLOWED_ORIGINS = ["http://127.0.0.1:5175"]
