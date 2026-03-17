from __future__ import annotations

import os
import time
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

import requests
from django.utils import timezone as django_timezone

from apps.powerbi.models import (
    DataSourceStatus,
    GatewayStatus,
    PowerBIConnection,
    PowerBIGateway,
    PowerBIGatewayDataSource,
)


class PowerBIServiceError(Exception):
    pass


@dataclass
class AccessToken:
    token: str
    expires_at: datetime


class PowerBIClient:
    def __init__(self, connection: PowerBIConnection):
        self.connection = connection
        self.aad_tenant_id = connection.aad_tenant_id
        self.client_id = connection.client_id
        self.client_secret = connection.client_secret
        self.scope = connection.scope
        self.api_base_url = connection.api_base_url.rstrip('/')
        self.timeout_seconds = 30
        self._token: AccessToken | None = None

    def _token_endpoint(self):
        return f'https://login.microsoftonline.com/{self.aad_tenant_id}/oauth2/v2.0/token'

    def _parse_error(self, response: requests.Response) -> str:
        fallback = f'Power BI API retornou erro {response.status_code}.'
        try:
            payload = response.json()
        except ValueError:
            return fallback

        error = payload.get('error')
        if isinstance(error, dict):
            code = str(error.get('code') or '').strip()
            message = str(error.get('message') or '').strip()
            if code == 'PowerBINotAuthorizedException':
                return (
                    'Power BI sem autorizacao para esse workspace. '
                    'Verifique se a service principal foi adicionada ao workspace e '
                    'se o default workspace ID esta correto para esse tenant.'
                )
            if code == 'PowerBIEntityNotFound':
                return (
                    'Report/dataset nao encontrado no workspace informado. '
                    'Sincronize os reports novamente ou valide workspace/report_id/dataset_id.'
                )
            return message or code or fallback
        if isinstance(error, str):
            if error.strip() == 'PowerBINotAuthorizedException':
                return (
                    'Power BI sem autorizacao para esse workspace. '
                    'Verifique se a service principal foi adicionada ao workspace e '
                    'se o default workspace ID esta correto para esse tenant.'
                )
            return error
        return fallback

    def get_access_token(self) -> AccessToken:
        now = datetime.now(timezone.utc)
        if self._token and self._token.expires_at > now + timedelta(minutes=2):
            return self._token

        payload = {
            'client_id': self.client_id,
            'client_secret': self.client_secret,
            'scope': self.scope,
            'grant_type': 'client_credentials',
        }
        response = requests.post(self._token_endpoint(), data=payload, timeout=self.timeout_seconds)
        if response.status_code >= 400:
            raise PowerBIServiceError(self._parse_error(response))

        data = response.json()
        access_token = data.get('access_token')
        if not access_token:
            raise PowerBIServiceError('Nao foi possivel obter access token do Azure AD.')

        expires_in = int(data.get('expires_in', 3600))
        token = AccessToken(
            token=access_token,
            expires_at=now + timedelta(seconds=expires_in),
        )
        self._token = token
        return token

    def _request(self, method: str, path: str, params: dict | None = None, payload: dict | None = None):
        token = self.get_access_token()
        url = path if path.startswith('http') else f'{self.api_base_url}/{path.lstrip("/")}'
        headers = {
            'Authorization': f'Bearer {token.token}',
            'Content-Type': 'application/json',
        }
        response = requests.request(
            method=method.upper(),
            url=url,
            headers=headers,
            params=params,
            json=payload,
            timeout=self.timeout_seconds,
        )
        if response.status_code >= 400:
            raise PowerBIServiceError(self._parse_error(response))

        if response.status_code == 204 or not response.text:
            return {}
        return response.json()

    def list_workspaces(self):
        data = self._request('GET', 'groups')
        return data.get('value', [])

    def list_reports(self, workspace_id: str):
        data = self._request('GET', f'groups/{workspace_id}/reports')
        return data.get('value', [])

    def import_pbix(
        self,
        workspace_id: str,
        pbix_file,
        dataset_display_name: str,
        name_conflict: str = 'CreateOrOverwrite',
    ):
        token = self.get_access_token()
        url = f'{self.api_base_url}/groups/{workspace_id}/imports'
        headers = {
            'Authorization': f'Bearer {token.token}',
        }
        params = {
            'datasetDisplayName': dataset_display_name,
            'nameConflict': name_conflict,
        }
        filename = getattr(pbix_file, 'name', 'upload.pbix')
        if hasattr(pbix_file, 'seek'):
            pbix_file.seek(0)
        files = {
            'file': (filename, pbix_file, 'application/octet-stream'),
        }
        upload_timeout = max(self.timeout_seconds, int(os.getenv('POWERBI_UPLOAD_TIMEOUT_SECONDS', '300')))
        response = requests.post(
            url=url,
            headers=headers,
            params=params,
            files=files,
            timeout=upload_timeout,
        )
        if response.status_code >= 400:
            raise PowerBIServiceError(self._parse_error(response))
        if not response.text:
            return {}
        return response.json()

    def get_import(self, workspace_id: str, import_id: str):
        return self._request('GET', f'groups/{workspace_id}/imports/{import_id}')

    def wait_for_import(
        self,
        workspace_id: str,
        import_id: str,
        timeout_seconds: int | None = None,
        poll_interval_seconds: int | None = None,
    ):
        wait_timeout = timeout_seconds or int(os.getenv('POWERBI_IMPORT_WAIT_TIMEOUT_SECONDS', '180'))
        poll_interval = poll_interval_seconds or int(os.getenv('POWERBI_IMPORT_POLL_INTERVAL_SECONDS', '2'))
        deadline = time.monotonic() + max(wait_timeout, 1)

        while time.monotonic() <= deadline:
            payload = self.get_import(workspace_id, import_id)
            state = str(payload.get('importState', '')).strip().lower()
            if state == 'succeeded':
                return payload
            if state == 'failed':
                error = payload.get('error') or {}
                if isinstance(error, dict):
                    message = error.get('message') or error.get('code') or 'sem detalhes.'
                else:
                    message = str(error) if error else 'sem detalhes.'
                raise PowerBIServiceError(f'Importacao PBIX falhou: {message}')
            time.sleep(max(poll_interval, 1))

        raise PowerBIServiceError(
            'Tempo limite excedido aguardando conclusao da importacao do PBIX. '
            'Verifique o status no Power BI Service.',
        )

    def list_datasets(self, workspace_id: str):
        data = self._request('GET', f'groups/{workspace_id}/datasets')
        return data.get('value', [])

    def get_report(self, workspace_id: str, report_id: str):
        return self._request('GET', f'groups/{workspace_id}/reports/{report_id}')

    def generate_embed_token(
        self,
        workspace_id: str,
        report_id: str,
        dataset_id: str,
        user,
        rls_context,
        rls_payload: dict | None = None,
        rls_roles: list[str] | None = None,
    ):
        payload = {'accessLevel': 'View'}
        role_list = [role for role in (rls_roles or []) if isinstance(role, str) and role.strip()]
        should_send_identity = bool(dataset_id and (rls_context or role_list))
        if should_send_identity:
            identity: dict[str, object] = {
                'username': getattr(user, 'email', 'embed@insighthub.local'),
                'datasets': [dataset_id],
            }

            if role_list:
                identity['roles'] = role_list

            if rls_payload:
                custom_data = str(rls_payload.get('tokenString') or '')
                max_chars = int(os.getenv('POWERBI_RLS_CUSTOM_DATA_MAX_CHARS', '3500'))
                if custom_data and len(custom_data) > max_chars:
                    raise PowerBIServiceError(
                        f'Payload RLS excedeu {max_chars} caracteres em customData. '
                        'Reduza valores de regras ou aumente POWERBI_RLS_CUSTOM_DATA_MAX_CHARS.'
                    )
                if custom_data:
                    identity['customData'] = custom_data

            payload['identities'] = [
                identity
            ]

        try:
            data = self._request(
                'POST',
                f'groups/{workspace_id}/reports/{report_id}/GenerateToken',
                payload=payload,
            )
        except PowerBIServiceError as exc:
            message = str(exc).lower()
            if should_send_identity and 'effective identity' in message:
                raise PowerBIServiceError(
                    'Falha de RLS no embed token: effective identity rejeitada pelo dataset/report. '
                    'Verifique role do Power BI, permissao da service principal e regra DAX.'
                )
            raise

        token = data.get('token')
        if not token:
            raise PowerBIServiceError('Power BI nao retornou token de embed.')

        expiration_raw = data.get('expiration')
        try:
            expiration = datetime.fromisoformat(expiration_raw.replace('Z', '+00:00')) if expiration_raw else None
        except ValueError:
            expiration = None
        if expiration is None:
            expiration = datetime.now(timezone.utc) + timedelta(minutes=30)

        return {
            'token': token,
            'expiration': expiration,
        }

    def list_gateways(self):
        data = self._request('GET', 'gateways')
        return data.get('value', [])

    def list_gateway_datasources(self, gateway_id: str):
        data = self._request('GET', f'gateways/{gateway_id}/datasources')
        return data.get('value', [])

    def bind_dataset_to_gateway(self, dataset_id: str, gateway_id: str, datasource_ids: list[str] | None = None):
        payload = {'gatewayObjectId': gateway_id}
        if datasource_ids:
            payload['datasourceObjectIds'] = datasource_ids
        self._request('POST', f'datasets/{dataset_id}/Default.BindToGateway', payload=payload)
        return {'datasetId': dataset_id, 'gatewayId': gateway_id, 'datasourceIds': datasource_ids or []}


