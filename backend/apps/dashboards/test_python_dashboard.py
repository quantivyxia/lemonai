from unittest.mock import patch

from django.conf import settings
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from apps.dashboards.python_dashboard import load_cultura_dataset
from apps.dashboards.models import PythonDashboardDataset
from apps.permissions.models import Role
from apps.tenants.models import Tenant
from apps.users.models import User


class CulturaDashboardAccessTests(APITestCase):
    availability_url = '/api/dashboards/python/'
    data_url = '/api/dashboards/python/cultura-inglesa/'

    def setUp(self):
        self.cultura = Tenant.objects.create(id=settings.CULTURA_INGLESA_TENANT_ID, name='Cultura Inglesa')
        self.other = Tenant.objects.create(name='Outra empresa')
        PythonDashboardDataset.objects.create(
            tenant=self.cultura,
            data={'EMBEDDED_ROWS': [[0, 0, 0, 0, 0, 100]], 'EMBEDDED_META': {'origem': 'synthetic-test.csv'}},
        )
        self.viewer_role = Role.objects.create(code='viewer', name='Usuario')
        self.analyst_role = Role.objects.create(code='analyst', name='Analista')
        self.owner_role = Role.objects.create(code='super_admin', name='Dono')
        self.viewer = self.make_user('viewer', self.cultura, self.viewer_role)
        self.analyst = self.make_user('analyst', self.cultura, self.analyst_role)
        self.other_user = self.make_user('other', self.other, self.analyst_role)
        self.owner = self.make_user('owner', None, self.owner_role, is_superuser=True)

    def make_user(self, name, tenant, role, **extra):
        return User.objects.create_user(
            email=f'{name}@example.test', password='Test-password-123',
            tenant=tenant, role=role, status='active', **extra,
        )

    def assert_denied_without_loading_data(self, user=None, url=None):
        self.client.force_authenticate(user=user)
        with patch('apps.dashboards.python_dashboard.load_cultura_dataset') as loader:
            response = self.client.get(url or self.data_url)
        self.assertIn(response.status_code, (401, 403))
        self.assertEqual(response['Cache-Control'], 'private, no-store')
        loader.assert_not_called()

    def test_anonymous_cannot_access_data_or_availability(self):
        self.assert_denied_without_loading_data()
        self.assert_denied_without_loading_data(url=self.availability_url)

    def test_other_tenant_cannot_access_even_with_target_tenant_parameter(self):
        self.assert_denied_without_loading_data(self.other_user, f'{self.data_url}?tenant_id={self.cultura.pk}')
        self.assertEqual(self.client.get(self.availability_url).data, {'available': False})

    def test_global_owner_can_access_without_tenant_or_superuser_flag(self):
        for superuser in (True, False):
            self.owner.is_superuser = superuser
            self.owner.save()
            self.client.force_authenticate(user=self.owner)
            self.assertEqual(self.client.get(self.availability_url).data, {'available': True})
            response = self.client.get(self.data_url)
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.data, load_cultura_dataset())

    def test_inactive_owner_cannot_access(self):
        self.owner.status = 'inactive'
        self.owner.is_active = False
        self.owner.save()
        self.assert_denied_without_loading_data(self.owner)

    def test_missing_dataset_has_no_public_fallback(self):
        PythonDashboardDataset.objects.all().delete()
        self.client.force_authenticate(user=self.owner)
        self.assertEqual(self.client.get(self.data_url).status_code, 404)

    def test_cultura_viewer_and_analyst_can_access_original_data(self):
        for user in (self.viewer, self.analyst):
            with self.subTest(role=user.role.code):
                self.client.force_authenticate(user=user)
                self.assertEqual(self.client.get(self.availability_url).data, {'available': True})
                response = self.client.get(self.data_url)
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response['Cache-Control'], 'private, no-store')
                self.assertEqual(response.data, load_cultura_dataset())
                self.assertGreater(len(response.data['EMBEDDED_ROWS']), 0)

    def test_tenant_rename_does_not_transfer_access(self):
        self.cultura.name = 'Cultura Inglesa Renomeada'
        self.cultura.save()
        self.other.name = 'Cultura Inglesa'
        self.other.save()
        self.assert_denied_without_loading_data(self.other_user)
        self.client.force_authenticate(user=self.viewer)
        self.assertEqual(self.client.get(self.data_url).status_code, 200)

    def test_inactive_or_suspended_tenant_is_denied(self):
        for status in ('inactive', 'suspended'):
            self.cultura.status = status
            self.cultura.save()
            self.assert_denied_without_loading_data(self.viewer)

    def test_inactive_user_is_denied(self):
        self.viewer.status = 'inactive'
        self.viewer.is_active = False
        self.viewer.save()
        self.assert_denied_without_loading_data(self.viewer)

    def test_view_as_uses_effective_tenant_and_does_not_leak_on_switch(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {RefreshToken.for_user(self.owner).access_token}')
        response = self.client.get(self.data_url, HTTP_X_INSIGHTHUB_VIEW_AS_USER=str(self.viewer.pk))
        self.assertEqual(response.status_code, 200)
        response = self.client.get(self.data_url, HTTP_X_INSIGHTHUB_VIEW_AS_USER=str(self.other_user.pk))
        self.assertEqual(response.status_code, 403)
        self.assertNotIn('EMBEDDED_ROWS', response.data)

    def test_other_tenant_analyst_cannot_impersonate_cultura_user(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {RefreshToken.for_user(self.other_user).access_token}')
        with patch('apps.dashboards.python_dashboard.load_cultura_dataset') as loader:
            response = self.client.get(self.data_url, HTTP_X_INSIGHTHUB_VIEW_AS_USER=str(self.viewer.pk))
        self.assertEqual(response.status_code, 403)
        loader.assert_not_called()

class BaianaDashboardAccessTests(CulturaDashboardAccessTests):
    baiana_url = '/api/dashboards/python/faculdade-baiana/'
    catalog_url = '/api/dashboards/python/catalog/'

    def setUp(self):
        super().setUp()
        from apps.dashboards.python_dashboard import FACULDADE_BAIANA_TENANT_ID
        self.baiana = Tenant.objects.create(id=FACULDADE_BAIANA_TENANT_ID, name='Faculdade Baiana')
        self.baiana_user = self.make_user('baiana', self.baiana, self.viewer_role)
        PythonDashboardDataset.objects.create(tenant=self.baiana, data={'__faculdade_baiana_html': '<h1>Private panel</h1>'})

    def test_baiana_catalog_and_data_are_scoped(self):
        for user, ids in [(self.owner, ['cultura-inglesa', 'faculdade-baiana']),
                          (self.viewer, ['cultura-inglesa']), (self.baiana_user, ['faculdade-baiana']),
                          (self.other_user, [])]:
            self.client.force_authenticate(user=user)
            response = self.client.get(self.catalog_url)
            self.assertEqual([d['id'] for d in response.data['dashboards']], ids)
            self.assertEqual(response['Cache-Control'], 'private, no-store')
            response = self.client.get(self.baiana_url)
            self.assertEqual(response.status_code, 200 if user in (self.owner, self.baiana_user) else 403)
            self.assertEqual(response['Cache-Control'], 'private, no-store')
        self.assertEqual(self.client.get(self.baiana_url+'?tenant_id='+str(self.baiana.id)).status_code, 403)
        self.client.force_authenticate(user=self.baiana_user)
        self.assertEqual(self.client.get(self.data_url).status_code, 403)
        self.assertEqual(self.client.get(self.baiana_url).data['html'], '<h1>Private panel</h1>')

    def test_baiana_inactive_and_anonymous_denied(self):
        for url in (self.baiana_url, self.catalog_url):
            self.assert_denied_without_loading_data(url=url)
        for user in (self.baiana_user, self.owner):
            user.status = 'inactive'
            user.save()
            self.client.force_authenticate(user=user)
            self.assertEqual(self.client.get(self.baiana_url).status_code, 403)
            self.assertEqual(self.client.get(self.catalog_url).data['dashboards'], [])
        self.baiana_user.status = 'active'
        self.baiana_user.save()
        self.baiana.status = 'suspended'
        self.baiana.save()
        self.client.force_authenticate(user=self.baiana_user)
        self.assertEqual(self.client.get(self.baiana_url).status_code, 403)

    def test_baiana_impersonation_and_missing_data(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {RefreshToken.for_user(self.owner).access_token}')
        for user, expected in ((self.baiana_user, 200), (self.viewer, 403), (self.other_user, 403)):
            response = self.client.get(self.baiana_url, HTTP_X_INSIGHTHUB_VIEW_AS_USER=str(user.pk))
            self.assertEqual(response.status_code, expected)
        PythonDashboardDataset.objects.filter(tenant=self.baiana).delete()
        self.client.force_authenticate(user=self.baiana_user)
        self.assertEqual(self.client.get(self.baiana_url).status_code, 404)
