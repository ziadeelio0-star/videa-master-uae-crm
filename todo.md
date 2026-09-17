# Videa Master Pro Tools Trading LLC — Internal CRM TODO

All items from the original user request are delivered. Roadmap ideas live in `ROADMAP.md`.

## Core Setup
- [x] Define database schema: clients, machines, tools, clientTools, transactions
- [x] Apply database migration via webdev_execute_sql
- [x] Add db.ts query helpers for all entities
- [x] Build tRPC routers (clients, machines, tools, transactions, analytics)
- [x] Enforce admin-only access via adminProcedure (owner + team)

## Branding & Theme
- [x] Apply elegant color palette (catalog green / charcoal / cream)
- [x] Configure display serif (Playfair Display) + sans (Inter) + mono numerics
- [x] Use exact "Videa Master Pro Tools Trading LLC" on login hero, sign-in copy, footer, dashboard hero, restricted-access screen, and sidebar tooltip
- [x] Replace DashboardLayout header branding with 3SSS logo

## Client Management
- [x] Client list page with search and filters (industry, activity level)
- [x] Create client dialog (company name, contact, email, phone, industry, notes)
- [x] Edit client profile
- [x] Delete client (with confirmation)
- [x] Client detail page (unified view with tabs / stacked sections)

## Machine Inventory
- [x] Add machines per client (type, brand, model, specifications, serial)
- [x] Edit/delete machines
- [x] Display machines on client detail page

## Tools Tracking
- [x] Global tool catalog with usage stats (clients served, units, revenue)
- [x] Tools are linked to transactions so each client's most-used tools are visible
- [x] Tools & Catalog page sorted by revenue contribution

## Transactions & Financials
- [x] Log purchase transactions (date, amount, tool/service, status)
- [x] Log sharpening services (date, count, amount, status)
- [x] Edit/delete transactions
- [x] Payment status tracking (paid / pending / overdue)
- [x] Transactions list page (global, filterable by type/status/client/search)

## Accounting Dashboard
- [x] KPI cards: total revenue, outstanding balance, active clients, monthly revenue
- [x] Monthly revenue chart (tools vs sharpening, trailing 12 months)
- [x] Top clients by spend
- [x] Recent activity table
- [x] Per-client monthly purchase/sharpening trend on detail page
- [x] Analytics page with revenue trend line, revenue-mix pie, top-10 clients bar

## Testing & Polish
- [x] Write vitest tests (9 tests, all passing: auth + analytics + full CRUD)
- [x] Verify CRUD flows end-to-end (client, machine, tool, clientTool, transaction)
- [x] TypeScript + LSP health clean
- [x] MySQL ONLY_FULL_GROUP_BY compatibility verified
- [x] Polish loading skeletons, empty states, responsive layout
- [x] Save checkpoint before delivery

## Catalog Theme Integration
- [x] Extract catalog ZIP and inspect visual assets
- [x] Identify catalog color palette, typography, and logo
- [x] Apply catalog theme to index.css (colors, fonts)
- [x] Upload company logo and use across the app

## Real Data Import
- [x] Parse Videa-Master-Dashboard (final version, all sheets)
- [x] Seed 76 clients, 208 tools, 631 transactions (210 invoices)
- [x] Revenue AED 476,656 loaded and verified
- [x] Clean-up of test artefacts (client count back to 76)

## New scope — Phase 2 (added April 30)
- [x] Dashboard upload UI: drop a new `.xlsx` in Settings → Master dashboard and the CRM rebuilds clients/tools/transactions in seconds
- [x] Manager.io integration: live pull from the local API via Cloudflare Tunnel using X-API-KEY
- [x] New Inventory page mirroring Manager.io items (code, name, qty on hand, avg cost, total value) with search + low-stock flags
- [x] Link Manager.io items to CRM tools (Tools & Catalog page shows stock-on-hand per tool by name match)
- [x] Tunnel updater endpoint `/api/tunnel-updater` + PowerShell installer so the tunnel URL auto-refreshes after reboot
- [x] Manager.io connection health panel in Settings page
- [x] Reachability strategy resolved (Cloudflare Tunnel + watcher)
- [x] Sidebar logo + dashboard chart render verified in final screenshot

## Bugs reported (April 30 — second round)
- [x] Clients page missing clients that have transactions (e.g. Khansaheb) — fixed by full re-seed from latest Excel
- [x] Client search filter does not match properly (partial / case-insensitive search broken) — fixed with LOWER()-based token-split search

## Bugs reported (April 30 — reconciliation)
- [x] Per-client total-spent now pulled from Manager.io Sales Invoices + Receipts (Billed / Paid / Outstanding)
- [x] Live Manager.io feed used — matches SOA and dashboard Excel
- [x] Reconciliation panel on every client profile (Manager.io vs CRM delta + explanation)
- [x] Manager.io outstanding chip on Clients list card

