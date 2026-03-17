# InsightHub Backend (Django + DRF)

Backend multi-tenant para plataforma de BI Embedded com:
- JWT authentication
- RBAC (`Dono`, `Analista`, `Usuario`)
- Controle de acesso por dashboard
- Regras de RLS por usuario/dashboard
- Auditoria de acesso
- White-label por tenant
- Integracao real com Power BI Embedded (service principal)

## 1) Pre-requisitos
- Python 3.12+
- Banco SQL (`sqlite`, `postgres` ou `mssql`)

## 2) Configuracao
```bash
cp .env.example .env
```

Preencha `.env`:
- `DJANGO_SECRET_KEY`
- `DJANGO_CORS_ALLOWED_ORIGINS`
- `DB_PROVIDER` (`sqlite`, `postgres` ou `mssql`)

### Opcao A (rapida para demo): SQLite
- `DB_PROVIDER=sqlite`
- `SQLITE_FILE=db.sqlite3`

### Opcao B (Supabase / Postgres)
- `DB_PROVIDER=postgres`
- `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_HOST`, `POSTGRES_PORT`

### Opcao C (Fabric Warehouse / SQL endpoint)
- `DB_PROVIDER=mssql`
- `MSSQL_HOST`
- `MSSQL_DB_NAME`
- `MSSQL_USER`
- `MSSQL_PASSWORD`
- `MSSQL_PORT` (default `1433`)

### Power BI Embedded / RLS
- `POWERBI_TENANT_ID`
- `POWERBI_CLIENT_ID`
- `POWERBI_CLIENT_SECRET`
- `POWERBI_SCOPE` (default: `https://analysis.windows.net/powerbi/api/.default`)
- `POWERBI_DEFAULT_RLS_ROLE` (default: `InsightHubRLS`)
- `POWERBI_RLS_ROLES` (opcional, lista separada por virgula para forcar roles)
- `POWERBI_RLS_CUSTOM_DATA_MAX_CHARS` (default: `3500`)

### Politica de isolamento Power BI por tenant
- Cada tenant possui **1 conexao exclusiva** (`PowerBIConnection` 1:1 com `Tenant`).
- O mesmo `Client ID` nao pode ser reutilizado em tenants diferentes.
- Gateways/datasources devem sempre pertencer ao mesmo tenant da conexao.

## 3) Instalacao e execucao
```bash
pip install -r requirements.txt
python manage.py makemigrations
python manage.py migrate
python manage.py seed_demo
python manage.py runserver
```

API docs:
- `http://localhost:8000/api/docs/`

## 4) Endpoints principais
- `POST /api/authentication/login/`
- `POST /api/authentication/refresh/`
- `GET /api/authentication/me/`
- `GET|POST|PATCH /api/tenants/`
- `GET|POST|PATCH /api/users/`
- `GET|POST|PATCH /api/users/groups/`
- `GET|POST|PATCH /api/workspaces/`
- `GET|POST|PATCH /api/dashboards/`
- `GET /api/dashboards/{id}/embed-config/`
- `POST /api/dashboards/{id}/publish/`
- `GET|POST|PATCH /api/powerbi/connections/`
- `POST /api/powerbi/connections/{id}/test-connection/`
- `POST /api/powerbi/connections/{id}/sync-workspaces/`
- `POST /api/powerbi/connections/{id}/sync-reports/`
- `POST /api/powerbi/connections/{id}/sync-gateways/`
- `POST /api/powerbi/connections/{id}/bind-dataset-gateway/`
- `GET|POST|PATCH /api/powerbi/gateways/`
- `POST /api/powerbi/gateways/{id}/sync-datasources/`
- `GET|POST|PATCH /api/powerbi/datasources/`
- `GET|POST|PATCH /api/permissions/dashboard-access/`
- `GET|POST|PATCH /api/permissions/rls-rules/`
- `POST /api/permissions/rls-rules/{id}/toggle/`
- `POST /api/permissions/rls-rules/{id}/duplicate/`
- `GET /api/audit/logs/`
- `GET|POST|PATCH /api/branding/`

## 5) Seed demo (login)
- Dono: `dono@insighthub.com` / `123456`
- Analista Nexa: `analista@nexa.com` / `123456`
- Usuario Nexa: `usuario@nexa.com` / `123456`
- Analista Solaris: `analista@solaris.com` / `123456`
- Usuario Solaris: `usuario@solaris.com` / `123456`

## 6) Como o RLS foi aplicado no embed token
Ao chamar `GET /api/dashboards/{id}/embed-config/`:

1. O backend valida tenant + acesso ao dashboard.
2. Busca regras RLS ativas (`allow`/`deny`) do usuario para aquele dashboard.
3. Monta `effective identity` com:
   - `username` = email do usuario
   - `datasets` = dataset do report
   - `roles` = role(s) de RLS configuradas
   - `customData` = string tokenizada com `NO_TABLE`, `NO_COLUMN`, `NO_OP`, `NO_VALUES`
4. Chama `GenerateToken` da API do Power BI.
5. Tambem retorna `reportFilters` para o frontend aplicar em nivel de relatorio
   (equivalente a "Filtros em todas as paginas").

Se o Power BI recusar `effective identity`, a API retorna erro claro (sem fallback inseguro).

## 7) Padrao NO_TABLE / NO_COLUMN / NO_OP / NO_VALUES
Campos persistidos por regra:
- `table_name` => NO_TABLE
- `column_name` => NO_COLUMN
- `operator` (`in` / `not_in`) => NO_OP
- `values` => NO_VALUES

## 8) Padrao DAX para CUSTOMDATA (allow/deny)
O backend envia `customData` no formato:
`v1|uid:<id>|tid:<id>|did:<id>|a:<tabela>:<coluna>:<valor>|d:<tabela>:<coluna>:<valor>`

Exemplo de regra DAX para `NO_TABLE=Obras` e `NO_COLUMN=CTT_DESC01`:

```DAX
VAR _cd = "|" & LOWER(CUSTOMDATA()) & "|"
VAR _value = LOWER(TRIM('Obras'[CTT_DESC01]))
VAR _allowToken = "|a:obras:ctt_desc01:" & _value & "|"
VAR _denyToken = "|d:obras:ctt_desc01:" & _value & "|"
VAR _hasAllowForColumn = CONTAINSSTRING(_cd, "|a:obras:ctt_desc01:")
RETURN
IF(
    CONTAINSSTRING(_cd, _denyToken),
    FALSE(),
    IF(_hasAllowForColumn, CONTAINSSTRING(_cd, _allowToken), TRUE())
)
```

Aplicacao sugerida:
1. Crie role no dataset com o mesmo nome de `POWERBI_DEFAULT_RLS_ROLE`.
2. Aplique a expressao nas tabelas/colunas que devem ser filtradas.
3. Publique o report e teste no portal com usuarios diferentes.

## 9) Nota sobre Fabric Lakehouse
Lakehouse e excelente para dados analiticos, mas backend transacional Django
(auth, CRUD, sessoes, migrations) precisa de banco SQL transacional.

No ecossistema Fabric, use preferencialmente **Warehouse SQL endpoint** para o app.
