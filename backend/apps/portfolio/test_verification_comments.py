"""
Regression tests for verification comments persistence (#251).

Ensures comments submitted during accomplishment verification (for both
'Verified' and 'Rejected' decisions) are persisted and returned rather than
silently discarded.
"""

from datetime import date
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.organizations.models import Organization, OrganizationRole
from apps.portfolio.models import Accomplishment
from apps.users.models import User


class AccomplishmentVerificationCommentsTests(APITestCase):
    def setUp(self):
        self.password = 'StrongP@ssw0rd!123'
        self.org = Organization.objects.create(
            name='Portfolio Test Org',
            code='PORTORG',
            period_year_start=date(2026, 1, 1),
            is_active=True,
        )

        self.admin = User.objects.create_user(
            username='portfolio_admin',
            email='admin@cit.edu',
            password=self.password,
            first_name='Admin',
            last_name='User',
        )
        OrganizationRole.objects.create(
            user=self.admin,
            organization=self.org,
            role='Admin',
            is_active=True,
        )

        self.member = User.objects.create_user(
            username='portfolio_member',
            email='member@cit.edu',
            password=self.password,
            first_name='Member',
            last_name='User',
        )
        OrganizationRole.objects.create(
            user=self.member,
            organization=self.org,
            role='Member',
            is_active=True,
        )

        self.client.force_authenticate(user=self.admin)
        self.client.credentials(HTTP_X_ORGANIZATION_ID=str(self.org.id))

    def _create_pending_accomplishment(self, title='Test Project'):
        return Accomplishment.objects.create(
            user_id=self.member,
            organization_id=self.org,
            title=title,
            description='Detailed accomplishment description',
            type='project',
            date_completed=timezone.now(),
            status='Pending',
        )

    def test_verify_with_comments_persists_comments(self):
        """Verifying an accomplishment with comments saves reviewer notes."""
        acc = self._create_pending_accomplishment('AI Research Prototype')
        url = reverse('accomplishments-verify', kwargs={'pk': acc.id})
        note = 'Reviewed source evidence and verified deployment demo.'

        resp = self.client.post(url, {
            'status': 'Verified',
            'comments': note,
        }, format='json')

        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data['accomplishment']['status'], 'Verified')
        self.assertEqual(resp.data['accomplishment']['comments'], note)

        acc.refresh_from_db()
        self.assertEqual(acc.status, 'Verified')
        self.assertEqual(acc.verified_by, self.admin)
        self.assertEqual(acc.comments, note)

    def test_reject_with_comments_persists_comments(self):
        """Rejecting an accomplishment with comments saves rejection reason."""
        acc = self._create_pending_accomplishment('Incomplete Submission')
        url = reverse('accomplishments-verify', kwargs={'pk': acc.id})
        note = 'Missing certification link and supervisor signoff.'

        resp = self.client.post(url, {
            'status': 'Rejected',
            'comments': note,
        }, format='json')

        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data['accomplishment']['status'], 'Rejected')
        self.assertEqual(resp.data['accomplishment']['comments'], note)

        acc.refresh_from_db()
        self.assertEqual(acc.status, 'Rejected')
        self.assertEqual(acc.verified_by, self.admin)
        self.assertEqual(acc.comments, note)

    def test_verify_without_comments_keeps_comments_none(self):
        """Verifying without comments omits notes cleanly."""
        acc = self._create_pending_accomplishment('Standard Submission')
        url = reverse('accomplishments-verify', kwargs={'pk': acc.id})

        resp = self.client.post(url, {'status': 'Verified'}, format='json')

        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        acc.refresh_from_db()
        self.assertEqual(acc.status, 'Verified')
        self.assertIsNone(acc.comments)

    def test_verify_with_blank_comments_stores_empty_string(self):
        """Passing empty comments string updates comments to empty string."""
        acc = self._create_pending_accomplishment('Blank Notes Submission')
        url = reverse('accomplishments-verify', kwargs={'pk': acc.id})

        resp = self.client.post(url, {
            'status': 'Verified',
            'comments': '',
        }, format='json')

        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        acc.refresh_from_db()
        self.assertEqual(acc.status, 'Verified')
        self.assertEqual(acc.comments, '')

    def test_verify_with_excessive_comments_returns_400(self):
        """Comments exceeding 500 characters return 400 validation error."""
        acc = self._create_pending_accomplishment('Too Long Notes Submission')
        url = reverse('accomplishments-verify', kwargs={'pk': acc.id})

        resp = self.client.post(url, {
            'status': 'Verified',
            'comments': 'A' * 501,
        }, format='json')

        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('comments', resp.data)
