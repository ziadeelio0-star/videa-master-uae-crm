/**
 * Formatting helpers used across the Videa Master Pro internal system.
 * All amounts are AED by default.
 */

const AED = new Intl.NumberFormat("en-AE", {
  style: "currency",
  currency: "AED",
  maximumFractionDigits: 0,
});

const AED_PRECISE = new Intl.NumberFormat("en-AE", {
  style: "currency",
  currency: "AED",
  maximumFractionDigits: 2,
});

export function formatCurrency(amount: number, precise = false): string {
  if (!isFinite(amount)) return "AED 0";
  return precise ? AED_PRECISE.format(amount) : AED.format(amount);
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat("en-AE").format(n);
}

export function formatDate(d: Date | string | number): string {
  const date = d instanceof Date ? d : new Date(d);
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(d: Date | string | number): string {
  const date = d instanceof Date ? d : new Date(d);
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Format YYYY-MM into readable month label, e.g. "Jan '26" or "January 2026".
 */
export function formatMonth(ym: string, long = false): string {
  if (!ym) return "";
  const [y, m] = ym.split("-").map((v) => parseInt(v, 10));
  if (!y || !m) return ym;
  const d = new Date(y, m - 1, 1);
  return long
    ? d.toLocaleDateString("en-GB", { month: "long", year: "numeric" })
    : d.toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
}

export function initials(name: string | null | undefined): string {
  if (!name) return "—";
  const parts = name.replace(/[^A-Za-z ]/g, " ").trim().split(/\s+/);
  if (parts.length === 0) return "—";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}
