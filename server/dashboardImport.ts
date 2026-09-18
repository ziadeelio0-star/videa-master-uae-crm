/**
 * Smart Dashboard Importer — single source of truth for Excel ↔ CRM sync.
 *
 * Parses every sheet that touches the CRM and applies them atomically so a
 * single upload refreshes EVERYTHING the user sees:
 *
 *   - Dim_Clients      → clients table (re-keyed on Client_ID)
 *   - Fact_Sales       → tools + transactions (with Item_ID column H baked in)
 *   - COGS             → transactions.cogs (linked by invoice number)
 *   - Client_Balances  → clients.outstandingBalance + clients.oldestUnpaidDate
 *   - Fact_Cost        → operatingCosts (with category + classification)
 *
 * Kept in lock-step with `scripts/import_operating_costs.py`.
 */
import XLSX from "xlsx";
import crypto from "node:crypto";
import { getDb } from "./db";
import {
  clients,
  tools,
  transactions,
  operatingCosts,
  syncState,
} from "../drizzle/schema";
import { sql, eq } from "drizzle-orm";

const IMPORTER_CACHE_VERSION = "gross-profit-client-resolution-v4";

function sha256Hex(buf: Buffer): string {
  return crypto
    .createHash("sha256")
    .update(IMPORTER_CACHE_VERSION)
    .update(buf)
    .digest("hex");
}

export interface ImportSummary {
  clients: number;
  tools: number;
  transactions: number;
  invoices: number;
  totalRevenue: number;
  totalCOGS: number;
  grossProfit: number;
  /** Number of clients whose outstanding balance was refreshed from the workbook. */
  balancesUpdated: number;
  /** Total operating-cost rows imported from Fact_Cost. */
  operatingCostsRows: number;
  /** Total operating-cost amount (excludes inventory + shipping). */
  operatingCostsTotal: number;
  /** Inventory cost (excluded from operating; lives in COGS already). */
  inventoryCostsTotal: number;
  warnings: string[];
}

function normalizeName(s: unknown): string {
  if (s === null || s === undefined) return "";
  return String(s).trim();
}

/**
 * Workbook client names may differ only by whitespace, case, or Unicode
 * presentation forms (notably Arabic text). This key lets a missing
 * Fact_Sales.Client_ID resolve safely to the matching Dim_Clients record.
 */
export function normalizeClientLookupKey(s: unknown): string {
  return normalizeName(s)
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .toLocaleLowerCase();
}

export function findFactSalesAmountColumn(headers: string[]): number {
  const grossProfit = headers.findIndex((h) => h.toLowerCase().trim() === "gross_profit");
  if (grossProfit >= 0) return grossProfit;
  return headers.findIndex((h) => h.toLowerCase().includes("net_revenue"));
}

export function resolveFactSalesGrossProfit(
  row: unknown[],
  grossProfitColumn: number,
  netRevenueColumn: number,
  factSalesCogsColumn: number,
): number {
  const cachedGrossProfit = grossProfitColumn >= 0 ? asNumber(row[grossProfitColumn]) : 0;
  const netRevenue = netRevenueColumn >= 0 ? asNumber(row[netRevenueColumn]) : 0;
  if (grossProfitColumn < 0 || cachedGrossProfit !== 0 || netRevenue === 0) {
    return cachedGrossProfit || netRevenue;
  }
  // SheetJS does not evaluate Excel formulas. If a workbook was uploaded before
  // Excel saved its calculated cache, reconstruct the workbook's GP formula:
  // Gross_Profit = Net_Revenue − Fact_Sales.COGS.
  const factSalesCogs = factSalesCogsColumn >= 0 ? asNumber(row[factSalesCogsColumn]) : 0;
  return netRevenue - factSalesCogs;
}

