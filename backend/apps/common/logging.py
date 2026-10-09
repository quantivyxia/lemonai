from __future__ import annotations

import json
import logging
from collections.abc import Mapping
from typing import Any

from apps.common.request_context import get_request_id

SENSITIVE_KEYS = {
    'password',
    'token',
    'access',
    'refresh',
    'authorization',
    'client_secret',
    'secret',
    'api_key',
}


def mask_sensitive_data(value: Any):
    if isinstance(value, Mapping):
        masked = {}
        for key, item in value.items():
            if str(key).lower() in SENSITIVE_KEYS:
                masked[key] = '***'
            else:
                masked[key] = mask_sensitive_data(item)
        return masked
    if isinstance(value, list):
        return [mask_sensitive_data(item) for item in value]
    return value


class RequestIdFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = get_request_id()
        return True


class KeyValueFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        base = {
            'level': record.levelname,
            'logger': record.name,
            'request_id': getattr(record, 'request_id', '-'),
            'message': record.getMessage(),
        }

        extra_keys = [
            'method',
            'path',
            'status_code',
            'duration_ms',
            'user_id',
            'tenant_id',
            'event_category',
            'event_action',
        ]
        for key in extra_keys:
            value = getattr(record, key, None)
            if value not in (None, ''):
                base[key] = value

        if record.exc_info:
            base['exception'] = self.formatException(record.exc_info)

        return json.dumps(mask_sensitive_data(base), ensure_ascii=False)
