import csv
import io
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.audit.models import AuditLog
from apps.audit.utils import sanitize_csv_cell
from apps.organizations.models import Organization
from apps.users.models import User


class CSVFormulaSanitizationTest(APITestCase):
    """Unit tests for spreadsheet formula injection neutralization."""

    def test_formula_triggers_are_escaped(self):
        cases = [
            "=1+1",
            "=SUM(A1:A10)",
            "=cmd|' /C calc'!A0",
            "+1+1",
            "+2+2",
            "-1+1",
            "-5",
            "@SUM(A1:A10)",
            "@danger",
        ]
        for val in cases:
            with self.subTest(val=val):
                self.assertEqual(sanitize_csv_cell(val), f"'{val}")

    def test_leading_whitespace_and_control_variants_are_escaped(self):
        cases = [
            "  =1+1",
            "   +2+2",
            " -3",
            "  @SUM",
            "\t=1+1",
            "\t+1+1",
            "\t-1+1",
            "\t@test",
            "\tcmd",
            "\r=1+1",
            "\r\n=1+1",
        ]
        for val in cases:
            with self.subTest(val=val):
                self.assertEqual(sanitize_csv_cell(val), f"'{val}")

    def test_quotes_and_commas_with_formulas(self):
        cases = [
            '=1+1, with comma',
            '=1+1, "with quotes"',
            '+2+2, "another, quote"',
            '-3, -4, -5',
            '@calc, "nested"',
        ]
        for val in cases:
            with self.subTest(val=val):
                sanitized = sanitize_csv_cell(val)
                self.assertEqual(sanitized, f"'{val}")
                # Verify round-trip through csv writer and reader
                buf = io.StringIO()
                writer = csv.writer(buf)
                writer.writerow([sanitized])
                buf.seek(0)
                reader = csv.reader(buf)
                row = next(reader)
                self.assertEqual(row[0], f"'{val}")

    def test_safe_values_are_not_escaped(self):
        cases = [
            "Normal Name",
            "John Doe",
            "john.doe@cit.edu",
            "admin@example.com",
            "2026-10-30 14:00:00",
            "192.168.1.1",
            "System",
            "N/A",
            "",
        ]
        for val in cases:
            with self.subTest(val=val):
                self.assertEqual(sanitize_csv_cell(val), val)

    def test_none_returns_empty_string(self):
        self.assertEqual(sanitize_csv_cell(None), "")


class AuditLogCSVExportAPITest(APITestCase):
    """Integration tests for audit log CSV export endpoint."""

    def setUp(self):
        self.admin = User.objects.create_superuser(
            email='audit_csv_admin@cit.edu',
            username='audit_csv_admin',
            first_name='Admin',
            last_name='User',
            password='Password123!',
        )
        self.org = Organization.objects.create(
            name='Audit CSV Test Org',
            code='CSVORG',
            period_year_start=timezone.now().date(),
        )
        self.client.force_authenticate(user=self.admin)

    def test_export_csv_neutralizes_formula_names_and_actions(self):
        malicious_user1 = User.objects.create_user(
            email='malicious1@cit.edu',
            username='malicious1',
            first_name='=1+1',
            last_name='',
            password='Password123!',
        )
        malicious_user2 = User.objects.create_user(
            email='malicious2@cit.edu',
            username='malicious2',
            first_name='  +SUM(1,2)',
            last_name='@evil',
            password='Password123!',
        )
        malicious_user3 = User.objects.create_user(
            email='malicious3@cit.edu',
            username='malicious3',
            first_name='\t=cmd',
            last_name='calc',
            password='Password123!',
        )
        safe_user = User.objects.create_user(
            email='safe_officer@cit.edu',
            username='safe_officer',
            first_name='Maria',
            last_name='Santos',
            password='Password123!',
        )

        AuditLog.objects.create(
            user_id=malicious_user1,
            organization_id=self.org,
            action='=cmd|/C calc!A0',
            ip_address='10.0.0.1',
        )
        AuditLog.objects.create(
            user_id=malicious_user2,
            organization_id=self.org,
            action='+export_action, "test"',
            ip_address='10.0.0.2',
        )
        AuditLog.objects.create(
            user_id=malicious_user3,
            organization_id=self.org,
            action='@run_payload',
            ip_address='10.0.0.3',
        )
        AuditLog.objects.create(
            user_id=safe_user,
            organization_id=self.org,
            action='Standard evaluation review completed',
            ip_address='192.168.1.50',
        )

        url = reverse('audit-export-csv')
        response = self.client.get(url, {'organization_id': self.org.id})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response['Content-Type'], 'text/csv')
        self.assertIn(
            'attachment; filename="audit_log_',
            response['Content-Disposition'],
        )

        csv_content = response.content.decode('utf-8')
        reader = csv.reader(io.StringIO(csv_content))
        rows = list(reader)

        # Header check
        expected_headers = [
            'Timestamp', 'User Name', 'User Email', 'Action', 'IP Address'
        ]
        self.assertEqual(rows[0], expected_headers)

        # Find rows by user email
        data_rows = {row[2]: row for row in rows[1:]}

        # Check malicious_user1 row
        row1 = data_rows['malicious1@cit.edu']
        self.assertEqual(row1[1], "'=1+1")
        self.assertEqual(row1[3], "'=cmd|/C calc!A0")

        # Check malicious_user2 row
        row2 = data_rows['malicious2@cit.edu']
        self.assertEqual(row2[1], "'+SUM(1,2) @evil")
        self.assertEqual(row2[3], "'+export_action, \"test\"")
        self.assertEqual(row2[4], "10.0.0.2")

        # Check malicious_user3 row
        row3 = data_rows['malicious3@cit.edu']
        self.assertEqual(row3[1], "'=cmd calc")
        self.assertEqual(row3[3], "'@run_payload")

        # Check safe_user row (no leading single quote)
        row_safe = data_rows['safe_officer@cit.edu']
        self.assertEqual(row_safe[1], "Maria Santos")
        self.assertEqual(row_safe[2], "safe_officer@cit.edu")
        self.assertEqual(row_safe[3], "Standard evaluation review completed")
        self.assertEqual(row_safe[4], "192.168.1.50")
