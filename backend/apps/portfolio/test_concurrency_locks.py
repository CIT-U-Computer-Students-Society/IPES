from concurrent.futures import ThreadPoolExecutor
from threading import Event
from unittest.mock import patch
from django.db import close_old_connections, connections
from django.test import TestCase, TransactionTestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from apps.audit.models import AuditLog
from apps.organizations.models import Organization, OrganizationRole
from apps.portfolio.models import Accomplishment
from apps.portfolio.serializers import AccomplishmentUpdateSerializer
from apps.portfolio.views.accomplishments import AccomplishmentViewSet
from apps.users.models import User


class AccomplishmentConcurrencyTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.org = Organization.objects.create(
            name='Concurrency Test Org',
            code='CONCORG',
            description='Org for concurrency tests',
            period_year_start='2026-01-01',
            is_active=True,
        )

        cls.owner = User.objects.create_user(
            username='conc_owner',
            email='conc_owner@cit.edu',
            password='password123',
        )
        OrganizationRole.objects.create(
            user=cls.owner,
            organization=cls.org,
            role='Member',
            is_active=True,
        )

        cls.admin1 = User.objects.create_user(
            username='conc_admin1',
            email='conc_admin1@cit.edu',
            password='password123',
        )
        OrganizationRole.objects.create(
            user=cls.admin1,
            organization=cls.org,
            role='Admin',
            is_active=True,
        )

        cls.admin2 = User.objects.create_user(
            username='conc_admin2',
            email='conc_admin2@cit.edu',
            password='password123',
        )
        OrganizationRole.objects.create(
            user=cls.admin2,
            organization=cls.org,
            role='Admin',
            is_active=True,
        )

    def setUp(self):
        self.client = APIClient()

    def _create_pending(self, title='Concurrent Task'):
        return Accomplishment.objects.create(
            user_id=self.owner,
            organization_id=self.org,
            title=title,
            description='Evidence text',
            type='project',
            status='Pending',
            date_completed=timezone.now(),
        )

    def test_scenario_a_edit_cannot_overwrite_concurrent_verification(self):
        """Simulate Scenario A: An edit initiated before verification

        cannot overwrite the verified status after verification succeeds.
        """
        acc = self._create_pending(title='Original Evidence')
        serializer = AccomplishmentUpdateSerializer(
            instance=acc,
            data={'title': 'Edited While Being Reviewed'},
            partial=True,
        )
        self.assertTrue(serializer.is_valid())

        # Admin completes verification before the serializer saves
        self.client.force_authenticate(self.admin1)
        verify_url = reverse('accomplishments-verify', kwargs={'pk': acc.pk})
        verify_resp = self.client.post(
            verify_url,
            {'status': 'Verified'},
            format='json',
            HTTP_X_ORGANIZATION_ID=str(self.org.pk),
        )
        self.assertEqual(verify_resp.status_code, 200)

        # Attempting to save the stale serializer must be blocked
        from rest_framework.exceptions import ValidationError
        with self.assertRaises(ValidationError) as cm:
            serializer.save()

        self.assertIn('error', cm.exception.detail)
        acc.refresh_from_db()
        self.assertEqual(acc.status, 'Verified')
        self.assertEqual(acc.verified_by, self.admin1)
        self.assertEqual(acc.title, 'Original Evidence')

    def test_scenario_b_conflicting_reviews_only_first_succeeds(self):
        """Simulate Scenario B: Two overlapping reviews on a pending item.

        The second review must fail and not overwrite the first.
        """
        acc = self._create_pending(title='Item for Conflicting Review')
        verify_url = reverse('accomplishments-verify', kwargs={'pk': acc.pk})

        # Admin 1 approves the accomplishment
        self.client.force_authenticate(self.admin1)
        resp1 = self.client.post(
            verify_url,
            {'status': 'Verified'},
            format='json',
            HTTP_X_ORGANIZATION_ID=str(self.org.pk),
        )
        self.assertEqual(resp1.status_code, 200)

        # Admin 2 attempts conflicting rejection
        self.client.force_authenticate(self.admin2)
        resp2 = self.client.post(
            verify_url,
            {'status': 'Rejected', 'comments': 'Too late'},
            format='json',
            HTTP_X_ORGANIZATION_ID=str(self.org.pk),
        )
        self.assertEqual(resp2.status_code, 400)
        self.assertEqual(
            resp2.data.get('error'),
            'Can only verify pending accomplishments',
        )

        acc.refresh_from_db()
        self.assertEqual(acc.status, 'Verified')
        self.assertEqual(acc.verified_by, self.admin1)
        self.assertIsNone(acc.comments)

        # Ensure only 1 review audit event was logged
        verify_logs = AuditLog.objects.filter(
            organization_id=self.org,
            action__startswith='accomplishment.',
        )
        self.assertEqual(verify_logs.count(), 1)
        self.assertTrue(
            verify_logs.filter(
                user_id=self.admin1,
                action__startswith='accomplishment.verified',
            ).exists()
        )
        self.assertFalse(
            verify_logs.filter(
                user_id=self.admin2,
            ).exists()
        )

    def test_cannot_edit_verified_accomplishment_via_api(self):
        acc = self._create_pending()
        acc.status = 'Verified'
        acc.verified_by = self.admin1
        acc.save()

        self.client.force_authenticate(self.owner)
        url = reverse('accomplishments-detail', kwargs={'pk': acc.pk})
        response = self.client.patch(
            url,
            {'title': 'Attempted Patch'},
            format='json',
            HTTP_X_ORGANIZATION_ID=str(self.org.pk),
        )
        self.assertEqual(response.status_code, 400)
        acc.refresh_from_db()
        self.assertEqual(acc.status, 'Verified')
        self.assertEqual(acc.title, 'Concurrent Task')

    def test_cannot_verify_non_pending_accomplishment(self):
        acc = self._create_pending()
        acc.status = 'Rejected'
        acc.save()

        self.client.force_authenticate(self.admin1)
        url = reverse('accomplishments-verify', kwargs={'pk': acc.pk})
        response = self.client.post(
            url,
            {'status': 'Verified'},
            format='json',
            HTTP_X_ORGANIZATION_ID=str(self.org.pk),
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.data.get('error'),
            'Can only verify pending accomplishments',
        )

    def test_edit_rejected_accomplishment_resets_to_pending(self):
        acc = self._create_pending()
        acc.status = 'Rejected'
        acc.verified_by = self.admin1
        acc.comments = 'Needs revision'
        acc.save()

        self.client.force_authenticate(self.owner)
        url = reverse('accomplishments-detail', kwargs={'pk': acc.pk})
        response = self.client.patch(
            url,
            {'title': 'Revised Title'},
            format='json',
            HTTP_X_ORGANIZATION_ID=str(self.org.pk),
        )
        self.assertEqual(response.status_code, 200)
        acc.refresh_from_db()
        self.assertEqual(acc.status, 'Pending')
        self.assertIsNone(acc.verified_by)
        self.assertIsNone(acc.comments)
        self.assertEqual(acc.title, 'Revised Title')


