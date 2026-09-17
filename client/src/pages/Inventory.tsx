import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { formatCurrency } from "@/lib/format";
import {
  AlertTriangle,
  ArrowUpDown,
  CheckCircle2,
  RefreshCw,
  Search,
  XCircle,
  Boxes,
  Coins,
  TrendingDown,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import SectionHeader from "@/components/SectionHeader";

type SortKey = "code" | "name" | "qty" | "cost" | "value";

export default function Inventory() {
  const utils = trpc.useUtils();
  const status = trpc.inventory.status.useQuery(undefined, {
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
  const items = trpc.inventory.listItems.useQuery(
    { forceRefresh: false },
    {
      enabled: status.data?.reachable === true,
      staleTime: 60_000,
      refetchOnWindowFocus: false,
    }
  );

  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({
    key: "value",
    dir: "desc",
  });
  const [refreshing, setRefreshing] = useState(false);

  const visibleItems = useMemo(() => {
    const arr = (items.data?.items ?? []).slice();
    const q = search.trim().toLowerCase();
    const filtered = q
      ? arr.filter(
          (it) =>
            it.itemName.toLowerCase().includes(q) ||
            it.itemCode.toLowerCase().includes(q) ||
            (it.description ?? "").toLowerCase().includes(q)
        )
      : arr;
    filtered.sort((a, b) => {
      const dir = sort.dir === "asc" ? 1 : -1;
      switch (sort.key) {
        case "code":
          return a.itemCode.localeCompare(b.itemCode) * dir;
        case "name":
          return a.itemName.localeCompare(b.itemName) * dir;
        case "qty":
          return (a.qtyOwned - b.qtyOwned) * dir;
        case "cost":
          return ((a.averageCost ?? 0) - (b.averageCost ?? 0)) * dir;
        case "value":
        default:
          return (a.totalValue - b.totalValue) * dir;
      }
    });
    return filtered;
  }, [items.data, search, sort]);

  const summary = useMemo(() => {
    const arr = items.data?.items ?? [];
    const total = arr.length;
    const inStock = arr.filter((i) => (i.qtyOwned ?? 0) > 0).length;
    const outOfStock = arr.filter((i) => (i.qtyOwned ?? 0) <= 0).length;
    const lowStock = arr.filter((i) => (i.qtyOwned ?? 0) > 0 && i.qtyOwned < 5).length;
    const totalValue = arr.reduce((a, b) => a + (b.totalValue ?? 0), 0);
    return { total, inStock, outOfStock, lowStock, totalValue };
  }, [items.data]);

  async function handleRefresh() {
    try {
      setRefreshing(true);
      await utils.inventory.listItems.fetch({ forceRefresh: true });
      await utils.inventory.status.fetch();
      toast.success("Inventory refreshed from Manager.io");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Refresh failed");
    } finally {
      setRefreshing(false);
    }
  }

  const headerCell = (label: string, key: SortKey, align: "left" | "right" = "left") => (
    <th
      className={`py-3 px-4 font-medium text-[10px] tracking-[0.2em] uppercase text-muted-foreground cursor-pointer select-none ${
        align === "right" ? "text-right" : "text-left"
      }`}
      onClick={() =>
        setSort((s) =>
          s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" }
        )
      }
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <ArrowUpDown
          className={`h-3 w-3 ${sort.key === key ? "text-primary" : "text-muted-foreground/40"}`}
        />
      </span>
    </th>
  );

  return (
    <DashboardLayout>
      <div className="container py-8 space-y-8">
        <SectionHeader
          eyebrow="Live from Manager.io"
          title="Inventory"
          description="Mirrors your Manager.io inventory in real time. Stock counts, average cost, and carrying value are pulled directly from the accounting book — nothing is ever edited from this screen."
          actions={
            <Button onClick={handleRefresh} disabled={refreshing} variant="outline">
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
              Refresh from Manager.io
            </Button>
          }
        />

        {/* Connection status */}
        <ConnectionBanner status={status.data} loading={status.isLoading} />

        {/* KPI row */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <MiniCard icon={Boxes} label="Distinct items" value={summary.total.toString()} />
          <MiniCard
            icon={CheckCircle2}
            label="In stock"
            value={summary.inStock.toString()}
            tone="success"
          />
          <MiniCard
            icon={TrendingDown}
            label="Low stock (<5)"
            value={summary.lowStock.toString()}
            tone="warning"
          />
          <MiniCard
            icon={XCircle}
            label="Out of stock"
            value={summary.outOfStock.toString()}
            tone="muted"
          />
          <MiniCard
            icon={Coins}
            label="Inventory value"
            value={formatCurrency(summary.totalValue)}
            tone="primary"
          />
        </div>

        {/* Table */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div>
              <CardTitle className="font-display text-xl">All inventory items</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                {items.data
                  ? `${items.data.totalRecords} item${
                      items.data.totalRecords === 1 ? "" : "s"
                    } · ${items.data.businessName}`
                  : "Loading…"}
              </p>
            </div>
            <div className="relative w-full max-w-xs">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search code, name or description…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {items.isLoading ? (
              <div className="p-6 space-y-3">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-10" />
                ))}
              </div>
            ) : items.error ? (
              <div className="p-6 text-sm text-destructive">
                Could not load inventory: {items.error.message}
              </div>
            ) : visibleItems.length === 0 ? (
              <div className="p-10 text-center text-sm text-muted-foreground">
                No items match your search.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-y border-border bg-muted/40">
                    <tr>
                      {headerCell("Code", "code")}
                      {headerCell("Item", "name")}
                      {headerCell("Qty owned", "qty", "right")}
                      {headerCell("Avg cost", "cost", "right")}
                      {headerCell("Total value", "value", "right")}
                    </tr>
                  </thead>
                  <tbody>
                    {visibleItems.map((it) => (
                      <tr
                        key={it.key}
                        className="border-b border-border last:border-0 hover:bg-muted/30"
                      >
                        <td className="py-3 px-4 text-xs font-mono-num text-muted-foreground">
                          {it.itemCode || "—"}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-medium">{it.itemName}</div>
                          {it.description && (
                            <div className="text-xs text-muted-foreground line-clamp-1">
                              {it.description}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right font-mono-num">
                          <StockBadge qty={it.qtyOwned} />
                        </td>
                        <td className="py-3 px-4 text-right font-mono-num text-muted-foreground">
                          {it.averageCost !== null
                            ? formatCurrency(it.averageCost)
                            : "—"}
                        </td>
                        <td className="py-3 px-4 text-right font-mono-num font-medium">
                          {formatCurrency(it.totalValue)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

function MiniCard({
  icon: Icon,
  label,
  value,
  tone = "default",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  tone?: "default" | "success" | "warning" | "muted" | "primary";
}) {
  const toneStyles: Record<string, string> = {
    default: "bg-card",
    success: "bg-primary/5 border-primary/20",
    warning: "bg-amber-50 border-amber-200",
    muted: "bg-muted/50",
    primary: "bg-primary/10 border-primary/30",
  };
  const iconStyles: Record<string, string> = {
    default: "bg-primary/10 text-primary",
    success: "bg-primary/15 text-primary",
    warning: "bg-amber-100 text-amber-700",
    muted: "bg-muted text-muted-foreground",
    primary: "bg-primary/15 text-primary",
  };
  return (
    <Card className={toneStyles[tone]}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] tracking-[0.22em] uppercase text-muted-foreground">{label}</p>
            <p className="mt-2 text-xl font-display tracking-tight font-mono-num truncate">
              {value}
            </p>
          </div>
          <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${iconStyles[tone]}`}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function StockBadge({ qty }: { qty: number }) {
  if (qty <= 0) {
    return <span className="text-destructive font-medium">0</span>;
  }
  if (qty < 5) {
    return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">{qty}</Badge>;
  }
  return <span>{qty}</span>;
}

function ConnectionBanner({
  status,
  loading,
}: {
  status:
    | { configured: boolean; reachable: boolean; businessName: string | null; baseUrl: string | null; error?: string }
    | undefined;
  loading: boolean;
}) {
  if (loading) {
    return <Skeleton className="h-16 w-full rounded-lg" />;
  }
  if (!status) return null;

  if (!status.configured) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-amber-700 mt-0.5 shrink-0" />
        <div>
          <p className="font-medium text-amber-900">Manager.io is not configured yet.</p>
          <p className="text-amber-800 mt-1">
            Ask your administrator to set <code>MANAGER_API_URL</code> and{" "}
            <code>MANAGER_API_KEY</code> in Project → Settings → Secrets.
          </p>
        </div>
      </div>
    );
  }

  if (!status.reachable) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm flex items-start gap-3">
        <XCircle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
        <div>
          <p className="font-medium text-destructive">Can't reach Manager.io.</p>
          <p className="text-muted-foreground mt-1">
            Make sure Manager.io is running on your PC and that the Cloudflare tunnel is up. The
            server is configured to use <code className="break-all">{status.baseUrl}</code>.
          </p>
          {status.error && (
            <p className="mt-2 text-xs text-muted-foreground">Error: {status.error}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm flex items-start gap-3">
      <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="font-medium">
          Connected to <span className="font-display">{status.businessName}</span> via Manager.io
        </p>
        <p className="text-muted-foreground text-xs mt-1 break-all">{status.baseUrl}</p>
      </div>
      <Badge className="bg-primary/15 text-primary hover:bg-primary/15">Live</Badge>
    </div>
  );
}
