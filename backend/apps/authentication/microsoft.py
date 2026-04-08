"""
Microsoft OAuth 2.0 integration for LemonAI login.
Uses Authorization Code flow with PKCE targeting /common (multi-tenant).
"""
from __future__ import annotations

import logging
import urllib.parse

import requests
from django.conf import settings
from django.core import signing

logger = logging.getLogger('insighthub.api')

AUTHORITY = 'https://login.microsoftonline.com/common/oauth2/v2.0'
GRAPH_ME_URL = 'https://graph.microsoft.com/v1.0/me'
SCOPES = 'openid profile email User.Read'
STATE_SALT = 'ms-oauth-state'
PROFILE_SALT = 'ms-profile'
PROFILE_MAX_AGE = 600  # 10 minutes


def build_auth_url(redirect_uri: str) -> tuple[str, str]:
    """Return (auth_url, state). State is a signed value to prevent CSRF."""
    state = signing.dumps({'ok': True}, salt=STATE_SALT)
    params = {
        'client_id': settings.MICROSOFT_CLIENT_ID,
        'response_type': 'code',
        'redirect_uri': redirect_uri,
        'response_mode': 'query',
        'scope': SCOPES,
        'state': state,
        'prompt': 'select_account',
    }
    url = f'{AUTHORITY}/authorize?' + urllib.parse.urlencode(params)
    return url, state


def validate_state(state: str) -> bool:
    try:
        signing.loads(state, salt=STATE_SALT, max_age=300)
        return True
    except signing.BadSignature:
        return False


def exchange_code_for_profile(code: str, redirect_uri: str) -> dict:
    """Exchange auth code for an access token and fetch the user profile."""
    token_resp = requests.post(
        f'{AUTHORITY}/token',
        data={
            'client_id': settings.MICROSOFT_CLIENT_ID,
            'client_secret': settings.MICROSOFT_CLIENT_SECRET,
            'grant_type': 'authorization_code',
            'code': code,
            'redirect_uri': redirect_uri,
            'scope': SCOPES,
        },
        timeout=15,
    )
    token_resp.raise_for_status()
    access_token = token_resp.json().get('access_token')

    profile_resp = requests.get(
        GRAPH_ME_URL,
        headers={'Authorization': f'Bearer {access_token}'},
        timeout=10,
    )
    profile_resp.raise_for_status()
    return profile_resp.json()


def sign_profile(profile: dict) -> str:
    """Create a short-lived signed token carrying the MS profile for the join flow."""
    payload = {
        'email': profile.get('mail') or profile.get('userPrincipalName', ''),
        'first_name': profile.get('givenName', ''),
        'last_name': profile.get('surname', ''),
        'avatar_url': '',
    }
    return signing.dumps(payload, salt=PROFILE_SALT)


def load_profile(token: str) -> dict:
    """Decode and verify the signed profile token (raises SignatureExpired / BadSignature)."""
    return signing.loads(token, salt=PROFILE_SALT, max_age=PROFILE_MAX_AGE)
