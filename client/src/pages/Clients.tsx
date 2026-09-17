import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { initials } from "@/lib/format";
import { Plus, Search, Mail, MapPin, Phone, Wallet, Users, Activity, AlertCircle } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { useState, useEffect, useMemo } from "react";
import { Link } from "wouter";
import { ClientFormDialog } from "@/components/ClientFormDialog";
import SectionHeader from "@/components/SectionHeader";
import SmartKpiGrid from "@/components/SmartKpiGrid";

function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

const LEVEL_TINT: Record<string, string> = {
  high: "bg-primary/10 text-primary border-primary/20",
  medium: "bg-sky-100 text-sky-800 border-sky-200",
  low: "bg-amber-100 text-amber-800 border-amber-200",
  inactive: "bg-muted text-muted-foreground border-border",
};

export default function Clients() {
  const [search, setSearch] = useState("");
  const [industry, setIndustry] = useState<string>("all");
  const [activity, setActivity] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);

  const debouncedSearch = useDebounced(search, 250);

  const list = trpc.clients.list.useQuery({
    search: debouncedSearch.trim() || undefined,
    industry: industry === "all" ? undefined : industry,
    activityLevel: activity === "all" ? undefined : activity,
  });
  const industries = trpc.clients.industries.useQuery();

  // Manager.io totals per client — one round-trip, then we render outstanding
  // balances as inline chips on each card. We never fail the page if the tunnel
  // is offline; we just hide the chips.
  const totals = trpc.financial.allClientTotals.useQuery(undefined, {
    refetchOnWindowFocus: false,
    retry: 0,
  });
  const totalsById = new Map(
    (totals.data?.totals ?? []).map((t) => [t.clientId, t])
  );

  return (
    <DashboardLayout>
      <div className="container py-8 space-y-8">
        <SectionHeader
          eyebrow="Client Portfolio"
          title="Clients"
          description={`Complete directory of factories and partners served by Videa Master Pro. ${list.data?.length ?? 0} ${(list.data?.length ?? 0) === 1 ? "client" : "clients"} on file.`}
          actions={
            <Button onClick={() => setDialogOpen(true)} size="lg" className="shrink-0">
              <Plus className="h-4 w-4" />
              Add client
            </Button>
          }
        />

        {/* Quick Stats */}
        {list.data && (
          <SmartKpiGrid
            cards={[
              {
                label: "Total Clients",
                value: String(list.data.length),
                sublabel: "Active and inactive",
                variant: "outline",
                icon: <Users className="w-4 h-4 text-primary" />,
              },
              {
                label: "With Outstanding",
                value: String((totals.data?.totals ?? []).filter((t) => t.outstanding > 0.5).length),
                sublabel: "Pending balances",
                variant: "outline",
                icon: <Wallet className="w-4 h-4 text-primary" />,
              },
              {
                label: "Active",
                value: String(list.data.filter((c) => c.activityLevel === "high" || c.activityLevel === "medium").length),
                sublabel: "Frequent buyers",
                variant: "outline",
                icon: <Activity className="w-4 h-4 text-primary" />,
              },
              {
                label: "Industries",
                value: String((industries.data ?? []).length),
                sublabel: "Sectors served",
                variant: "outline",
                icon: <AlertCircle className="w-4 h-4 text-primary" />,
              },
            ]}
          />
        )}

        {/* Filters */}
        <Card>
          <CardContent className="p-4 flex flex-col md:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, contact, email…"
                className="pl-9 h-10"
              />
            </div>
            <Select value={industry} onValueChange={setIndustry}>
              <SelectTrigger className="w-full md:w-[200px] h-10">
                <SelectValue placeholder="Industry" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All industries</SelectItem>
                {(industries.data ?? []).map((i) => (
                  <SelectItem key={i} value={i}>
                    {i}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={activity} onValueChange={setActivity}>
              <SelectTrigger className="w-full md:w-[180px] h-10">
                <SelectValue placeholder="Activity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All activity</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {list.isLoading ? (
            Array.from({ length: 9 }).map((_, i) => (
              <Skeleton key={i} className="h-[180px] rounded-xl" />
            ))
          ) : (list.data ?? []).length === 0 ? (
            <div className="md:col-span-2 lg:col-span-3">
              <Card>
                <CardContent className="py-16 text-center text-muted-foreground">
                  No clients match your filters.
                </CardContent>
              </Card>
            </div>
          ) : (
            (list.data ?? []).map((c) => (
              <Link key={c.id} href={`/clients/${c.id}`}>
                <Card className="group hover:border-primary/40 transition-colors h-full cursor-pointer">
                  <CardContent className="p-5 flex flex-col gap-4 h-full">
                    <div className="flex items-start gap-4">
                      <div className="h-12 w-12 rounded-lg bg-primary/10 border border-primary/15 text-primary flex items-center justify-center font-display text-base shrink-0">
                        {initials(c.companyName)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-display text-base leading-tight line-clamp-2 group-hover:text-primary transition-colors">
                          {c.companyName}
                        </p>
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <span
                            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] tracking-wider uppercase ${
                              LEVEL_TINT[c.activityLevel] ?? LEVEL_TINT.medium
                            }`}
                          >
                            {c.activityLevel}
                          </span>
                          {c.industry && (
                            <span className="text-[10px] tracking-wider uppercase text-muted-foreground">
                              {c.industry}
                            </span>
                          )}
                          {(() => {
                            const t = totalsById.get(c.id);
                            if (!t) return null;
                            if (t.outstanding > 0.5) {
                              return (
                                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 text-[10px] tracking-wider uppercase font-mono-num">
                                  <Wallet className="h-2.5 w-2.5" /> Due {formatCurrency(t.outstanding)}
                                </span>
                              );
                            }
                            if (t.invoiceCount > 0) {
                              return (
                                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 text-[10px] tracking-wider uppercase font-mono-num">
                                  Settled
                                </span>
                              );
                            }
                            return null;
                          })()}
                        </div>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground space-y-1 mt-auto">
                      {c.contactPerson && (
                        <div className="flex items-center gap-2">
                          <span className="text-foreground font-medium">
                            {c.contactPerson}
                          </span>
                        </div>
                      )}
                      {c.email && (
                        <div className="flex items-center gap-2 truncate">
                          <Mail className="h-3 w-3 shrink-0" />
                          <span className="truncate">{c.email}</span>
                        </div>
                      )}
                      {c.phone && (
                        <div className="flex items-center gap-2">
                          <Phone className="h-3 w-3 shrink-0" />
                          <span>{c.phone}</span>
                        </div>
                      )}
                      {c.address && (
                        <div className="flex items-start gap-2">
                          <MapPin className="h-3 w-3 mt-0.5 shrink-0" />
                          <span className="line-clamp-2">{c.address}</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))
          )}
        </div>
      </div>

      <ClientFormDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </DashboardLayout>
  );
}
