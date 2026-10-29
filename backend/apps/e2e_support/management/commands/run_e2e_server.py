from pathlib import Path
from socketserver import ThreadingMixIn
from wsgiref.simple_server import WSGIServer, make_server

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.core.wsgi import get_wsgi_application
from IPES.testing import validate_database


class ThreadedServer(ThreadingMixIn, WSGIServer):
    daemon_threads = False
    allow_reuse_address = False


class Command(BaseCommand):
    def add_arguments(self, parser):
        parser.add_argument("--runtime", required=True)
        parser.add_argument("--port", type=int, default=8001)

    def handle(self, *args, **options):
        import coverage

        validate_database(settings.E2E_DATABASE, settings.E2E_TOKEN)
        runtime = Path(options["runtime"]).resolve()
        expected = Path(settings.BASE_DIR) / ".e2e" / settings.E2E_DATABASE
        if (
            runtime != expected.resolve()
            or not (runtime / "owner").is_file()
            or (runtime / "owner").read_text() != settings.E2E_TOKEN
        ):
            raise CommandError("Invalid server runtime marker/path.")
        collector = coverage.Coverage(
            data_file=str(runtime / ".coverage.e2e"),
            config_file=str(Path(settings.BASE_DIR) / ".coveragerc"),
        )
        collector.start()
        try:
            with make_server(
                "127.0.0.1",
                options["port"],
                get_wsgi_application(),
                server_class=ThreadedServer,
            ) as server:
                server.timeout = 0.25
                self.stdout.write("E2E WSGI server ready", ending="\n")
                while not (runtime / "stop").exists():
                    server.handle_request()
        finally:
            collector.stop()
            collector.save()
            collector.html_report(directory=str(runtime / "coverage" / "html"))
            collector.xml_report(
                outfile=str(runtime / "coverage" / "coverage.xml")
            )
            collector.json_report(
                outfile=str(runtime / "coverage" / "coverage.json")
            )
