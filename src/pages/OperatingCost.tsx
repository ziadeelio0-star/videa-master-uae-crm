import { useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import SectionHeader from "@/components/SectionHeader";
import SmartKpiGrid from "@/components/SmartKpiGrid";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { formatCurrency } from "@/lib/format";
import {
  Coins,
  Search,
  TrendingDown,
  Wallet,
  Calculator,
  Receipt,
} from "lucide-react";

const CAT_LABEL: Record<string, string> = {
  salaries: "Salaries",
  rent: "Rent",
  fuel: "Fuel",
  maintenance: "Maintenance & Repairs",
  utilities: "Utilities (Electricity / HVAC)",
  phone_internet: "Phone & Internet",
  office: "Office Supplies",
  it_equipment: "IT & Equipment",
  marketing: "Marketing",
  legal: "Legal Fees",
  accounting: "Accounting Fees",
  bank_fees: "Bank Fees",
  tax: "Tax & VAT",
  other_operating: "Other Operating",
};

const MONTH_LABEL = (ym: string) => {
  // 'YYYY-MM' → 'Mar 2026'
  const [y, m] = ym.split("-").map(Number);
  if (!y || !m) return ym;
  const d = new Date(Date.UTC(y, m - 1, 1));
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
};

export default function OperatingCost() {
  const summary = trpc.operatingCost.summary.useQuery();
  const netProfit = trpc.operatingCost.netProfit.useQuery();
  const [filterCat, setFilterCat] = useState<string | undefined>(undefined);
  const [filterMonth, setFilterMonth] = useState<string | undefined>(undefined);
  const [search, setSearch] = useState("");

  const rowsQuery = trpc.operatingCost.list.useQuery(
    {
      category: filterCat,
      month: filterMonth,
      search: search.trim() || undefined,
      limit: 500,
    },
    { placeholderData: (prev: any) => prev },
  );

  const rows = rowsQuery.data ?? [];
  const isLoading = summary.isLoading || netProfit.isLoading;

  const months = summary.data?.months ?? [];
  const byCategory = summary.data?.byCategory ?? [];
  const pivot = summary.data?.byCategoryByMonth ?? {};

  // Per-month totals across categories (for the heatmap footer row)
  const monthTotals = useMemo(() => {
    const t: Record<string, number> = {};
    for (const m of months) {
      let sum = 0;
      for (const c of byCategory) sum += pivot[c.category]?.[m] ?? 0;
      t[m] = sum;
    }
    return t;
  }, [months, byCategory, pivot]);

  // Heatmap intensity helper — find max cell to scale opacity
  const maxCell = useMemo(() => {
    let max = 0;
    for (const c of byCategory) {
      const m = pivot[c.category] ?? {};
      for (const k of Object.keys(m)) max = Math.max(max, m[k] || 0);
    }
    return max || 1;
  }, [byCategory, pivot]);

  const cellBg = (v: number) => {
    if (!v) return undefined;
    const ratio = Math.min(1, v / maxCell);
    // scale 0.07 → 0.35 alpha for legibility
    const alpha = 0.07 + ratio * 0.28;
    return { backgroundColor: `rgba(34, 197, 94, ${alpha.toFixed(3)})` };
  };

  return (
    <DashboardLayout>
      <div className="container py-8 space-y-8">
        <SectionHeader
          eyebrow="Operating Performance"
          title="Operating Cost"
          description="Salaries, rent, fuel, maintenance, utilities, phone/internet, office, IT, marketing, legal, accounting, bank fees and tax — sourced directly from the Fact Cost sheet, excluding inventory purchases and shipping. Subtracted from Gross Profit to give a true Net Profit."
        />

        {/* KPIs */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-32 rounded-xl" />
            ))}
          </div>
        ) : (
          <SmartKpiGrid
            cards={[
              {
                label: "Total Revenue",
                value: formatCurrency(netProfit.data?.totalRevenue ?? 0),
                sublabel: "Tools + Sharpening",
                variant: "light",
                icon: <Receipt className="h-5 w-5" />,
              },
              {
                label: "Gross Profit",
                value: formatCurrency(netProfit.data?.grossProfit ?? 0),
                sublabel: `${netProfit.data?.grossMargin ?? 0}% margin (Tools)`,
                variant: "outline",
                icon: <Wallet className="h-5 w-5" />,
              },
              {
                label: "Operating Cost",
                value: formatCurrency(summary.data?.totalOperating ?? 0),
                sublabel: `${summary.data?.rowCount ?? 0} expense rows`,
                variant: "dark",
                icon: <Coins className="h-5 w-5" />,
              },
              {
                label: "Net Profit",
                value: formatCurrency(netProfit.data?.netProfit ?? 0),
                sublabel: `${netProfit.data?.netMargin ?? 0}% net margin`,
                variant: (netProfit.data?.netProfit ?? 0) >= 0 ? "primary" : "dark",
                icon: <Calculator className="h-5 w-5" />,
              },
            ]}
          />
        )}

        {/* Computation strip — make the math obvious */}
        <Card className="p-5 bg-gradient-to-br from-emerald-50 via-white to-emerald-50/30 border-emerald-200">
          <div className="text-[11px] tracking-[0.28em] uppercase text-emerald-700 font-semibold mb-3">
            How Net Profit is calculated
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 font-display">
            <span className="text-2xl text-foreground">{formatCurrency(netProfit.data?.grossProfit ?? 0)}</span>
            <span className="text-sm text-muted-foreground tracking-wider uppercase">Gross Profit</span>
            <span className="text-2xl text-emerald-700">−</span>
            <span className="text-2xl text-foreground">{formatCurrency(summary.data?.totalOperating ?? 0)}</span>
            <span className="text-sm text-muted-foreground tracking-wider uppercase">Operating Cost</span>
            <span className="text-2xl text-emerald-700">=</span>
            <span
              className={`text-3xl font-bold ${(netProfit.data?.netProfit ?? 0) >= 0 ? "text-emerald-700" : "text-red-600"}`}
            >
              {formatCurrency(netProfit.data?.netProfit ?? 0)}
            </span>
            <span className="text-sm text-muted-foreground tracking-wider uppercase">Net Profit</span>
          </div>
          <div className="text-xs text-muted-foreground mt-3 leading-relaxed">
            Gross Profit excludes COGS (inventory purchases). Operating Cost is the sum of every Fact Cost row that
            is <strong>not</strong> an Inventory Purchase. Inventory excluded from operating: <strong>{formatCurrency(summary.data?.totalInventory ?? 0)}</strong>.
          </div>
        </Card>

        {/* Monthly heatmap (category × month) */}
        <Card className="overflow-hidden">
          <div className="p-5 border-b">
            <div className="text-[11px] tracking-[0.28em] uppercase text-emerald-700 font-semibold mb-1">
              Spread by month
            </div>
            <h2 className="font-display text-2xl">Operating Cost Heatmap</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Each cell is the total spent on that category in that month. Darker green = bigger spend. Click a cell
              to drill into the underlying expense rows.
            </p>
          </div>
          {summary.isLoading ? (
            <div className="p-6">
              <Skeleton className="h-64 w-full" />
            </div>
          ) : months.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">No operating cost data yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead className="bg-muted/40">
                  <tr>
                    <th className="text-left px-4 py-2 sticky left-0 bg-muted/40 z-10 font-medium text-muted-foreground">
                      Category
                    </th>
                    {months.map((m) => (
                      <th
                        key={m}
                        className="px-3 py-2 text-right font-medium text-muted-foreground whitespace-nowrap cursor-pointer hover:bg-emerald-50/60"
                        onClick={() => {
                          setFilterMonth(m === filterMonth ? undefined : m);
                          setFilterCat(undefined);
                        }}
                      >
                        {MONTH_LABEL(m)}
                      </th>
                    ))}
                    <th className="px-4 py-2 text-right font-semibold whitespace-nowrap bg-emerald-50">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {byCategory.map((c) => {
                    const row = pivot[c.category] ?? {};
                    return (
                      <tr key={c.category} className="border-t hover:bg-muted/20">
                        <td
                          className="px-4 py-2 sticky left-0 bg-background font-medium z-10 cursor-pointer hover:bg-emerald-50/60 whitespace-nowrap"
                          onClick={() => {
                            setFilterCat(c.category === filterCat ? undefined : c.category);
                            setFilterMonth(undefined);
                          }}
                        >
                          {CAT_LABEL[c.category] ?? c.category}
                        </td>
                        {months.map((m) => {
                          const v = row[m] ?? 0;
                          return (
                            <td
                              key={m}
                              className="px-3 py-2 text-right tabular-nums whitespace-nowrap cursor-pointer transition-colors"
                              style={cellBg(v)}
                              onClick={() => {
                                setFilterCat(c.category);
                                setFilterMonth(m);
                              }}
                              title={`${CAT_LABEL[c.category] ?? c.category} · ${MONTH_LABEL(m)}: ${formatCurrency(v)}`}
                            >
                              {v ? formatCurrency(v) : <span className="text-muted-foreground/40">—</span>}
                            </td>
                          );
                        })}
                        <td className="px-4 py-2 text-right tabular-nums font-semibold bg-emerald-50/40 whitespace-nowrap">
                          {formatCurrency(c.total)}
                        </td>
                      </tr>
                    );
                  })}
                  {/* Totals row */}
                  <tr className="border-t-2 border-emerald-700 bg-emerald-50/60 font-semibold">
                    <td className="px-4 py-3 sticky left-0 bg-emerald-50/60 z-10 whitespace-nowrap">Month total</td>
                    {months.map((m) => (
                      <td key={m} className="px-3 py-3 text-right tabular-nums whitespace-nowrap">
                        {formatCurrency(monthTotals[m] ?? 0)}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap text-emerald-800">
                      {formatCurrency(summary.data?.totalOperating ?? 0)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Drilldown filters + table */}
        <Card className="overflow-hidden">
          <div className="p-5 border-b flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-[11px] tracking-[0.28em] uppercase text-emerald-700 font-semibold mb-1">
                Drill-down
              </div>
              <h2 className="font-display text-2xl">Expense rows</h2>
              <p className="text-sm text-muted-foreground mt-1">
                {filterCat || filterMonth ? "Filtered" : "Showing latest"} · {rows.length} row
                {rows.length === 1 ? "" : "s"}
                {filterCat ? ` · category: ${CAT_LABEL[filterCat] ?? filterCat}` : ""}
                {filterMonth ? ` · month: ${MONTH_LABEL(filterMonth)}` : ""}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {(filterCat || filterMonth) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setFilterCat(undefined);
                    setFilterMonth(undefined);
                  }}
                >
                  Clear filters
                </Button>
              )}
              <div className="relative">
                <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9 w-72"
                  placeholder="Search payee / description…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
          </div>

          {rowsQuery.isLoading ? (
            <div className="p-6">
              <Skeleton className="h-40 w-full" />
            </div>
          ) : rows.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <TrendingDown className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p>No expense rows match your filters.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Payee / Account</TableHead>
                  <TableHead>Cost type (raw)</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap text-sm">
                      {new Date(r.txDate).toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </TableCell>
                    <TableCell>
                      <span className="vm-pill bg-emerald-100 text-emerald-800 text-xs px-2 py-0.5 rounded-full">
                        {CAT_LABEL[r.category] ?? r.category}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-md">
                      <div className="font-medium truncate">{r.payee || "—"}</div>
                      <div className="text-xs text-muted-foreground truncate">{r.expenseAccount || ""}</div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{r.rawCostType || "(uncategorized)"}</TableCell>
                    <TableCell className="text-right tabular-nums font-semibold">
                      {formatCurrency(Number(r.amount))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </div>
    </DashboardLayout>
  );
}
