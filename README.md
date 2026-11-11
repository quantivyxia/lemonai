# InsightHub

Plataforma SaaS multi-tenant para Power BI Embedded com frontend React/Vite e backend Django/DRF.

## 1. Arquitetura

- `frontend/`: React 19 + TypeScript + Vite + Tailwind + shadcn/ui
- `backend/`: Django 5 + DRF + JWT + PostgreSQL/Supabase
- `Power BI`: integração por service principal e embed token
- `Autenticação`: JWT com refresh token e blacklist
- `Observabilidade`: logs estruturados, `request_id`, healthchecks e monitoramento administrativo

## 2. Estrutura principal

```text
frontend/
  src/
backend/
  apps/
  config/
.github/workflows/
```

Arquivos críticos para produção:

- `backend/config/settings/base.py`
- `backend/config/settings/prod.py`
- `backend/apps/common/middleware.py`
- `backend/apps/common/exceptions.py`
- `backend/apps/audit/services.py`
- `frontend/src/services/api-client.ts`
- `frontend/src/features/auth/context/auth-provider.tsx`
- `.github/workflows/main_lemonbi2.yml`
- `.github/workflows/azure-static-web-apps-ambitious-cliff-0ad8f490f.yml`

## 3. Como rodar localmente

### Backend

```powershell
cd backend
copy .env.example .env
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate --settings=config.settings.dev
python manage.py runserver --settings=config.settings.dev
```

### Frontend

```powershell
cd frontend
copy .env.example .env
npm install
npm run dev
```

## 4. Variáveis de ambiente obrigatórias

### Backend

Base:

- `DJANGO_SECRET_KEY`
- `DJANGO_DEBUG`
- `DJANGO_ALLOWED_HOSTS`
- `DJANGO_CORS_ALLOWED_ORIGINS`
- `DJANGO_CSRF_TRUSTED_ORIGINS`
- `DB_PROVIDER`

Banco PostgreSQL/Supabase:

- `POSTGRES_DB`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `POSTGRES_HOST`
- `POSTGRES_PORT`
- `POSTGRES_SSLMODE`

JWT e limites:

- `JWT_ACCESS_MINUTES`
- `JWT_REFRESH_DAYS`
- `API_THROTTLE_ANON`
- `API_THROTTLE_USER`
- `API_THROTTLE_AUTH`

Produção:

- `DJANGO_SECURE_SSL_REDIRECT`
- `DJANGO_SESSION_COOKIE_SECURE`
- `DJANGO_CSRF_COOKIE_SECURE`
- `DJANGO_SECURE_PROXY_SSL_HEADER`
- `DJANGO_SECURE_HSTS_SECONDS`
- `DJANGO_LOG_LEVEL`

Power BI:

- `POWERBI_TENANT_ID`
- `POWERBI_CLIENT_ID`
- `POWERBI_CLIENT_SECRET`
- `POWERBI_SCOPE`
- `POWERBI_DEFAULT_RLS_ROLE`
- `POWERBI_RLS_FALLBACK_ON_IDENTITY_ERROR=false`
- `INSIGHTHUB_ALLOW_DEMO_EMBED_FALLBACK=false`

### Frontend

- `VITE_API_BASE_URL`
- `VITE_API_TIMEOUT_MS`
- `VITE_LOG_LEVEL`

## 5. Build, lint e testes

### Backend

```powershell
cd backend
.venv\Scripts\python.exe manage.py check
.venv\Scripts\python.exe manage.py test
```

### Frontend

```powershell
cd frontend
npm run lint
npm run build
```

## 6. Endpoints operacionais

Healthchecks:

- `GET /api/health/`
- `GET /api/health/live/`
- `GET /api/health/ready/`
- `GET /api/health/summary/` (`super_admin`)

Monitoramento:

- `GET /api/audit/system-events/` (`super_admin`)
- `GET /monitoring` (`super_admin`)

Auth:

- `POST /api/authentication/login/`
- `POST /api/authentication/refresh/`
- `POST /api/authentication/logout/`
- `GET /api/authentication/me/`

## 7. Perfis e autorização

- `super_admin`: acesso global, monitoramento, edição de tenants, operações administrativas completas
- `analyst`: opera apenas o próprio tenant
- `viewer`: acesso somente leitura ao ambiente autorizado

Regras relevantes:

- proteção real no backend por tenant/perfil
- modo `Ver tela do usuario` somente leitura
- bloqueio de mutações em modo simulado
- listagens críticas autenticadas
- eventos administrativos auditados

## 8. Logging e observabilidade

Implementado:

- logs estruturados em JSON-like key/value
- `request_id` por requisição
- header `X-Request-ID`
- logs de autenticação, autorização, erro de integração e operações críticas
- `SystemEventLog` persistido no banco
- página administrativa de monitoramento no frontend

## 9. Deploy em produção no Azure

### Backend

Hospedagem recomendada:

- Azure App Service (Linux, Python 3.12)

Startup command:

```bash
gunicorn --bind=0.0.0.0 --timeout 600 --chdir backend config.wsgi
```

Configuração obrigatória no App Service:

- subir a branch de produção
- configurar todas as env vars do backend
- garantir `DJANGO_DEBUG=False`
- garantir `DJANGO_ALLOWED_HOSTS` com domínio final
- garantir `DJANGO_CORS_ALLOWED_ORIGINS` com domínio do frontend
- rodar migrations após deploy:

```bash
python manage.py migrate --settings=config.settings.prod
```

### Frontend

Hospedagem recomendada:

- Azure Static Web Apps

O workflow já está ajustado para Vite:

- `app_location: ./frontend`
- `output_location: dist`

Env vars mínimas:

- `VITE_API_BASE_URL=https://<seu-backend>/api`
- `VITE_API_TIMEOUT_MS=20000`
- `VITE_LOG_LEVEL=info`

## 10. Checklist de deploy

1. Preencher env vars de backend e frontend
2. Garantir `DJANGO_DEBUG=False`
3. Validar `DJANGO_ALLOWED_HOSTS`
4. Validar `DJANGO_CSRF_TRUSTED_ORIGINS`
5. Validar `DJANGO_CORS_ALLOWED_ORIGINS`
6. Executar `python manage.py migrate --settings=config.settings.prod`
7. Executar testes mínimos antes da publicação
8. Validar `/api/health/ready/`
9. Validar login, refresh, logout
10. Validar uma conta `super_admin`
11. Validar uma conta `analyst`
12. Validar embed Power BI com credencial real
13. Validar página `/monitoring`

## 11. Pendências conhecidas

- O frontend ainda possui warnings de hooks no lint. Não bloqueiam build, mas devem ser reduzidos gradualmente.
- O bundle principal do frontend está grande. Recomendado aplicar code splitting antes de aumento de tráfego.
- Ainda existe fluxo `seed_demo` no backend. É útil para demonstração local, mas não deve ser usado em produção.
- Há fallback de embed demo no backend para ambientes sem conexão Power BI. Em produção, use somente conexões reais.
- A API ainda não está versionada em `/api/v1`.

## 12. Recomendação operacional

Estado recomendado para produção inicial controlada:

- backend em App Service
- frontend em Static Web Apps
- banco PostgreSQL gerenciado
- observabilidade via `SystemEventLog` + logs do App Service
- acesso inicial controlado, com poucos tenants e operação assistida
