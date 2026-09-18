/**
 * Financial reconciliation between CRM and Manager.io.
 *
 * All money totals shown on client cards, dashboards and statements are
 * derived from Manager.io (the source of truth) and expressed tax-exclusive
 * (net of UAE VAT 5%). The CRM's own transaction rows are kept only for
 * line-item metadata (which tool, which invoice, which date).
 */
import {
  UAE_VAT_RATE,
  fetchAllReceipts,
  fetchAllSalesInvoices,
  parseCustomerField,
  taxExclusive,
  type ManagerReceipt,
  type ManagerSalesInvoice,
} from "./manager";

export interface InvoiceLine {
  key: string;
  issueDate: string;
  reference: string | null;
  grossAmount: number;
  netAmount: number;
  vatAmount: number;
  balanceDue: number;
  status: string;
}

export interface ReceiptLine {
  key: string;
  date: string;
  reference: string | null;
  amount: number;
  receivedIn: string | null;
}

export interface ClientFinancials {
  /** Tax-exclusive billed amount across all Manager.io invoices for this client. */
  netBilled: number;
  /** VAT portion — difference between gross and net. */
  vatBilled: number;
  /** Gross = invoiceAmount sum (tax-inclusive). */
  grossBilled: number;
  /** Payments received against this customer (receipts). */
  paid: number;
  /** Outstanding balance — from Manager.io balanceDue column (gross). */
  outstanding: number;
  /** Invoice count. */
  invoiceCount: number;
  /** Paid invoices count (status === "Paid"). */
  paidInvoiceCount: number;
  /** All invoices, newest first. */
  invoices: InvoiceLine[];
  /** All receipts, newest first. */
  receipts: ReceiptLine[];
}

/**
 * Match a Manager.io customer string like "47 - BSI Interior Design" to a CRM
 * client. We match by (a) managerCustomerKey if present and resolvable, then
 * (b) the numeric code prefix when the CRM client was imported with a matching
 * dashboard Client_ID, then (c) case-insensitive substring on the name.
 */
export function matchInvoicesToClient(
  invoices: ManagerSalesInvoice[],
  options: {
    clientName: string;
    managerCustomerKey: string | null;
    customerCodes?: string[]; // fallback numeric codes
    managerCustomers?: { key: string; code: string; name: string }[];
  },
): ManagerSalesInvoice[] {
  const lcName = options.clientName.trim().toLowerCase();
  const codes = new Set((options.customerCodes ?? []).map((c) => c.trim()).filter(Boolean));

  // If we have the managerCustomerKey, resolve to code+name via customers list.
  let keyCode: string | null = null;
  let keyName: string | null = null;
  if (options.managerCustomerKey && options.managerCustomers) {
    const c = options.managerCustomers.find((x) => x.key === options.managerCustomerKey);
    if (c) {
      keyCode = c.code;
      keyName = c.name.trim().toLowerCase();
    }
  }

  return invoices.filter((inv) => {
    const parsed = parseCustomerField(inv.customer);
    if (keyCode && parsed.code === keyCode) return true;
    if (keyName && parsed.name.trim().toLowerCase() === keyName) return true;
    if (codes.size > 0 && parsed.code && codes.has(parsed.code)) return true;
    if (parsed.name && parsed.name.trim().toLowerCase() === lcName) return true;
    return false;
  });
}

/**
 * Receipts use `paidBy` (free text of the payer name). No code prefix.
 * We rely on managerCustomerKey resolution to the customer name, then
 * match case-insensitive.
 */
export function matchReceiptsToClient(
  receipts: ManagerReceipt[],
  options: {
    clientName: string;
    managerCustomerKey: string | null;
    managerCustomers?: { key: string; code: string; name: string }[];
  },
): ManagerReceipt[] {
  const candidates = new Set<string>();
  candidates.add(options.clientName.trim().toLowerCase());

  if (options.managerCustomerKey && options.managerCustomers) {
    const c = options.managerCustomers.find((x) => x.key === options.managerCustomerKey);
    if (c) candidates.add(c.name.trim().toLowerCase());
  }

  const candList = Array.from(candidates);
  return receipts.filter((r) => {
    const pb = (r.paidBy ?? "").trim().toLowerCase();
    if (!pb) return false;
    for (let i = 0; i < candList.length; i++) {
      const cand = candList[i];
      if (cand && pb === cand) return true;
    }
    return false;
  });
}

