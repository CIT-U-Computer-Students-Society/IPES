from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.organizations.models import Organization, OrganizationRole
from apps.users.models import User
from apps.users.serializers import (
    PasswordResetSerializer,
    UserCreateSerializer,
)


class PasswordValidationSerializerTest(APITestCase):
    """Unit tests for password validation in user serializers."""

    def test_user_create_rejects_numeric_password(self):
        data = {
            'email': 'numeric@cit.edu',
            'first_name': 'Juan',
            'last_name': 'Cruz',
            'password': '12345678',
        }
        serializer = UserCreateSerializer(data=data)
        self.assertFalse(serializer.is_valid())
        self.assertIn('password', serializer.errors)
        errors_text = ' '.join(str(e) for e in serializer.errors['password'])
        self.assertTrue(
            'entirely numeric' in errors_text or 'too common' in errors_text
        )

    def test_user_create_rejects_common_password(self):
        data = {
            'email': 'common@cit.edu',
            'first_name': 'Juan',
            'last_name': 'Cruz',
            'password': 'password123',
        }
        serializer = UserCreateSerializer(data=data)
        self.assertFalse(serializer.is_valid())
        self.assertIn('password', serializer.errors)
        errors_text = ' '.join(str(e) for e in serializer.errors['password'])
        self.assertIn('too common', errors_text)

    def test_user_create_rejects_password_similar_to_user_attributes(self):
        data = {
            'email': 'juandelacruz@cit.edu',
            'first_name': 'Juan',
            'last_name': 'DelaCruz',
            'password': 'JuanDelaCruz2026!',
        }
        serializer = UserCreateSerializer(data=data)
        self.assertFalse(serializer.is_valid())
        self.assertIn('password', serializer.errors)
        errors_text = ' '.join(str(e) for e in serializer.errors['password'])
        self.assertIn('too similar', errors_text)

    def test_user_create_accepts_strong_password(self):
        data = {
            'email': 'valid@cit.edu',
            'first_name': 'Maria',
            'last_name': 'Santos',
            'password': 'C1t-Un1vers1ty-Pass!2026',
        }
        serializer = UserCreateSerializer(data=data)
        self.assertTrue(serializer.is_valid(), serializer.errors)
        user = serializer.save()
        self.assertTrue(user.check_password('C1t-Un1vers1ty-Pass!2026'))

    def test_password_reset_rejects_numeric_and_common_passwords(self):
        user = User.objects.create_user(
            username='reset_user',
            email='reset_user@cit.edu',
            first_name='Target',
            last_name='User',
            password='InitialPassword123!',
        )
        # Test numeric
        serializer_numeric = PasswordResetSerializer(
            user, data={'password': '12345678'}
        )
        self.assertFalse(serializer_numeric.is_valid())
        self.assertIn('password', serializer_numeric.errors)

        # Test common
        serializer_common = PasswordResetSerializer(
            user, data={'password': 'password123'}
        )
        self.assertFalse(serializer_common.is_valid())
        self.assertIn('password', serializer_common.errors)

        # Test similar to user username/attributes
        serializer_similar = PasswordResetSerializer(
            user, data={'password': 'reset_user123!'}
        )
        self.assertFalse(serializer_similar.is_valid())
        self.assertIn('password', serializer_similar.errors)

        # Test valid replacement
        serializer_valid = PasswordResetSerializer(
            user, data={'password': 'Fresh-Secure-Pass!2026'}
        )
        self.assertTrue(serializer_valid.is_valid())
        serializer_valid.save()
        user.refresh_from_db()
        self.assertTrue(user.check_password('Fresh-Secure-Pass!2026'))


class PasswordValidationAPITest(APITestCase):
    """API integration tests for registration and admin password resets."""

    def setUp(self):
        self.platform_admin = User.objects.create_superuser(
            username='platform_admin',
            email='platform_admin@cit.edu',
            first_name='Platform',
            last_name='Admin',
            password='AdminStrongP@ss2026!',
        )
        self.org = Organization.objects.create(
            name='Password Validation Org',
            code='PWORG',
            period_year_start=timezone.now().date(),
        )

    def test_registration_endpoint_rejects_weak_passwords(self):
        url = reverse('auth-register')

        # Numeric password
        res_numeric = self.client.post(
            url,
            {
                'email': 'weak_num@cit.edu',
                'first_name': 'Weak',
                'last_name': 'Num',
                'password': '12345678',
            },
            format='json',
        )
        self.assertEqual(res_numeric.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('password', res_numeric.data.get('errors', {}))
        self.assertFalse(
            User.objects.filter(email='weak_num@cit.edu').exists()
        )

        # Common password
        res_common = self.client.post(
            url,
            {
                'email': 'weak_com@cit.edu',
                'first_name': 'Weak',
                'last_name': 'Com',
                'password': 'password123',
            },
            format='json',
        )
        self.assertEqual(res_common.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('password', res_common.data.get('errors', {}))
        self.assertFalse(
            User.objects.filter(email='weak_com@cit.edu').exists()
        )

        # Similar to name
        res_similar = self.client.post(
            url,
            {
                'email': 'weak_sim@cit.edu',
                'first_name': 'Pedro',
                'last_name': 'Penduko',
                'password': 'Penduko2026!',
            },
            format='json',
        )
        self.assertEqual(res_similar.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('password', res_similar.data.get('errors', {}))
        self.assertFalse(
            User.objects.filter(email='weak_sim@cit.edu').exists()
        )

        # Valid registration
        res_valid = self.client.post(
            url,
            {
                'email': 'pedro.good@cit.edu',
                'first_name': 'Pedro',
                'last_name': 'Penduko',
                'password': 'P3nduk0-Str0ng-P@ss!',
            },
            format='json',
        )
        self.assertEqual(res_valid.status_code, status.HTTP_201_CREATED)
        self.assertTrue(
            User.objects.filter(email='pedro.good@cit.edu').exists()
        )

    def test_admin_set_password_endpoint_rejects_weak_passwords(self):
        OrganizationRole.objects.create(
            user=self.platform_admin, organization=self.org, role='Admin'
        )
        target = User.objects.create_user(
            username='target_officer',
            email='target_officer@cit.edu',
            first_name='Target',
            last_name='Officer',
            password='OldStrongP@ss2026!',
        )
        OrganizationRole.objects.create(
            user=target, organization=self.org, role='Member'
        )
        self.client.force_authenticate(user=self.platform_admin)

        url = reverse('users-set-password', args=[target.pk])
        headers = {'HTTP_X_ORGANIZATION_ID': str(self.org.id)}

        # Reject common password
        res_fail = self.client.post(
            url,
            {'password': 'password123'},
            format='json',
            **headers,
        )
        self.assertEqual(res_fail.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('password', res_fail.data)
        target.refresh_from_db()
        self.assertTrue(target.check_password('OldStrongP@ss2026!'))

        # Accept valid password
        res_ok = self.client.post(
            url,
            {'password': 'N3w-Adm1n-S3t-P@ss!'},
            format='json',
            **headers,
        )
        self.assertEqual(res_ok.status_code, status.HTTP_200_OK)
        target.refresh_from_db()
        self.assertTrue(target.check_password('N3w-Adm1n-S3t-P@ss!'))