class AccomplishmentDeletionConcurrencyTests(TransactionTestCase):
    """Verify row-level locking protects accomplishments in deletion races."""

    def setUp(self):
        super().setUp()
        self.org = Organization.objects.create(
            name='Deletion Concurrency Org',
            code='DELCONC',
            period_year_start='2026-01-01',
            is_active=True,
        )
        self.owner = User.objects.create_user(
            username='del_conc_owner',
            email='del_conc_owner@cit.edu',
        )
        self.admin = User.objects.create_user(
            username='del_conc_admin',
            email='del_conc_admin@cit.edu',
        )
        for user, role in ((self.owner, 'Member'), (self.admin, 'Admin')):
            OrganizationRole.objects.create(
                user=user,
                organization=self.org,
                role=role,
            )
        self.acc = Accomplishment.objects.create(
            user_id=self.owner,
            organization_id=self.org,
            title='Evidence for deletion race',
            description='Original description',
            type='project',
            status='Pending',
            date_completed=timezone.now(),
        )
        self.detail = reverse('accomplishments-detail', args=[self.acc.pk])
        self.verify = reverse('accomplishments-verify', args=[self.acc.pk])

    def client_for(self, user):
        client = APIClient()
        client.force_authenticate(user)
        client.credentials(HTTP_X_ORGANIZATION_ID=str(self.org.pk))
        return client

    def test_verification_between_delete_check_and_delete_preserves_evidence(
        self,
    ):
        original = AccomplishmentViewSet.perform_destroy
        ready, release = Event(), Event()

        def interleave(view, instance):
            ready.set()
            if not release.wait(8):
                raise RuntimeError('Delete scheduling hook timed out')
            return original(view, instance)

        def request(deleting):
            close_old_connections()
            try:
                if deleting:
                    return self.client_for(
                        self.owner
                    ).delete(self.detail).status_code
                return self.client_for(
                    self.admin
                ).post(
                    self.verify,
                    {'status': 'Verified'},
                    format='json',
                ).status_code
            finally:
                connections.close_all()

        with patch.object(
            AccomplishmentViewSet, 'perform_destroy', interleave
        ):
            with ThreadPoolExecutor(max_workers=2) as executor:
                deleting = executor.submit(request, True)
                try:
                    self.assertTrue(ready.wait(5))
                    verifying = executor.submit(request, False)
                    try:
                        verifying.result(timeout=0.5)
                    except TimeoutError:
                        pass
                finally:
                    release.set()
                deletion = deleting.result(timeout=8)
                verification = verifying.result(timeout=8)

        exists = Accomplishment.objects.filter(
            pk=self.acc.pk,
            status='Verified',
        ).exists()
        self.assertNotEqual(
            (deletion, verification),
            (204, 200),
            'DELETE removed evidence after verification returned 200',
        )
        if verification == 200:
            self.assertTrue(exists)
