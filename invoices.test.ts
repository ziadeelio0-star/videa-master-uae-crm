import { describe, it, expect } from "vitest";
import { searchInvoices, getInvoiceDetail } from "./db";

describe("Invoice Explorer", () => {
  it("searchInvoices returns results with correct P&L fields", async () => {
    const results = await searchInvoices("", { limit: 10 });
    expect(results.length).toBeGreaterThan(0);

    for (const inv of results) {
      // Required fields
      expect(inv.invoiceNumber).toBeTruthy();
      expect(inv.clientName).toBeTruthy();
      expect(typeof inv.totalRevenue).toBe("number");
      expect(typeof inv.totalCogs).toBe("number");
      expect(typeof inv.grossProfit).toBe("number");
      expect(typeof inv.marginPct).toBe("number");
      expect(typeof inv.markupPct).toBe("number");
      expect(typeof inv.lineItems).toBe("number");
      expect(inv.lineItems).toBeGreaterThan(0);

      // Algebraic identity: grossProfit = revenue - cogs
      expect(inv.grossProfit).toBeCloseTo(inv.totalRevenue - inv.totalCogs, 1);

      // Margin = grossProfit / revenue * 100 (when revenue > 0)
      if (inv.totalRevenue > 0) {
        const expectedMargin = (inv.grossProfit / inv.totalRevenue) * 100;
        expect(inv.marginPct).toBeCloseTo(expectedMargin, 0);
      }

      // Markup = grossProfit / cogs * 100 (when cogs > 0)
      if (inv.totalCogs > 0) {
        const expectedMarkup = (inv.grossProfit / inv.totalCogs) * 100;
        expect(inv.markupPct).toBeCloseTo(expectedMarkup, 0);
      }
    }
  });

  it("searchInvoices filters by invoice number substring", async () => {
    // Get a known invoice number first
    const all = await searchInvoices("", { limit: 5 });
    expect(all.length).toBeGreaterThan(0);
    const target = all[0].invoiceNumber;

    // Search for it
    const filtered = await searchInvoices(target, { limit: 50 });
    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered.some((i) => i.invoiceNumber === target)).toBe(true);
  });

  it("getInvoiceDetail returns full line-item breakdown with per-line P&L", async () => {
    // Get a known invoice
    const all = await searchInvoices("", { limit: 5 });
    expect(all.length).toBeGreaterThan(0);
    const target = all[0].invoiceNumber;

    const detail = await getInvoiceDetail(target);
    expect(detail).not.toBeNull();
    if (!detail) return;

    // Top-level fields
    expect(detail.invoiceNumber).toBe(target);
    expect(detail.clientName).toBeTruthy();
    expect(detail.lineItems.length).toBeGreaterThan(0);

    // Summary matches line items
    const sumRevenue = detail.lineItems.reduce((s, l) => s + l.amount, 0);
    const sumCogs = detail.lineItems.reduce((s, l) => s + l.cogs, 0);
    expect(detail.summary.totalRevenue).toBeCloseTo(sumRevenue, 1);
    expect(detail.summary.totalCogs).toBeCloseTo(sumCogs, 1);
    expect(detail.summary.grossProfit).toBeCloseTo(sumRevenue - sumCogs, 1);
    expect(detail.summary.lineItemCount).toBe(detail.lineItems.length);

    // Per-line P&L identity
    for (const line of detail.lineItems) {
      expect(line.grossProfit).toBeCloseTo(line.amount - line.cogs, 1);
      if (line.amount > 0) {
        const expectedMargin = (line.grossProfit / line.amount) * 100;
        expect(line.marginPct).toBeCloseTo(expectedMargin, 0);
      }
    }
  });

  it("getInvoiceDetail returns null for non-existent invoice", async () => {
    const detail = await getInvoiceDetail("NONEXISTENT_99999");
    expect(detail).toBeNull();
  });
});
