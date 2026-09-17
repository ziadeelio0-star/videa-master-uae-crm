/**
 * Clients on a map.
 *
 * UAE-centered Google Map with a pin per client. Pins are colored by order
 * frequency: Green (2+ orders/month), Blue (1/month), Orange (1 per 2-4 months),
 * Grey (inactive). A side panel lists every client (searchable); clicking a
 * row pans/zooms the map to that client, opens its info window, and
 * visually highlights the selected marker (larger, white ring, bounce).
 */

/// <reference types="@types/google.maps" />

import DashboardLayout from "@/components/DashboardLayout";
import { MapView } from "@/components/Map";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { ExternalLink, MapPinOff, Search, Sparkles } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

// UAE-centric default view. fitBounds will refine this once markers are placed.
const UAE_CENTER: google.maps.LatLngLiteral = { lat: 24.35, lng: 54.5 };
const UAE_ZOOM = 7;

type OrderFrequencyTier = "green" | "blue" | "orange" | "grey";

const TIER: Record<
  OrderFrequencyTier,
  { bg: string; border: string; label: string; caption: string }
> = {
  green: {
    bg: "#16a34a",
    border: "#052e16",
    label: "Green",
    caption: "2+ orders per month",
  },
  blue: {
    bg: "#2563eb",
    border: "#0c1e4a",
    label: "Blue",
    caption: "1 order per month",
  },
  orange: {
    bg: "#f59e0b",
    border: "#4a2d05",
    label: "Orange",
    caption: "1 order per 2–4 months",
  },
  grey: {
    bg: "#6b7280",
    border: "#1f2937",
    label: "Grey",
    caption: "Inactive (no orders in 6+ months)",
  },
};

type ClientRow = {
  id: number;
  companyName: string;
  address: string | null;
  industry: string | null;
  activityLevel: string;
  phone: string | null;
  email: string | null;
  latitude: number | null;
  longitude: number | null;
  geocodeSource: "google" | "manual" | "research" | null;
  geocodedAt: Date | null;
  totalRevenue: number;
  transactionCount: number;
  lastTransactionAt: Date | string | null;
  ordersLast30Days: number;
  ordersLast60Days: number;
  ordersLast90Days: number;
  ordersLast180Days: number;
};

function tierFor(c: ClientRow): OrderFrequencyTier {
  // Green: 2+ orders in last 30 days (2+ per month)
  if (c.ordersLast30Days >= 2) return "green";
  // Blue: 1 order in last 30 days (1 per month)
  if (c.ordersLast30Days === 1) return "blue";
  // Orange: 1+ orders in last 60–90 days (1 per 2–4 months)
  if (c.ordersLast90Days >= 1) return "orange";
  // Grey: no orders in 6+ months
  return "grey";
}

function buildPin(
  tier: OrderFrequencyTier,
  opts: { selected?: boolean } = {}
): HTMLElement {
  const t = TIER[tier];
  const size = opts.selected ? 32 : 20;
  const ring = opts.selected ? "3px solid #ffffff" : "2px solid " + t.border;
  const wrapper = document.createElement("div");
  wrapper.style.cssText = `
    position: relative;
    width: ${size}px;
    height: ${size}px;
    cursor: pointer;
  `;
  const pin = document.createElement("div");
  pin.style.cssText = `
    position: absolute;
    inset: 0;
    background: ${t.bg};
    border: ${ring};
    border-radius: 50% 50% 50% 0;
    transform: rotate(-45deg);
    box-shadow: 0 ${opts.selected ? 6 : 2}px ${opts.selected ? 14 : 6}px rgba(0,0,0,0.35);
    ${opts.selected ? "outline: 3px solid " + t.bg + "55;" : ""}
  `;
  wrapper.appendChild(pin);
  if (opts.selected) {
    wrapper.animate(
      [
        { transform: "translateY(0)" },
        { transform: "translateY(-6px)" },
        { transform: "translateY(0)" },
      ],
      { duration: 900, iterations: 2, easing: "ease-out" }
    );
  }
  return wrapper;
}

function formatCoords(lat: number, lng: number) {
  return `${lat.toFixed(4)}°, ${lng.toFixed(4)}°`;
}

function formatAED(n: number): string {
  return new Intl.NumberFormat("en-AE", {
    style: "currency",
    currency: "AED",
    maximumFractionDigits: 0,
  }).format(n);
}

