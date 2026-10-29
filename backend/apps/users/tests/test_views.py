from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from apps.users.models import User

class AuthViewSetTest(APITestCase):
    def setUp(self):
        self.user_data = {
            'email': 'testuser@cit.edu',
            'username': 'testuser',
            'first_name': 'Test',
            'last_name': 'User',
            'password': 'testpassword123'
        }
        self.user = User.objects.create_user(**self.user_data)
        
        # We also need an admin user for admin-only endpoints
        self.admin = User.objects.create_superuser(
            email='admin@cit.edu',
            username='admin',
            password='adminpassword123'
        )

    def test_login_successful(self):
        url = reverse('auth-login')
        data = {'email': self.user_data['email'], 'password': self.user_data['password']}
        response = self.client.post(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['message'], 'Login successful')
        self.assertEqual(response.data['user']['email'], self.user_data['email'])

    def test_login_failed_wrong_password(self):
        url = reverse('auth-login')
        data = {'email': self.user_data['email'], 'password': 'wrongpassword'}
        response = self.client.post(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['message'], 'Login failed')

    def test_register_successful(self):
        url = reverse('auth-register')
        data = {
            'email': 'newuser@cit.edu',
            'username': 'newuser',
            'first_name': 'New',
            'last_name': 'User',
            'password': 'newpassword123'
        }
        response = self.client.post(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['message'], 'Registration successful')
        self.assertEqual(response.data['user']['email'], data['email'])

    def test_me_endpoint(self):
        url = reverse('auth-me')
        self.client.force_authenticate(user=self.user)
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['email'], self.user.email)

    def test_me_endpoint_unauthenticated(self):
        url = reverse('auth-me')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
