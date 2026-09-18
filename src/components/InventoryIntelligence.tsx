import { Link } from "wouter";
import {
  Boxes,
  Flame,
  AlertTriangle,
  Snowflake,
  ShoppingCart,
  Wrench,
  ArrowRight,
  Package,
  Sparkles,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/format";

type SkuRow = {
  toolId: number;
  toolName: string;
  toolCategory: string | null;
  unitPrice: number | null;
  lifetimeUnits: number;
  lifetimeRevenue: number;
  marginPct: number;
  units30d: number;
  units90d: number;
  revenue90d: number;
  daysSinceLastSale: number | null;
  velocityTag: "fast" | "steady" | "slow" | "dead";
  reorderTag: "reorder-now" | "watch" | "ok";
};

function VelocityChip({ tag }: { tag: SkuRow["velocityTag"] }) {
  const map: Record<SkuRow["velocityTag"], { label: string; cls: string }> = {
    fast: { label: "Fast", cls: "bg-emerald-100 text-emerald-800 border-emerald-200" },
    steady: { label: "Steady", cls: "bg-sky-100 text-sky-800 border-sky-200" },
    slow: { label: "Slow", cls: "bg-amber-100 text-amber-800 border-amber-200" },
    dead: { label: "Dead", cls: "bg-rose-100 text-rose-800 border-rose-200" },
  };
  const v = map[tag];
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${v.cls}`}>
      {v.label}
    </span>
  );
}

function SkuRowItem({ s, showWindow = "90d" }: { s: SkuRow; showWindow?: "30d" | "90d" }) {
  const units = showWindow === "30d" ? s.units30d : s.units90d;
  const windowLabel = showWindow === "30d" ? "30d" : "90d";
  return (
    <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-secondary/40 hover:bg-secondary transition-colors">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="font-medium text-sm text-foreground truncate" title={s.toolName}>
            {s.toolName}
          </p>
          <VelocityChip tag={s.velocityTag} />
        </div>
        <p className="text-[11px] text-muted-foreground mt-0.5 tabular-nums">
          {units} units · {windowLabel} {s.marginPct ? ` · ${s.marginPct}% margin` : ""}
        </p>
      </div>
      <p className="font-mono-num font-semibold text-sm text-foreground whitespace-nowrap">
        {formatCurrency(s.revenue90d || s.lifetimeRevenue)}
      </p>
    </div>
  );
}

export default function InventoryIntelligence() {
  const q = trpc.analytics.inventoryIntelligence.useQuery();

  if (q.isLoading || !q.data) {
    return (
      <div className="vm-card-elevated p-8 space-y-4">
        <Skeleton className="h-6 w-64" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      </div>
    );
  }

  const data = q.data;
  const toolMargin = data.streamMargins.find((s) => s.type === "purchase")?.marginPct ?? 0;
  const sharpMargin = data.streamMargins.find((s) => s.type === "sharpening")?.marginPct ?? 0;
  const marginGap = sharpMargin - toolMargin;

  return (
    <div className="vm-card-elevated p-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="vm-eyebrow text-xs">Inventory Intelligence</p>
          <h3 className="font-display text-2xl mt-2 flex items-center gap-2">
            <Boxes className="w-6 h-6 text-primary" /> Stock & Service Velocity
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            What's flying off the shelf, what to reorder, and what's sitting cold.
          </p>
        </div>
        <Link
          href="/stock-history"
          className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
        >
          Full stock history <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-4">
          <p className="text-[11px] uppercase tracking-wider text-emerald-800 font-semibold flex items-center gap-1">
            <Flame className="w-3 h-3" /> Fast movers
          </p>
          <p className="text-2xl font-display text-emerald-900 mt-1 tabular-nums">{data.fastMovers}</p>
          <p className="text-[11px] text-emerald-700/80">SKUs sold in last 30d</p>
        </div>
        <div className="rounded-xl bg-sky-50 border border-sky-100 p-4">
          <p className="text-[11px] uppercase tracking-wider text-sky-800 font-semibold flex items-center gap-1">
            <Package className="w-3 h-3" /> Active SKUs
          </p>
          <p className="text-2xl font-display text-sky-900 mt-1 tabular-nums">
            {data.totalSkusSoldEver}
          </p>
          <p className="text-[11px] text-sky-700/80">Sold at least once</p>
        </div>
        <div className="rounded-xl bg-rose-50 border border-rose-100 p-4">
          <p className="text-[11px] uppercase tracking-wider text-rose-800 font-semibold flex items-center gap-1">
            <Snowflake className="w-3 h-3" /> Dead stock
          </p>
          <p className="text-2xl font-display text-rose-900 mt-1 tabular-nums">
            {data.deadStockCount}
          </p>
          <p className="text-[11px] text-rose-700/80">
            {formatCurrency(data.deadStockRevenueLifetime)} lifetime
          </p>
        </div>
        <div className="rounded-xl bg-violet-50 border border-violet-100 p-4">
          <p className="text-[11px] uppercase tracking-wider text-violet-800 font-semibold flex items-center gap-1">
            <Sparkles className="w-3 h-3" /> Margin gap
          </p>
          <p className="text-2xl font-display text-violet-900 mt-1 tabular-nums">
            {marginGap > 0 ? "+" : ""}
            {marginGap.toFixed(1)} pp
          </p>
          <p className="text-[11px] text-violet-700/80">
            Sharpen {sharpMargin}% vs tools {toolMargin}%
          </p>
        </div>
      </div>

      {/* Three column grid: Top movers · Reorder · Sharpening */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top movers (90d) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Flame className="w-4 h-4 text-emerald-600" /> Top movers (90d)
            </p>
            <span className="text-[11px] text-muted-foreground">{data.topMovers.length} SKUs</span>
          </div>
          {data.topMovers.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">No tool sales in the last 90 days.</p>
          ) : (
            <div className="space-y-2">
              {data.topMovers.map((s) => (
                <SkuRowItem key={s.toolId} s={s as SkuRow} showWindow="90d" />
              ))}
            </div>
          )}
        </div>

        {/* Reorder + Watch */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-primary" /> Reorder watch
            </p>
            <span className="text-[11px] text-muted-foreground">
              {data.reorderList.length + data.watchList.length} flagged
            </span>
          </div>
          {data.reorderList.length === 0 && data.watchList.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">Nothing urgent — stock looks healthy.</p>
          ) : (
            <div className="space-y-2">
              {data.reorderList.map((s) => (
                <div
                  key={`r-${s.toolId}`}
                  className="p-3 rounded-lg bg-emerald-50 border border-emerald-200"
                >
                  <p className="text-[11px] uppercase font-semibold text-emerald-800 mb-0.5">
                    Reorder now · {s.units30d}u in last 30d
                  </p>
                  <p className="text-sm font-medium text-emerald-950 truncate" title={s.toolName}>
                    {s.toolName}
                  </p>
                  <p className="text-[11px] text-emerald-700 tabular-nums mt-0.5">
                    {formatCurrency(s.revenue90d)} · 90d
                  </p>
                </div>
              ))}
              {data.watchList.map((s) => (
                <div
                  key={`w-${s.toolId}`}
                  className="p-3 rounded-lg bg-amber-50 border border-amber-200"
                >
                  <p className="text-[11px] uppercase font-semibold text-amber-800 mb-0.5 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> Watch · last sold {s.daysSinceLastSale ?? "?"}d ago
                  </p>
                  <p className="text-sm font-medium text-amber-950 truncate" title={s.toolName}>
                    {s.toolName}
                  </p>
                  <p className="text-[11px] text-amber-700 tabular-nums mt-0.5">
                    {formatCurrency(s.lifetimeRevenue)} lifetime · {s.lifetimeUnits}u
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top sharpening services */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Wrench className="w-4 h-4 text-violet-600" /> Top sharpening services
            </p>
            <span className="text-[11px] text-muted-foreground">{data.topSharpening.length}</span>
          </div>
          {data.topSharpening.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">No sharpening jobs yet.</p>
          ) : (
            <div className="space-y-2">
              {data.topSharpening.map((s, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between gap-3 p-3 rounded-lg bg-violet-50/60 border border-violet-100"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-violet-950 truncate" title={s.serviceName}>
                      {s.serviceName}
                    </p>
                    <p className="text-[11px] text-violet-700/80 tabular-nums mt-0.5">
                      {s.jobs} jobs · {s.marginPct}% margin
                    </p>
                  </div>
                  <p className="font-mono-num font-semibold text-sm text-violet-900 whitespace-nowrap">
                    {formatCurrency(s.revenue)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Dead stock callout (only if there is any) */}
      {data.deadStock.length > 0 && (
        <div className="rounded-xl border border-rose-200 bg-rose-50/40 p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-rose-900 flex items-center gap-2">
              <Snowflake className="w-4 h-4 text-rose-600" /> Dead stock — no sale in 12+ months
            </p>
            <span className="text-[11px] text-rose-700">
              {data.deadStockCount} SKUs · {formatCurrency(data.deadStockRevenueLifetime)} lifetime
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {data.deadStock.map((s) => (
              <div
                key={s.toolId}
                className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-white/60 border border-rose-100"
              >
                <p className="text-xs text-rose-950 truncate flex-1" title={s.toolName}>
                  {s.toolName}
                </p>
                <p className="text-[11px] tabular-nums text-rose-800 font-semibold whitespace-nowrap">
                  {s.lifetimeUnits}u · {formatCurrency(s.lifetimeRevenue)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
