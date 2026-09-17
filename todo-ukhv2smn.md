# Project TODO

- [x] Inspect the Excel synchronization endpoint, customer resolution, and revenue analytics implementation.
- [x] Resolve missing `Client_ID` values from an exact normalized client-name match during Excel import.
- [x] Preserve every source sales line using a stable unique import key and prevent accidental line collapse.
- [x] Base sales revenue and monthly revenue on the Excel `Gross_Profit` field, including exact decimal totals.
- [x] Exclude COGS-only synthetic records from revenue totals while preserving their cost treatment.
- [x] Add Vitest coverage for Unicode customer-name resolution, Gross_Profit selection, and formula-cache recovery.
- [x] Synchronize and validate the corrected importer against `Videa-Master-DashboardFinale.xlsx` (AED 873,918.63 all time; AED 115,256.72 for August 2026).
- [ ] Save a checkpoint and guide the user to publish the corrected CRM.
