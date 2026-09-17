# Cutting Tools CRM Migration Package

This package is a file-level export of the live Cutting Tools Client & Accounting System for Videa Master Pro Tools Trading LLC. It contains the current application source, Drizzle schema and migration history, a full live database export, per-table JSON copies, and every branded storage asset referenced by the live UI.

## Package contents

| Path | Contents |
|---|---|
| `source/` | Complete tracked application source and configuration, excluding `node_modules`, `.git`, runtime logs, build output, and secret-bearing Manus metadata. |
| `database/database-full.sql` | SQL schema and data dump of the live database. |
| `database/tables/` | JSON export of every live table, including column metadata and all rows. |
| `database/EXPORT_MANIFEST.json` | Export timestamp, database name, table list, and row counts. |
| `assets/` | Six downloaded PNG assets referenced by the live frontend. |
| `environment-variables.example` | Required/optional environment-variable names with no secret values. |
| `tools/export_crm_migration.mjs` | Reusable TLS-aware export utility; it never contains credentials. |

## Live database export

The export was taken from the live TiDB/MySQL-compatible database on **2026-09-17T13:39:27.061Z**. The live database contained the following tables and rows:

| Table | Rows |
|---|---:|
| `__drizzle_migrations` | 1 |
| `clientTools` | 0 |
| `clients` | 116 |
| `machines` | 0 |
| `operatingCosts` | 489 |
| `syncState` | 1 |
| `tools` | 625 |
| `transactions` | 1,173 |
| `users` | 1 |
| **Total** | **2,406** |

The export includes every stored client, transaction/invoice line, COGS value, receivable balance, inventory/tool record, operating-cost row, user, sync state, and migration-history row present in the live database at export time. Empty `clientTools` and `machines` tables are included in both the SQL dump and JSON export so that the database shape is explicit.

The import summary recorded by the application at export time was 116 clients, 625 tools, 1,173 transactions, 412 distinct invoices, total revenue AED 1,008,140.55, total COGS AED 413,935.99, gross profit AED 594,204.56, 489 operating-cost rows totaling AED 743,387.98, and inventory costs totaling AED 299,021.72. The recorded warning about five COGS-only invoices is already reflected in the exported transactions.

## Database connection

The current server uses Drizzle ORM with the `mysql2` driver. The connection path is:

1. The process receives `DATABASE_URL` from its environment.
2. `server/_core/env.ts` exposes it as `ENV.databaseUrl`.
3. `server/db.ts` calls `drizzle(process.env.DATABASE_URL)`.
4. Drizzle/mysql2 connects to the MySQL-compatible database over TLS.
5. All application database helpers and tRPC procedures use that Drizzle connection.

The expected URL is:

```text
mysql://DB_USER:DB_PASSWORD@DB_HOST:3306/DB_NAME?ssl=%7B%22rejectUnauthorized%22%3Atrue%7D
```

The current hosted database used TiDB Serverless on port 4000 and required TLS. For a new provider, use its host, port, database name, credentials, and TLS settings. Do not put a real credential in source control. The URL may be supplied through the hosting provider's secret manager instead of a `.env` file.

## Restoring the database

For the closest byte-for-byte logical restoration, create an empty MySQL-compatible database and import the SQL dump:

```bash
mysql --host "$DB_HOST" --port "$DB_PORT" --user "$DB_USER" --password \
  --ssl-mode=REQUIRED "$DB_NAME" < database/database-full.sql
```

If the target client does not support `--ssl-mode`, configure TLS using that provider's equivalent option. For TiDB Cloud, keep TLS enabled and use the provider's certificate/verification guidance.

After setting `DATABASE_URL`, install dependencies and run the application checks:

```bash
cd source
pnpm install --frozen-lockfile
pnpm run check
pnpm test
pnpm run build
pnpm run dev
```

The existing `source/package.json` provides `dev`, `build`, `start`, `check`, `test`, and `db:push` scripts. `db:push` generates and applies the Drizzle migrations; do **not** run it against a restored database unless you understand the migration history and have a backup. When using the supplied full SQL dump, restoration is already complete.

## Schema and migration history

The TypeScript schema is `source/drizzle/schema.ts`. All generated migration SQL files are in `source/drizzle/*.sql`, with Drizzle snapshots and journal under `source/drizzle/meta/`. The SQL dump is authoritative for the exact live database. The source schema retains two historical application table declarations (`portfolioCache` and `apiConfig`) that are not present in the nine-table live export; they are preserved in source and migration history for completeness, but they should not be assumed to contain current data.