def sync_gateways_for_tenant(connection: PowerBIConnection) -> dict:
    client = PowerBIClient(connection)
    gateways = client.list_gateways()
    synced_gateway_ids = []
    synced_datasource_ids = 0

    for gateway_data in gateways:
        gateway, _ = PowerBIGateway.objects.update_or_create(
            tenant=connection.tenant,
            external_gateway_id=str(gateway_data.get('id', '')),
            defaults={
                'connection': connection,
                'name': gateway_data.get('name') or 'Gateway sem nome',
                'gateway_type': gateway_data.get('type', ''),
                'status': GatewayStatus.ACTIVE,
                'last_sync_at': django_timezone.now(),
            },
        )
        synced_gateway_ids.append(gateway.id)

        datasources = client.list_gateway_datasources(gateway.external_gateway_id)
        for datasource in datasources:
            PowerBIGatewayDataSource.objects.update_or_create(
                gateway=gateway,
                external_datasource_id=str(datasource.get('datasourceId', '')),
                defaults={
                    'name': datasource.get('datasourceName') or 'Datasource sem nome',
                    'datasource_type': datasource.get('datasourceType', ''),
                    'connection_details': datasource.get('connectionDetails') or {},
                    'status': DataSourceStatus.ACTIVE,
                },
            )
            synced_datasource_ids += 1

    connection.last_sync_at = django_timezone.now()
    connection.last_error = ''
    connection.save(update_fields=['last_sync_at', 'last_error', 'updated_at'])

    return {
        'gatewaysSynced': len(synced_gateway_ids),
        'datasourcesSynced': synced_datasource_ids,
    }
