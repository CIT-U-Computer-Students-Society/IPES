from django.test import TestCase, override_settings
from django.urls import reverse


@override_settings(ALLOWED_HOSTS=['testserver'])
class SecurityHeadersTests(TestCase):
    def test_csp_is_enforced_on_html_and_api_responses(self):
        for url in ('/admin/login/', reverse('auth-csrf')):
            with self.subTest(url=url):
                response = self.client.get(url)
                self.assertEqual(response.status_code, 200)
                policy = response['Content-Security-Policy']
                scripts = next(
                    d for d in policy.split('; ')
                    if d.startswith('script-src ')
                )
                self.assertNotIn("'unsafe-inline'", scripts)
                self.assertNotIn("'unsafe-eval'", scripts)
                self.assertIn("object-src 'none'", policy)
                self.assertIn("base-uri 'none'", policy)
                self.assertIn("frame-ancestors 'none'", policy)
                self.assertEqual(response['X-Content-Type-Options'], 'nosniff')
