# COGS Discrepancy Bug Notes

## Root Cause
The import pipeline in `server/dashboardImport.ts` only creates transactions from `Fact_Sales` rows.
It then distributes COGS from the `COGS` sheet proportionally across matching invoices.

If an invoice exists in the COGS sheet but NOT in Fact_Sales, its COGS is simply lost.

## Evidence
- Excel COGS sheet July 2026: 18 invoices, COGS = 44,383.71
- CRM transactions July 2026: 64 line items, COGS = 42,390.55
- Difference: 1,993.16
- Missing: Invoice #315 (C T F Metal Steel Workshop LLC, 2026-07-14, COGS=1,993.16) exists in COGS sheet but NOT in Fact_Sales

## Fix Required
In `server/dashboardImport.ts`, after processing all Fact_Sales rows, iterate over `cogsByInvoice` entries.
For any invoice NOT already represented in `salesRows`, create a synthetic transaction row using the COGS sheet data:
- date = COGS sheet Invoice_Date (column index 0)
- clientId = COGS sheet Client_ID (column index 2)
- clientName = COGS sheet Client_Name (column index 3)
- amount = cogsAmount (revenue unknown, use COGS as placeholder or 0)
- cogs = cogsAmount
- type = 'purchase'
- description = 'COGS-only invoice (no Fact_Sales detail)'

## COGS Sheet Structure
Row 0: ('Invoice_Date', 'Invoice_No', 'Client_ID', 'Client_Name', 'Cost_of_Sales', 'costOfSales_currency')

## Key Code Locations
- Line 329-336: cogsByInvoice map built from COGS sheet
- Line 437-483: COGS distribution logic (proportional across line items)
- Line 598-608: Transaction batch creation (only from salesRows)