## Assets and storage migration

The current UI references these files through `/manus-storage/...` paths. The actual PNG bytes are included in `assets/`:

| Current storage key | Package file |
|---|---|
| `videa-3sss-fulllogo_1c41c034.png` | `assets/videa-3sss-fulllogo_1c41c034.png` |
| `3s-logo_7e37c362.png` | `assets/3s-logo_7e37c362.png` |
| `3s-cutter-head_656e29f5.png` | `assets/3s-cutter-head_656e29f5.png` |
| `3s-spiral-bit_fa59e61b.png` | `assets/3s-spiral-bit_fa59e61b.png` |
| `3s-router-bit_708e8ac7.png` | `assets/3s-router-bit_708e8ac7.png` |
| `3s-tool-lineup_85e70d1b.png` | `assets/3s-tool-lineup_85e70d1b.png` |

When leaving Manus, copy these files into the new application's static/public asset storage and update the `/manus-storage/...` references in `source/client/src/components/DashboardLayout.tsx` and `source/client/src/pages/StockHistory.tsx`. The current `source/server/storage.ts` is a Manus Forge/S3 adapter; replace it with the destination provider's storage adapter if the application will continue accepting file uploads.

## Workbook/source-data note

The raw mother workbook is **not persisted by the current application**. The sync endpoint receives the workbook, imports its rows into the database, and stores only the SHA256 hash, original filename, import summary, and timestamp in `syncState`. Consequently, no truthful full copy of the latest mother workbook can be extracted from the live database. The package includes `source/server/fixtures_dashboard.xlsx`, which is a test fixture and is not represented as the latest mother workbook. Keep the original workbook separately if it is required for future re-imports or audit purposes.

## Environment variables

Use `environment-variables.example` as the names-only template. The current code references these variables:

| Variable | Purpose | Required for current deployment? |
|---|---|---|
| `DATABASE_URL` | MySQL/TiDB connection URL | Yes |
| `JWT_SECRET` | Session-cookie signing secret | Yes |
| `OAUTH_SERVER_URL` | OAuth server base URL | Yes while using current auth |
| `VITE_APP_ID` | OAuth/application identifier | Yes while using current auth |
| `VITE_OAUTH_PORTAL_URL` | Browser login portal | Yes while using current auth |
| `OWNER_OPEN_ID` | Owner/admin identity mapping | Recommended |
| `BUILT_IN_FORGE_API_URL` | Server-side Manus Forge endpoint | Required for current storage/image/data integrations |
| `BUILT_IN_FORGE_API_KEY` | Server-side Forge credential | Required for current storage/image/data integrations |
| `VITE_FRONTEND_FORGE_API_URL` | Browser-side Forge/maps endpoint | Required for current map integration |
| `VITE_FRONTEND_FORGE_API_KEY` | Browser-side Forge/maps credential | Required for current map integration |
| `NODE_ENV` | Runtime mode | Recommended; set `production` in production |
| `PORT` | HTTP port | Optional; defaults through the server runtime |
| `MANAGER_API_URL` | Legacy Manager.io API endpoint | Optional; core local-data views do not require it |
| `MANAGER_API_KEY` | Legacy Manager.io credential | Optional; core local-data views do not require it |
| `TUNNEL_UPDATER_SECRET` | Legacy tunnel updater script secret | Optional; only for that legacy script |
| `RUN_UNIFIED_TEST` | Enables destructive workbook-import tests | Test-only; leave unset normally |

The source tree intentionally does not contain `.env`, `.env.local`, `.project-config.json`, or any other secret-bearing file. Manus project metadata was excluded because it contained live database, OAuth, Forge, Manager.io, tunnel, and Git-backend credentials. Rotate any credentials that may have been exposed in old deployment metadata before moving to the new host.

## Migration-away checklist

1. Provision a MySQL-compatible database and restore `database/database-full.sql`.
2. Create a secret-managed environment from `environment-variables.example`.
3. Install dependencies from `source/pnpm-lock.yaml`.
4. Replace Manus OAuth or configure equivalent OAuth endpoints.
5. Replace Manus Forge storage, maps, image, and data integrations if the migration is intended to be fully independent of Manus.
6. Copy the six PNG files into the new asset store and update the two frontend reference files.
7. Run `pnpm run check`, `pnpm test`, and `pnpm run build`.
8. Start the server and verify `/`, `/clients`, `/invoices`, dashboard P&L, stock history, and workbook sync against the restored database.
9. Preserve the original mother workbook separately for future data reconciliation.
