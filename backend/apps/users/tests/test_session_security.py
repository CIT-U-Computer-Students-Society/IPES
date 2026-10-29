from django.conf import settings
from django.test import TestCase, override_settings
from django.urls import reverse
from rest_framework.test import APIClient

from apps.users.models import User


@override_settings(
    ALLOWED_HOSTS=['testserver'], SESSION_COOKIE_SECURE=True,
    CSRF_COOKIE_SECURE=True,
    CSRF_TRUSTED_ORIGINS=['https://app.example.com'],
    CORS_ALLOWED_ORIGINS=['https://app.example.com'],
)
class SessionSecurityTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.credentials = {
            'email': 'session@cit.edu', 'password': 'session-password-123',
        }
        cls.user = User.objects.create_user(
            **cls.credentials, username='session', first_name='Session',
        )

    def setUp(self):
        self.client = APIClient(enforce_csrf_checks=True)

    def csrf(self):
        response = self.client.get(reverse('auth-csrf'), secure=True)
        self.assertEqual(response.status_code, 200)
        self.assertIn('no-store', response['Cache-Control'])
        self.assertIn('Cookie', response['Vary'])
        return response.data['csrfToken']

    def me(self):
        return self.client.get(reverse('auth-me'), secure=True)

    def post(self, route, data, token=None, origin='https://testserver'):
        headers = {'HTTP_ORIGIN': origin}
        if token:
            headers['HTTP_X_CSRFTOKEN'] = token
        return self.client.post(
            reverse(route), data, format='json', secure=True, **headers,
        )

    def test_anonymous_login_registration_and_logout_require_csrf(self):
        for route in ('auth-login', 'auth-register', 'auth-logout'):
            with self.subTest(route=route):
                response = self.post(route, self.credentials)
                self.assertEqual(response.status_code, 403)

    def test_session_login_rotation_mutation_and_logout(self):
        old_token = self.csrf()
        response = self.post('auth-login', self.credentials, old_token)
        self.assertEqual(response.status_code, 200)
        self.assertNotIn('token', response.data)
        session = response.cookies[settings.SESSION_COOKIE_NAME]
        self.assertTrue(session['httponly'])
        self.assertTrue(session['secure'])
        self.assertFalse(session['domain'])
        csrf_cookie = response.cookies[settings.CSRF_COOKIE_NAME]
        self.assertTrue(csrf_cookie['httponly'])
        self.assertTrue(csrf_cookie['secure'])
        self.assertFalse(csrf_cookie['domain'])
        self.assertEqual(self.me().status_code, 200)

        # Login rotates the secret: missing and pre-login tokens both fail.
        for token in (None, old_token):
            response = self.post('auth-logout', {}, token)
            self.assertEqual(response.status_code, 403)
        token = self.csrf()
        response = self.client.patch(
            reverse('auth-me'), {'first_name': 'Updated'}, format='json',
            secure=True, HTTP_ORIGIN='https://testserver',
            HTTP_X_CSRFTOKEN=token,
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.post('auth-logout', {}, token).status_code, 200)
        self.assertEqual(self.me().status_code, 403)

    def test_profile_mutation_requires_csrf_and_trusted_origin(self):
        self.post('auth-login', self.credentials, self.csrf())
        token = self.csrf()
        for headers in ({}, {
            'HTTP_X_CSRFTOKEN': token, 'HTTP_ORIGIN': 'https://evil.example',
        }):
            response = self.client.patch(
                reverse('auth-me'), {'first_name': 'Attacker'}, format='json',
                secure=True, **headers,
            )
            self.assertEqual(response.status_code, 403)
        self.user.refresh_from_db()
        self.assertEqual(self.user.first_name, 'Session')

    def test_separate_trusted_frontend_can_bootstrap_and_login(self):
        origin = 'https://app.example.com'
        response = self.client.get(
            reverse('auth-csrf'), secure=True, HTTP_ORIGIN=origin,
        )
        self.assertEqual(response['Access-Control-Allow-Origin'], origin)
        self.assertEqual(response['Access-Control-Allow-Credentials'], 'true')
        response = self.post(
            'auth-login', self.credentials, response.data['csrfToken'], origin,
        )
        self.assertEqual(response.status_code, 200)

    def test_registration_issues_session_without_bearer_token(self):
        data = {
            **self.credentials, 'email': 'new-session@cit.edu',
            'first_name': 'New', 'last_name': 'User',
        }
        response = self.post('auth-register', data, self.csrf())
        self.assertEqual(response.status_code, 201)
        self.assertNotIn('token', response.data)
        self.assertIn(settings.SESSION_COOKIE_NAME, response.cookies)
        self.assertEqual(self.me().status_code, 200)

    def test_bearer_headers_cannot_authenticate(self):
        self.assertEqual(
            settings.REST_FRAMEWORK['DEFAULT_AUTHENTICATION_CLASSES'],
            ['rest_framework.authentication.SessionAuthentication'],
        )
        self.client.credentials(HTTP_AUTHORIZATION='Token legacy-token')
        self.assertEqual(self.me().status_code, 403)
