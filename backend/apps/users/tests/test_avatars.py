from io import BytesIO
from unittest.mock import patch
from urllib.parse import parse_qs, urlparse

from botocore.exceptions import ClientError
from django.core.files.storage import InMemoryStorage
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from PIL import Image
from rest_framework.test import APITestCase
from storages.backends.s3 import S3Storage

from apps.audit.models import AuditLog
from apps.organizations.models import Organization, OrganizationRole
from apps.users.models import User


def image_upload(fmt='PNG', size=(500, 300)):
    output = BytesIO()
    Image.new('RGB', size, 'blue').save(output, format=fmt)
    return SimpleUploadedFile(
        f'avatar.{fmt.lower()}', output.getvalue(), f'image/{fmt.lower()}',
    )


class AvatarTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='avatar', email='avatar@cit.edu', password='password123',
        )
        self.other = User.objects.create_user(
            username='other', email='other@cit.edu',
        )
        self.client.force_authenticate(self.user)
        self.storage = InMemoryStorage(base_url='/private-test/')
        self.storage_patch = patch.object(
            User._meta.get_field('display_picture'), 'storage', self.storage,
        )
        self.storage_patch.start()
        self.addCleanup(self.storage_patch.stop)
        self.url = reverse('auth-me')

    def upload(self, image=None):
        return self.client.patch(
            self.url, {'display_picture': image or image_upload()},
            format='multipart',
        )

    def test_supported_images_are_cropped_without_metadata(self):
        for fmt in ['JPEG', 'PNG', 'WEBP']:
            with (self.subTest(fmt=fmt),
                  self.captureOnCommitCallbacks(execute=True)):
                response = self.upload(image_upload(fmt))
                self.assertEqual(response.status_code, 200, response.data)
                self.user.refresh_from_db()
                name = self.user.display_picture.name
                self.assertTrue(name.endswith('.webp'))
                with (self.storage.open(name) as stored,
                      Image.open(stored) as image):
                    self.assertEqual(image.size, (256, 256))
                    self.assertEqual(image.format, 'WEBP')
                    self.assertFalse(image.getexif())
                    self.assertLess(stored.size, 100_000)
        self.other.refresh_from_db()
        self.assertFalse(self.other.display_picture)
        self.assertTrue(AuditLog.objects.filter(
            action__startswith='user.updated',
        ).exists())

    def test_invalid_uploads_leave_profile_unchanged(self):
        self.upload()
        self.user.refresh_from_db()
        original = self.user.display_picture.name
        invalid = [
            SimpleUploadedFile('fake.png', b'not an image', 'image/png'),
            SimpleUploadedFile(
                'large.png', b'x' * (2 * 1024 * 1024 + 1), 'image/png',
            ),
            image_upload('GIF'),
            image_upload('PNG', (4001, 4000)),
        ]
        for image in invalid:
            with self.subTest(name=image.name):
                response = self.upload(image)
                self.assertEqual(response.status_code, 400)
                self.assertIn('display_picture', response.data)
                self.user.refresh_from_db()
                self.assertEqual(self.user.display_picture.name, original)

    def test_replacement_deletes_previous_file_only_after_commit(self):
        self.upload()
        self.user.refresh_from_db()
        old_name = self.user.display_picture.name
        with self.captureOnCommitCallbacks(execute=True):
            self.assertEqual(self.upload().status_code, 200)
            self.assertTrue(self.storage.exists(old_name))
        self.assertFalse(self.storage.exists(old_name))

    def test_remove_picture_and_edit_names_without_a_file(self):
        self.upload()
        self.user.refresh_from_db()
        old_name = self.user.display_picture.name
        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.patch(
                self.url, {'display_picture': None, 'first_name': 'Updated'},
                format='json',
            )
        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.data['display_picture'])
        self.assertEqual(response.data['first_name'], 'Updated')
        self.assertFalse(self.storage.exists(old_name))

    def test_name_only_update_keeps_existing_picture(self):
        self.upload()
        self.user.refresh_from_db()
        name = self.user.display_picture.name
        response = self.client.patch(
            self.url, {'last_name': 'Updated'}, format='json',
        )
        self.assertEqual(response.status_code, 200)
        self.user.refresh_from_db()
        self.assertEqual(self.user.display_picture.name, name)
        self.assertTrue(self.storage.exists(name))

    def test_storage_failure_preserves_previous_picture(self):
        self.upload()
        self.user.refresh_from_db()
        name = self.user.display_picture.name
        error = ClientError(
            {'Error': {'Code': 'ServiceUnavailable'}}, 'PutObject',
        )
        with patch.object(self.storage, '_save', side_effect=error):
            response = self.upload()
        self.assertEqual(response.status_code, 503)
        self.user.refresh_from_db()
        self.assertEqual(self.user.display_picture.name, name)
        self.assertTrue(self.storage.exists(name))

    def test_anonymous_upload_is_rejected(self):
        self.client.force_authenticate(None)
        self.assertEqual(self.upload().status_code, 401)

    def test_private_urls_are_signed_and_expire(self):
        storage = S3Storage(
            access_key='test-access', secret_key='test-secret',
            endpoint_url='https://example.storage.supabase.co/storage/v1/s3',
            region_name='ap-southeast-1', bucket_name='avatars',
            addressing_style='path', signature_version='s3v4',
            querystring_auth=True, querystring_expire=3600, custom_domain=None,
        )
        url = urlparse(storage.url('users/pictures/avatar.webp'))
        self.assertEqual(
            url.path, '/storage/v1/s3/avatars/users/pictures/avatar.webp',
        )
        query = parse_qs(url.query)
        self.assertEqual(query['X-Amz-Expires'], ['3600'])
        self.assertIn('X-Amz-Signature', query)

    def test_user_list_and_detail_do_not_expose_other_organizations(self):
        org_a = Organization.objects.create(
            name='A', code='A', period_year_start='2026-01-01',
        )
        org_b = Organization.objects.create(
            name='B', code='B', period_year_start='2026-01-01',
        )
        OrganizationRole.objects.create(
            user=self.user, organization=org_a, role='Admin',
        )
        OrganizationRole.objects.create(
            user=self.other, organization=org_b, role='Member',
        )
        self.client.credentials(HTTP_X_ORGANIZATION_ID=str(org_a.pk))
        response = self.client.get(reverse('users-list'))
        rows = response.data.get('results', response.data)
        self.assertEqual([row['id'] for row in rows], [self.user.pk])
        detail = reverse('users-detail', args=[self.other.pk])
        self.assertEqual(self.client.get(detail).status_code, 404)
        self.client.credentials(HTTP_X_ORGANIZATION_ID=str(org_b.pk))
        self.assertEqual(
            self.client.get(reverse('users-list')).data['results'], [],
        )
        self.client.credentials()
        self.assertEqual(
            self.client.get(reverse('users-list')).data['results'], [],
        )
