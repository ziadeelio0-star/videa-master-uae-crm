import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import SectionHeader from "@/components/SectionHeader";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
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
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Search,
  Building2,
  Package,
  ChevronsUpDown,
  Check,
  History,
  ArrowLeft,
  Receipt,
} from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

// Brand assets uploaded to webdev storage — personalised 3·S identity.
const BRAND = {
  logo: "/manus-storage/3s-logo_7e37c362.png",
  cutterHead: "/manus-storage/3s-cutter-head_656e29f5.png",
  spiralBit: "/manus-storage/3s-spiral-bit_fa59e61b.png",
  routerBit: "/manus-storage/3s-router-bit_708e8ac7.png",
  toolLineup: "/manus-storage/3s-tool-lineup_85e70d1b.png",
} as const;

function fmtDate(d: Date | string | null | undefined) {
  if (!d) return "—";
  const dt = typeof d === "string" ? new Date(d) : d;
  if (isNaN(dt.getTime())) return "—";
  return dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

/**
 * Highlight matched substrings within a string (case-insensitive). Supports
 * multi-token queries (whitespace separated) — every token is highlighted
 * independently. Returns React nodes with matched parts wrapped in <mark>.
 */
function highlight(text: string, query: string) {
  if (!query) return text;
  const tokens = query
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
  if (tokens.length === 0) return text;

  // Find all match ranges across all tokens, then merge overlaps.
  const ranges: Array<[number, number]> = [];
  const lower = text.toLowerCase();
  for (const tok of tokens) {
    let from = 0;
    while (from <= lower.length) {
      const idx = lower.indexOf(tok, from);
      if (idx === -1) break;
      ranges.push([idx, idx + tok.length]);
      from = idx + tok.length;
    }
  }
  if (ranges.length === 0) return text;
  ranges.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const merged: Array<[number, number]> = [];
  for (const [s, e] of ranges) {
    if (merged.length && merged[merged.length - 1][1] >= s) {
      merged[merged.length - 1][1] = Math.max(merged[merged.length - 1][1], e);
    } else {
      merged.push([s, e]);
    }
  }

  const out: any[] = [];
  let cursor = 0;
  merged.forEach(([s, e], i) => {
    if (s > cursor) out.push(text.slice(cursor, s));
    out.push(
      <mark
        key={`m-${i}-${s}`}
        className="bg-[#01a451]/20 text-[#01a451] font-semibold rounded px-0.5"
      >
        {text.slice(s, e)}
      </mark>
    );
    cursor = e;
  });
  if (cursor < text.length) out.push(text.slice(cursor));
  return out;
}

export default function StockHistoryPage() {
  // Step 1: client picker
  const [clientPickerOpen, setClientPickerOpen] = useState(false);
  const [clientQuery, setClientQuery] = useState("");
  const [selectedClient, setSelectedClient] = useState<{
    id: number;
    companyName: string;
    excelClientId: number | null;
  } | null>(null);

  // Step 2: item search within selected client
  const [itemQuery, setItemQuery] = useState("");
  const [itemPickerOpen, setItemPickerOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<string | null>(null);

  // Search clients (debounced via the user's typing — useQuery fires on every keystroke,
  // but we cap results to 25 server-side, so it's cheap).
  const { data: clientResults = [], isLoading: clientsLoading } =
    trpc.stockHistory.searchClients.useQuery(
      { query: clientQuery, limit: 25 },
      { enabled: clientPickerOpen, staleTime: 5_000 }
    );

  // Items for the selected client (flexible substring filter via the search input).
  const { data: items = [], isLoading: itemsLoading } =
    trpc.stockHistory.itemsByClient.useQuery(
      { clientId: selectedClient?.id ?? 0, search: itemQuery },
      { enabled: !!selectedClient }
    );

  // Full purchase history for the chosen item.
  const { data: history = [], isLoading: historyLoading } =
    trpc.stockHistory.itemPurchases.useQuery(
      { clientId: selectedClient?.id ?? 0, itemName: selectedItem ?? "" },
      { enabled: !!selectedClient && !!selectedItem }
    );

  const clientStats = useMemo(() => {
    const totalSpent = items.reduce((s, it) => s + Number(it.totalSpent || 0), 0);
    const totalQty = items.reduce((s, it) => s + Number(it.totalQuantity || 0), 0);
    return { distinctItems: items.length, totalSpent, totalQty };
  }, [items]);

  return (
    <DashboardLayout>
      {/* Branded hero: 3·S Safe Simple Strong identity + cutting-tool lineup */}
      <div className="relative overflow-hidden rounded-2xl mb-6 vm-card-elevated">
        {/* Hero background — dark gradient with the tool lineup as a textured overlay */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `linear-gradient(115deg, rgba(15,23,18,0.96) 0%, rgba(15,23,18,0.82) 45%, rgba(1,164,81,0.55) 100%), url(${BRAND.toolLineup})`,
            backgroundSize: "cover",
            backgroundPosition: "center right",
          }}
          aria-hidden="true"
        />
        {/* Etched grid for industrial feel */}
        <div
          className="absolute inset-0 opacity-20 mix-blend-overlay pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(0deg, transparent 23px, rgba(255,255,255,0.08) 24px), linear-gradient(90deg, transparent 23px, rgba(255,255,255,0.08) 24px)",
            backgroundSize: "24px 24px",
          }}
          aria-hidden="true"
        />

        <div className="relative px-6 sm:px-10 py-8 sm:py-10 flex flex-col sm:flex-row items-start sm:items-center gap-6">
          <div className="flex-shrink-0 bg-white/95 rounded-xl p-3 shadow-lg">
            <img
              src={BRAND.logo}
              alt="3·S Safe Simple Strong"
              className="h-20 w-auto block"
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="inline-flex items-center gap-2 text-[10px] font-bold tracking-[0.25em] uppercase text-[#01a451] bg-[#01a451]/15 ring-1 ring-[#01a451]/30 rounded-full px-3 py-1">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#01a451] animate-pulse" />
              Stock History · Fact Sales
            </div>
            <h1 className="font-display text-3xl sm:text-4xl text-white mt-3 leading-tight">
              Every cut, every client —
              <span className="text-[#01a451]"> tracked.</span>
            </h1>
            <p className="text-white/70 mt-2 max-w-2xl text-sm sm:text-base">
              Search any client, drill into the exact tools they purchased, and pull the
              unit price straight from the workbook. Built for the workshop floor —
              <span className="text-white/90 font-medium"> Safe · Simple · Strong</span>.
            </p>
          </div>
          {selectedClient && (
            <div className="flex-shrink-0">
              <Button
                variant="outline"
                className="bg-white/10 border-white/30 text-white hover:bg-white/20 hover:text-white"
                onClick={() => {
                  setSelectedClient(null);
                  setSelectedItem(null);
                  setItemQuery("");
                }}
              >
                <ArrowLeft className="mr-2 h-4 w-4" /> Change client
              </Button>
            </div>
          )}
        </div>

        {/* Bottom edge: brand-green machined ribbon */}
        <div
          className="relative h-1.5"
          style={{
            backgroundImage:
              "repeating-linear-gradient(135deg, #01a451 0 8px, #2d3436 8px 12px)",
          }}
          aria-hidden="true"
        />
      </div>

      {/* Step 1 — pick a client */}
      {!selectedClient && (
        <Card className="vm-card-elevated vm-fade-in relative overflow-hidden">
          {/* Decorative cutter-head watermark in the top-right corner */}
          <img
            src={BRAND.cutterHead}
            alt=""
            aria-hidden="true"
            className="absolute -top-6 -right-6 w-40 h-40 object-contain opacity-[0.06] pointer-events-none select-none"
          />
          <CardHeader className="relative">
            <p className="vm-eyebrow">Step 1 of 3</p>
            <CardTitle className="font-display text-2xl flex items-center gap-2">
              <Building2 className="h-5 w-5 text-[#01a451]" />
              Find a client
            </CardTitle>
            <CardDescription>
              Type any part of the company name. Results update as you type.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Popover open={clientPickerOpen} onOpenChange={setClientPickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={clientPickerOpen}
                  className="w-full justify-between h-12 text-left font-normal"
                >
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <Search className="h-4 w-4" />
                    Search clients…
                  </span>
                  <ChevronsUpDown className="h-4 w-4 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="w-[--radix-popover-trigger-width] p-0"
                align="start"
              >
                <Command shouldFilter={false}>
                  <CommandInput
                    placeholder="Type a client name…"
                    value={clientQuery}
                    onValueChange={setClientQuery}
                  />
                  <CommandList>
                    {clientsLoading ? (
                      <div className="p-4 space-y-2">
                        <Skeleton className="h-8 w-full" />
                        <Skeleton className="h-8 w-full" />
                        <Skeleton className="h-8 w-full" />
                      </div>
                    ) : clientResults.length === 0 ? (
                      <CommandEmpty>No clients found.</CommandEmpty>
                    ) : (
                      <CommandGroup heading={`${clientResults.length} matches`}>
                        {clientResults.map((c) => (
                          <CommandItem
                            key={c.id}
                            value={String(c.id)}
                            onSelect={() => {
                              setSelectedClient({
                                id: c.id,
                                companyName: c.companyName,
                                excelClientId: c.excelClientId,
                              });
                              setClientPickerOpen(false);
                              setClientQuery("");
                            }}
                            className="flex items-center justify-between gap-3"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="font-medium truncate">
                                {highlight(c.companyName, clientQuery)}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                ID {c.id}
                                {c.excelClientId && c.excelClientId !== c.id
                                  ? ` · Excel ${c.excelClientId}`
                                  : ""}
                                {" · "}
                                {c.purchaseCount} purchase{c.purchaseCount === 1 ? "" : "s"}
                                {" · "}
                                {formatCurrency(Number(c.totalPurchased) || 0)}
                              </div>
                            </div>
                            {c.lastPurchaseDate && (
                              <span className="text-xs text-muted-foreground whitespace-nowrap">
                                last {fmtDate(c.lastPurchaseDate)}
                              </span>
                            )}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    )}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </CardContent>
        </Card>
      )}

      {/* Step 2 — items for the selected client + flexible item search */}
      {selectedClient && (
        <div className="space-y-6 vm-fade-in">
          <Card className="vm-card-elevated relative overflow-hidden">
            {/* Brand accent: vertical green machined stripe on the left edge */}
            <div
              className="absolute left-0 top-0 bottom-0 w-1.5"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(180deg, #01a451 0 6px, #2d3436 6px 9px)",
              }}
              aria-hidden="true"
            />
            {/* Decorative spiral bit watermark behind the stats */}
            <img
              src={BRAND.spiralBit}
              alt=""
              aria-hidden="true"
              className="absolute right-4 top-2 h-32 w-auto opacity-[0.07] pointer-events-none select-none"
            />
            <CardHeader className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 pl-6 relative">
              <div className="min-w-0">
                <p className="vm-eyebrow">Step 2 of 3 · Selected client</p>
                <CardTitle className="font-display text-3xl truncate">
                  {selectedClient.companyName}
                </CardTitle>
                <CardDescription>
                  Client ID {selectedClient.id}
                  {selectedClient.excelClientId &&
                    selectedClient.excelClientId !== selectedClient.id &&
                    ` · Excel ${selectedClient.excelClientId}`}
                </CardDescription>
              </div>
              <div className="grid grid-cols-3 gap-4 text-right">
                <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wider">
                    Items
                  </div>
                  <div className="font-display text-2xl text-[#2d3436]">
                    {clientStats.distinctItems}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wider">
                    Units
                  </div>
                  <div className="font-display text-2xl text-[#2d3436]">
                    {clientStats.totalQty.toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wider">
                    Spent
                  </div>
                  <div className="font-display text-2xl text-[#01a451] font-mono-num">
                    {formatCurrency(clientStats.totalSpent)}
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Flexible item search — Combobox-style with substring matching */}
              <div>
                <label className="block text-sm font-medium mb-2 text-[#2d3436]">
                  Search items{" "}
                  <span className="text-muted-foreground font-normal">
                    (universal — matches item ID, name & description; multi-word
                    narrows results, e.g. "mar 3072 ATB")
                  </span>
                </label>
                <Popover open={itemPickerOpen} onOpenChange={setItemPickerOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={itemPickerOpen}
                      className="w-full justify-between h-12 text-left font-normal"
                    >
                      <span className="flex items-center gap-2 truncate">
                        {selectedItem ? (
                          <>
                            <Package className="h-4 w-4 text-[#01a451] flex-shrink-0" />
                            <span className="truncate">{selectedItem}</span>
                          </>
                        ) : (
                          <>
                            <Search className="h-4 w-4 text-muted-foreground" />
                            <span className="text-muted-foreground">
                              Type any part of an item name…
                            </span>
                          </>
                        )}
                      </span>
                      <ChevronsUpDown className="h-4 w-4 opacity-50 flex-shrink-0" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-[--radix-popover-trigger-width] p-0"
                    align="start"
                  >
                    <Command shouldFilter={false}>
                      <CommandInput
                        placeholder="Search items…"
                        value={itemQuery}
                        onValueChange={setItemQuery}
                      />
                      <CommandList>
                        {itemsLoading ? (
                          <div className="p-4 space-y-2">
                            <Skeleton className="h-8 w-full" />
                            <Skeleton className="h-8 w-full" />
                          </div>
                        ) : items.length === 0 ? (
                          <CommandEmpty>
                            {itemQuery
                              ? `No items matching "${itemQuery}"`
                              : "This client has no purchase history."}
                          </CommandEmpty>
                        ) : (
                          <CommandGroup heading={`${items.length} matching items`}>
                            {items.map((it) => (
                              <CommandItem
                                key={it.itemName}
                                value={it.itemName}
                                onSelect={() => {
                                  setSelectedItem(it.itemName);
                                  setItemPickerOpen(false);
                                }}
                                className="flex items-start justify-between gap-3 py-2"
                              >
                                <div className="min-w-0 flex-1">
                                  <div className="font-medium truncate flex items-center gap-2">
                                    {selectedItem === it.itemName && (
                                      <Check className="h-4 w-4 text-[#01a451] flex-shrink-0" />
                                    )}
                                    <span className="truncate">
                                      {highlight(it.toolName || it.itemName, itemQuery)}
                                    </span>
                                    {it.factItemId && (
                                      <Badge
                                        variant="outline"
                                        className="text-[10px] font-mono-num py-0 h-4 flex-shrink-0 border-[#01a451]/40 text-[#01a451]"
                                        title="Fact Sales Item_ID (column H)"
                                      >
                                        {highlight(it.factItemId, itemQuery)}
                                      </Badge>
                                    )}
                                  </div>
                                  {it.toolName && it.toolName !== it.itemName && (
                                    <div className="text-xs text-muted-foreground truncate">
                                      code: {highlight(it.itemName, itemQuery)}
                                    </div>
                                  )}
                                  {it.toolDescription && (
                                    <div className="text-xs text-muted-foreground truncate">
                                      {highlight(it.toolDescription, itemQuery)}
                                    </div>
                                  )}
                                  <div className="text-xs text-muted-foreground mt-0.5">
                                    {it.purchaseCount} purchase
                                    {it.purchaseCount === 1 ? "" : "s"} ·{" "}
                                    {Number(it.totalQuantity).toLocaleString()} units · last{" "}
                                    {fmtDate(it.lastPurchaseDate)}
                                  </div>
                                </div>
                                <span className="text-sm font-mono-num text-[#01a451] whitespace-nowrap pt-1">
                                  {formatCurrency(Number(it.lastUnitPrice) || 0, true)}
                                </span>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        )}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            </CardContent>
          </Card>

          {/* Items table for the client */}
          <Card className="vm-card-elevated relative overflow-hidden">
            {/* Brand top stripe */}
            <div
              className="absolute top-0 left-0 right-0 h-1"
              style={{
                backgroundImage:
                  "linear-gradient(90deg, #01a451 0%, #2d3436 60%, #01a451 100%)",
              }}
              aria-hidden="true"
            />
            {/* Faint cutter-head watermark on the right */}
            <img
              src={BRAND.cutterHead}
              alt=""
              aria-hidden="true"
              className="absolute -right-8 top-8 w-48 h-48 object-contain opacity-[0.05] pointer-events-none select-none"
            />
            <CardHeader className="relative">
              <CardTitle className="font-display text-2xl flex items-center gap-2 flex-wrap">
                <Package className="h-5 w-5 text-[#01a451]" />
                All items purchased
                <span className="inline-flex items-center gap-1 text-[10px] font-bold tracking-[0.2em] uppercase text-[#01a451] bg-[#01a451]/10 ring-1 ring-[#01a451]/20 rounded-full px-2 py-0.5">
                  3·S
                </span>
                {itemQuery && (
                  <Badge variant="secondary" className="ml-2 font-normal">
                    filtered: "{itemQuery}"
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                Click any row to drill into its full purchase history. Unit price is
                computed from the Fact Sales sheet (amount ÷ quantity).
              </CardDescription>
            </CardHeader>
            <CardContent>
              {itemsLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : items.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  {itemQuery
                    ? `No items matching "${itemQuery}".`
                    : "This client has no purchase history."}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[180px]">Item ID</TableHead>
                        <TableHead>Item</TableHead>
                        <TableHead className="text-right">Purchases</TableHead>
                        <TableHead className="text-right">Total qty</TableHead>
                        <TableHead className="text-right">Last unit price</TableHead>
                        <TableHead className="text-right">Avg unit price</TableHead>
                        <TableHead className="text-right">Total spent</TableHead>
                        <TableHead className="text-right">Last purchase</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((it) => (
                        <TableRow
                          key={it.itemName}
                          className={cn(
                            "cursor-pointer transition-colors",
                            selectedItem === it.itemName && "bg-[#01a451]/5"
                          )}
                          onClick={() => setSelectedItem(it.itemName)}
                        >
                          <TableCell className="font-mono-num text-xs">
                            {it.factItemId ? (
                              <span
                                className="inline-block max-w-[170px] truncate align-middle text-[#01a451] font-medium"
                                title={it.factItemId}
                              >
                                {highlight(it.factItemId, itemQuery)}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="font-medium max-w-[460px]">
                            <div className="truncate">
                              {highlight(it.toolName || it.itemName, itemQuery)}
                            </div>
                            {it.toolName && it.toolName !== it.itemName && (
                              <div className="text-xs text-muted-foreground truncate">
                                {highlight(it.itemName, itemQuery)}
                              </div>
                            )}
                            {it.toolDescription && (
                              <div className="text-xs text-muted-foreground truncate">
                                {highlight(it.toolDescription, itemQuery)}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-mono-num">
                            {it.purchaseCount}
                          </TableCell>
                          <TableCell className="text-right font-mono-num">
                            {Number(it.totalQuantity).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right font-mono-num font-semibold text-[#01a451]">
                            {formatCurrency(Number(it.lastUnitPrice) || 0, true)}
                          </TableCell>
                          <TableCell className="text-right font-mono-num text-muted-foreground">
                            {formatCurrency(Number(it.avgUnitPrice) || 0, true)}
                          </TableCell>
                          <TableCell className="text-right font-mono-num">
                            {formatCurrency(Number(it.totalSpent) || 0)}
                          </TableCell>
                          <TableCell className="text-right text-sm text-muted-foreground whitespace-nowrap">
                            {fmtDate(it.lastPurchaseDate)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Step 3 — drilldown: per-item purchase history */}
          {selectedItem && (
            <Card className="vm-card-elevated vm-fade-in border-[#01a451]/30 relative overflow-hidden">
              {/* Router bit watermark, mirrored to the left */}
              <img
                src={BRAND.routerBit}
                alt=""
                aria-hidden="true"
                className="absolute -left-6 -bottom-8 h-44 w-auto opacity-[0.06] -rotate-12 pointer-events-none select-none"
              />
              <CardHeader className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 relative">
                <div className="min-w-0">
                  <p className="vm-eyebrow">Step 3 of 3 · Purchase history</p>
                  <CardTitle className="font-display text-2xl flex items-center gap-2">
                    <History className="h-5 w-5 text-[#01a451]" />
                    <span className="truncate">{selectedItem}</span>
                  </CardTitle>
                  <CardDescription>
                    Every Fact Sales row for {selectedClient.companyName} buying this item.
                  </CardDescription>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedItem(null)}
                >
                  Close
                </Button>
              </CardHeader>
              <CardContent>
                {historyLoading ? (
                  <Skeleton className="h-32 w-full" />
                ) : history.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No history found.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Invoice</TableHead>
                          <TableHead className="text-right">Qty</TableHead>
                          <TableHead className="text-right">Unit price</TableHead>
                          <TableHead className="text-right">Line total</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {history.map((row) => (
                          <TableRow key={row.id}>
                            <TableCell className="font-mono-num">
                              {fmtDate(row.transactionDate)}
                            </TableCell>
                            <TableCell>
                              {row.invoiceNumber ? (
                                <span className="inline-flex items-center gap-1 text-sm">
                                  <Receipt className="h-3.5 w-3.5 text-muted-foreground" />
                                  {row.invoiceNumber}
                                </span>
                              ) : (
                                <span className="text-muted-foreground text-sm">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right font-mono-num">
                              {row.quantity}
                            </TableCell>
                            <TableCell className="text-right font-mono-num font-semibold text-[#01a451]">
                              {formatCurrency(Number(row.unitPrice) || 0, true)}
                            </TableCell>
                            <TableCell className="text-right font-mono-num">
                              {formatCurrency(Number(row.amount) || 0)}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={row.status === "paid" ? "secondary" : "outline"}
                                className={cn(
                                  "capitalize",
                                  row.status === "paid" &&
                                    "bg-[#01a451]/10 text-[#01a451] border-[#01a451]/20"
                                )}
                              >
                                {row.status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </DashboardLayout>
  );
}