export function computeFinancials(
  invoices: ManagerSalesInvoice[],
  receipts: ManagerReceipt[],
): ClientFinancials {
  let grossBilled = 0;
  let netBilled = 0;
  let outstanding = 0;
  let paidInvoiceCount = 0;

  const invLines: InvoiceLine[] = invoices.map((inv) => {
    const gross = inv.invoiceAmount?.value ?? 0;
    const net = taxExclusive(gross);
    const vat = +(gross - net).toFixed(2);
    const bal = inv.balanceDue?.value ?? 0;
    grossBilled += gross;
    netBilled += net;
    outstanding += bal;
    if ((inv.status ?? "").toLowerCase() === "paid") paidInvoiceCount++;
    return {
      key: inv.key,
      issueDate: inv.issueDate,
      reference: inv.reference,
      grossAmount: +gross.toFixed(2),
      netAmount: net,
      vatAmount: vat,
      balanceDue: +bal.toFixed(2),
      status: inv.status,
    };
  });

  invLines.sort((a, b) => b.issueDate.localeCompare(a.issueDate));

  const recLines: ReceiptLine[] = receipts
    .map((r) => ({
      key: r.key,
      date: r.date,
      reference: r.reference,
      amount: +(r.amount?.value ?? 0).toFixed(2),
      receivedIn: r.receivedIn?.name ?? null,
    }))
    .sort((a, b) => b.date.localeCompare(a.date));

  const paid = +recLines.reduce((s, r) => s + r.amount, 0).toFixed(2);

  return {
    netBilled: +netBilled.toFixed(2),
    vatBilled: +(grossBilled - netBilled).toFixed(2),
    grossBilled: +grossBilled.toFixed(2),
    paid,
    outstanding: +outstanding.toFixed(2),
    invoiceCount: invoices.length,
    paidInvoiceCount,
    invoices: invLines,
    receipts: recLines,
  };
}

/**
 * Compute a Manager.io-based Statement of Account for every customer at once,
 * in a single pass over the invoices/receipts feeds. Keyed by managerCustomerKey.
 */
export async function loadAllFinancialsByManagerKey(opts: { forceRefresh?: boolean } = {}) {
  const [invoices, receipts] = await Promise.all([
    fetchAllSalesInvoices({ forceRefresh: opts.forceRefresh }),
    fetchAllReceipts({ forceRefresh: opts.forceRefresh }),
  ]);

  return {
    invoices,
    receipts,
    vatRate: UAE_VAT_RATE,
  };
}

/**
 * Portfolio-wide roll-up used by the Dashboard. Aggregates across the whole
 * Manager.io feed so the numbers shown on the home page are the exact sum of
 * what each client's SOA shows. Every figure is tax-inclusive (gross),
 * except `netBilled` which is the VAT-exclusive equivalent of `grossBilled`.
 *
 * `outstanding` is the sum of Manager.io `balanceDue` across every invoice
 * — the authoritative number the user reconciles against Manager.io.
 */
/**
 * Returns the current year-month as "YYYY-MM" in the given IANA timezone.
 * Exported for the regression test that covers month-boundary receipts.
 */
export function currentYmInTz(tz: string, now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);
  const year = parts.find((p) => p.type === "year")?.value ?? "1970";
  const month = parts.find((p) => p.type === "month")?.value ?? "01";
  return `${year}-${month}`;
}

// In-memory cache for portfolio totals (survives within a single server process)
let portfolioCacheData: any = null;
let portfolioCacheTime = 0;

export async function computePortfolioTotals(opts: { forceRefresh?: boolean } = {}) {
  try {
    const { invoices, receipts } = await loadAllFinancialsByManagerKey(opts);

    let grossBilled = 0;
    let netBilled = 0;
    let outstanding = 0;
    let paidInvoiceCount = 0;
    for (const inv of invoices) {
      const gross = inv.invoiceAmount?.value ?? 0;
      const net = taxExclusive(gross);
      const bal = inv.balanceDue?.value ?? 0;
      grossBilled += gross;
      netBilled += net;
      outstanding += bal;
      if ((inv.status ?? "").toLowerCase() === "paid") paidInvoiceCount++;
    }

    // Total paid across the portfolio = sum of receipts.
    let paid = 0;
    // "This month" must be computed in the business timezone (Dubai / GMT+4),
    // otherwise receipts entered late at night on the 30th of the month can
    // land in the previous UTC month and be wrongly excluded.
    const currentYm = currentYmInTz("Asia/Dubai");
    let paidThisMonth = 0;
    for (const r of receipts) {
      const amt = r.amount?.value ?? 0;
      paid += amt;
      const ym = (r.date ?? "").slice(0, 7);
      if (ym === currentYm) paidThisMonth += amt;
    }

    const result = {
      grossBilled: +grossBilled.toFixed(2),
      netBilled: +netBilled.toFixed(2),
      vatBilled: +(grossBilled - netBilled).toFixed(2),
      paid: +paid.toFixed(2),
      paidThisMonth: +paidThisMonth.toFixed(2),
      outstanding: +outstanding.toFixed(2),
      invoiceCount: invoices.length,
      paidInvoiceCount,
      receiptCount: receipts.length,
      vatRate: UAE_VAT_RATE,
      asOf: new Date().toISOString(),
      isCached: false,
    };
    // Cache successful result
    portfolioCacheData = result;
    portfolioCacheTime = Date.now();
    return result;
  } catch (e) {
    // Manager.io is unreachable — return cached data if available
    if (portfolioCacheData) {
      console.warn(
        `Manager.io unreachable, returning cached portfolio totals from ${new Date(portfolioCacheTime).toISOString()}`
      );
      return {
        ...portfolioCacheData,
        isCached: true,
        asOf: new Date(portfolioCacheTime).toISOString(),
      };
    }
    // No cache available — re-throw the error
    throw e;
  }
}