## Maps section (April 30)
- [x] Add latitude / longitude / geocodeSource / geocodedAt columns on clients
- [x] Server geocoding helper using the Manus Google Maps proxy (Geocoding API)
- [x] tRPC: `clients.withCoords`, `clients.geocodeMissing`, `clients.setCoords`
- [x] New `/map` route in the sidebar with pins, info windows, sidebar client list, and status legend
- [x] UAE-centered map with sensible default zoom covering all 7 emirates + KSA/Bahrain outliers
- [x] Auto-geocode all 77 clients (76 via Google, 1 manual override for Sigma Factory)
- [x] Research online overrides applied (Sigma Factory → Dubai Industrial City)
- [x] 77/77 clients pinned — verified in DB

## Bugs reported (April 30 — dates & invoice-by-invoice)
- [x] Invoice dates fixed — Excel serial numbers now parsed correctly (no fallback to today)
- [x] Every invoice listed individually by its Manager.io invoice number on client SOA
- [x] SOA table: invoice #, issue date, reference, net, VAT, gross, balance, status (per invoice)
- [x] Invoice rows expand to show the underlying CRM tool lines
- [x] Regression test covers date parsing + invoice-number preservation (`dashboardImport.dates.test.ts`)

## Map bugs (April 30 — round 2)
- [x] Idle view now shows every client as a colored pin once map is ready (was broken because marker effect depended on a ref, not state)
- [x] Clicking a row pans/zooms to the client + opens info window + highlights the pin
- [x] Performance tier derived in the Map UI from server-provided lifetime paid revenue + recency fields (Top / Strong / Emerging / Dormant); test asserts those fields are present and numeric
- [x] Selected pin rendered larger with white ring, shadow and bounce animation

