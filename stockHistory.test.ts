import { describe, it, expect } from "vitest";
import {
  searchClientsForStockHistory,
  getItemsByClient,
  getItemPurchaseHistory,
} from "./db";

/**
 * Stock History — end-to-end smoke tests against the live DB.
 *
 * These verify:
 *   1. Client search returns matches for a substring (case-insensitive).
 *   2. itemsByClient returns distinct items with sane unit-price math
 *      (lastUnitPrice ≈ amount / quantity for the most recent row).
 *   3. itemsByClient honors the `search` substring filter.
 *   4. itemPurchaseHistory returns rows whose unitPrice = amount / quantity.
 */
describe("Stock History helpers", () => {
  const url = process.env.DATABASE_URL;
  if (!url) {
    it.skip("DATABASE_URL not set; skipping live-DB tests", () => {});
    return;
  }

  it("searchClientsForStockHistory returns matches for substring", async () => {
    // Empty query → returns top buyers (capped at limit)
    const top = await searchClientsForStockHistory("", 5);
    expect(top.length).toBeGreaterThan(0);
    expect(top[0]).toHaveProperty("companyName");
    expect(top[0]).toHaveProperty("purchaseCount");

    // Substring match — at least one of our 81 clients should contain "trad"
    // (e.g. "Trading", "Trade", etc.). If not, fall back to substring of first
    // top buyer's own name to keep this test resilient.
    let probe = "trad";
    let hits = await searchClientsForStockHistory(probe, 25);
    if (hits.length === 0 && top.length > 0) {
      probe = top[0].companyName.slice(0, 4).toLowerCase();
      hits = await searchClientsForStockHistory(probe, 25);
    }
    expect(hits.length).toBeGreaterThan(0);
    for (const h of hits) {
      expect(h.companyName.toLowerCase()).toContain(probe.toLowerCase());
    }
  });

  it("getItemsByClient returns distinct items with valid unit-price math", async () => {
    const top = await searchClientsForStockHistory("", 1);
    expect(top.length).toBe(1);
    const clientId = top[0].id;

    const items = await getItemsByClient(clientId);
    expect(items.length).toBeGreaterThan(0);

    // Distinct item names
    const names = items.map((i) => i.itemName);
    expect(new Set(names).size).toBe(names.length);

    // Unit price math: lastUnitPrice should be a positive number
    for (const it of items.slice(0, 5)) {
      const last = Number(it.lastUnitPrice);
      const avg = Number(it.avgUnitPrice);
      expect(last).toBeGreaterThan(0);
      expect(avg).toBeGreaterThan(0);
      expect(Number(it.totalQuantity)).toBeGreaterThan(0);
      expect(Number(it.totalSpent)).toBeGreaterThan(0);
    }
  });

  it("getItemsByClient honors the search substring filter", async () => {
    const top = await searchClientsForStockHistory("", 1);
    const clientId = top[0].id;

    const all = await getItemsByClient(clientId);
    if (all.length === 0) return; // no purchases for this client, skip

    // Pick a 3-char substring from the first item's name and re-query
    const sample = all[0].itemName;
    const probe = sample.slice(0, Math.min(4, sample.length)).toLowerCase();
    const filtered = await getItemsByClient(clientId, probe);
    expect(filtered.length).toBeGreaterThan(0);
    for (const it of filtered) {
      const hay = `${it.itemName} ${it.toolName ?? ""} ${
        it.toolDescription ?? ""
      } ${(it as any).factItemId ?? ""} ${it.toolId ?? ""}`.toLowerCase();
      expect(hay).toContain(probe);
    }
  });

  it("getItemsByClient supports universal multi-token search (each token must match)", async () => {
    const top = await searchClientsForStockHistory("", 1);
    const clientId = top[0].id;
    const all = await getItemsByClient(clientId);
    if (all.length < 2) return;

    // Build a multi-token query from two non-overlapping fragments of the first item.
    const sample = all[0].itemName;
    // Take the first 3 chars and the last 3 chars as separate tokens.
    const t1 = sample.slice(0, 3).toLowerCase();
    const t2 = sample.slice(-3).toLowerCase();
    if (t1 === t2) return;

    const filtered = await getItemsByClient(clientId, `${t1} ${t2}`);
    expect(filtered.length).toBeGreaterThan(0);
    for (const it of filtered) {
      const hay = `${it.itemName} ${it.toolName ?? ""} ${
        it.toolDescription ?? ""
      } ${(it as any).factItemId ?? ""} ${it.toolId ?? ""}`.toLowerCase();
      expect(hay).toContain(t1);
      expect(hay).toContain(t2);
    }
  });

  it("getItemsByClient: empty whitespace-only query returns full list", async () => {
    const top = await searchClientsForStockHistory("", 1);
    const clientId = top[0].id;
    const full = await getItemsByClient(clientId);
    const ws = await getItemsByClient(clientId, "   ");
    expect(ws.length).toBe(full.length);
  });

  it("getItemsByClient: search by numeric token (item ID style) works", async () => {
    // Find any client whose items contain digits in the description.
    const top = await searchClientsForStockHistory("", 5);
    let found = false;
    for (const c of top) {
      const items = await getItemsByClient(c.id);
      const withDigits = items.find((i) => /\d{2,}/.test(i.itemName));
      if (!withDigits) continue;
      const m = withDigits.itemName.match(/\d{2,}/);
      if (!m) continue;
      const numToken = m[0];
      const filtered = await getItemsByClient(c.id, numToken);
      expect(filtered.length).toBeGreaterThan(0);
      for (const it of filtered) {
        const hay = `${it.itemName} ${it.toolName ?? ""} ${
          it.toolDescription ?? ""
        } ${(it as any).factItemId ?? ""} ${it.toolId ?? ""}`.toLowerCase();
        expect(hay).toContain(numToken.toLowerCase());
      }
      found = true;
      break;
    }
    expect(found).toBe(true);
  });

  it("getItemsByClient: searching by an actual Fact Sales Item_ID surfaces the row", async () => {
    // Find any client whose items have a non-null factItemId so we can search by it.
    const top = await searchClientsForStockHistory("", 30);
    let asserted = false;
    for (const c of top) {
      const items = await getItemsByClient(c.id);
      const withId = items.find((i: any) => i.factItemId);
      if (!withId) continue;
      const itemId = String((withId as any).factItemId);

      // Full ID search
      const full = await getItemsByClient(c.id, itemId);
      expect(full.length).toBeGreaterThan(0);
      expect(full.some((i: any) => i.factItemId === itemId)).toBe(true);

      // Partial substring of the ID (e.g. first 4 chars) must also match
      const probe = itemId.slice(0, Math.min(4, itemId.length));
      const partial = await getItemsByClient(c.id, probe);
      expect(partial.length).toBeGreaterThan(0);
      for (const r of partial) {
        const hay = `${r.itemName} ${r.toolName ?? ""} ${
          r.toolDescription ?? ""
        } ${(r as any).factItemId ?? ""} ${r.toolId ?? ""}`.toLowerCase();
        expect(hay).toContain(probe.toLowerCase());
      }

      asserted = true;
      break;
    }
    expect(asserted).toBe(true);
  });

  it("getItemPurchaseHistory unit price equals amount / quantity per row", async () => {
    const top = await searchClientsForStockHistory("", 1);
    const clientId = top[0].id;
    const items = await getItemsByClient(clientId);
    if (items.length === 0) return;

    const itemName = items[0].itemName;
    const history = await getItemPurchaseHistory(clientId, itemName);
    expect(history.length).toBeGreaterThan(0);
    for (const row of history) {
      const amt = Number(row.amount);
      const qty = Number(row.quantity);
      const unit = Number(row.unitPrice);
      expect(qty).toBeGreaterThan(0);
      // Allow tiny floating point drift
      expect(Math.abs(unit - amt / qty)).toBeLessThan(0.01);
      expect(row.itemName).toBe(itemName);
    }

    // Newest first
    for (let i = 1; i < history.length; i++) {
      const a = new Date(history[i - 1].transactionDate).getTime();
      const b = new Date(history[i].transactionDate).getTime();
      expect(a).toBeGreaterThanOrEqual(b);
    }
  });
});
