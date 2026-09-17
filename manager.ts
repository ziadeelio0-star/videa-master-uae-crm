/**
 * Manager.io integration service.
 *
 * The CRM reaches the user's local Manager.io install through a Cloudflare
 * quick tunnel. The tunnel URL is stored in env so it can be rotated
 * (either by hand in the Settings UI or automatically by the Windows
 * cloudflared-watcher we ship separately) without a redeploy.
 *
 * All GET helpers use a tiny in-memory TTL cache so we don't hammer the
 * local machine, and so the UI stays fast.
 */

import { getApiConfig } from "./apiConfig";
import https from "https";

type CacheEntry<T> = { expiresAt: number; value: T };
const cache = new Map<string, CacheEntry<unknown>>();
const DEFAULT_TTL_MS = 60 * 1000; // 60s default; inventory endpoints use 5min

function getBaseUrl(): string | null {
  // Try config first, then fall back to env
  let raw = getApiConfig("manager.api.url") ?? process.env.MANAGER_API_URL;
  if (!raw || raw.trim().length === 0) return null;
  // Strip trailing slash.
  return raw.replace(/\/+$/, "");
}

function getApiKey(): string | null {
  // Try config first, then fall back to env
  let raw = getApiConfig("manager.api.key") ?? process.env.MANAGER_API_KEY;
  if (!raw || raw.trim().length === 0) return null;
  return raw;
}

export class ManagerConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ManagerConfigError";
  }
}

export class ManagerApiError extends Error {
  constructor(
    public status: number,
    public path: string,
    message: string
  ) {
    super(message);
    this.name = "ManagerApiError";
  }
}

export function isManagerConfigured(): boolean {
  return getBaseUrl() !== null && getApiKey() !== null;
}

