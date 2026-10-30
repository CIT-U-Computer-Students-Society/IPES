from django.test.runner import DiscoverRunner
from .testing import validate_instance


class IsolatedPostgresRunner(DiscoverRunner):
    def setup_databases(self, **kwargs):
        version = validate_instance()
        print(f"Test database engine: PostgreSQL {version}")
        return super().setup_databases(**kwargs)