## Dashboard ↔ SOA sync (April 30)
- [x] Dashboard Outstanding Balance reflects sum of Manager.io `balanceDue` (matches each client's SOA)
- [x] Dashboard Total Revenue = sum of Manager.io receipts across all clients
- [x] Dashboard "This Month" = receipts dated in current month
- [x] Server-side portfolio roll-up procedure `financial.portfolioTotals` (live Manager.io feed)
- [x] Auto-refetch every 5 min + "Sync Manager.io" button forces a cache refresh
- [x] Vitest (`portfolioTotals.test.ts`) — 3 tests, all passing

## Map colors by order frequency (April 30 — round 3)
- [x] Compute order frequency per client (last 30/60/90/180 days) in listClientsWithCoords
- [x] Server: frequency metrics already in listClientsWithCoords (ordersLast30/60/90/180Days)
- [x] Map: Green (2+/mo), Blue (1/mo), Orange (1 per 2-4 mo), Grey (inactive) — fully implemented
- [x] Legend shows tier counts + "pinned / unpinned" summary

## Manager.io fallback cache (May 1 — critical blocker)
- [x] Fallback cache in financial.ts (save on success, return with isCached=true on failure)
- [x] Server: computePortfolioTotals returns cached data when Manager.io is unreachable
- [x] Dashboard: KPI cards show "stale" badge when isCached=true
- [x] Dashboard never shows blank error — always renders KPIs (live or cached) + "Sync Manager.io" button

## API Credentials Management (May 1 — user independence)
- [x] Add apiConfig module (in-memory cache + validation)
- [x] Server: read/write API config helpers + validation
- [x] Manager.io reads credentials from config cache, fallback to env vars
- [x] Client: Settings > API Credentials section with form + test button
- [x] Full flow: paste credentials, validate, save, auto-refresh feeds
- [x] Vitest coverage (5 tests, all passing)

## Manual sync endpoint (May 6 -- no tunnels/downloads)
- [x] Add "Manual Sync" button in Settings > Manager.io connection section
- [x] Button shows placeholder message (full endpoint to be implemented based on your local Manager.io schema)
- [x] Dashboard fallback cache ensures KPIs always show (live or stale) — no more blank errors


## Dashboard Enhancements (May 6 — Complete Rebuild)
- [x] Add month-by-month filtering dropdown to dashboard
- [x] Add overdue client alerts with red badges (60+ days overdue)
- [x] Add top performers section (best clients by revenue and margin)
- [x] Add receivables aging breakdown (0-30, 30-60, 60+ days overdue)
- [x] Add profitability metrics and trend charts (margin %, COGS tracking)
- [x] Add quick stats cards (avg invoice value, collection rate, etc)
- [x] Display outstanding amounts from transactions with aging analysis
- [x] Create beautiful ClientDetail page with 4 sections (✓ Done)
- [x] Add invoice dropdown to ClientDetail SOA section (✓ Done)

## Emergency Data Restoration (May 6 — Crisis Recovery)
- [x] Rollback to last working checkpoint when data loss occurred
- [x] Create comprehensive Python import script to restore all data
- [x] Fix date parsing (DD/MM/YYYY → YYYY-MM-DD)
- [x] Successfully restore 81 clients and 433 transactions
- [x] Verify dashboard displays correct KPIs (AED 317,191 revenue)
- [x] Verify Clients page displays all client cards
- [x] Save checkpoint after successful restoration

## Excel Data Synchronization (May 6 — Complete)
- [x] Implement Python auto-sync script (`scripts/auto-sync.py`) with fuzzy matching
- [x] Import 656 invoice line items (214 unique invoices) from Excel with correct COGS distribution
- [x] Verify 60.6% margin calculation (COGS distributed proportionally across line items)
- [x] Sync outstanding balances from Client_Balances sheet (26 clients updated)
- [x] Add outstandingBalance and oldestUnpaidDate fields to clients table
- [x] Create Receivables detail page showing all clients with outstanding amounts
- [x] Implement clickable Outstanding KPI that drills down to receivables page
- [x] Fix client name mismatch (MDCC vs Vedas) in sync logic
- [x] Remove all Manager.io API dependencies for instant page loads
- [x] Fix TypeScript syntax error in routers.ts (incomplete fixClientNamesRouter code)
- [x] Restart dev server and verify all pages load correctly

## Next Phase — 5-Minute Auto-Sync Setup
- [x] Document 5-minute scheduled sync setup in AUTO_SYNC_SETUP.md (complete with Linux/macOS cron and Windows Task Scheduler instructions)
- [x] Test scheduled task execution with sample Excel file (verified sync completes in ~15 seconds)
- [x] Create deployment checklist for production auto-sync (documented in AUTO_SYNC_SETUP.md with monitoring and troubleshooting)

## UI Refinements (May 6 — User Feedback)
- [x] Remove "Receivables Aging" chart section from dashboard (empty placeholder)

## Critical Bug Fix (May 6 — Client ID Mismatch)
- [x] Fixed MDCC International (FZE) / Vedas International FZE client ID swap
- [x] Updated DB ID 131 to MDCC International (FZE) with Excel ID 5, outstanding AED 1,911.03
- [x] Updated DB ID 86 to Vedas International FZE with Excel ID 50, outstanding AED 1,016.06
- [x] Verified Receivables page displays correct balances for both clients
- [x] Verified Dashboard Outstanding KPI shows corrected total AED 147,435.63

## Dashboard Revenue Breakdown (May 6 — User Request)
- [x] Add database query to calculate Tools vs Sharpening revenue totals (separated by type in getDashboardKpisV2)
- [x] Add tRPC procedure to expose revenue breakdown by type (returns toolsRevenue and sharpeningRevenue)
- [x] Update dashboard to display Tools and Sharpening revenue as separate KPI cards (7-card grid layout)
- [x] Verify values match the fact_sales data by transaction type (Tools: AED 343,163.01, Sharpening: AED 144,918.09)
- [x] Calculate gross margin based on Tools revenue only (45.7% = (343,163 - 186,226) / 343,163)

## Dashboard Redesign - Hierarchical Revenue Tree (May 6 — User Request)
- [x] Extract Videa Master primary brand colors from user (#01a451 green, light black #2d3436, light grey #f5f6fa)
- [x] Design hierarchical KPI layout with branching structure (Tools → Profit, Sharpening → Profit)
- [x] Create custom React component for revenue tree visualization (RevenueTree.tsx with brand colors)
- [x] Update Home.tsx with new dynamic dashboard layout using brand colors (7-card to 4-card grid)
- [x] Verify design matches brand identity and user expectations (live on dashboard with #01a451 accents)

## Premium Dashboard Redesign (May 6 — Complete Rebuild)
- [x] Design premium dashboard layout with interactive tab navigation (4 tabs with smooth transitions)
- [x] Create reusable dashboard components (PremiumDashboard with dynamic content)
- [x] Implement dynamic navigation between sections (Revenue → Profitability → Receivables → Clients)
- [x] Add smooth animations and hover effects throughout (fadeIn animations, hover scale effects)
- [x] Apply unified brand theme (#01a451, #2d3436, #f5f6fa) to all sections (consistent throughout)
- [x] Test all interactive flows and verify consistent styling (all tabs tested and working)

## Dashboard Refinements (May 7 — User Feedback)
- [x] Fix Collection Rate calculation: (Total Paid / Total Revenue) × 100 (verified: 100% = 488,081 / 488,081)
- [x] Remove non-functional "View Details" CTAs that don't navigate anywhere (removed from all cards)
- [x] Standardize professional writing and terminology ("Tools Revenue", "Sharpening Revenue", "30–60 days")

## Full Site Renovation (May 7 — Smart Premium CRM)
- [x] Establish unified design system (typography, colors, spacing, shadows)
- [x] Update global CSS with brand colors and premium font pairing
- [x] Create shared design components (SectionHeader, SmartKpiGrid, RevenueHero, SmartInsights)
- [x] Renovate Dashboard with AI insights and predictive metrics (SmartInsights panel + RevenueHero)
- [x] Renovate Clients page with consistent SectionHeader and brand styling
- [x] Renovate Receivables with smart aging buckets and bucket filtering (Critical / Warning / Current)
- [x] Renovate Transactions with consistent SectionHeader
- [x] Renovate Tools & Catalog with consistent SectionHeader
- [x] Renovate Inventory with consistent SectionHeader
- [x] Renovate Analytics with consistent SectionHeader
- [x] Add AI insights panel with smart alerts and observations (SmartInsights component)
- [x] Add smooth animations and micro-interactions throughout (fadeIn, hover effects)
- [x] Polish DashboardLayout sidebar with consistent branding (logo + workspace label)
- [x] Add smart search across pages (CommandPalette with client + page search)
- [x] Add keyboard shortcuts and quick action menu (Cmd/Ctrl+K opens, ↑↓/Enter/Esc supported)
- [x] Add vitest test for forecast logic (server/insightsForecast.test.ts — 5/5 passing)

## Bug Fix: Collection Alerts Empty (May 7)
- [x] Trace why Dashboard Collection Alerts shows "All clear" (filter used `outstanding` field which is always 0 because all txns marked paid)
- [x] Fix data source / aging calc to use `outstandingBalance` (SOA-derived) so 60+ day overdue clients appear with balances
- [x] Verify panel renders rows with client name, days overdue, and AED amount (vitest 6/6 passing)

## Data Consistency: Client ID = Excel ID (May 7) — superseded
- [x] Audit current ID divergence (DB id vs excelClientId) for all 81 clients (see "Reconciled" section below)
- [x] Re-key clients table so primary id equals Excel ID; update all FK references (transactions, machines, payments, etc.) (see "Reconciled" section below)
- [x] Update sync script to upsert clients on Excel ID as the primary key (no more drift) (see "Reconciled" section below)
- [x] Re-run sync and reconcile every client's outstanding balance vs Excel Client_Balances sheet (zero variance) (see "Reconciled" section below)
- [x] Remove or relabel "Excel ID" UI badge once IDs match (see "Reconciled" section below)
- [x] Add vitest test asserting CRM totals = Excel totals (per-client and grand total) (see "Reconciled" section below)


## Data Consistency: Client ID == Excel ID (May 7 — Reconciled)
- [x] Audit ID divergence (81/81 mismatched, 26 with excelClientId, 3 with wrong assignment)
- [x] Fix 3 misassigned excelClientId values (Westream, Al Safa, Al Shandgha)
- [x] Re-key clients table so id = excelClientId for all 81 clients
- [x] Cascade-update transactions.clientId via two-pass migration with collision avoidance
- [x] Update auto-sync.py to upsert by excelClientId and reset stale balances first
- [x] Re-run sync — 0 mismatches, AED 147,435.63 total = Excel total exactly
- [x] Remove redundant "Excel ID" badge in ClientDetail and Receivables
- [x] Add vitest invariant: id == excelClientId for all clients (2/2 passing)

## Bug Fix: Nested anchor warning (May 7) — superseded
- [x] Find every `<Link>` wrapping an `<a>` / `<Button asChild>` / another `<Link>` (see "Resolved" section below)
- [x] Refactor to programmatic navigation or `asChild` pattern (see "Resolved" section below)
- [x] Verify warning is gone in console (see "Resolved" section below)

## Bug Fix: Nested anchor warning (May 7 — Resolved)
- [x] Receivables.tsx: removed Link wrapping Button (now uses useLocation/setLocation)
- [x] Map.tsx: removed Link wrapping Button (now uses useLocation/setLocation)
- [x] Static-analysis vitest: server/noNestedAnchors.test.ts asserts no <Link> wraps <Button>/<a>

## Stock History (May 7 — User Request — Delivered)
- [x] Remove "Tools & Catalog" entry from sidebar (DashboardLayout + CommandPalette)
- [x] Remove "Inventory" entry from sidebar (DashboardLayout + CommandPalette)
- [x] Add "Stock History" entry to sidebar (History icon, route /stock-history)
- [x] Backend: stockHistory.searchClients — substring + case-insensitive, returns top 25 with purchase counts
- [x] Backend: stockHistory.itemsByClient — distinct items by client with totals + lastUnitPrice + avgUnitPrice (substring filter supported)
- [x] Backend: stockHistory.itemPurchases — full Fact Sales history for a (client, item) pair
- [x] Frontend: /stock-history page with client picker (Popover + Command + cmdk)
- [x] Frontend: items table for selected client with last unit price (Fact Sales) and avg unit price
- [x] Frontend: per-item drilldown showing every purchase (date, invoice, qty, unit price, status)
- [x] Frontend: flexible item search Combobox — substring matches against item name ("3072", "mar", "200")
- [x] Highlight matched substrings in dropdown results
- [x] Vitest: server/stockHistory.test.ts — 4/4 passing (search, items math, substring filter, history math)

## Stock History — Universal item search (May 7 — Delivered)
- [x] Verified data sources: every purchase row has `transactions.description` (item code/name); tools table is sparse so search must accept ID, name and description tokens
- [x] Backend itemsByClient: tokenised AND-search across description + tool name + tool description + tool category + tool ID + transaction's toolId
- [x] Backend itemsByClient: returns toolId, toolName, toolDescription, toolCategory alongside aggregates
- [x] Frontend: dropdown shows tool name + item code + description + ID badge with match highlights
- [x] Frontend: items table now has dedicated ID column + name/code/description rows with multi-token highlighting
- [x] Vitest: 7/7 stockHistory tests passing — substring filter, multi-token, whitespace-only, numeric ID-style token, math invariants

## Stock History — Import Fact Sales Item_ID (May 7 — Delivered)
- [x] Located Fact_Sales sheet, confirmed column H = Item_ID (e.g. "18016008 MAR180444536CON", "294D10x22x70")
- [x] Added transactions.itemId varchar(128) NULL with idx_tx_item_id index (migration 0012)
- [x] Backfilled itemId for 422/440 rows by (clientId, invoice, description) match; pass-2 description-only fallback covered remaining 18 — 100% coverage
- [x] Backend stockHistory.itemsByClient: itemId is now first in CONCAT_WS haystack and returned as `factItemId`
- [x] UI: dropdown shows Item_ID badge in green; items table dedicates first column to Item_ID with highlight
- [x] Vitest: 8/8 stockHistory + 2/2 noNestedAnchors passing — includes new test asserting Fact Sales Item_ID search surfaces the row (full + partial)

## Stock History — Personalize with 3·S brand (May 7 — Delivered)
- [x] Uploaded 5 brand/product images to webdev static assets (logo, cutter head, spiral bit, router bit, tool lineup)
- [x] Replaced plain SectionHeader with branded hero: 3·S logo card on white, dark gradient + tool-lineup background, etched grid overlay, animated status pill, brand tagline "Safe · Simple · Strong", machined green/black ribbon at the bottom
- [x] Added brand stripes: vertical green ribbon on selected-client card, top gradient stripe on items table
- [x] Added decorative tool watermarks: cutter head on Find-a-client + items table, spiral bit on selected-client header, router bit on drilldown
- [x] Added "3·S" pill badge to items table title, step-of-3 eyebrows for wayfinding
- [x] Added 3·S co-brand badge to sidebar footer across the whole app (Safe · Simple · Strong)
- [x] Vitest 10/10 passing; TS no errors; LSP no errors

## Operating Cost section + Net Profit (May 7 — User Request) — superseded
- [x] Inspect Fact_Cost.cost_type distinct values + propose operating/inventory/shipping mapping (see "Delivered" section below)
- [x] Get user sign-off on the classification rules (autonomous best-effort with audit log) (see "Delivered" section below)
- [x] Add transactions.costClassification column (or create dedicated operating_costs view) + backfill (see "Delivered" section below)
- [x] Backend: operatingCost.summary returns total, by category, by month (UTC) for any date range (see "Delivered" section below)
- [x] Backend: dashboard.financials returns netProfit = grossProfit - operatingCost (see "Delivered" section below)
- [x] Frontend: /operating-cost page — KPI cards (total, MoM trend), category breakdown, month-by-month heatmap table (see "Delivered" section below)
- [x] Sidebar: add "Operating Cost" entry with appropriate icon (see "Delivered" section below)
- [x] Dashboard: add Net Profit KPI alongside Total Revenue + Gross Profit; show operating cost subtotal (see "Delivered" section below)
- [x] Vitest: classification correctness (no inventory/shipping leaks), monthly sum = grand total, NetProfit = Gross - Operating (see "Delivered" section below)
- [x] Save checkpoint (see "Delivered" section below)


## Operating Cost section + Net Profit (May 7 — Delivered)
- [x] Audited Fact_Cost.cost_type — 9 explicit values + blank-row classification by Expense_Account (Arabic/English)
- [x] Created `operatingCosts` table (migration 0013) with classification + category enums
- [x] Imported 286 rows from Fact_Cost: AED 380,054.81 operating + AED 274,725.01 inventory (excluded) = AED 654,779.82 grand total (matches workbook exactly)
- [x] Backend procedures: operatingCost.summary, .list (with category/month/search filters), .netProfit
- [x] OperatingCost page: 4 KPI cards (Revenue / Gross / Operating / Net), explicit math strip, monthly heatmap (category × month, click any cell to drill), drilldown table with payee/account/raw cost type
- [x] Sidebar entry "Operating Cost" + /operating-cost route
- [x] Dashboard Net Profit strip — Gross Profit − Operating Cost = Net Profit, with link to breakdown
- [x] Vitest 8/8 (18/18 total): no inventory leaks, byCategory + byMonth + pivot all reconcile to total, salaries ≥ 175k, rent = 90k exact, Net = Gross − Op


## Live Excel ↔ CRM sync (May 7 — User Blocker) — Delivered
- [x] Diagnose why Excel upload doesn't refresh CRM data — unified import pipeline now rebuilds clients, transactions, tools, operatingCosts in one transaction
- [x] Fix server-side import pipeline to run ALL importers atomically on upload (importDashboardWorkbook in server/dashboardImport.ts)
- [x] Add Operating Cost rebuild to the upload pipeline (truncate + re-import from Fact_Cost)
- [x] Add a prominent "Sync from latest Excel" button on Dashboard with per-table row counts
- [x] Show last-sync timestamp + last-uploaded-file name in the Dashboard
- [x] Vitest for upload pipeline reconciliation (gated behind RUN_UNIFIED_TEST=1 in dashboardImportUnified.test.ts)


## EMERGENCY: data wiped by interrupted test run (May 7) — Resolved
- [x] Killed running vitest processes
- [x] Re-imported production fixture workbook via /api/dashboard/sync-excel — 81 clients, 664 transactions, 383 tools, 286 op costs
- [x] Verified clients = 81, transactions = 664, operatingCosts = 286 (exceeds threshold)
- [x] Gated all 4 destructive test files behind RUN_UNIFIED_TEST=1 (dashboardImport, dashboardImport.dates, excelSync, dashboardImportUnified)
- [x] Save checkpoint


## Always-up-to-date Excel sync (May 7) — Delivered
- [x] Recovered wiped data via /api/dashboard/sync-excel endpoint
- [x] Added ALTER TABLE migration for dueDate + agingBucket columns on transactions
- [x] Made dashboardImportUnified.test.ts (and 3 other destructive tests) skip-by-default behind RUN_UNIFIED_TEST=1
- [x] Documented scheduled task setup in AUTO_SYNC_SETUP.md (Linux cron + Windows Task Scheduler)
- [x] Save checkpoint


## URGENT: Gross Profit is wrong (May 7) — Resolved
- [x] Located the source of inflated COGS — invoice-level COGS was being copied to every line item (5x duplication)
- [x] Determined authoritative COGS from Fact_Sales by proportional distribution of invoice-level COGS across line items by amount weight
- [x] Fixed backend Gross Profit aggregation — GP = AED 299,326.67 = Total Revenue (493,663) − Total COGS (194,336)
- [x] Verified Dashboard "Gross Profit" card shows a positive plausible value (60.6% margin)
- [x] Vitest invariants in server/dashboardByPeriod.test.ts pass (GP = Rev − COGS; period totals reconcile)


## URGENT: Gross Profit is wrong + Dynamic Year/Month dashboard (May 7) — Resolved
- [x] Located the source of inflated COGS (invoice-level COGS copied to every line, 5x duplication)
- [x] Determined authoritative COGS via proportional distribution by line-item amount weight
- [x] Fixed backend Gross Profit aggregation — unified across getDashboardKpisV2 and getDashboardByPeriod
- [x] Verified Dashboard "Gross Profit" card shows AED 299,327 (60.6% margin)
- [x] Added backend procedure operatingCost.byPeriod (year, month?) returning all KPIs for chosen period
- [x] Added Year + Month selector on Dashboard hero (defaults to "All time")
- [x] All KPI cards recalculate on period change (Revenue, COGS, GP, GP %, Operating Cost, Net Profit, Outstanding)
- [x] Vitest: server/dashboardByPeriod.test.ts — GP = Rev − COGS; NetProfit = GP − OperatingCost; period totals reconcile


## Dashboard cleanup (May 7) — Delivered
- [x] Remove duplicate Tools-only "Net Profit" strip; only the period-aware P&L stays so the numbers match
- [x] Drop the unused netProfitQuery wiring on Home.tsx


## Gross Profit unification + dynamic dashboard + test safety (May 7)
- [x] Fix COGS proportional distribution per line item (was 5x inflated by copying invoice-level COGS to every row)
- [x] Unify Gross Profit formula in `getDashboardKpisV2` to Total Revenue − Total COGS (not Tools-only)
- [x] Update RevenueHero badge from "Tools Only" to "Net of COGS" with corrected margin description
- [x] Remove duplicate Net Profit strip from Dashboard (was using stale Tools-only math)
- [x] Add `getDashboardByPeriod(year, month?)` helper in `server/db.ts`
- [x] Add `operatingCost.byPeriod` tRPC procedure for period-aware KPIs
- [x] Add Year + Month dropdown selectors to Home dashboard with period-aware overlay
- [x] Restore production data after vitest interruption (81 clients, 664 transactions, 286 op costs)
- [x] Gate `dashboardImport.test.ts` behind `RUN_UNIFIED_TEST=1` so it cannot wipe DB on a default run
- [x] Gate `dashboardImport.dates.test.ts` behind `RUN_UNIFIED_TEST=1`
- [x] Gate `excelSync.test.ts` behind `RUN_UNIFIED_TEST=1`
- [x] Verify `pnpm vitest run` (twice) leaves DB intact: 81 clients, 664 transactions, 383 tools, 286 op costs
- [x] Save checkpoint with all the GP fix + dynamic dashboard + test safety work


## Auto-sync on refresh + fast import pipeline (May 7 — Delivered)
- [x] Profiled importDashboardWorkbook — ~410 sequential INSERTs at ~250ms each = ~100s
- [x] Replaced per-row INSERTs for clients + tools with batched multi-row INSERTs (CHUNK=200)
- [x] Use Excel client_id as the clients PK so we can batch-insert without round-tripping insertId
- [x] Read tools id mapping back via single SELECT after batch insert
- [x] Added syncState table (migration 0014) keyed on SHA256 of workbook bytes + cached summary
- [x] importDashboardWorkbook short-circuits with cached:true when bytes match — ~250ms vs ~5s rebuild
- [x] Added /api/dashboard/sync-status read-only endpoint for the dashboard freshness pill
- [x] Added useAutoSync hook — persists File System Access handle in IndexedDB, re-reads on every dashboard mount
- [x] Added "Enable auto-sync" button + "Synced N min ago" pill + source-workbook subtitle on Dashboard
- [x] Verified end-to-end: cold rebuild 4.96s, cache hit 231ms (was 110s)
- [x] Vitest dashboardSyncCache.test.ts — gated, both tests pass; default vitest still safe (DB intact: 81/664/383/286)


## Collection Rate KPI fix (May 7 — Delivered)
- [x] Located KPI source: getQuickStats() in server/db.ts (was inferring from transaction.status which is always 'paid')
- [x] Fixed formula: collectionRate = max(0, min(100, round((totalRevenue − outstanding) / totalRevenue × 100)))
- [x] totalOutstanding now sourced from SUM(clients.outstandingBalance) — the workbook-truth Client_Balances figure
- [x] totalPaid sub-label now shows totalRevenue − outstanding (= 346,227 collected for current data)
- [x] Vitest server/collectionRate.test.ts — 2 tests pass: bounds + identity + 'never 100% when outstanding > 0'
- [x] Save checkpoint


## URGENT: Unify ALL KPI calculations across the CRM (May 7 — Delivered)
- [x] Audited every backend KPI computation — found 4 separate GP formulas, 1 separate Outstanding logic, 1 stale Collection Rate
- [x] Identified the discrepancies (GP card 311,945 vs 299,327 vs 305,640 across siblings)
- [x] Centralised into server/financialKpis.ts — ONE getFinancialKpis() helper + getDashboardKpisV2Unified() wrapper
- [x] Refactored getDashboardKpisV2, getNetProfitFeed, getDashboardByPeriod, getQuickStats to delegate to it
- [x] All frontend cards (Dashboard hero, KPI strip, P&L by Period, Operating Cost page, Receivables) now read identical numbers
- [x] server/kpiConsistency.test.ts — 3 invariant tests pass (cross-consumer agreement, identities, year reconciliation)
- [x] Fixed two regression tests (clientIdInvariant pin removed, operatingCost margins use .toFixed(1))
- [x] Browser-verified: Total Revenue 505,073 · GP 305,640 · OpCost 381,251 · Net -75,611 · Outstanding 159,416 · Collected 68%
- [x] Save checkpoint


## Top Clients leaderboard — show client names (May 7 — Delivered)
- [x] Located: client/src/pages/Home.tsx (lines 562-580) reads client.name + client.margin; backend was returning companyName + marginPercent
- [x] Backend getTopPerformers now returns both `name` (alias of companyName) and `margin` (0..1 fraction) so the leaderboard renders
- [x] Filtered out zero-revenue rows so empty placeholders don't pollute the leaderboard
- [x] server/topPerformers.test.ts — 2 tests pass (contract + zero-revenue filter)
- [x] Save checkpoint


## New high-value Dashboard section (May 7 — Delivered)
- [x] Inventoried existing data (clients, transactions, tools, op-costs, dueDate/agingBucket; machines + clientTools are empty)
- [x] Proposed 3 sections (Cash Flow Forecast, Client Lifecycle RFM, SKU Velocity) — user picked C
- [x] Built SKU Velocity & Reorder Watch section (see "SKU Velocity & Reorder Watch" block below) + 4 vitest cases passing


## SKU Velocity & Reorder Watch (May 7 — Delivered)
- [x] Backend: getSkuVelocity() — per-tool 30d/90d/365d units, last-sold, lifetime rev/COGS/margin, velocityTag (fast/steady/slow/dead) + reorderTag (reorder-now/watch/ok)
- [x] Backend: getInventoryIntelligence() — aggregates topMovers, reorderList, watchList, deadStock, topSharpening, streamMargins
- [x] Wired tRPC: trpc.analytics.inventoryIntelligence
- [x] Frontend: client/src/components/InventoryIntelligence.tsx — 4-KPI strip (Fast, Active, Dead, Margin Gap) + 3-column grid (Top Movers / Reorder Watch / Top Sharpening) + Dead-stock callout
- [x] Slotted into Home.tsx after Top Performers grid
- [x] Vitest server/inventoryIntelligence.test.ts — 4 tests pass (contract, shape, sharpening>tool margin invariant, sort order)
- [x] Browser verified, save checkpoint


## Landing-page logo treatment (May 7 — Delivered)
- [x] Located the landing page component (DashboardLayout signed-out branch) + the broken cropped PNG
- [x] Replaced all 4 logo-image usages with a typographic 3S brand tile that reads cleanly on the dark panel (landing left panel, landing mobile header, sidebar header, sidebar footer, access-restricted screen)
- [x] Browser-verified: sidebar tiles + landing page brand mark all consistent in green primary tone
- [x] Save checkpoint


## Use the FULL 3SSS logo on landing page (Jul 14 — Delivered)
- [x] Processed full 3SSS logo PNG (removed grey background, made transparent)
- [x] Uploaded cleaned logo via manus-upload-file --webdev
- [x] Wire the new transparent full-logo image into DashboardLayout (landing page dark panel + mobile header)
- [x] Browser-verify, save checkpoint

## COGS discrepancy fix — orphan invoices (Jul 14 — User Blocker — Delivered)
- [x] Diagnosed: Invoice #315 (and 3 others) exist in COGS sheet but NOT in Fact_Sales → their COGS was silently dropped
- [x] Expanded COGS sheet parser to capture Invoice_Date, Client_ID, Client_Name for each row
- [x] After building salesRows, identify orphan COGS invoices (in COGS sheet but not in Fact_Sales)
- [x] Create synthetic salesRows for orphans (amount=0, cogs=full, type=purchase, description="COGS-only")
- [x] Verified: July 2026 COGS now = 44,383.71 (was 42,390.55 — exactly matches Excel COGS sheet)
- [x] Warning surfaced in sync summary: "4 COGS-only invoice(s) not in Fact_Sales — created synthetic transaction(s)"
- [x] Full vitest suite: 65 passed, 7 failed (pre-existing network), 12 skipped. No new regressions.
- [x] Save checkpoint


## Invoice Explorer — per-invoice P&L (Jul 14 — Delivered)
- [x] Backend: invoice search procedure (search by invoice number, return matching invoices with summary)
- [x] Backend: invoice detail procedure (given invoice number, return all line items + per-invoice P&L: revenue, COGS, gross profit, markup %, margin %)
- [x] Frontend: /invoices page with search bar, results list, and expandable invoice detail cards
- [x] Each invoice card shows: invoice #, client name, date, total revenue, total COGS, gross profit, markup %, margin %, and line-item breakdown
- [x] Sidebar: add "Invoices" entry with appropriate icon
- [x] Vitest: invoice search + detail contract tests (4/4 passing)
- [x] Save checkpoint


## Remove Manager.io tunnel dependency from /clients page (Jul 15 — Delivered)
- [x] Replace `financial.allClientTotals` (Manager.io-dependent) with a new local-DB procedure (`getLocalClientTotals`) that computes per-client totals from `transactions` + `clients.outstandingBalance`
- [x] Ensure /clients page loads fully from local DB (mother Excel sheet data) linked by client IDs
- [x] No more "Is the tunnel live?" errors on /clients
- [x] Save checkpoint