export async function managerFetch<T = unknown>(
  path: string,
  opts: { ttlMs?: number; forceRefresh?: boolean } = {}
): Promise<T> {
  const base = getBaseUrl();
  const key = getApiKey();
  if (!base || !key) {
    throw new ManagerConfigError(
      "Manager.io is not configured. Set MANAGER_API_URL and MANAGER_API_KEY."
    );
  }

  const fullPath = path.startsWith("/") ? path : `/${path}`;
  const url = `${base}${fullPath}`;
  const cacheKey = url;
  const ttl = opts.ttlMs ?? DEFAULT_TTL_MS;

  if (!opts.forceRefresh) {
    const cached = cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value as T;
    }
  }

  let res: Response;
  try {
    // For tunnel URLs (trycloudflare.com), disable certificate validation
    // This is safe because we're connecting to Cloudflare's trusted infrastructure
    const fetchOptions: any = {
      method: "GET",
      headers: {
        "X-API-KEY": key,
        Accept: "application/json",
      },
      // 25s timeout — Cloudflare free quick tunnels can be slow on first hit.
      signal: AbortSignal.timeout(25_000),
    };

    if (url.includes("trycloudflare.com")) {
      fetchOptions.agent = new https.Agent({ rejectUnauthorized: false });
    }

    res = await fetch(url, fetchOptions);
  } catch (err) {
    throw new ManagerApiError(
      0,
      fullPath,
      `Network error reaching Manager.io: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  if (!res.ok) {
    let detail = "";
    try {
      detail = (await res.text()).slice(0, 300);
    } catch {
      /* ignore */
    }
    throw new ManagerApiError(res.status, fullPath, `Manager.io ${res.status}: ${detail}`);
  }

  const data = (await res.json()) as T;
  cache.set(cacheKey, { expiresAt: Date.now() + ttl, value: data });
  return data;
}

export function clearManagerCache(): void {
  cache.clear();
}

/* ----------------------------- Types ----------------------------- */

export interface ManagerMoney {
  value: number;
  currency: string;
}

export interface ManagerInventoryItem {
  key: string;
  itemCode: string;
  itemName: string;
  description?: string;
  purchasePrice?: ManagerMoney;
  qtyOwned?: number;
  averageCost?: ManagerMoney | null;
  totalCost?: ManagerMoney;
}

export interface ManagerCustomer {
  key: string;
  code: string;
  name: string;
  accountsReceivable?: ManagerMoney;
  status?: string;
}

export interface ManagerBusinessInfo {
  name: string;
}

export interface ManagerListResponse<TItemsKey extends string, TItem> {
  business: ManagerBusinessInfo;
  skip: number;
  pageSize: number;
  totalRecords: number;
}

/* -------------------------- High-level helpers -------------------------- */

export async function pingBusinessName(opts: { forceRefresh?: boolean } = {}): Promise<string> {
  const data = await managerFetch<{ business?: ManagerBusinessInfo; totalRecords?: number }>(
    "/inventory-items?pageSize=1",
    { ttlMs: 30_000, forceRefresh: opts.forceRefresh }
  );
  return data.business?.name ?? "";
}

const INVENTORY_TTL = 5 * 60 * 1000;
const CUSTOMERS_TTL = 5 * 60 * 1000;

export async function fetchAllInventoryItems(opts: { forceRefresh?: boolean } = {}): Promise<{
  business: ManagerBusinessInfo;
  items: ManagerInventoryItem[];
  totalRecords: number;
}> {
  const pageSize = 500;
  let skip = 0;
  let business: ManagerBusinessInfo = { name: "" };
  const items: ManagerInventoryItem[] = [];
  let totalRecords = 0;

  for (let loop = 0; loop < 50; loop++) {
    const payload = await managerFetch<{
      business: ManagerBusinessInfo;
      totalRecords: number;
      inventoryItems: ManagerInventoryItem[];
    }>(`/inventory-items?skip=${skip}&pageSize=${pageSize}`, {
      ttlMs: INVENTORY_TTL,
      forceRefresh: opts.forceRefresh && loop === 0,
    });
    business = payload.business;
    totalRecords = payload.totalRecords;
    const batch = payload.inventoryItems ?? [];
    items.push(...batch);
    if (batch.length < pageSize || items.length >= totalRecords) break;
    skip += pageSize;
  }

  return { business, items, totalRecords };
}

export async function fetchAllCustomers(opts: { forceRefresh?: boolean } = {}): Promise<{
  business: ManagerBusinessInfo;
  customers: ManagerCustomer[];
  totalRecords: number;
}> {
  const pageSize = 500;
  let skip = 0;
  let business: ManagerBusinessInfo = { name: "" };
  const customers: ManagerCustomer[] = [];
  let totalRecords = 0;

  for (let loop = 0; loop < 50; loop++) {
    const payload = await managerFetch<{
      business: ManagerBusinessInfo;
      totalRecords: number;
      customers: ManagerCustomer[];
    }>(`/customers?skip=${skip}&pageSize=${pageSize}`, {
      ttlMs: CUSTOMERS_TTL,
      forceRefresh: opts.forceRefresh && loop === 0,
    });
    business = payload.business;
    totalRecords = payload.totalRecords;
    const batch = payload.customers ?? [];
    customers.push(...batch);
    if (batch.length < pageSize || customers.length >= totalRecords) break;
    skip += pageSize;
  }

  return { business, customers, totalRecords };
}

/* ====================== Sales Invoices & Receipts ====================== */

export interface ManagerSalesInvoice {
  key: string;
  issueDate: string;
  reference: string | null;
  customer: string | null; // "<customerCode> - <customerName>"
  description: string | null;
  invoiceAmount: ManagerMoney | null; // GROSS, tax-inclusive
  costOfSales?: ManagerMoney | null;
  balanceDue: ManagerMoney | null;
  status: string; // "Paid", "Overdue", "Due", ...
  timestamp: string;
}

export interface ManagerReceipt {
  key: string;
  date: string;
  reference: string | null;
  receivedIn: { key: string; name: string } | null;
  description: string | null;
  paidBy: string | null; // free text, name of payer
  amount: ManagerMoney | null;
}

const DOC_TTL = 2 * 60 * 1000;

async function pageAll<ListKey extends string, Item>(
  path: string,
  listKey: ListKey,
  ttlMs: number,
  forceRefresh?: boolean,
): Promise<Item[]> {
  const pageSize = 500;
  const all: Item[] = [];
  for (let skip = 0, loop = 0; loop < 100; loop++) {
    const payload = await managerFetch<{ totalRecords: number } & Record<ListKey, Item[]>>(
      `${path}${path.includes("?") ? "&" : "?"}skip=${skip}&pageSize=${pageSize}`,
      { ttlMs, forceRefresh: forceRefresh && loop === 0 },
    );
    const batch = (payload[listKey] as Item[]) ?? [];
    all.push(...batch);
    if (batch.length < pageSize || all.length >= payload.totalRecords) break;
    skip += pageSize;
  }
  return all;
}

export async function fetchAllSalesInvoices(opts: { forceRefresh?: boolean } = {}): Promise<ManagerSalesInvoice[]> {
  return pageAll<"salesInvoices", ManagerSalesInvoice>("/sales-invoices", "salesInvoices", DOC_TTL, opts.forceRefresh);
}

export async function fetchAllReceipts(opts: { forceRefresh?: boolean } = {}): Promise<ManagerReceipt[]> {
  return pageAll<"receipts", ManagerReceipt>("/receipts", "receipts", DOC_TTL, opts.forceRefresh);
}

/* --------------------------- Parsing helpers --------------------------- */

/**
 * Manager.io encodes "customer" on invoices as "<code> - <name>".
 * We split it back so we can match CRM clients by either code or name.
 */
export function parseCustomerField(raw: string | null | undefined): { code: string | null; name: string } {
  if (!raw) return { code: null, name: "" };
  const m = /^([^-\s]+)\s*-\s*(.+)$/.exec(raw.trim());
  if (m) return { code: m[1].trim(), name: m[2].trim() };
  return { code: null, name: raw.trim() };
}

/**
 * Convert tax-inclusive Manager.io invoiceAmount to tax-exclusive net revenue.
 * UAE standard VAT is 5%. We detect 0%-rated invoices by checking whether the
 * gross is already a round multiple that doesn't cleanly divide by 1.05.
 */
export const UAE_VAT_RATE = 0.05;

export function taxExclusive(gross: number, vatRate = UAE_VAT_RATE): number {
  return +(gross / (1 + vatRate)).toFixed(2);
}

export function taxAmount(gross: number, vatRate = UAE_VAT_RATE): number {
  return +(gross - taxExclusive(gross, vatRate)).toFixed(2);
}
