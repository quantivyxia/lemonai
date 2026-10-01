"""Tenant-scoped delivery of the Cultura Inglesa dashboard's original dataset."""

from django.conf import settings
from django.shortcuts import get_object_or_404
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.common.services import get_effective_user, is_super_admin, safe_related
from apps.dashboards.models import PythonDashboardDataset


def can_view_cultura_dashboard(user):
    active_user = (
        getattr(user, 'is_authenticated', False)
        and getattr(user, 'is_active', False)
        and getattr(user, 'status', None) == 'active'
    )
    if not active_user:
        return False
    if is_super_admin(user):
        return True
    tenant = safe_related(user, 'tenant')
    return bool(
        tenant
        and tenant.status == 'active'
        and str(tenant.pk) == settings.CULTURA_INGLESA_TENANT_ID
    )


def load_cultura_dataset():
    return get_object_or_404(
        PythonDashboardDataset, tenant_id=settings.CULTURA_INGLESA_TENANT_ID,
    ).data


class PrivateDashboardView(APIView):
    permission_classes = [IsAuthenticated]

    def finalize_response(self, request, response, *args, **kwargs):
        response = super().finalize_response(request, response, *args, **kwargs)
        response['Cache-Control'] = 'private, no-store'
        return response


class PythonDashboardAvailabilityView(PrivateDashboardView):
    def get(self, request):
        return Response({'available': can_view_cultura_dashboard(get_effective_user(request))})


class CulturaDashboardDataView(PrivateDashboardView):
    def get(self, request):
        if not can_view_cultura_dashboard(get_effective_user(request)):
            raise PermissionDenied('Dashboard indisponivel para este usuario.')
        return Response(load_cultura_dataset())
