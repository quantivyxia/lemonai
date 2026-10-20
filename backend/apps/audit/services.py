from __future__ import annotations

from typing import Any

from apps.audit.models import AccessLog, SystemEventLog
from apps.common.logging import mask_sensitive_data
from apps.common.request_context import get_request_id


def _safe_related_instance(instance):
    if instance is None:
        return None
    if getattr(instance, 'is_authenticated', True):
        return instance
    return None


def _request_meta(request):
    if not request:
        return {
            'endpoint': '',
            'method': '',
            'ip_address': None,
            'request_id': get_request_id(),
        }

    forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR', '')
    ip_address = forwarded_for.split(',')[0].strip() if forwarded_for else request.META.get('REMOTE_ADDR')
    return {
        'endpoint': request.path,
        'method': request.method,
        'ip_address': ip_address or None,
        'request_id': getattr(request, 'request_id', '') or get_request_id(),
    }


def log_dashboard_access(*, user, tenant, dashboard, ip_address, status, origin='portal', details=''):
    return AccessLog.objects.create(
        user=user,
        tenant=tenant,
        dashboard=dashboard,
        ip_address=ip_address,
        status=status,
        origin=origin,
        details=details,
    )


def create_system_event(
    *,
    level: str,
    category: str,
    action: str,
    message: str,
    request=None,
    user=None,
    tenant=None,
    resource_type: str = '',
    resource_id: str = '',
    status_code: int | None = None,
    metadata: dict[str, Any] | None = None,
):
    request_data = _request_meta(request)
    return SystemEventLog.objects.create(
        user=_safe_related_instance(user),
        tenant=_safe_related_instance(tenant),
        level=level,
        category=category,
        action=action,
        message=message,
        resource_type=resource_type,
        resource_id=resource_id,
        endpoint=request_data['endpoint'],
        method=request_data['method'],
        request_id=request_data['request_id'],
        ip_address=request_data['ip_address'],
        status_code=status_code,
        metadata=mask_sensitive_data(metadata or {}),
    )
