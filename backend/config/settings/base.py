from pathlib import Path
import os

from dotenv import load_dotenv
from datetime import timedelta
from corsheaders.defaults import default_headers

BASE_DIR = Path(__file__).resolve().parent.parent.parent
load_dotenv(BASE_DIR / '.env', override=True)

SECRET_KEY = os.getenv('DJANGO_SECRET_KEY', 'unsafe-secret-key')
DEBUG = os.getenv('DJANGO_DEBUG', 'False') == 'True'
ALLOWED_HOSTS = [host.strip() for host in os.getenv('DJANGO_ALLOWED_HOSTS', 'localhost').split(',') if host.strip()]

INSTALLED_APPS = [
    'corsheaders',
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'django.contrib.postgres',
    'rest_framework',
    'rest_framework_simplejwt',
    'django_filters',
    'drf_spectacular',
    'apps.common',
    'apps.authentication',
    'apps.users',
    'apps.tenants',
    'apps.dashboards',
    'apps.workspaces',
    'apps.permissions',
    'apps.audit',
    'apps.branding',
    'apps.powerbi',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'
ASGI_APPLICATION = 'config.asgi.application'

DB_PROVIDER = os.getenv('DB_PROVIDER', 'sqlite').lower()

if DB_PROVIDER == 'postgres':
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': os.getenv('POSTGRES_DB', 'insighthub'),
            'USER': os.getenv('POSTGRES_USER', 'postgres'),
            'PASSWORD': os.getenv('POSTGRES_PASSWORD', 'postgres'),
            'HOST': os.getenv('POSTGRES_HOST', 'localhost'),
            'PORT': os.getenv('POSTGRES_PORT', '5432'),
            'OPTIONS': {
                'sslmode': os.getenv('POSTGRES_SSLMODE', 'require'),
            },
        }
    }
elif DB_PROVIDER in ('mssql', 'fabric'):
    DATABASES = {
        'default': {
            'ENGINE': 'mssql',
            'NAME': os.getenv('MSSQL_DB_NAME', ''),
            'HOST': os.getenv('MSSQL_HOST', ''),
            'PORT': os.getenv('MSSQL_PORT', '1433'),
            'USER': os.getenv('MSSQL_USER', ''),
            'PASSWORD': os.getenv('MSSQL_PASSWORD', ''),
            'OPTIONS': {
                'driver': os.getenv('MSSQL_DRIVER', 'ODBC Driver 18 for SQL Server'),
                'extra_params': os.getenv(
                    'MSSQL_EXTRA_PARAMS',
                    'Encrypt=yes;TrustServerCertificate=no;Connection Timeout=30;',
                ),
            },
        }
    }
else:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / os.getenv('SQLITE_FILE', 'db.sqlite3'),
        }
    }

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator', 'OPTIONS': {'min_length': 6}},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

LANGUAGE_CODE = 'pt-br'
TIME_ZONE = 'America/Sao_Paulo'
USE_I18N = True
USE_TZ = True

STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
AUTH_USER_MODEL = 'users.User'

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'apps.authentication.auth.ViewAsJWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
    'DEFAULT_FILTER_BACKENDS': (
        'django_filters.rest_framework.DjangoFilterBackend',
        'rest_framework.filters.SearchFilter',
        'rest_framework.filters.OrderingFilter',
    ),
    'DEFAULT_PAGINATION_CLASS': 'apps.common.pagination.DefaultPageNumberPagination',
    'PAGE_SIZE': 20,
    'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
}

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=30),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': False,
}

SPECTACULAR_SETTINGS = {
    'TITLE': 'InsightHub API',
    'DESCRIPTION': 'Embedded BI multi-tenant API',
    'VERSION': '0.1.0',
}

CORS_ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv('DJANGO_CORS_ALLOWED_ORIGINS', 'http://localhost:5173,http://127.0.0.1:5173').split(',')
    if origin.strip()
]

CORS_ALLOW_HEADERS = list(default_headers) + [
    'x-insighthub-view-as-user',
]
