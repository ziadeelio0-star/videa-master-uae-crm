import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { formatCurrency, formatMonth } from "@/lib/format";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Link } from "wouter";
import SectionHeader from "@/components/SectionHeader";

const PIE_COLORS = [
  "var(--primary)",
  "var(--chart-3)",
  "var(--chart-5)",
  "var(--chart-4)",
  "var(--chart-2)",
];

export default function Analytics() {
  const monthly = trpc.analytics.monthlyRevenue.useQuery({ monthsBack: 12 });
  const top = trpc.analytics.topClients.useQuery({ limit: 10 });
  const kpis = trpc.analytics.kpis.useQuery();

  const pivot = (() => {
    const map = new Map<
      string,
      { month: string; purchase: number; sharpening: number; total: number }
    >();
    (monthly.data ?? []).forEach((r) => {
      const existing =
        map.get(r.month) ?? { month: r.month, purchase: 0, sharpening: 0, total: 0 };
      if (r.type === "purchase") existing.purchase += r.total;
      else existing.sharpening += r.total;
      existing.total = existing.purchase + existing.sharpening;
      map.set(r.month, existing);
    });
    return Array.from(map.values()).sort((a, b) => a.month.localeCompare(b.month));
  })();

  // Revenue mix
  const totalPurchase = pivot.reduce((s, p) => s + p.purchase, 0);
  const totalSharpening = pivot.reduce((s, p) => s + p.sharpening, 0);
  const mix = [
    { name: "Tool purchases", value: totalPurchase },
    { name: "Sharpening services", value: totalSharpening },
  ];

  return (
    <DashboardLayout>
      <div className="container py-8 space-y-8">
        <SectionHeader
          eyebrow="Business Intelligence"
          title="Analytics"
          description="Deep view into revenue composition, monthly trends and client performance."
        />

        {/* KPI strip */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
          <Card>
            <CardContent className="p-5">
              <p className="text-[10px] tracking-[0.25em] uppercase text-muted-foreground">
                Lifetime revenue
              </p>
              <p className="mt-2 text-2xl font-display">
                {formatCurrency(kpis.data?.totalRevenue ?? 0)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-[10px] tracking-[0.25em] uppercase text-muted-foreground">
                Tool purchases
              </p>
              <p className="mt-2 text-2xl font-display">{formatCurrency(totalPurchase)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-[10px] tracking-[0.25em] uppercase text-muted-foreground">
                Sharpening services
              </p>
              <p className="mt-2 text-2xl font-display">{formatCurrency(totalSharpening)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-[10px] tracking-[0.25em] uppercase text-muted-foreground">
                Outstanding
              </p>
              <p className="mt-2 text-2xl font-display">
                {formatCurrency(kpis.data?.outstanding ?? 0)}
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Trend */}
          <Card className="xl:col-span-2">
            <CardHeader>
              <CardTitle className="font-display text-xl">Revenue trend</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Trailing 12 months, total revenue per month
              </p>
            </CardHeader>
            <CardContent>
              {monthly.isLoading ? (
                <Skeleton className="h-[320px]" />
              ) : (
                <div className="h-[320px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={pivot} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                      <XAxis
                        dataKey="month"
                        tickFormatter={(v) => formatMonth(v)}
                        tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : v.toString())}
                      />
                      <Tooltip
                        formatter={(val: number) => formatCurrency(val)}
                        labelFormatter={(v) => formatMonth(v as string, true)}
                        contentStyle={{
                          background: "var(--popover)",
                          border: "1px solid var(--border)",
                          borderRadius: "var(--radius-md)",
                          fontSize: 12,
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="total"
                        stroke="var(--primary)"
                        strokeWidth={2.5}
                        dot={{ r: 3, fill: "var(--primary)" }}
                        activeDot={{ r: 5 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Mix */}
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-xl">Revenue mix</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Purchases vs sharpening share
              </p>
            </CardHeader>
            <CardContent>
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={mix}
                      dataKey="value"
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={95}
                      paddingAngle={2}
                      stroke="var(--card)"
                    >
                      {mix.map((_, idx) => (
                        <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(val: number) => formatCurrency(val)}
                      contentStyle={{
                        background: "var(--popover)",
                        border: "1px solid var(--border)",
                        borderRadius: "var(--radius-md)",
                        fontSize: 12,
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2 mt-2">
                {mix.map((m, idx) => (
                  <div key={m.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ background: PIE_COLORS[idx] }}
                      />
                      <span>{m.name}</span>
                    </div>
                    <span className="font-mono-num">{formatCurrency(m.value)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Top clients full ranking */}
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-xl">Top 10 clients by revenue</CardTitle>
          </CardHeader>
          <CardContent>
            {top.isLoading ? (
              <Skeleton className="h-[320px]" />
            ) : (
              <div className="h-[380px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={(top.data ?? []).slice().reverse()}
                    layout="vertical"
                    margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
                    <XAxis
                      type="number"
                      tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : v.toString())}
                    />
                    <YAxis
                      type="category"
                      dataKey="clientName"
                      tick={{ fontSize: 11, fill: "var(--foreground)" }}
                      width={220}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      formatter={(val: number) => formatCurrency(val)}
                      contentStyle={{
                        background: "var(--popover)",
                        border: "1px solid var(--border)",
                        borderRadius: "var(--radius-md)",
                        fontSize: 12,
                      }}
                    />
                    <Bar dataKey="total" fill="var(--primary)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
