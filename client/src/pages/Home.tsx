import { useState, useMemo } from "react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart } from "recharts";
import { Link } from "wouter";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { DollarSign, TrendingUp, AlertCircle, Users, Receipt, Wallet, Calendar, Activity, ArrowRight, Coins, Calculator, RefreshCw } from "lucide-react";
import { useRef, useEffect, useState as useSyncState, useCallback } from "react";
import { useAutoSync, isFsAccessSupported } from "@/hooks/useAutoSync";
import { Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/format";
import RevenueHero from "@/components/RevenueHero";
import SmartInsights from "@/components/SmartInsights";
import SmartKpiGrid from "@/components/SmartKpiGrid";
import SectionHeader from "@/components/SectionHeader";
import InventoryIntelligence from "@/components/InventoryIntelligence";

const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function StatusBadge({ status }: { status: "paid" | "pending" | "overdue" }) {
  const map: Record<string, string> = {
    paid: "vm-pill vm-pill-success",
    pending: "vm-pill vm-pill-warning",
    overdue: "vm-pill vm-pill-danger",
  };
  return <span className={map[status]}>{status.charAt(0).toUpperCase() + status.slice(1)}</span>;
}

function readAsBase64Local(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1] ?? "");
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function Home() {
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  // Period selector for the dynamic KPI strip (Year + optional Month)
  const [periodYear, setPeriodYear] = useState<string>("all");
  const [periodMonth, setPeriodMonth] = useState<string>("all");
  const utils = trpc.useUtils();
  const importMutation = trpc.dashboardSync.import.useMutation();
  const syncInputRef = useRef<HTMLInputElement | null>(null);

  // Live sync status from /api/dashboard/sync-status — lets us show
  // "Last sync 5s ago · filename" without re-uploading.
  const [syncStatus, setSyncStatus] = useSyncState<{
    lastSyncAt: string | null;
    fileName: string | null;
    fileHash: string | null;
  }>({ lastSyncAt: null, fileName: null, fileHash: null });
  const refetchStatus = useCallback(async () => {
    try {
      const r = await fetch("/api/dashboard/sync-status", { credentials: "include" });
      if (!r.ok) return;
      const j = await r.json();
      if (j?.ok) {
        setSyncStatus({
          lastSyncAt: j.lastSyncAt ?? null,
          fileName: j.fileName ?? null,
          fileHash: j.fileHash ?? null,
        });
      }
    } catch {
      // ignore
    }
  }, []);
  useEffect(() => {
    void refetchStatus();
  }, [refetchStatus]);

  async function handleSyncFile(file: File) {
    const tId = toast.loading(`Syncing ${file.name}\u2026`);
    try {
      const base64 = await readAsBase64Local(file);
      const summary = await importMutation.mutateAsync({
        fileBase64: base64,
        fileName: file.name,
      });
      const u = utils as any;
      await Promise.all([
        u.clients?.list?.invalidate?.(),
        u.transactions?.list?.invalidate?.(),
        u.tools?.listWithStats?.invalidate?.(),
        u.analytics?.kpis?.invalidate?.(),
        u.analytics?.monthlyRevenue?.invalidate?.(),
        u.analytics?.topClients?.invalidate?.(),
        u.analytics?.clientsWithInvoice?.invalidate?.(),
        u.analytics?.overdueClients?.invalidate?.(),
        u.analytics?.topPerformers?.invalidate?.(),
        u.analytics?.quickStats?.invalidate?.(),
        u.analytics?.profitabilityTrend?.invalidate?.(),
        u.stockHistory?.searchClients?.invalidate?.(),
        u.stockHistory?.itemsByClient?.invalidate?.(),
        u.operatingCost?.summary?.invalidate?.(),
        u.operatingCost?.byMonth?.invalidate?.(),
        u.operatingCost?.byCategory?.invalidate?.(),
        u.operatingCost?.netProfit?.invalidate?.(),
        u.receivables?.summary?.invalidate?.(),
      ]);
      void refetchStatus();
      toast.success(
        `Synced: ${summary.clients} clients, ${summary.transactions} tx, ${
          (summary as any).operatingCostsRows ?? 0
        } operating-cost rows.`,
        { id: tId }
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sync failed.", { id: tId });
    } finally {
      if (syncInputRef.current) syncInputRef.current.value = "";
    }
  }

  const kpis = trpc.analytics.kpis.useQuery();
  const monthly = trpc.analytics.monthlyRevenue.useQuery({ monthsBack: 12 });
  const top = trpc.analytics.topClients.useQuery({ limit: 6 });
  const clientsWithInvoice = trpc.analytics.clientsWithInvoice.useQuery();
  const overdueQuery = trpc.analytics.overdueClients.useQuery();
  const topPerformersQuery = trpc.analytics.topPerformers.useQuery({ limit: 6 });
  const statsQuery = trpc.analytics.quickStats.useQuery();
  const profitabilityQuery = trpc.analytics.profitabilityTrend.useQuery({ monthsBack: 12 });
  const periodInput = useMemo(() => {
    const out: { year?: number; month?: number } = {};
    if (periodYear !== "all") out.year = parseInt(periodYear);
    if (periodMonth !== "all" && periodYear !== "all") out.month = parseInt(periodMonth);
    return Object.keys(out).length > 0 ? out : undefined;
  }, [periodYear, periodMonth]);
  const periodQuery = trpc.operatingCost.byPeriod.useQuery(periodInput, {
    placeholderData: (prev) => prev,
  });
  const periodLabel = useMemo(() => {
    if (periodYear === "all") return "All time";
    if (periodMonth === "all") return periodYear;
    return `${monthNames[parseInt(periodMonth) - 1]} ${periodYear}`;
  }, [periodYear, periodMonth]);

  const overdueClients = overdueQuery.data || [];
  const topPerformers = topPerformersQuery.data || [];
  const stats = statsQuery.data;
  const profitability = profitabilityQuery.data || [];

  const pivot = useMemo(() => {
    const map = new Map<string, { month: string; tools: number; sharpening: number; total: number }>();
    (monthly.data ?? []).forEach((r) => {
      const existing = map.get(r.month) ?? { month: r.month, tools: 0, sharpening: 0, total: 0 };
      if (r.type === "purchase") existing.tools += r.total;
      else existing.sharpening += r.total;
      existing.total = existing.tools + existing.sharpening;
      map.set(r.month, existing);
    });
    return Array.from(map.values()).sort((a, b) => a.month.localeCompare(b.month));
  }, [monthly.data]);

  const filteredPivot = useMemo(() => {
    if (selectedMonth === "all") return pivot;
    const monthIndex = parseInt(selectedMonth);
    return pivot.filter((d) => {
      const date = new Date(d.month);
      return date.getMonth() === monthIndex;
    });
  }, [pivot, selectedMonth]);

  const monthlyTrend = useMemo(
    () => pivot.map((p) => ({ month: p.month, total: p.total })),
    [pivot]
  );

  const overdueClientsSummary = useMemo(() => {
    const clients = clientsWithInvoice.data ?? [];
    const now = new Date();

    type Row = { id: number; name: string; balance: number; daysOverdue: number };

    const enriched: Row[] = clients
      .map((c: any): Row | null => {
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
      critical: enriched
        .filter((r) => r.daysOverdue > 60)
        .sort((a, b) => b.balance - a.balance),
      warning: enriched
        .filter((r) => r.daysOverdue > 30 && r.daysOverdue <= 60)
        .sort((a, b) => b.balance - a.balance),
    };
  }, [clientsWithInvoice.data]);

  const isLoading = kpis.isLoading || monthly.isLoading || top.isLoading;

  // Auto-sync: re-reads the user's chosen workbook on every dashboard mount.
  // The server SHA256-caches identical bytes, so unchanged files cost ~250ms.
  const autoSync = useAutoSync({
    onFile: async (file: File) => {
      // Reuse the same handler the manual button uses so cache invalidation +
      // toast UX stay consistent. handleSyncFile already calls refetchStatus.
      await handleSyncFile(file);
    },
  });

  function relativeTime(iso: string | null): string {
    if (!iso) return "never";
    const t = new Date(iso).getTime();
    if (!Number.isFinite(t)) return "unknown";
    const s = Math.max(0, Math.round((Date.now() - t) / 1000));
    if (s < 60) return `${s}s ago`;
    const m = Math.round(s / 60);
    if (m < 60) return `${m} min ago`;
    const h = Math.round(m / 60);
    if (h < 24) return `${h} h ago`;
    const d = Math.round(h / 24);
    return `${d} d ago`;
  }

  return (
    <DashboardLayout>
      <div className="container py-8 space-y-8">
        <SectionHeader
          eyebrow="Executive Overview"
          title="Dashboard"
          description="Live financial overview of Videa Master Pro Tools Trading LLC — revenue, profitability, and client performance."
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={syncInputRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(e) => {
                  const f = e.currentTarget.files?.[0];
                  if (f) handleSyncFile(f);
                }}
              />
              <Button
                size="sm"
                onClick={() => syncInputRef.current?.click()}
                disabled={importMutation.isPending}
                className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
              >
                <RefreshCw className={`h-4 w-4 ${importMutation.isPending ? "animate-spin" : ""}`} />
                {importMutation.isPending ? "Syncing\u2026" : "Sync from latest Excel"}
              </Button>
              {isFsAccessSupported() && (
                autoSync.status.enabled ? (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-emerald-200 bg-emerald-50">
                    <Wand2 className="w-3.5 h-3.5 text-emerald-700" />
                    <span className="text-xs font-semibold text-emerald-700">
                      Auto-sync {autoSync.status.syncing ? "running…" : "on"}
                    </span>
                    <button
                      type="button"
                      onClick={() => void autoSync.disableAutoSync()}
                      className="text-xs text-emerald-700/70 hover:text-emerald-900 underline-offset-2 hover:underline"
                      title="Stop auto-sync (forget the workbook)"
                    >
                      Stop
                    </button>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void autoSync.enableAutoSync()}
                    className="gap-2 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                  >
                    <Wand2 className="w-4 h-4" />
                    Enable auto-sync
                  </Button>
                )
              )}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-emerald-200 bg-emerald-50">
                <span className="w-2 h-2 rounded-full bg-emerald-500 vm-pulse" />
                <span className="text-xs font-semibold text-emerald-700">
                  {syncStatus.lastSyncAt
                    ? `Synced ${relativeTime(syncStatus.lastSyncAt)}`
                    : "Live data"}
                </span>
              </div>
            </div>
          }
        />
        {syncStatus.fileName && (
          <div className="-mt-4 text-xs text-muted-foreground">
            Source workbook: <span className="font-medium text-foreground">{syncStatus.fileName}</span>
            {autoSync.status.lastError && (
              <span className="ml-3 text-amber-700">· {autoSync.status.lastError}</span>
            )}
          </div>
        )}

        {/* Hero Revenue Section */}
        {isLoading ? (
          <Skeleton className="h-[500px] rounded-2xl" />
        ) : (
          <RevenueHero
            toolsRevenue={kpis.data?.toolsRevenue ?? 0}
            sharpeningRevenue={kpis.data?.sharpeningRevenue ?? 0}
            grossProfit={kpis.data?.grossProfit ?? 0}
            grossMargin={kpis.data?.grossMargin ?? 0}
          />
        )}

        {/* Smart KPI Grid */}
        {!isLoading && stats && (
          <SmartKpiGrid
            cards={[
              {
                label: "Outstanding",
                value: formatCurrency(kpis.data?.outstanding ?? 0),
                sublabel: `Across ${overdueClients.length} clients`,
                variant: "outline",
                icon: <Wallet className="w-4 h-4 text-primary" />,
                href: "/receivables",
              },
              {
                label: "This Month",
                value: formatCurrency(kpis.data?.monthlyRevenue ?? 0),
                sublabel: "Current period revenue",
                variant: "outline",
                icon: <Calendar className="w-4 h-4 text-primary" />,
              },
              {
                label: "Active Clients",
                value: String(kpis.data?.activeClients ?? 0),
                sublabel: `${stats.totalInvoices} total invoices`,
                variant: "outline",
                icon: <Users className="w-4 h-4 text-primary" />,
                href: "/clients",
              },
              {
                label: "Collection Rate",
                value: `${stats.collectionRate}%`,
                sublabel: `${formatCurrency(stats.totalPaid)} collected`,
                variant: "outline",
                icon: <Activity className="w-4 h-4 text-primary" />,
              },
            ]}
          />
        )}

        {/* Period-aware KPI strip — Year + Month selector with full P&L */}
        <div className="vm-card-elevated p-6 bg-white border-2 border-primary/20">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 mb-6">
            <div>
              <p className="vm-eyebrow text-xs text-primary">Period Analysis</p>
              <h3 className="font-display text-2xl mt-1">P&amp;L by Period</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Choose a year and (optionally) a month to recalculate every KPI for that period.
                Outstanding balance is point-in-time and stays all-time.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Period</span>
              <Select value={periodYear} onValueChange={(v) => { setPeriodYear(v); if (v === "all") setPeriodMonth("all"); }}>
                <SelectTrigger className="w-[140px]"><SelectValue placeholder="Year" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All years</SelectItem>
                  {(periodQuery.data?.availableYears ?? []).map((y) => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={periodMonth} onValueChange={setPeriodMonth} disabled={periodYear === "all"}>
                <SelectTrigger className="w-[140px]"><SelectValue placeholder="Month" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All months</SelectItem>
                  {monthNames.map((m, i) => (
                    <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Badge variant="outline" className="font-semibold">{periodLabel}</Badge>
            </div>
          </div>
          {periodQuery.isLoading || !periodQuery.data ? (
            <Skeleton className="h-[200px]" />
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="rounded-xl border bg-emerald-50/50 p-4">
                <div className="text-[10px] tracking-[0.24em] uppercase text-emerald-700 font-bold">Revenue</div>
                <div className="font-display text-xl mt-2">{formatCurrency(periodQuery.data.totalRevenue)}</div>
                <div className="text-[11px] text-muted-foreground mt-1">{periodQuery.data.invoiceCount} inv. · {periodQuery.data.transactionCount} tx</div>
              </div>
              <div className="rounded-xl border bg-white p-4">
                <div className="text-[10px] tracking-[0.24em] uppercase text-muted-foreground font-bold">Tools / Sharp.</div>
                <div className="font-display text-base mt-2">{formatCurrency(periodQuery.data.toolsRevenue)}</div>
                <div className="text-[11px] text-muted-foreground mt-1">+ {formatCurrency(periodQuery.data.sharpeningRevenue)}</div>
              </div>
              <div className="rounded-xl border bg-white p-4">
                <div className="text-[10px] tracking-[0.24em] uppercase text-muted-foreground font-bold">COGS</div>
                <div className="font-display text-xl mt-2">− {formatCurrency(periodQuery.data.totalCogs)}</div>
                <div className="text-[11px] text-muted-foreground mt-1">Cost of goods sold</div>
              </div>
              <div className="rounded-xl border bg-white p-4">
                <div className="text-[10px] tracking-[0.24em] uppercase text-muted-foreground font-bold">Gross Profit</div>
                <div className="font-display text-xl mt-2">{formatCurrency(periodQuery.data.grossProfit)}</div>
                <div className="text-[11px] text-muted-foreground mt-1">{periodQuery.data.grossMargin}% margin</div>
              </div>
              <div className="rounded-xl border bg-white p-4">
                <div className="text-[10px] tracking-[0.24em] uppercase text-muted-foreground font-bold">Op. Cost</div>
                <div className="font-display text-xl mt-2">− {formatCurrency(periodQuery.data.operatingCost)}</div>
                <div className="text-[11px] text-muted-foreground mt-1">Excl. inventory + shipping</div>
              </div>
              <div className={`rounded-xl border p-4 ${periodQuery.data.netProfit >= 0 ? "bg-emerald-700 text-white border-emerald-800" : "bg-red-700 text-white border-red-800"}`}>
                <div className="text-[10px] tracking-[0.24em] uppercase font-bold opacity-90">Net Profit</div>
                <div className="font-display text-xl mt-2">{formatCurrency(periodQuery.data.netProfit)}</div>
                <div className="text-[11px] opacity-90 mt-1">{periodQuery.data.netMargin}% net margin</div>
              </div>
            </div>
          )}
          {periodQuery.data && (
            <div className="text-xs text-muted-foreground border-t mt-4 pt-3">
              {formatCurrency(periodQuery.data.totalRevenue)} − {formatCurrency(periodQuery.data.totalCogs)} = <span className="font-semibold">{formatCurrency(periodQuery.data.grossProfit)}</span> − {formatCurrency(periodQuery.data.operatingCost)} = <span className={`font-bold ${periodQuery.data.netProfit >= 0 ? "text-emerald-700" : "text-red-700"}`}>{formatCurrency(periodQuery.data.netProfit)}</span> · Outstanding (point-in-time, all-time): {formatCurrency(periodQuery.data.outstanding)}
            </div>
          )}
        </div>

        {/* Smart Insights AI Panel */}
        {!isLoading && stats && (
          <SmartInsights
            toolsRevenue={kpis.data?.toolsRevenue ?? 0}
            sharpeningRevenue={kpis.data?.sharpeningRevenue ?? 0}
            grossMargin={kpis.data?.grossMargin ?? 0}
            outstanding={kpis.data?.outstanding ?? 0}
            thisMonth={kpis.data?.monthlyRevenue ?? 0}
            collectionRate={stats.collectionRate}
            criticalCount={overdueClientsSummary.critical.length}
            warningCount={overdueClientsSummary.warning.length}
            monthlyTrend={monthlyTrend}
          />
        )}

        {/* Monthly Revenue Chart */}
        <div className="vm-card-elevated p-8">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
            <div>
              <p className="vm-eyebrow text-xs">Trend Analysis</p>
              <h3 className="font-display text-2xl mt-2">Monthly Revenue Composition</h3>
              <p className="text-sm text-muted-foreground mt-1">Tools versus sharpening services across the trailing 12 months.</p>
            </div>
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All months</SelectItem>
                {monthNames.map((month, idx) => (
                  <SelectItem key={idx} value={idx.toString()}>{month}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {monthly.isLoading ? (
            <Skeleton className="h-[320px]" />
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={filteredPivot} barCategoryGap="20%">
                <defs>
                  <linearGradient id="toolsGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#01a451" stopOpacity={1} />
                    <stop offset="100%" stopColor="#019647" stopOpacity={0.85} />
                  </linearGradient>
                  <linearGradient id="sharpeningGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2d3436" stopOpacity={1} />
                    <stop offset="100%" stopColor="#1a1d1f" stopOpacity={0.85} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e8eaed" vertical={false} />
                <XAxis dataKey="month" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#fff", border: "1px solid #e8eaed", borderRadius: "12px", boxShadow: "0 10px 25px -5px rgba(0,0,0,0.1)" }}
                  formatter={(value) => formatCurrency(value as number)}
                  cursor={{ fill: "rgba(1, 164, 81, 0.05)" }}
                />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: "16px" }} />
                <Bar dataKey="tools" fill="url(#toolsGrad)" name="Tools sales" radius={[8, 8, 0, 0]} />
                <Bar dataKey="sharpening" fill="url(#sharpeningGrad)" name="Sharpening services" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Profitability Trend */}
        <div className="vm-card-elevated p-8">
          <div className="mb-6">
            <p className="vm-eyebrow text-xs">Profitability Curve</p>
            <h3 className="font-display text-2xl mt-2">Revenue, Cost &amp; Profit Trajectory</h3>
            <p className="text-sm text-muted-foreground mt-1">12-month flow of revenue, cost of goods sold, and gross profit on tools sales.</p>
          </div>
          {profitabilityQuery.isLoading ? (
            <Skeleton className="h-[320px]" />
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <AreaChart data={profitability}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#01a451" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#01a451" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1a1d1f" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#1a1d1f" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e8eaed" vertical={false} />
                <XAxis dataKey="month" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#fff", border: "1px solid #e8eaed", borderRadius: "12px", boxShadow: "0 10px 25px -5px rgba(0,0,0,0.1)" }}
                  formatter={(value) => formatCurrency(value as number)}
                />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: "16px" }} />
                <Area type="monotone" dataKey="revenue" stroke="#01a451" strokeWidth={2.5} fill="url(#revGrad)" name="Revenue" />
                <Area type="monotone" dataKey="cogs" stroke="#94a3b8" strokeWidth={2} fill="none" name="COGS" strokeDasharray="5 5" />
                <Area type="monotone" dataKey="profit" stroke="#1a1d1f" strokeWidth={2.5} fill="url(#profitGrad)" name="Gross profit" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Top Performers + Overdue Alerts side by side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Performers */}
          <div className="vm-card-elevated p-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="vm-eyebrow text-xs">Leaderboard</p>
                <h3 className="font-display text-2xl mt-2">Top Clients</h3>
                <p className="text-sm text-muted-foreground mt-1">Best clients by revenue.</p>
              </div>
              <Link href="/clients" className="text-xs font-semibold text-primary hover:underline flex items-center gap-1">
                All clients <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            {topPerformersQuery.isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16" />)}
              </div>
            ) : (
              <div className="space-y-3">
                {topPerformers.slice(0, 5).map((client: any, idx: number) => (
                  <Link key={idx} href={`/clients/${client.id}`} className="flex items-center justify-between p-4 rounded-xl bg-secondary/40 hover:bg-secondary transition-colors group">
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                          {idx + 1}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-foreground truncate">{client.name}</p>
                          <p className="text-xs text-muted-foreground">{client.invoiceCount} invoices</p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-mono-num font-bold text-foreground">{formatCurrency(client.totalRevenue)}</p>
                        {!isNaN(client.margin) && (
                          <p className="text-xs text-primary font-semibold">{(client.margin * 100).toFixed(1)}% margin</p>
                        )}
                      </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Collection Alerts */}
          <div className="vm-card-elevated p-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="vm-eyebrow text-xs">Action Required</p>
                <h3 className="font-display text-2xl mt-2">Collection Alerts</h3>
                <p className="text-sm text-muted-foreground mt-1">Clients needing immediate attention.</p>
              </div>
              <Link href="/receivables" className="text-xs font-semibold text-primary hover:underline flex items-center gap-1">
                Receivables <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            {overdueClientsSummary.critical.length === 0 && overdueClientsSummary.warning.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-3">
                  <Activity className="w-6 h-6 text-emerald-600" />
                </div>
                <p className="font-semibold text-foreground">All clear</p>
                <p className="text-sm text-muted-foreground mt-1">No overdue clients at the moment.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {overdueClientsSummary.critical.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-rose-600" />
                        <p className="font-semibold text-rose-900 text-sm">
                          Critical · {overdueClientsSummary.critical.length} client{overdueClientsSummary.critical.length > 1 ? "s" : ""} overdue 60+ days
                        </p>
                      </div>
                      <p className="text-xs font-semibold text-rose-700">
                        {formatCurrency(overdueClientsSummary.critical.reduce((s, c) => s + c.balance, 0))}
                      </p>
                    </div>
                    <div className="rounded-xl border border-rose-200 bg-rose-50/40 divide-y divide-rose-100 max-h-72 overflow-y-auto">
                      {overdueClientsSummary.critical.map((c) => (
                        <Link key={c.id} href={`/clients/${c.id}`} className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-rose-100/50 transition-colors">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-rose-950 truncate">{c.name}</p>
                              <p className="text-[11px] text-rose-700/80">
                                {c.daysOverdue} days overdue
                              </p>
                            </div>
                            <p className="text-sm font-mono font-semibold text-rose-900 tabular-nums whitespace-nowrap">
                              {formatCurrency(c.balance)}
                            </p>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
                {overdueClientsSummary.warning.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-amber-600" />
                        <p className="font-semibold text-amber-900 text-sm">
                          Warning · {overdueClientsSummary.warning.length} client{overdueClientsSummary.warning.length > 1 ? "s" : ""} overdue 30–60 days
                        </p>
                      </div>
                      <p className="text-xs font-semibold text-amber-700">
                        {formatCurrency(overdueClientsSummary.warning.reduce((s, c) => s + c.balance, 0))}
                      </p>
                    </div>
                    <div className="rounded-xl border border-amber-200 bg-amber-50/40 divide-y divide-amber-100 max-h-60 overflow-y-auto">
                      {overdueClientsSummary.warning.map((c) => (
                        <Link key={c.id} href={`/clients/${c.id}`} className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-amber-100/50 transition-colors">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-amber-950 truncate">{c.name}</p>
                              <p className="text-[11px] text-amber-700/80">
                                {c.daysOverdue} days overdue
                              </p>
                            </div>
                            <p className="text-sm font-mono font-semibold text-amber-900 tabular-nums whitespace-nowrap">
                              {formatCurrency(c.balance)}
                            </p>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Inventory Intelligence section — SKU velocity + reorder watch + sharpening leaderboard */}
        <InventoryIntelligence />
      </div>
    </DashboardLayout>
  );
}
