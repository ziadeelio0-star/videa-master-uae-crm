/**
 * Tests the dashboard Collection Alerts bucket logic.
 *
 * The mirrored function in client/src/pages/Home.tsx (overdueClientsSummary)
 * must:
 *   1. Use `outstandingBalance` (SOA-derived), not the local txn `outstanding`.
 *   2. Skip clients with non-positive balance.
 *   3. Bucket > 60 days into "critical" and 30 < d <= 60 into "warning".
 *   4. Sort each bucket by balance descending.
 *
 * This pin avoids the regression that caused "All clear" to render even
 * when 25+ clients had real outstanding balances.
 */
import { describe, expect, it } from "vitest";

type Client = {
  id: number;
  companyName: string;
  outstandingBalance?: number | string | null;
  outstanding?: number | string | null;
  oldestUnpaidDate?: string | Date | null;
  lastInvoiceDate?: string | Date | null;
};

type Row = { id: number; name: string; balance: number; daysOverdue: number };

function bucketize(clients: Client[], now: Date): { critical: Row[]; warning: Row[] } {
  const enriched: Row[] = clients
    .map((c): Row | null => {
      const balance = Number(c.outstandingBalance ?? c.outstanding ?? 0);
      if (!(balance > 0)) return null;
      const refDate = c.oldestUnpaidDate
        ? new Date(c.oldestUnpaidDate)
        : c.lastInvoiceDate
        ? new Date(c.lastInvoiceDate)
        : null;
      const daysOverdue = refDate
        ? Math.floor((now.getTime() - refDate.getTime()) / (1000 * 60 * 60 * 24))
        : 0;
      return { id: c.id, name: c.companyName, balance, daysOverdue };
    })
    .filter((r): r is Row => r !== null);

  return {
    critical: enriched.filter((r) => r.daysOverdue > 60).sort((a, b) => b.balance - a.balance),
    warning: enriched
      .filter((r) => r.daysOverdue > 30 && r.daysOverdue <= 60)
      .sort((a, b) => b.balance - a.balance),
  };
}

describe("Dashboard Collection Alerts bucket logic", () => {
  const NOW = new Date("2026-05-07T00:00:00Z");

  it("uses outstandingBalance over outstanding when both are set", () => {
    const out = bucketize(
      [
        {
          id: 5,
          companyName: "MDCC International (FZE)",
          outstandingBalance: 1911.03,
          outstanding: 0,
          oldestUnpaidDate: "2026-01-01T00:00:00Z",
        },
      ],
      NOW
    );
    expect(out.critical).toHaveLength(1);
    expect(out.critical[0].balance).toBeCloseTo(1911.03, 2);
  });

  it("skips clients with zero or negative balance", () => {
    const out = bucketize(
      [
        { id: 1, companyName: "Zero Co", outstandingBalance: 0, oldestUnpaidDate: "2025-01-01" },
        { id: 2, companyName: "Negative Co", outstandingBalance: -5, oldestUnpaidDate: "2025-01-01" },
      ],
      NOW
    );
    expect(out.critical).toHaveLength(0);
    expect(out.warning).toHaveLength(0);
  });

  it("buckets > 60 days as critical and 30..60 as warning", () => {
    const out = bucketize(
      [
        { id: 1, companyName: "Old Debt", outstandingBalance: 5000, oldestUnpaidDate: "2026-01-01" }, // 126 days
        { id: 2, companyName: "Mid Debt", outstandingBalance: 3000, oldestUnpaidDate: "2026-04-01" }, // 36 days
        { id: 3, companyName: "Fresh Debt", outstandingBalance: 1000, oldestUnpaidDate: "2026-05-01" }, // 6 days
      ],
      NOW
    );
    expect(out.critical.map((r) => r.id)).toEqual([1]);
    expect(out.warning.map((r) => r.id)).toEqual([2]);
  });

  it("sorts each bucket by balance descending", () => {
    const out = bucketize(
      [
        { id: 1, companyName: "Small", outstandingBalance: 100, oldestUnpaidDate: "2026-01-01" },
        { id: 2, companyName: "Big", outstandingBalance: 10000, oldestUnpaidDate: "2026-01-01" },
        { id: 3, companyName: "Medium", outstandingBalance: 500, oldestUnpaidDate: "2026-01-01" },
      ],
      NOW
    );
    expect(out.critical.map((r) => r.id)).toEqual([2, 3, 1]);
  });

  it("falls back to lastInvoiceDate when oldestUnpaidDate is null", () => {
    const out = bucketize(
      [
        {
          id: 9,
          companyName: "Legacy Client",
          outstandingBalance: 750,
          oldestUnpaidDate: null,
          lastInvoiceDate: "2026-01-01",
        },
      ],
      NOW
    );
    expect(out.critical).toHaveLength(1);
    expect(out.critical[0].id).toBe(9);
  });

  it("treats clients with no date info as 0 days (not overdue)", () => {
    const out = bucketize(
      [
        {
          id: 10,
          companyName: "No-date Client",
          outstandingBalance: 200,
          oldestUnpaidDate: null,
          lastInvoiceDate: null,
        },
      ],
      NOW
    );
    expect(out.critical).toHaveLength(0);
    expect(out.warning).toHaveLength(0);
  });
});