export default function MapPage() {
  const [, setLocation] = useLocation();
  const { data: rows, isLoading, refetch } = trpc.clients.withCoords.useQuery();
  const geocodeMissing = trpc.clients.geocodeMissing.useMutation({
    onSuccess: (res) => {
      toast.success(
        `Geocoded ${res.resolved} of ${res.attempted} clients${
          res.unresolved.length ? ` · ${res.unresolved.length} need manual review` : ""
        }`
      );
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);

  // `mapReady` is the crucial fix — it's a React state that flips once the
  // Google Map has been constructed. The marker effect depends on it so
  // markers are actually created on first load.
  const [mapReady, setMapReady] = useState(false);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<Map<number, google.maps.marker.AdvancedMarkerElement>>(new Map());
  const infoRef = useRef<google.maps.InfoWindow | null>(null);
  const hasFitRef = useRef(false);

  const clients: ClientRow[] = (rows as ClientRow[] | undefined) ?? [];
  const withCoords = useMemo(
    () => clients.filter((c) => c.latitude != null && c.longitude != null),
    [clients]
  );
  const missing = clients.length - withCoords.length;
  const now = useMemo(() => Date.now(), []);
  const tiered = useMemo(
    () => withCoords.map((c) => ({ ...c, tier: tierFor(c) })),
    [withCoords]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tiered;
    return tiered.filter(
      (c) =>
        c.companyName.toLowerCase().includes(q) ||
        (c.address ?? "").toLowerCase().includes(q) ||
        (c.industry ?? "").toLowerCase().includes(q)
    );
  }, [tiered, search]);

  const tierCounts = useMemo(() => {
    const counts: Record<OrderFrequencyTier, number> = {
      green: 0,
      blue: 0,
      orange: 0,
      grey: 0,
    };
    for (const c of tiered) counts[c.tier] += 1;
    return counts;
  }, [tiered]);

  // Build / refresh markers whenever data or the map becomes ready.
  useEffect(() => {
    if (!mapReady || !mapRef.current || !window.google) return;
    const map = mapRef.current;

    // Clear stale markers
    markersRef.current.forEach((m) => (m.map = null));
    markersRef.current.clear();

    const info = infoRef.current ?? new window.google.maps.InfoWindow();
    infoRef.current = info;

    const bounds = new window.google.maps.LatLngBounds();

    for (const c of tiered) {
      const marker = new window.google.maps.marker.AdvancedMarkerElement({
        map,
        position: { lat: c.latitude!, lng: c.longitude! },
        title: c.companyName,
        content: buildPin(c.tier, { selected: c.id === selectedId }),
      });
      marker.addListener("gmp-click", () => {
        setSelectedId(c.id);
        info.setContent(renderInfoHTML(c));
        info.open({ map, anchor: marker });
      });
      markersRef.current.set(c.id, marker);
      bounds.extend({ lat: c.latitude!, lng: c.longitude! });
    }

    // Auto-fit the viewport once so every pin is visible on first load.
    if (!hasFitRef.current && tiered.length > 0) {
      map.fitBounds(bounds, 56);
      const z = map.getZoom();
      if (z != null && z > 10) map.setZoom(10);
      hasFitRef.current = true;
    }
    // `selectedId` included so the highlighted pin is rebuilt with the
    // "selected" content when selection changes.
  }, [mapReady, tiered, selectedId]);

  // When the side list selection changes: pan/zoom and open info window.
  useEffect(() => {
    if (!mapReady || selectedId == null || !mapRef.current || !window.google) return;
    const client = tiered.find((c) => c.id === selectedId);
    const marker = markersRef.current.get(selectedId);
    if (!client || !marker) return;
    mapRef.current.panTo({ lat: client.latitude!, lng: client.longitude! });
    mapRef.current.setZoom(Math.max(mapRef.current.getZoom() ?? 7, 12));
    const info = infoRef.current ?? new window.google.maps.InfoWindow();
    infoRef.current = info;
    info.setContent(renderInfoHTML(client));
    info.open({ map: mapRef.current, anchor: marker });
  }, [selectedId, mapReady, tiered]);

  return (
    <DashboardLayout>
      <div className="container space-y-6 py-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Geography
            </p>
            <h1 className="font-serif text-3xl tracking-tight">Client map</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Every client geolocated on a UAE-centered map. Pins are colored by performance
              tier (lifetime paid revenue and recency). Click a pin — or a row in the side
              list — to highlight that client's exact location.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {missing > 0 && (
              <Button
                variant="outline"
                onClick={() => geocodeMissing.mutate(undefined)}
                disabled={geocodeMissing.isPending}
              >
                <Sparkles className="mr-2 h-4 w-4" />
                {geocodeMissing.isPending
                  ? "Locating…"
                  : `Locate ${missing} missing client${missing === 1 ? "" : "s"}`}
              </Button>
            )}
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
          <Card className="overflow-hidden">
            <CardContent className="p-0">
              <MapView
                className="h-[620px] w-full"
                initialCenter={UAE_CENTER}
                initialZoom={UAE_ZOOM}
                onMapReady={(map) => {
                  mapRef.current = map;
                  setMapReady(true);
                }}
              />
              <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-muted/30 px-4 py-3 text-xs">
                <div className="flex flex-wrap items-center gap-3">
                  {(Object.keys(TIER) as OrderFrequencyTier[]).map((key) => (
                    <span
                      key={key}
                      className="flex items-center gap-1.5"
                      title={TIER[key].caption}
                    >
                      <span
                        className="inline-block h-3 w-3 rounded-full border"
                        style={{ background: TIER[key].bg, borderColor: TIER[key].border }}
                      />
                      {TIER[key].label}
                      <span className="font-mono text-muted-foreground">
                        ({tierCounts[key]})
                      </span>
                    </span>
                  ))}
                </div>
                <span className="text-muted-foreground">
                  {tiered.length} pinned · {missing} unpinned
                </span>
              </div>
            </CardContent>
          </Card>

          <Card className="flex h-[680px] flex-col">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Clients on the map</CardTitle>
              <div className="relative mt-2">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search name, address, industry…"
                  className="pl-9"
                />
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto pt-0">
              {isLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <Skeleton key={i} className="h-14 w-full" />
                  ))}
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-12 text-center text-sm text-muted-foreground">
                  <MapPinOff className="h-8 w-8 opacity-60" />
                  No clients match your search.
                </div>
              ) : (
                <ul className="space-y-1">
                  {filtered.map((c) => {
                    const t = TIER[c.tier];
                    return (
                      <li key={c.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedId(c.id)}
                          className={cn(
                            "w-full rounded-md border px-3 py-2 text-left transition",
                            selectedId === c.id
                              ? "border-primary bg-primary/5"
                              : "border-transparent hover:border-border hover:bg-muted/40"
                          )}
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                              style={{ background: t.bg }}
                            />
                            <span className="truncate font-medium">{c.companyName}</span>
                            <Badge
                              variant="outline"
                              className="ml-auto shrink-0 text-[10px]"
                              style={{ borderColor: t.bg, color: t.bg }}
                            >
                              {t.label}
                            </Badge>
                          </div>
                          <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                            {c.address ?? formatCoords(c.latitude!, c.longitude!)}
                          </p>
                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            {formatAED(c.totalRevenue)} · {c.transactionCount} tx
                          </p>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
              {missing > 0 && (
                <p className="mt-3 rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
                  {missing} client{missing === 1 ? " is" : "s are"} not on the map yet — click{" "}
                  <b>Locate missing clients</b> above to resolve them.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {selectedId != null &&
          (() => {
            const c = tiered.find((x) => x.id === selectedId);
            if (!c) return null;
            const t = TIER[c.tier];
            return (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center justify-between text-base">
                    <span className="flex items-center gap-2">
                      <span
                        className="inline-block h-3 w-3 rounded-full"
                        style={{ background: t.bg }}
                      />
                      {c.companyName}
                      <Badge
                        variant="outline"
                        className="text-[10px]"
                        style={{ borderColor: t.bg, color: t.bg }}
                      >
                        {t.label}
                      </Badge>
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setLocation(`/clients/${c.id}`)}
                    >
                      Open profile <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-2 text-sm md:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <p className="text-xs uppercase text-muted-foreground">Address</p>
                    <p>{c.address ?? "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-muted-foreground">Coordinates</p>
                    <p className="font-mono text-xs">{formatCoords(c.latitude!, c.longitude!)}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-muted-foreground">Paid revenue</p>
                    <p>{formatAED(c.totalRevenue)}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-muted-foreground">Last transaction</p>
                    <p>
                      {c.lastTransactionAt
                        ? new Date(c.lastTransactionAt).toLocaleDateString()
                        : "—"}
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })()}
      </div>
    </DashboardLayout>
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderInfoHTML(c: ClientRow & { tier: OrderFrequencyTier }): string {
  const t = TIER[c.tier];
  return `
    <div style="font-family: inherit; max-width: 260px;">
      <div style="font-weight: 600; font-size: 14px; margin-bottom: 4px;">
        ${escapeHtml(c.companyName)}
      </div>
      <div style="font-size: 12px; color: #4b5563; margin-bottom: 6px;">
        ${escapeHtml(c.address ?? "")}
      </div>
      <div style="display: flex; gap: 6px; font-size: 11px; color: #4b5563; margin-bottom: 6px;">
        <span style="padding: 2px 8px; border-radius: 9999px; background: ${t.bg}22; color: ${t.bg}; font-weight: 600;">
          ${t.label}
        </span>
        <span style="padding: 2px 6px;">
          ${formatAED(c.totalRevenue)} · ${c.transactionCount} tx
        </span>
      </div>
      <a href="/clients/${c.id}" style="font-size: 12px; color: #2563eb; text-decoration: underline;">
        Open profile →
      </a>
    </div>
  `;
}
