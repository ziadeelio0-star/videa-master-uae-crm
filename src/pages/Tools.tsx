import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { formatCurrency } from "@/lib/format";
import { Boxes, Search } from "lucide-react";
import { useMemo, useState } from "react";
import SectionHeader from "@/components/SectionHeader";

function normalize(s: string | null | undefined) {
  return (s ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export default function Tools() {
  const [search, setSearch] = useState("");
  const tools = trpc.tools.listWithStats.useQuery({ search: search || undefined });
  const managerStatus = trpc.inventory.status.useQuery(undefined, { staleTime: 60_000 });
  const managerInventory = trpc.inventory.listItems.useQuery(
    { forceRefresh: false },
    { enabled: managerStatus.data?.reachable === true, staleTime: 60_000 }
  );

  // Build a name-normalized lookup of Manager.io stock items.
  const stockByName = useMemo(() => {
    const map = new Map<
      string,
      { key: string; code: string; name: string; qty: number; avgCost: number | null }
    >();
    for (const it of managerInventory.data?.items ?? []) {
      const key = normalize(it.itemName);
      if (!key) continue;
      map.set(key, {
        key: it.key,
        code: it.itemCode,
        name: it.itemName,
        qty: it.qtyOwned,
        avgCost: it.averageCost,
      });
    }
    return map;
  }, [managerInventory.data]);

  const matched = tools.data ?? [];

  return (
    <DashboardLayout>
      <div className="container py-8 space-y-8">
        <SectionHeader
          eyebrow="Product Catalog"
          title="Tools & Catalog"
          description="All cutting tools, sharpening services and consumables traded through Videa Master Pro. Sorted by revenue contribution and matched against live Manager.io stock."
          actions={
            managerStatus.data?.reachable ? (
              <Badge className="bg-primary/15 text-primary hover:bg-primary/15 gap-1.5">
                <Boxes className="h-3 w-3" />
                Manager.io linked
              </Badge>
            ) : undefined
          }
        />

        <Card>
          <CardContent className="p-4">
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search tools by name or SKU…"
                className="pl-9 h-10"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0 overflow-x-auto">
            {tools.isLoading ? (
              <div className="p-6 space-y-3">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-10" />
                ))}
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground border-y border-border bg-muted/40">
                  <tr>
                    <th className="text-left py-3 px-6 font-medium">Tool / Service</th>
                    <th className="text-left py-3 px-6 font-medium">Category</th>
                    <th className="text-right py-3 px-6 font-medium">Clients served</th>
                    <th className="text-right py-3 px-6 font-medium">Units sold</th>
                    <th className="text-right py-3 px-6 font-medium">Revenue</th>
                    <th className="text-right py-3 px-6 font-medium">Stock on hand</th>
                  </tr>
                </thead>
                <tbody>
                  {matched.map((t) => {
                    const stock = stockByName.get(normalize(t.name));
                    return (
                      <tr
                        key={t.id}
                        className="border-b border-border last:border-0 hover:bg-muted/30"
                      >
                        <td className="py-3 px-6">
                          <p className="font-medium">{t.name}</p>
                          {t.sku && (
                            <p className="text-[11px] text-muted-foreground font-mono-num">
                              {t.sku}
                            </p>
                          )}
                        </td>
                        <td className="py-3 px-6 text-muted-foreground">{t.category || "—"}</td>
                        <td className="py-3 px-6 text-right font-mono-num">{t.clientCount}</td>
                        <td className="py-3 px-6 text-right font-mono-num">{t.totalQty}</td>
                        <td className="py-3 px-6 text-right font-mono-num font-medium">
                          {formatCurrency(t.totalRevenue)}
                        </td>
                        <td className="py-3 px-6 text-right font-mono-num">
                          <StockCell stock={stock} loading={managerInventory.isLoading} />
                        </td>
                      </tr>
                    );
                  })}
                  {matched.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-14 text-center text-muted-foreground">
                        No tools found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

function StockCell({
  stock,
  loading,
}: {
  stock: { qty: number; avgCost: number | null } | undefined;
  loading: boolean;
}) {
  if (loading) return <span className="text-muted-foreground/50">…</span>;
  if (!stock) return <span className="text-muted-foreground/50">—</span>;
  if (stock.qty <= 0) {
    return <Badge variant="outline" className="text-destructive border-destructive/40">Out</Badge>;
  }
  if (stock.qty < 5) {
    return (
      <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">{stock.qty}</Badge>
    );
  }
  return <span>{stock.qty}</span>;
}
