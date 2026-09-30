# Dashboard Cultura Inglesa

`cultura_inglesa.json` contains the original data/configuration literals extracted
from the supplied `dre-contabil-viewer/dre-contabil-viewer.jsx`. It is deliberately
outside static and media directories and ignored by Git, as is the supplied JSX.
Never commit either file to the public repository or copy them into public assets.
Production reads the snapshot from `PythonDashboardDataset` in PostgreSQL.

The frontend loads the dataset only through the authenticated
`GET /api/dashboards/python/cultura-inglesa/` endpoint. Access requires an active
user in the active tenant identified by `CULTURA_INGLESA_TENANT_ID`. Its default
is the existing Cultura Inglesa UUID, verified read-only against the configured
database. Active owners (super-admin) also have access without a tenant. Tenant
names and query parameters do not grant access. The existing authorized view-as
flow uses the effective user: viewing another client does not inherit owner access.
Responses are marked `private, no-store`.

Migration 0003 creates the snapshot table with PostgreSQL RLS enabled and no
public policies. The trusted Django database role reads it after application-level
authorization. Load the private JSON into the Cultura Inglesa row separately from
deployment. The supplied 2025 data remains a fixed snapshot; in-browser spreadsheet
imports and rule controls retain their original behavior and are not persisted.

The original component did not define `StatCard`. A presentation-only adapter
displays the existing `label`, `valor`, `sub` and `cor` props. Theme tokens and
scoped CSS adapt the visual appearance. The presentation transform in
`frontend/scripts/refine-cultura-viewer.cjs` adds layout classes, navigation icons
and chart colors; calculations, data bindings and event handlers are preserved.

Recreate or check the adaptation from the repository root:

```text
node frontend/scripts/import-cultura-dashboard.cjs
node frontend/scripts/import-cultura-dashboard.cjs --check
```

The source supplied by the user is left untouched. The check compares all extracted
values and the generated viewer against that source. Access regression tests live
in `apps.dashboards.test_python_dashboard`; run them against an isolated test
database, never the production Supabase instance.

Deployment requires both backend and frontend, migration 0003, and a populated
Cultura Inglesa dataset row. Neither GitHub source nor deployment artifacts contain
the original data. The frontend build contains rendering code only.

## Data-only HTML updates

To replace the existing record sets and branch metadata using a newer private
HTML export, keeping the current calculation rules and UI:

```text
node frontend/scripts/update-cultura-data.cjs "<private HTML path>"
node frontend/scripts/update-cultura-data.cjs "<private HTML path>" --check
```

The parser extracts literal values without executing the HTML. It does not import
new screens or calculation rules. The original JSX generator checks the original
snapshot only; use the HTML check above after a data update. Before updating the
production row, save its existing JSON privately and verify it has not changed
since the backup. Update only the configured Cultura tenant in a transaction and
verify exact equality after writing. Keep all snapshots outside Git.

After importing a newer data snapshot, verify the viewer independently with:

```text
node frontend/scripts/import-cultura-dashboard.cjs --check-viewer
```

This checks the presentation transform without rewriting or comparing the newer
data snapshot against the original source. Use the data-only HTML check above
to validate that snapshot. Browser regression checks compare all seven views,
filters, drill-down, import and rateio controls against the original renderer
with the same current data; only letter case and whitespace are normalized.