function asNumber(v: unknown): number {
  if (v === null || v === undefined || v === "") return 0;
  if (typeof v === "number") return v;
  const n = Number(String(v).replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function asDate(v: unknown): Date | null {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v;
  if (typeof v === "number" && Number.isFinite(v)) {
    const ms = Math.round((v - 25569) * 86400 * 1000);
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const s = normalizeName(v);
  if (!s) return null;
  if (/^\d+(\.\d+)?$/.test(s)) {
    const n = Number(s);
    const ms = Math.round((n - 25569) * 86400 * 1000);
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const iso = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/.exec(s);
  if (iso) {
    const [, y, m, d] = iso;
    return new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  }
  const eu = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/.exec(s);
  if (eu) {
    const [, d, m, y] = eu;
    return new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  }
  const t = Date.parse(s);
  return Number.isFinite(t) ? new Date(t) : null;
}

function extractInsertId(result: unknown): number | null {
  if (Array.isArray(result) && result.length > 0) {
    const first = result[0] as { insertId?: number | string };
    if (first && first.insertId !== undefined) return Number(first.insertId);
  }
  if (typeof result === "object" && result !== null) {
    const r = result as { insertId?: number | string };
    if (r.insertId !== undefined) return Number(r.insertId);
  }
  return null;
}

// =====================================================================
// Operating-cost classification — mirrors scripts/import_operating_costs.py
// =====================================================================

type Category =
  | "salaries"
  | "rent"
  | "fuel"
  | "maintenance"
  | "utilities"
  | "phone_internet"
  | "office"
  | "it_equipment"
  | "marketing"
  | "legal"
  | "accounting"
  | "bank_fees"
  | "tax"
  | "other_operating";

type Classification = "operating" | "inventory" | "shipping" | "other";

const EXPLICIT_TYPE_MAP: Record<string, [Category, Classification]> = {
  "Salary Elio": ["salaries", "operating"],
  "Salary Naseer": ["salaries", "operating"],
  Rent: ["rent", "operating"],
  "Office charges": ["office", "operating"],
  "Maintenance & repairs": ["maintenance", "operating"],
  Fuel: ["fuel", "operating"],
  Electricity: ["utilities", "operating"],
  VAT: ["tax", "operating"],
  "Partner account": ["other_operating", "operating"],
  "Inventory Purchase": ["other_operating", "inventory"],
};

const BLANK_DESC_RULES: Array<[RegExp, Category]> = [
  [/هاتف|phone|wifi|internet|du\b|etisalat/i, "phone_internet"],
  [/كهرباء|electric(ity)?|hvac|water|dewa/i, "utilities"],
  [/أتعاب قانونية|legal/i, "legal"],
  [/أتعاب محاسبية|accounting|bookkeep/i, "accounting"],
  [/أجهزة الكمبيوتر|computer|laptop|software|adobe|microsoft|it\b/i, "it_equipment"],
  [/office kitchen|kitchen|coffee|water cooler|stationery|أدوات مكتبية|مطبوعات|office supplies/i, "office"],
  [/دعايه|advert|marketing|إعلان|sponsor/i, "marketing"],
  [/رسوم مصرفية|bank fee|wire fee|transfer fee/i, "bank_fees"],
  [/تكاليف ضريبية|vat|tax/i, "tax"],
  [/إصلاح|maintenance|repair|service/i, "maintenance"],
  [/fuel|gas|petrol|مركبات|vehicle/i, "fuel"],
  [/rent|إيجار/i, "rent"],
  [/salary|راتب|wage/i, "salaries"],
];

function classifyCost(
  costType: string | null,
  expenseAccount: string | null,
): { category: Category; classification: Classification } {
  const ct = (costType || "").trim();
  if (ct in EXPLICIT_TYPE_MAP) {
    const [c, cls] = EXPLICIT_TYPE_MAP[ct];
    return { category: c, classification: cls };
  }
  if (ct === "") {
    const desc = expenseAccount || "";
    for (const [pat, cat] of BLANK_DESC_RULES) {
      if (pat.test(desc)) return { category: cat, classification: "operating" };
    }
    return { category: "other_operating", classification: "operating" };
  }
  return { category: "other_operating", classification: "operating" };
}

// =====================================================================
// Public entry points
// =====================================================================

export async function importDashboard(fileBase64: string): Promise<ImportSummary> {
  const buffer = Buffer.from(fileBase64, "base64");
  return importDashboardWorkbook(buffer);
}

/**
 * Import the Dashboard workbook. If `forceRebuild` is false and the same bytes
 * have already been imported successfully (matched by SHA256), this returns the
 * cached summary in milliseconds without touching the database. Pass
 * `forceRebuild: true` to ignore the cache and rebuild anyway.
 */
export async function importDashboardWorkbook(
  buffer: Buffer,
  opts: { forceRebuild?: boolean; fileName?: string } = {},
): Promise<ImportSummary & { cached?: boolean; fileHash?: string; lastSyncAt?: Date }> {
  const t0 = Date.now();
  const fileHash = sha256Hex(buffer);
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Fast path: bytes match the last successful import — return cached summary.
  if (!opts.forceRebuild) {
    try {
      const [existing] = await db
        .select()
        .from(syncState)
        .where(eq(syncState.source, "dashboard"))
        .limit(1);
      if (existing && existing.fileHash === fileHash && existing.summaryJson) {
        const cached = JSON.parse(existing.summaryJson) as ImportSummary;
        return {
          ...cached,
          cached: true,
          fileHash,
          lastSyncAt: existing.lastSyncAt,
        };
      }
    } catch (e) {
      // syncState table may not exist on first run; fall through to rebuild.
      console.warn("[importDashboardWorkbook] cache lookup failed, rebuilding:", e);
    }
  }

  const warnings: string[] = [];
  const workbook = XLSX.read(buffer, { cellDates: true });

  const getSheet = (name: string) => {
    if (!workbook.SheetNames.includes(name)) return [];
    const ws = workbook.Sheets[name];
    return XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" }) as any[][];
  };

  const dimClientsRows = getSheet("Dim_Clients");
  const factSalesRows = getSheet("Fact_Sales");
  const cogsRows = getSheet("COGS");
  const balancesRows = getSheet("Client_Balances");
  const factCostRows = getSheet("Fact_Cost");

  if (factSalesRows.length < 2) throw new Error("Fact_Sales sheet is empty or missing");
  if (dimClientsRows.length < 2) throw new Error("Dim_Clients sheet is empty or missing");

  // ---------- Dim_Clients ----------
  const dimHeaders = (dimClientsRows[0] as string[]).map((h) => (h ? String(h) : ""));
  const cClientId = dimHeaders.findIndex((h) => h.toLowerCase().includes("client_id"));
  const cName = dimHeaders.findIndex((h) => h.toLowerCase().includes("client_name"));
  const cIndustry = dimHeaders.findIndex((h) => h.toLowerCase().includes("industry"));
  const cPhone = dimHeaders.findIndex((h) => h.toLowerCase().includes("phone"));
  const cEmail = dimHeaders.findIndex((h) => h.toLowerCase().includes("email"));
  const cAddress = dimHeaders.findIndex((h) => h.toLowerCase().includes("address"));
  if (cClientId < 0 || cName < 0) {
    throw new Error("Dim_Clients must have 'Client_ID' and 'Client_Name' columns");
  }

  type ClientData = {
    srcId: number;
    name: string;
    industry: string | null;
    phone: string | null;
    email: string | null;
    address: string | null;
  };
  const parsedClients: ClientData[] = [];
  for (let i = 1; i < dimClientsRows.length; i++) {
    const row = dimClientsRows[i];
    if (!row) continue;
    const srcId = asNumber(row[cClientId]);
    const name = normalizeName(row[cName]);
    if (!name || srcId === 0) continue;
    parsedClients.push({
      srcId,
      name,
      industry: cIndustry >= 0 ? normalizeName(row[cIndustry]) || null : null,
      phone: cPhone >= 0 ? normalizeName(row[cPhone]) || null : null,
      email: cEmail >= 0 ? normalizeName(row[cEmail]) || null : null,
      address: cAddress >= 0 ? normalizeName(row[cAddress]) || null : null,
    });
  }
  const clientIdByNormalizedName = new Map<string, number>();
  for (const client of parsedClients) {
    const key = normalizeClientLookupKey(client.name);
    if (key && !clientIdByNormalizedName.has(key)) {
      clientIdByNormalizedName.set(key, client.srcId);
    }
  }
  let nextFallbackClientId = Math.max(0, ...parsedClients.map((client) => client.srcId)) + 1;
  const fallbackClientIdByKey = new Map<string, number>();

  // ---------- Fact_Sales (with Item_ID column H) ----------
  const salesHeaders = (factSalesRows[0] as string[]).map((h) => (h ? String(h) : ""));
  const sClientId = salesHeaders.findIndex((h) => h.toLowerCase().includes("client_id"));
  const sClientName = salesHeaders.findIndex((h) => h.toLowerCase().includes("client_name"));
  const sInvoiceNo = salesHeaders.findIndex((h) => h.toLowerCase().includes("invoice_no"));
  const sDate = salesHeaders.findIndex((h) => h.toLowerCase().includes("invoice_date"));
  const sType = salesHeaders.findIndex((h) => h.toLowerCase().includes("revenue_type"));
  const sItemId = salesHeaders.findIndex((h) => h.toLowerCase().trim() === "item_id");
  const sDescription = salesHeaders.findIndex((h) => h.toLowerCase().includes("item_description"));
  const sGrossProfit = salesHeaders.findIndex((h) => h.toLowerCase().trim() === "gross_profit");
  const sNetRevenue = salesHeaders.findIndex((h) => h.toLowerCase().includes("net_revenue"));
  const sFactSalesCogs = salesHeaders.findIndex((h) => h.toLowerCase().trim() === "cogs");
  const sAmount = findFactSalesAmountColumn(salesHeaders);
  // The workbook owner's reporting definition is column O (Gross_Profit).
  // Retain Net_Revenue only as a backward-compatible fallback for older files.
  if ((sClientId < 0 && sClientName < 0) || sDescription < 0 || sAmount < 0) {
    throw new Error("Fact_Sales must have Client_ID or Client_Name, Item_Description, and Gross_Profit (or Net_Revenue) columns");
  }

  type SalesRow = {
    clientSrcId: number;
    invoiceNo: string;
    date: Date;
    type: "purchase" | "sharpening";
    itemId: string | null;
    description: string;
    amount: number;
  };
  const salesRows: SalesRow[] = [];
  for (let i = 1; i < factSalesRows.length; i++) {
    const row = factSalesRows[i];
    if (!row) continue;
    const suppliedClientId = sClientId >= 0 ? asNumber(row[sClientId]) : 0;
    const clientName = sClientName >= 0 ? normalizeName(row[sClientName]) : "";
    const invoiceNo = sInvoiceNo >= 0 ? normalizeName(row[sInvoiceNo]) : "";
    const clientKey = normalizeClientLookupKey(clientName) || `invoice:${invoiceNo || i}`;
    let clientSrcId = suppliedClientId || clientIdByNormalizedName.get(clientKey) || 0;
    if (!clientSrcId) {
      clientSrcId = fallbackClientIdByKey.get(clientKey) || nextFallbackClientId++;
      fallbackClientIdByKey.set(clientKey, clientSrcId);
      parsedClients.push({
        srcId: clientSrcId,
        name: clientName || `Unassigned invoice ${invoiceNo || i}`,
        industry: null,
        phone: null,
        email: null,
        address: null,
      });
      clientIdByNormalizedName.set(clientKey, clientSrcId);
      warnings.push(`Invoice ${invoiceNo || "(no number)"}: created placeholder client because no Client_ID or Dim_Clients name match was available`);
    }
    const amount = resolveFactSalesGrossProfit(row, sGrossProfit, sNetRevenue, sFactSalesCogs);
    const description = normalizeName(row[sDescription]) || `Unspecified sales line — Invoice ${invoiceNo || i}`;
    if (amount === 0) continue;
    const date = sDate >= 0 ? asDate(row[sDate]) : null;
    if (!date) {
      warnings.push(`Invoice ${invoiceNo || "(no number)"}: could not parse date; skipped`);
      continue;
    }
    const rawType = sType >= 0 ? normalizeName(row[sType]).toLowerCase() : "";
    const type: "purchase" | "sharpening" = rawType.includes("sharp") ? "sharpening" : "purchase";

    const itemIdRaw = sItemId >= 0 ? normalizeName(row[sItemId]) : "";
    const itemId = itemIdRaw ? itemIdRaw.slice(0, 128) : null;

    salesRows.push({ clientSrcId, invoiceNo, date, type, itemId, description, amount });
  }

  // ---------- COGS ----------
  const cogsByInvoice = new Map<string, number>();
  // Also capture date + clientId for orphan invoices (present in COGS but not in Fact_Sales)
  type CogsMetadata = { invoiceNo: string; date: Date | null; clientSrcId: number; clientName: string; cogsAmount: number };
  const cogsMetadata: CogsMetadata[] = [];
  if (cogsRows.length > 1) {
    const cogsHeaders = (cogsRows[0] as string[]).map((h) => (h ? String(h) : ""));
    const cogsInvoiceCol = cogsHeaders.findIndex((h) => h.toLowerCase().includes("invoice_no"));
    const cogsAmountCol = cogsHeaders.findIndex((h) => h.toLowerCase().includes("cost_of_sales"));
    const cogsDateCol = cogsHeaders.findIndex((h) => h.toLowerCase().includes("invoice_date"));
    const cogsClientIdCol = cogsHeaders.findIndex((h) => h.toLowerCase().includes("client_id"));
    const cogsClientNameCol = cogsHeaders.findIndex((h) => h.toLowerCase().includes("client_name"));
    if (cogsInvoiceCol >= 0 && cogsAmountCol >= 0) {
      for (let i = 1; i < cogsRows.length; i++) {
        const row = cogsRows[i];
        if (!row) continue;
        const invoiceNo = normalizeName(row[cogsInvoiceCol]);
        const cogsAmount = asNumber(row[cogsAmountCol]);
        if (invoiceNo && cogsAmount > 0) {
          cogsByInvoice.set(invoiceNo, cogsAmount);
          cogsMetadata.push({
            invoiceNo,
            date: cogsDateCol >= 0 ? asDate(row[cogsDateCol]) : null,
            clientSrcId: cogsClientIdCol >= 0 ? asNumber(row[cogsClientIdCol]) : 0,
            clientName: cogsClientNameCol >= 0 ? normalizeName(row[cogsClientNameCol]) : "",
            cogsAmount,
          });
        }
      }
    }
  }

  // ---------- Orphan COGS invoices (in COGS sheet but NOT in Fact_Sales) ----------
  // Create synthetic salesRows so their COGS is captured in the transactions table.
  const salesInvoiceNos = new Set(salesRows.map((r) => r.invoiceNo));
  const orphanInvoices = new Map<string, CogsMetadata>();
  for (const meta of cogsMetadata) {
    if (!salesInvoiceNos.has(meta.invoiceNo) && !orphanInvoices.has(meta.invoiceNo)) {
      orphanInvoices.set(meta.invoiceNo, meta);
    }
  }
  if (orphanInvoices.size > 0) {
    warnings.push(`${orphanInvoices.size} COGS-only invoice(s) not in Fact_Sales — created synthetic transaction(s) to capture COGS`);
    for (const [, meta] of Array.from(orphanInvoices.entries())) {
      salesRows.push({
        clientSrcId: meta.clientSrcId,
        invoiceNo: meta.invoiceNo,
        date: meta.date ?? new Date(),
        type: "purchase",
        itemId: null,
        description: `COGS-only (no Fact_Sales detail) — ${meta.clientName}`.slice(0, 200),
        amount: 0, // Revenue unknown for orphan COGS invoices
      });
    }
  }

  // ---------- Client_Balances ----------
  type BalanceRow = { srcId: number; outstanding: number; oldestUnpaid: Date | null };
  const balanceBySrcId = new Map<number, BalanceRow>();
  if (balancesRows.length > 1) {
    const bhHeaders = (balancesRows[0] as string[]).map((h) => (h ? String(h).toLowerCase() : ""));
    const bClientId = bhHeaders.findIndex((h) => h.includes("client_id"));
    const bOutstanding = bhHeaders.findIndex(
      (h) => h.includes("outstanding") || h.includes("balance") || h.includes("amount_due"),
    );
    const bOldest = bhHeaders.findIndex(
      (h) => h.includes("oldest") || h.includes("first_unpaid") || h.includes("invoice_date"),
    );
    if (bClientId >= 0 && bOutstanding >= 0) {
      for (let i = 1; i < balancesRows.length; i++) {
        const row = balancesRows[i];
        if (!row) continue;
        const srcId = asNumber(row[bClientId]);
        const outstanding = asNumber(row[bOutstanding]);
        if (srcId === 0) continue;
        const oldestUnpaid = bOldest >= 0 ? asDate(row[bOldest]) : null;
        balanceBySrcId.set(srcId, { srcId, outstanding, oldestUnpaid });
      }
    } else {
      warnings.push("Client_Balances: could not find Client_ID + outstanding columns; balances not refreshed");
    }
  } else {
    warnings.push("Client_Balances sheet missing or empty; balances not refreshed");
  }

  // ---------- Fact_Cost ----------
  type CostRow = {
    excelCostId: string | null;
    excelKey: string | null;
    txDate: Date;
    payee: string | null;
    expenseAccount: string | null;
    description: string | null;
    amount: number;
    currency: string;
    paidFrom: string | null;
    reference: string | null;
    rawCostType: string | null;
    costCenter: string | null;
    category: Category;
    classification: Classification;
  };
  const parsedCosts: CostRow[] = [];
  if (factCostRows.length > 1) {
    const costHeaders = (factCostRows[0] as string[]).map((h) => (h ? String(h) : ""));
    const idx = (label: string) => costHeaders.findIndex((h) => h.toLowerCase() === label.toLowerCase());
    const cDate = idx("Date");
    const cAmount = idx("Amount");
    const cCostType = idx("Cost_Type");
    const cExpense = idx("Expense_Account");
    const cPayee = idx("Payee");
    const cDesc = idx("Description");
    const cCurrency = idx("Currency");
    const cPaidFrom = idx("Paid_From");
    const cRef = idx("Reference");
    const cCenter = idx("Cost_Center");
    const cCostId = idx("Cost_ID");
    const cKey = idx("_Key");

    if (cDate < 0 || cAmount < 0) {
      warnings.push("Fact_Cost missing Date/Amount columns; operating costs not refreshed");
    } else {
      for (let i = 1; i < factCostRows.length; i++) {
        const row = factCostRows[i];
        if (!row) continue;
        const dt = asDate(row[cDate]);
        const amt = asNumber(row[cAmount]);
        if (!dt || amt === 0) continue;
        const costType = cCostType >= 0 ? normalizeName(row[cCostType]) : "";
        const expense = cExpense >= 0 ? normalizeName(row[cExpense]) : "";
        const { category, classification } = classifyCost(costType, expense);
        parsedCosts.push({
          excelCostId: cCostId >= 0 && row[cCostId] != null ? String(row[cCostId]) : null,
          excelKey: cKey >= 0 ? normalizeName(row[cKey]) || null : null,
          txDate: dt,
          payee: cPayee >= 0 ? normalizeName(row[cPayee]) || null : null,
          expenseAccount: expense || null,
          description: cDesc >= 0 ? normalizeName(row[cDesc]) || null : null,
          amount: amt,
          currency: cCurrency >= 0 ? normalizeName(row[cCurrency]) || "AED" : "AED",
          paidFrom: cPaidFrom >= 0 ? normalizeName(row[cPaidFrom]) || null : null,
          reference: cRef >= 0 && row[cRef] != null ? String(row[cRef]) : null,
          rawCostType: costType || null,
          costCenter: cCenter >= 0 ? normalizeName(row[cCenter]) || null : null,
          category,
          classification,
        });
      }
    }
  } else {
    warnings.push("Fact_Cost sheet missing or empty; operating costs not refreshed");
  }

  // =====================================================================
  // Distribute invoice-level COGS proportionally across each invoice's line
  // items, so SUM(transactions.cogs) == SUM(COGS sheet) exactly.
  // The COGS sheet only has one row per invoice; without distribution every
  // line item would be assigned the FULL invoice COGS, inflating COGS by the
  // average lines-per-invoice (~5x).
  // =====================================================================
  const revenueByInvoice = new Map<string, number>();
  for (const row of salesRows) {
    revenueByInvoice.set(row.invoiceNo, (revenueByInvoice.get(row.invoiceNo) || 0) + row.amount);
  }
  const cogsByTxKey = new Map<string, number>();
  // Track per-invoice running assigned COGS so the last line absorbs the rounding remainder.
  const assignedCogsPerInvoice = new Map<string, number>();
  const linesByInvoice = new Map<string, number>();
  for (const row of salesRows) {
    linesByInvoice.set(row.invoiceNo, (linesByInvoice.get(row.invoiceNo) || 0) + 1);
  }
  const seenLineCountPerInvoice = new Map<string, number>();
  for (let i = 0; i < salesRows.length; i++) {
    const row = salesRows[i];
    if (!row) continue;
    const invCogs = cogsByInvoice.get(row.invoiceNo) || 0;
    const invRev = revenueByInvoice.get(row.invoiceNo) || 0;
    const totalLines = linesByInvoice.get(row.invoiceNo) || 1;
    const seen = (seenLineCountPerInvoice.get(row.invoiceNo) || 0) + 1;
    seenLineCountPerInvoice.set(row.invoiceNo, seen);

    let lineCogs = 0;
    if (invCogs > 0) {
      if (seen === totalLines) {
        // Last line: take whatever's left so the sum reconciles to the cent.
        lineCogs = Math.max(0, invCogs - (assignedCogsPerInvoice.get(row.invoiceNo) || 0));
      } else if (invRev > 0) {
        lineCogs = (invCogs * row.amount) / invRev;
      } else {
        // Revenue-less line; spread evenly
        lineCogs = invCogs / totalLines;
      }
      lineCogs = Math.round(lineCogs * 100) / 100;
      assignedCogsPerInvoice.set(
        row.invoiceNo,
        (assignedCogsPerInvoice.get(row.invoiceNo) || 0) + lineCogs
      );
    }
    // Use a stable key: invoice + line index
    cogsByTxKey.set(`${row.invoiceNo}|${i}`, lineCogs);
  }

  // =====================================================================
  // Aggregates
  // =====================================================================
  let totalRevenue = 0;
  let totalCOGS = 0;
  for (const row of salesRows) {
    totalRevenue += row.amount;
  }
  // Sum the actual per-invoice COGS (each invoice counted once)
  Array.from(cogsByInvoice.values()).forEach((v) => {
    totalCOGS += v;
  });
  const grossProfit = totalRevenue - totalCOGS;

  let operatingCostsTotal = 0;
  let inventoryCostsTotal = 0;
  for (const c of parsedCosts) {
    if (c.classification === "operating") operatingCostsTotal += c.amount;
    else if (c.classification === "inventory") inventoryCostsTotal += c.amount;
  }

  // =====================================================================
  // Apply atomically — batched inserts to minimize TiDB round-trips.
  // =====================================================================

  await db.execute(sql`SET FOREIGN_KEY_CHECKS = 0`);
  await db.execute(sql`TRUNCATE TABLE transactions`);
  await db.execute(sql`TRUNCATE TABLE tools`);
  await db.execute(sql`TRUNCATE TABLE clients`);
  if (parsedCosts.length > 0) {
    // Only wipe if we have new rows to insert; otherwise leave existing state.
    await db.execute(sql`DELETE FROM operatingCosts`);
  }
  await db.execute(sql`SET FOREIGN_KEY_CHECKS = 1`);

  const CHUNK = 200;

  // ---- Clients ---- (batched). Use Excel client_id as the primary key so we
  // never have to round-trip insertId per row.
  const clientIdMap = new Map<number, number>();
  const clientBatch: (typeof clients.$inferInsert)[] = [];
  const seenClientIds = new Set<number>();
  for (const c of parsedClients) {
    if (seenClientIds.has(c.srcId)) continue;
    seenClientIds.add(c.srcId);
    const balance = balanceBySrcId.get(c.srcId);
    clientBatch.push({
      id: c.srcId,
      companyName: c.name,
      industry: c.industry,
      contactPerson: null,
      email: c.email,
      phone: c.phone,
      address: c.address,
      notes: null,
      activityLevel: "high",
      managerCustomerKey: null,
      excelClientId: c.srcId,
      outstandingBalance: balance ? balance.outstanding.toFixed(2) : "0",
      oldestUnpaidDate: balance?.oldestUnpaid ?? null,
    } as typeof clients.$inferInsert);
    clientIdMap.set(c.srcId, c.srcId);
  }
  // Placeholder clients for any orphan Sales rows.
  for (const row of salesRows) {
    const srcId = row.clientSrcId;
    if (!srcId || clientIdMap.has(srcId) || seenClientIds.has(srcId)) continue;
    seenClientIds.add(srcId);
    clientBatch.push({
      id: srcId,
      companyName: `Unassigned (Client #${srcId})`,
      activityLevel: "low",
      excelClientId: srcId,
    } as typeof clients.$inferInsert);
    clientIdMap.set(srcId, srcId);
    warnings.push(`Created placeholder for Client_ID=${srcId}`);
  }
  for (let i = 0; i < clientBatch.length; i += CHUNK) {
    const slice = clientBatch.slice(i, i + CHUNK);
    if (slice.length === 0) continue;
    await db.insert(clients).values(slice);
  }

  // ---- Tools ---- (batched). Auto-increment ids; we read them back in one SELECT.
  const toolIdByName = new Map<string, number>();
  const toolBatch: (typeof tools.$inferInsert)[] = [];
  const seenToolNames = new Set<string>();
  for (const row of salesRows) {
    if (seenToolNames.has(row.description)) continue;
    seenToolNames.add(row.description);
    toolBatch.push({
      name: row.description,
      unitPrice: "0",
      category: row.type === "sharpening" ? "Sharpening" : "Tool",
    } as typeof tools.$inferInsert);
  }
  for (let i = 0; i < toolBatch.length; i += CHUNK) {
    const slice = toolBatch.slice(i, i + CHUNK);
    if (slice.length === 0) continue;
    await db.insert(tools).values(slice);
  }
  // Read back the assigned ids in one SELECT.
  if (toolBatch.length > 0) {
    const rows = await db.select({ id: tools.id, name: tools.name }).from(tools);
    for (const r of rows) {
      if (r.name) toolIdByName.set(r.name, r.id);
    }
  }

  // ---- Transactions (with itemId baked in, COGS proportionally distributed) ----
  let insertedTx = 0;
  const txBatch: (typeof transactions.$inferInsert)[] = [];
  for (let i = 0; i < salesRows.length; i++) {
    const row = salesRows[i];
    if (!row) continue;
    const clientId = clientIdMap.get(row.clientSrcId);
    if (!clientId) continue;
    const toolId = toolIdByName.get(row.description) ?? null;
    const cogs = cogsByTxKey.get(`${row.invoiceNo}|${i}`) ?? 0;
    txBatch.push({
      clientId,
      toolId,
      type: row.type,
      description: row.description,
      itemId: row.itemId,
      quantity: 1,
      amount: row.amount.toFixed(2),
      cogs: cogs.toFixed(2),
      status: "paid",
      invoiceNumber: row.invoiceNo || null,
      transactionDate: row.date,
      notes: null,
    } as typeof transactions.$inferInsert);
  }
  for (let i = 0; i < txBatch.length; i += CHUNK) {
    const slice = txBatch.slice(i, i + CHUNK);
    if (slice.length === 0) continue;
    await db.insert(transactions).values(slice);
    insertedTx += slice.length;
  }

  // ---- Operating costs ----
  if (parsedCosts.length > 0) {
    const costBatch: (typeof operatingCosts.$inferInsert)[] = parsedCosts.map((c) => ({
      excelCostId: c.excelCostId,
      excelKey: c.excelKey,
      txDate: c.txDate,
      payee: c.payee,
      expenseAccount: c.expenseAccount,
      description: c.description,
      amount: c.amount.toFixed(2),
      currency: c.currency,
      paidFrom: c.paidFrom,
      reference: c.reference,
      rawCostType: c.rawCostType,
      costCenter: c.costCenter,
      category: c.category,
      classification: c.classification,
    }));
    for (let i = 0; i < costBatch.length; i += CHUNK) {
      const slice = costBatch.slice(i, i + CHUNK);
      if (slice.length === 0) continue;
      await db.insert(operatingCosts).values(slice);
    }
  }

  const summary: ImportSummary = {
    clients: parsedClients.length,
    tools: toolIdByName.size,
    transactions: insertedTx,
    invoices: new Set(salesRows.map((r) => r.invoiceNo)).size,
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    totalCOGS: Math.round(totalCOGS * 100) / 100,
    grossProfit: Math.round(grossProfit * 100) / 100,
    balancesUpdated: balanceBySrcId.size,
    operatingCostsRows: parsedCosts.length,
    operatingCostsTotal: Math.round(operatingCostsTotal * 100) / 100,
    inventoryCostsTotal: Math.round(inventoryCostsTotal * 100) / 100,
    warnings,
  };

  // Persist the new file hash + summary so future identical uploads short-circuit.
  try {
    const summaryJson = JSON.stringify(summary);
    await db
      .insert(syncState)
      .values({
        source: "dashboard",
        fileHash,
        fileName: opts.fileName ?? null,
        summaryJson,
      })
      .onConflictDoUpdate({
        target: syncState.source,
        set: {
          fileHash,
          fileName: opts.fileName ?? null,
          summaryJson,
          lastSyncAt: new Date(),
        },
      });
  } catch (e) {
    console.warn("[importDashboardWorkbook] failed to persist syncState:", e);
  }

  const elapsedMs = Date.now() - t0;
  console.log(`[importDashboardWorkbook] rebuilt in ${elapsedMs}ms (cached=false)`);

  return {
    ...summary,
    cached: false,
    fileHash,
    lastSyncAt: new Date(),
  };
}
