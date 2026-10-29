"""PostgreSQL for every backend test, with no fallback engine."""

import os
from pathlib import Path

from .testing import CONTROL_DATABASE, connection_options, run_id

# Set throwaway values before decouple can inspect the application's .env.
os.environ.update(
    SECRET_KEY="ipes-tests-only-secret",
    DEBUG="False",
    DB_NAME=CONTROL_DATABASE,
    DB_USER="unused",
    DB_PASSWORD="unused",
    DB_HOST="127.0.0.1",
    DB_PORT="55432",
)
from .settings import *  # noqa: E402,F401,F403

options = connection_options()
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": CONTROL_DATABASE,
        "USER": options["user"],
        "PASSWORD": options["password"],
        "HOST": options["host"],
        "PORT": options["port"],
        "OPTIONS": {"sslmode": "disable", "connect_timeout": 5},
        "TEST": {"NAME": "test_ipes_unit_" + run_id()},
    }
}
TEST_RUNNER = "IPES.test_runner.IsolatedPostgresRunner"
ALLOWED_HOSTS = ["localhost", "127.0.0.1", "testserver"]
EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"
CACHES = {
    "default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}
}
STORAGES = {
    name: {"BACKEND": "django.core.files.storage.FileSystemStorage"}
    for name in ("default", "avatars")
}
STORAGES["staticfiles"] = {
    "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"
}
MEDIA_ROOT = Path(__file__).resolve().parent.parent / ".e2e" / "unit-media"
