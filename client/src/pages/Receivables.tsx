import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import { ArrowRight, AlertTriangle, Clock, Wallet, Users, TrendingDown } from "lucide-react";
import { useLocation } from "wouter";
import DashboardLayout from "@/components/DashboardLayout";
import SectionHeader from "@/components/SectionHeader";
import SmartKpiGrid from "@/components/SmartKpiGrid";
import { formatCurrency } from "@/lib/format";
import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

export function ReceivablesPage() {
  const { data: clients = [], isLoading } = trpc.financial.clientsWithOutstanding.useQuery();
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [bucketFilter, setBucketFilter] = useState<"all" | "current" | "warning" | "critical">("all");

  const calculateDaysOverdue = (date: string | Date | null) => {
    if (!date) return 0;
    const invoiceDate = typeof date === "string" ? new Date(date) : date;
    const today = new Date();
    const diffTime = Math.abs(today.getTime() - invoiceDate.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const enriched = useMemo(() => {
    return (clients || []).map((c: any) => {
      const days = calculateDaysOverdue(c.oldestUnpaidDate);
      const outstanding = Number(c.outstandingBalance) || 0;
      let bucket: "current" | "warning" | "critical" = "current";
      if (days > 60) bucket = "critical";
      else if (days > 30) bucket = "warning";
      return { ...c, days, outstanding, bucket };
    });
  }, [clients]);

  const filtered = useMemo(() => {
    return enriched
      .filter((c) => bucketFilter === "all" || c.bucket === bucketFilter)
      .filter((c) =>
        search.trim() === "" ||
        c.companyName?.toLowerCase().includes(search.trim().toLowerCase())
      )
      .sort((a, b) => b.outstanding - a.outstanding);
  }, [enriched, bucketFilter, search]);

  const totals = useMemo(() => {
    const total = enriched.reduce((s, c) => s + c.outstanding, 0);
    const critical = enriched.filter((c) => c.bucket === "critical");
    const warning = enriched.filter((c) => c.bucket === "warning");
    const current = enriched.filter((c) => c.bucket === "current");
    return {
      total,
      criticalAmount: critical.reduce((s, c) => s + c.outstanding, 0),
      warningAmount: warning.reduce((s, c) => s + c.outstanding, 0),
      currentAmount: current.reduce((s, c) => s + c.outstanding, 0),
      criticalCount: critical.length,
      warningCount: warning.length,
      currentCount: current.length,
    };
  }, [enriched]);

  const bucketStyle = (bucket: string) => {
    if (bucket === "critical") return "vm-pill vm-pill-danger";
    if (bucket === "warning") return "vm-pill vm-pill-warning";
    return "vm-pill vm-pill-success";
  };

  const bucketLabel = (bucket: string) => {
    if (bucket === "critical") return "60+ days";
    if (bucket === "warning") return "31–60 days";
    return "0–30 days";
  };

  return (
    <DashboardLayout>
      <div className="container py-8 space-y-8">
        <SectionHeader
          eyebrow="Cash Flow"
          title="Receivables"
          description="Outstanding balances by client. Click a row to drill into the client's full financial history."
        />

        {/* KPI Cards */}
        <SmartKpiGrid
          cards={[
            {
              label: "Total Outstanding",
              value: formatCurrency(totals.total),
              sublabel: `${enriched.length} client${enriched.length === 1 ? "" : "s"}`,
              variant: "primary",
              icon: <Wallet className="w-4 h-4 text-white" />,
            },
            {
              label: "Critical (60+ days)",
              value: formatCurrency(totals.criticalAmount),
              sublabel: `${totals.criticalCount} client${totals.criticalCount === 1 ? "" : "s"} overdue`,
              variant: "outline",
              icon: <AlertTriangle className="w-4 h-4 text-rose-600" />,
            },
            {
              label: "Warning (31–60 days)",
              value: formatCurrency(totals.warningAmount),
              sublabel: `${totals.warningCount} client${totals.warningCount === 1 ? "" : "s"}`,
              variant: "outline",
              icon: <Clock className="w-4 h-4 text-amber-600" />,
            },
            {
              label: "Current (0–30 days)",
              value: formatCurrency(totals.currentAmount),
              sublabel: `${totals.currentCount} client${totals.currentCount === 1 ? "" : "s"}`,
              variant: "outline",
              icon: <Users className="w-4 h-4 text-primary" />,
            },
          ]}
        />

        {/* Filters */}
        <div className="vm-card-elevated p-6">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by client name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-10"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              <BucketTab active={bucketFilter === "all"} onClick={() => setBucketFilter("all")}>
                All ({enriched.length})
              </BucketTab>
              <BucketTab active={bucketFilter === "critical"} onClick={() => setBucketFilter("critical")} variant="danger">
                Critical ({totals.criticalCount})
              </BucketTab>
              <BucketTab active={bucketFilter === "warning"} onClick={() => setBucketFilter("warning")} variant="warning">
                Warning ({totals.warningCount})
              </BucketTab>
              <BucketTab active={bucketFilter === "current"} onClick={() => setBucketFilter("current")} variant="success">
                Current ({totals.currentCount})
              </BucketTab>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="vm-card-elevated overflow-hidden">
          <div className="p-6 border-b border-border">
            <p className="vm-eyebrow text-xs">Detail Ledger</p>
            <h3 className="font-display text-2xl mt-2">Client Receivables</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {filtered.length} record{filtered.length === 1 ? "" : "s"} matching current filters.
            </p>
          </div>
          {isLoading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-16 text-center">
              <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-3">
                <TrendingDown className="w-6 h-6 text-emerald-600" />
              </div>
              <p className="font-semibold text-foreground">No matching receivables</p>
              <p className="text-sm text-muted-foreground mt-1">Try adjusting your filters.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-secondary/40 hover:bg-secondary/40">
                    <TableHead className="font-bold text-xs uppercase tracking-wider">Client</TableHead>
                    <TableHead className="font-bold text-xs uppercase tracking-wider">Outstanding</TableHead>
                    <TableHead className="font-bold text-xs uppercase tracking-wider">Oldest Unpaid</TableHead>
                    <TableHead className="font-bold text-xs uppercase tracking-wider">Aging</TableHead>
                    <TableHead className="font-bold text-xs uppercase tracking-wider">Status</TableHead>
                    <TableHead className="font-bold text-xs uppercase tracking-wider text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((client) => (
                    <TableRow key={client.id} className="hover:bg-secondary/30 transition-colors">
                      <TableCell>
                        <div>
                          <p className="font-semibold text-foreground">{client.companyName}</p>
                          <p className="text-xs text-muted-foreground">Client ID #{client.id}</p>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono-num font-bold text-foreground">
                        {formatCurrency(client.outstanding)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground font-mono-num">
                        {client.oldestUnpaidDate ? new Date(client.oldestUnpaidDate).toLocaleDateString() : "—"}
                      </TableCell>
                      <TableCell className="text-sm font-mono-num">{client.days} days</TableCell>
                      <TableCell>
                        <span className={bucketStyle(client.bucket)}>{bucketLabel(client.bucket)}</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          className="font-semibold"
                          onClick={() => setLocation(`/clients/${client.id}`)}
                        >
                          View <ArrowRight className="w-3 h-3 ml-1" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

function BucketTab({
  active,
  onClick,
  children,
  variant = "default",
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  variant?: "default" | "success" | "warning" | "danger";
}) {
  const colors = {
    default: active ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground hover:bg-secondary/80",
    success: active ? "bg-emerald-600 text-white" : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
    warning: active ? "bg-amber-600 text-white" : "bg-amber-50 text-amber-700 hover:bg-amber-100",
    danger: active ? "bg-rose-600 text-white" : "bg-rose-50 text-rose-700 hover:bg-rose-100",
  };
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${colors[variant]}`}
    >
      {children}
    </button>
  );
}
