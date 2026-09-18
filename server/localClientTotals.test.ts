import { describe, it, expect } from "vitest";
import { getLocalClientTotals } from "./db";

describe("getLocalClientTotals (local DB, no Manager.io)", () => {
  it("returns per-client financial totals from local DB", async () => {
    const totals = await getLocalClientTotals();
    expect(totals.length).toBeGreaterThan(0);

    for (const t of totals) {
      expect(typeof t.clientId).toBe("number");
      expect(typeof t.grossBilled).toBe("number");
      expect(typeof t.outstanding).toBe("number");
      expect(typeof t.paid).toBe("number");
      expect(typeof t.invoiceCount).toBe("number");
      // paid = grossBilled - outstanding (clamped to 0)
      expect(t.paid).toBeCloseTo(Math.max(t.grossBilled - t.outstanding, 0), 1);
      // paid should never be negative
      expect(t.paid).toBeGreaterThanOrEqual(0);
    }
  });

  it("returns clients with outstanding balances > 0", async () => {
    const totals = await getLocalClientTotals();
    const withOutstanding = totals.filter((t) => t.outstanding > 0);
    // We know from the imported workbook there are clients with outstanding
    expect(withOutstanding.length).toBeGreaterThan(0);
  });

  it("returns clients with invoices (invoiceCount > 0)", async () => {
    const totals = await getLocalClientTotals();
    const withInvoices = totals.filter((t) => t.invoiceCount > 0);
    expect(withInvoices.length).toBeGreaterThan(0);
  });
});
