from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from django.utils import timezone
from apps.evaluations.models import EvaluationForm
from apps.organizations.models import Organization, OrganizationRole
from apps.users.models import User

class EvaluationViewSetTest(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(email='admin@cit.edu', username='admin', password='password')
        self.client.force_authenticate(user=self.user)
        
        self.org = Organization.objects.create(
            name='Test Org', code='ORG1', period_year_start=timezone.now().date(), is_active=True
        )
        OrganizationRole.objects.create(user=self.user, organization=self.org, role='Admin')
        self.client.credentials(HTTP_X_ORGANIZATION_ID=str(self.org.pk))
        
        self.form = EvaluationForm.objects.create(
            organization_id=self.org,
            title='Midterm Evaluation',
            start_date=timezone.now().date(),
            end_date=timezone.now().date() + timezone.timedelta(days=7),
            created_by=self.user
        )

    def test_list_forms(self):
        url = reverse('forms-list') 
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Handle paginated or unpaginated
        results = response.data.get('results', response.data) if isinstance(response.data, dict) else response.data
        self.assertTrue(len(results) > 0)
        self.assertEqual(results[0]['title'], 'Midterm Evaluation')

    def test_create_question(self):
        url = reverse('questions-list')
        data = {
            'form_id': self.form.id,
            'text': 'How collaborative is this person?',
            'input_type': 'rating',
            'order': 1,
            'weight': 1.0,
            'is_required': True
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['text'], 'How collaborative is this person?')
