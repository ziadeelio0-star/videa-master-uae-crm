import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Search,
  FileText,
  TrendingUp,
  TrendingDown,
  ChevronDown,
  ChevronRight,
  Package,
  Scissors,
  DollarSign,
  BarChart3,
  Percent,
  ArrowUpRight,
} from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

function fmtDate(d: Date | string | null | undefined) {
  if (!d) return "—";
  const dt = typeof d === "string" ? new Date(d) : d;
  if (isNaN(dt.getTime())) return "—";
  return dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function MarginBadge({ margin }: { margin: number }) {
  const color =
    margin >= 50 ? "bg-emerald-100 text-emerald-800 border-emerald-200" :
    margin >= 30 ? "bg-green-100 text-green-800 border-green-200" :
    margin >= 15 ? "bg-yellow-100 text-yellow-800 border-yellow-200" :
    margin >= 0 ? "bg-orange-100 text-orange-800 border-orange-200" :
    "bg-red-100 text-red-800 border-red-200";
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border", color)}>
      {margin >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {margin.toFixed(1)}%
    </span>
  );
}

function InvoiceDetailCard({ invoiceNumber }: { invoiceNumber: string }) {
  const { data, isLoading } = trpc.invoices.detail.useQuery({ invoiceNumber });

  if (isLoading) {
    return (
      <div className="p-4 space-y-3">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!data) {
    return <p className="p-4 text-sm text-muted-foreground">No detail found.</p>;
  }

  const s = data.summary;

  return (
    <div className="p-4 space-y-4 bg-muted/30 border-t">
      {/* Summary KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white rounded-lg p-3 border shadow-sm">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Revenue</p>
          <p className="text-base font-bold text-foreground">{formatCurrency(s.totalRevenue, true)}</p>
        </div>
        <div className="bg-white rounded-lg p-3 border shadow-sm">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">COGS</p>
          <p className="text-base font-bold text-foreground">{formatCurrency(s.totalCogs, true)}</p>
        </div>
        <div className="bg-white rounded-lg p-3 border shadow-sm">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Gross Profit</p>
          <p className={cn("text-base font-bold", s.grossProfit >= 0 ? "text-emerald-700" : "text-red-600")}>
            {formatCurrency(s.grossProfit, true)}
          </p>
        </div>
        <div className="bg-white rounded-lg p-3 border shadow-sm">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Margin %</p>
          <p className="text-base font-bold text-foreground">{s.marginPct.toFixed(1)}%</p>
        </div>
        <div className="bg-white rounded-lg p-3 border shadow-sm">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Markup %</p>
          <p className="text-base font-bold text-foreground">{s.markupPct.toFixed(1)}%</p>
        </div>
        <div className="bg-white rounded-lg p-3 border shadow-sm">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Items</p>
          <p className="text-base font-bold text-foreground">{s.lineItemCount} ({s.totalQuantity} units)</p>
        </div>
      </div>

      {/* Line items table */}
      <div className="rounded-lg border bg-white overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="text-xs font-semibold">Item</TableHead>
              <TableHead className="text-xs font-semibold text-right">Qty</TableHead>
              <TableHead className="text-xs font-semibold text-right">Unit Price</TableHead>
              <TableHead className="text-xs font-semibold text-right">Unit Cost</TableHead>
              <TableHead className="text-xs font-semibold text-right">Revenue</TableHead>
              <TableHead className="text-xs font-semibold text-right">COGS</TableHead>
              <TableHead className="text-xs font-semibold text-right">Profit</TableHead>
              <TableHead className="text-xs font-semibold text-center">Margin</TableHead>
              <TableHead className="text-xs font-semibold text-center">Markup</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.lineItems.map((line) => (
              <TableRow key={line.id} className="hover:bg-muted/20">
                <TableCell className="text-sm max-w-[200px]">
                  <div className="truncate font-medium">{line.description}</div>
                  {line.itemId && (
                    <span className="text-[10px] text-muted-foreground">{line.itemId}</span>
                  )}
                </TableCell>
                <TableCell className="text-sm text-right font-mono">{line.quantity}</TableCell>
                <TableCell className="text-sm text-right font-mono">{formatCurrency(line.unitPrice, true)}</TableCell>
                <TableCell className="text-sm text-right font-mono">{formatCurrency(line.unitCost, true)}</TableCell>
                <TableCell className="text-sm text-right font-mono">{formatCurrency(line.amount, true)}</TableCell>
                <TableCell className="text-sm text-right font-mono">{formatCurrency(line.cogs, true)}</TableCell>
                <TableCell className={cn("text-sm text-right font-mono font-semibold", line.grossProfit >= 0 ? "text-emerald-700" : "text-red-600")}>
                  {formatCurrency(line.grossProfit, true)}
                </TableCell>
                <TableCell className="text-center">
                  <MarginBadge margin={line.marginPct} />
                </TableCell>
                <TableCell className="text-center text-sm font-mono">
                  {line.markupPct.toFixed(0)}%
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export default function Invoices() {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [expandedInvoice, setExpandedInvoice] = useState<string | null>(null);

  // Debounce search
  const debounceTimer = useMemo(() => {
    let timer: ReturnType<typeof setTimeout>;
    return (value: string) => {
      clearTimeout(timer);
      timer = setTimeout(() => setDebouncedQuery(value), 300);
    };
  }, []);

  const handleSearch = (value: string) => {
    setSearchQuery(value);
    debounceTimer(value);
  };

  const { data: invoices, isLoading } = trpc.invoices.search.useQuery(
    { query: debouncedQuery, limit: 500 },
  );

  // Summary stats
  const stats = useMemo(() => {
    if (!invoices || invoices.length === 0) return null;
    const totalRev = invoices.reduce((s, i) => s + i.totalRevenue, 0);
    const totalCogs = invoices.reduce((s, i) => s + i.totalCogs, 0);
    const gp = totalRev - totalCogs;
    const avgMargin = totalRev > 0 ? (gp / totalRev) * 100 : 0;
    const avgMarkup = totalCogs > 0 ? (gp / totalCogs) * 100 : 0;
    return {
      count: invoices.length,
      totalRevenue: totalRev,
      totalCogs,
      grossProfit: gp,
      avgMargin,
      avgMarkup,
    };
  }, [invoices]);

  return (
    <DashboardLayout>
      <div className="space-y-6 p-6 max-w-[1400px] mx-auto">
        {/* Header */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-display font-bold tracking-tight">Invoice Explorer</h1>
              <p className="text-sm text-muted-foreground">
                Search any invoice and see its full P&L breakdown — revenue, COGS, profit, margin, and markup per line item.
              </p>
            </div>
          </div>
        </div>

        {/* Search bar */}
        <Card className="border-2 border-primary/20 shadow-sm">
          <CardContent className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                placeholder="Search by invoice number (e.g. 310, 150, 78)..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-10 h-12 text-base border-0 bg-muted/50 focus-visible:ring-primary/30"
              />
            </div>
          </CardContent>
        </Card>

        {/* Summary strip */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <Card className="shadow-sm">
              <CardContent className="p-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium flex items-center gap-1">
                  <FileText className="h-3 w-3" /> Invoices
                </p>
                <p className="text-lg font-bold">{stats.count}</p>
              </CardContent>
            </Card>
            <Card className="shadow-sm">
              <CardContent className="p-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium flex items-center gap-1">
                  <DollarSign className="h-3 w-3" /> Revenue
                </p>
                <p className="text-lg font-bold">{formatCurrency(stats.totalRevenue)}</p>
              </CardContent>
            </Card>
            <Card className="shadow-sm">
              <CardContent className="p-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium flex items-center gap-1">
                  <Package className="h-3 w-3" /> COGS
                </p>
                <p className="text-lg font-bold">{formatCurrency(stats.totalCogs)}</p>
              </CardContent>
            </Card>
            <Card className="shadow-sm">
              <CardContent className="p-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" /> Gross Profit
                </p>
                <p className={cn("text-lg font-bold", stats.grossProfit >= 0 ? "text-emerald-700" : "text-red-600")}>
                  {formatCurrency(stats.grossProfit)}
                </p>
              </CardContent>
            </Card>
            <Card className="shadow-sm">
              <CardContent className="p-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium flex items-center gap-1">
                  <BarChart3 className="h-3 w-3" /> Avg Margin
                </p>
                <p className="text-lg font-bold">{stats.avgMargin.toFixed(1)}%</p>
              </CardContent>
            </Card>
            <Card className="shadow-sm">
              <CardContent className="p-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium flex items-center gap-1">
                  <ArrowUpRight className="h-3 w-3" /> Avg Markup
                </p>
                <p className="text-lg font-bold">{stats.avgMarkup.toFixed(1)}%</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Results */}
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-lg" />
            ))}
          </div>
        ) : !invoices || invoices.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <FileText className="h-12 w-12 text-muted-foreground/40 mb-4" />
              <h3 className="text-lg font-semibold text-muted-foreground">
                {debouncedQuery ? "No invoices found" : "Search for an invoice"}
              </h3>
              <p className="text-sm text-muted-foreground/70 mt-1 max-w-sm">
                {debouncedQuery
                  ? `No invoices match "${debouncedQuery}". Try a different number.`
                  : "Type an invoice number above to see its full P&L breakdown."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {invoices.map((inv) => {
              const isExpanded = expandedInvoice === inv.invoiceNumber;
              return (
                <Card
                  key={`${inv.invoiceNumber}-${inv.clientId}-${inv.type}`}
                  className={cn(
                    "transition-all duration-200 overflow-hidden",
                    isExpanded ? "ring-2 ring-primary/30 shadow-md" : "hover:shadow-sm"
                  )}
                >
                  {/* Invoice row header */}
                  <div
                    className="flex items-center gap-4 p-4 cursor-pointer hover:bg-muted/30 transition-colors"
                    onClick={() => setExpandedInvoice(isExpanded ? null : inv.invoiceNumber)}
                  >
                    <div className="flex items-center justify-center h-8 w-8 rounded-md bg-muted/60">
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-primary" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>

                    {/* Invoice # + type badge */}
                    <div className="flex items-center gap-2 min-w-[140px]">
                      <span className="font-mono font-bold text-base">#{inv.invoiceNumber}</span>
                      <Badge variant="outline" className={cn(
                        "text-[10px] uppercase",
                        inv.type === "sharpening" ? "border-blue-300 text-blue-700" : "border-amber-300 text-amber-700"
                      )}>
                        {inv.type === "sharpening" ? <Scissors className="h-3 w-3 mr-0.5" /> : <Package className="h-3 w-3 mr-0.5" />}
                        {inv.type}
                      </Badge>
                    </div>

                    {/* Client + date */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{inv.clientName}</p>
                      <p className="text-xs text-muted-foreground">{fmtDate(inv.invoiceDate)} · {inv.lineItems} items</p>
                    </div>

                    {/* Financial summary */}
                    <div className="hidden sm:flex items-center gap-6 text-right">
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase">Revenue</p>
                        <p className="text-sm font-semibold font-mono">{formatCurrency(inv.totalRevenue, true)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase">COGS</p>
                        <p className="text-sm font-mono">{formatCurrency(inv.totalCogs, true)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase">Profit</p>
                        <p className={cn("text-sm font-semibold font-mono", inv.grossProfit >= 0 ? "text-emerald-700" : "text-red-600")}>
                          {formatCurrency(inv.grossProfit, true)}
                        </p>
                      </div>
                      <div className="min-w-[60px]">
                        <p className="text-[10px] text-muted-foreground uppercase">Margin</p>
                        <MarginBadge margin={inv.marginPct} />
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase">Markup</p>
                        <p className="text-sm font-mono font-semibold">{inv.markupPct.toFixed(0)}%</p>
                      </div>
                    </div>
                  </div>

                  {/* Expanded detail */}
                  {isExpanded && <InvoiceDetailCard invoiceNumber={inv.invoiceNumber} />}
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
