import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import {
  ArrowLeft,
  Plus,
  Mail,
  MapPin,
  Phone,
  Building,
  Pencil,
  Trash2,
  Wrench,
  Wallet,
  FileText,
  TrendingUp,
  ChevronDown,
  AlertCircle,
} from "lucide-react";
import { useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import { formatCurrency, formatDate, initials } from "@/lib/format";
import { StatusBadge } from "./Home";
import { ClientFormDialog } from "@/components/ClientFormDialog";
import { MachineFormDialog } from "@/components/MachineFormDialog";
import { TransactionFormDialog } from "@/components/TransactionFormDialog";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
  LineChart,
  Line,
} from "recharts";
import { toast } from "sonner";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

const LEVEL_TINT: Record<string, string> = {
  high: "bg-primary/10 text-primary border-primary/20",
  medium: "bg-sky-100 text-sky-800 border-sky-200",
  low: "bg-amber-100 text-amber-800 border-amber-200",
  inactive: "bg-muted text-muted-foreground border-border",
};

export default function ClientDetail() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const id = parseInt(params.id || "0", 10);

  const [editOpen, setEditOpen] = useState(false);
  const [machineOpen, setMachineOpen] = useState(false);
  const [txOpen, setTxOpen] = useState(false);

  const client = trpc.clients.get.useQuery({ id }, { enabled: id > 0 });
  const machines = trpc.machines.listByClient.useQuery({ clientId: id }, { enabled: id > 0 });
  const spending = trpc.clients.spending.useQuery({ clientId: id }, { enabled: id > 0 });
  const monthlyTrend = trpc.clients.monthlyTrend.useQuery({ clientId: id }, { enabled: id > 0 });
  const transactions = trpc.transactions.list.useQuery({ clientId: id }, { enabled: id > 0 });
  const soa = trpc.financial.clientStatement.useQuery(
    { clientId: id },
    { enabled: id > 0, staleTime: 60_000, refetchOnWindowFocus: false }
  );

  const utils = trpc.useUtils();
  const deleteMut = trpc.clients.delete.useMutation({
    onSuccess: () => {
      toast.success("Client deleted");
      utils.clients.list.invalidate();
      setLocation("/clients");
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMachineMut = trpc.machines.delete.useMutation({
    onSuccess: () => {
      toast.success("Machine deleted");
      utils.machines.listByClient.invalidate({ clientId: id });
    },
    onError: (e) => toast.error(e.message),
  });

  const c = client.data;
  if (!c) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </DashboardLayout>
    );
  }

  // Process monthly trend data
  const trendByMonth: Record<string, { purchase: number; sharpening: number }> = {};
  monthlyTrend.data?.forEach((item) => {
    if (!trendByMonth[item.month]) {
      trendByMonth[item.month] = { purchase: 0, sharpening: 0 };
    }
    trendByMonth[item.month][item.type as "purchase" | "sharpening"] = item.total;
  });

  const trendData = Object.entries(trendByMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, data]) => ({
      month,
      ...data,
    }));

  // Calculate totals
  const totalSpending = spending.data?.reduce((sum, item) => sum + item.total, 0) ?? 0;
  const toolsSpending = spending.data?.find((s) => s.type === "purchase")?.total ?? 0;
  const sharpeningSpending = spending.data?.find((s) => s.type === "sharpening")?.total ?? 0;
  const outstanding = soa.data?.outstanding ?? 0;

  return (
    <DashboardLayout>
      <div className="container py-10 space-y-10">
        {/* Header */}
        <Card>
          <CardContent className="p-8">
            <div className="flex items-start justify-between gap-6">
              <div className="flex-1 space-y-4">
                <Link href="/clients" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
                  <ArrowLeft className="h-4 w-4" /> All clients
                </Link>
                <div className="flex items-center gap-4">
                  <div
                    className={`h-16 w-16 rounded-xl flex items-center justify-center font-bold text-xl text-white ${
                      LEVEL_TINT[c.activityLevel]
                    }`}
                  >
                    {initials(c.companyName)}
                  </div>
                  <div className="space-y-2">
                    <h1 className="font-display text-3xl tracking-tight">{c.companyName}</h1>
                    <div className="flex items-center gap-3">
                      <span
                        className={`inline-block px-3 py-1 rounded-full text-xs font-semibold tracking-wider uppercase border ${
                          LEVEL_TINT[c.activityLevel]
                        }`}
                      >
                        {c.activityLevel}
                      </span>
                      {outstanding > 0 && (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700 border border-red-300">
                          <AlertCircle className="h-3 w-3" />
                          {formatCurrency(outstanding)} Outstanding
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm text-muted-foreground">
                  <span className="flex items-center gap-2 font-semibold text-foreground">
                    Client ID: {c.id}
                  </span>
                  {c.contactPerson && (
                    <span className="flex items-center gap-2">
                      <Building className="h-4 w-4" /> {c.contactPerson}
                    </span>
                  )}
                  {c.email && (
                    <span className="flex items-center gap-2">
                      <Mail className="h-4 w-4" /> {c.email}
                    </span>
                  )}
                  {c.phone && (
                    <span className="flex items-center gap-2">
                      <Phone className="h-4 w-4" /> {c.phone}
                    </span>
                  )}
                  {c.address && (
                    <span className="flex items-start gap-2 max-w-lg">
                      <MapPin className="h-4 w-4 mt-0.5 shrink-0" /> {c.address}
                    </span>
                  )}
                </div>
                {c.notes && (
                  <p className="text-xs text-muted-foreground border-l-2 border-primary/30 pl-3 italic">
                    {c.notes}
                  </p>
                )}
              </div>
              <div className="flex flex-row lg:flex-col gap-2 shrink-0">
                <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
                  <Pencil className="h-4 w-4" /> Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => {
                    if (confirm("Delete this client and all related transactions?")) {
                      deleteMut.mutate({ id: c.id });
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4" /> Delete
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 4 Sections */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Section 1: Monthly Spending */}
          <Card className="bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-200">
            <CardHeader>
              <CardTitle className="font-display text-lg flex items-center gap-2 text-emerald-900">
                <Wallet className="h-5 w-5 text-emerald-600" /> Monthly Spending
              </CardTitle>
              <p className="text-xs text-emerald-700 mt-1">Tools vs Sharpening breakdown</p>
            </CardHeader>
            <CardContent className="space-y-4">
              {spending.isLoading ? (
                <Skeleton className="h-32 w-full" />
              ) : spending.data && spending.data.length > 0 ? (
                <>
                  {spending.data.map((item) => (
                    <div
                      key={item.type}
                      className="p-4 bg-white rounded-lg border border-emerald-200 hover:shadow-md transition"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-emerald-900 capitalize">{item.type}</p>
                          <p className="text-xs text-emerald-600 mt-1">{item.invoiceCount} invoices</p>
                        </div>
                        <p className="font-display text-xl text-emerald-700">{formatCurrency(item.total)}</p>
                      </div>
                    </div>
                  ))}
                  <div className="p-4 bg-gradient-to-r from-emerald-100 to-teal-100 rounded-lg border border-emerald-300">
                    <div className="flex items-center justify-between">
                      <p className="font-bold text-emerald-900">Total Spending</p>
                      <p className="font-display text-2xl text-emerald-900">{formatCurrency(totalSpending)}</p>
                    </div>
                  </div>
                </>
              ) : (
                <div className="h-24 flex items-center justify-center text-sm text-emerald-600">
                  No transactions yet
                </div>
              )}
            </CardContent>
          </Card>

          {/* Section 2: Machines */}
          <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-200">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="font-display text-lg flex items-center gap-2 text-blue-900">
                  <Wrench className="h-5 w-5 text-blue-600" /> Machines
                </CardTitle>
                <p className="text-xs text-blue-700 mt-1">{machines.data?.length ?? 0} machines</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => setMachineOpen(true)} className="border-blue-300 hover:bg-blue-100">
                <Plus className="h-4 w-4" /> Add
              </Button>
            </CardHeader>
            <CardContent>
              {machines.isLoading ? (
                <Skeleton className="h-24 w-full" />
              ) : machines.data && machines.data.length > 0 ? (
                <div className="space-y-2 max-h-[250px] overflow-y-auto">
                  {machines.data.map((m) => (
                    <div key={m.id} className="p-3 bg-white rounded-lg border border-blue-200 flex items-start justify-between hover:shadow-md transition">
                      <div className="flex-1">
                        <p className="font-semibold text-blue-900 text-sm">{m.machineType}</p>
                        {m.brand && <p className="text-xs text-blue-700">{m.brand} {m.model}</p>}
                        {m.serialNumber && <p className="text-xs text-blue-600">SN: {m.serialNumber}</p>}
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-600 hover:text-red-700"
                        onClick={() => {
                          if (confirm("Delete this machine?")) {
                            deleteMachineMut.mutate({ id: m.id });
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-24 flex items-center justify-center text-sm text-blue-600">
                  No machines recorded yet
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Section 3: Statement of Account with Invoice Dropdown */}
        <Card className="bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200">
          <CardHeader>
            <CardTitle className="font-display text-lg flex items-center gap-2 text-purple-900">
              <FileText className="h-5 w-5 text-purple-600" /> Statement of Account
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {soa.isLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : (
              <>
                {/* KPI Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-6 bg-white rounded-lg border border-purple-200 hover:shadow-md transition">
                    <p className="text-xs tracking-wider uppercase text-purple-700 font-semibold">Total Billed</p>
                    <p className="text-2xl font-display mt-3 text-purple-900">{formatCurrency(totalSpending)}</p>
                    <p className="text-xs text-purple-600 mt-2">{soa.data?.invoiceCount ?? 0} invoices</p>
                  </div>
                  <div className="p-6 bg-white rounded-lg border border-purple-200 hover:shadow-md transition">
                    <p className="text-xs tracking-wider uppercase text-purple-700 font-semibold">Paid</p>
                    <p className="text-2xl font-display mt-3 text-purple-900">{formatCurrency(totalSpending - (typeof c.outstandingBalance === 'string' ? parseFloat(c.outstandingBalance) : (c.outstandingBalance ?? outstanding)))}</p>
                    <p className="text-xs text-purple-600 mt-2">Total Billed - Outstanding</p>
                  </div>
                  <div className={`p-6 rounded-lg border transition ${
                    outstanding > 0
                      ? "bg-gradient-to-br from-red-100 to-orange-100 border-red-300"
                      : "bg-gradient-to-br from-green-100 to-emerald-100 border-green-300"
                  }`}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className={`text-xs tracking-wider uppercase font-semibold ${
                          outstanding > 0 ? "text-red-700" : "text-green-700"
                        }`}>Outstanding</p>
                        <p className={`text-2xl font-display mt-3 ${
                          outstanding > 0 ? "text-red-900" : "text-green-900"
                        }`}>{formatCurrency(typeof c.outstandingBalance === 'string' ? parseFloat(c.outstandingBalance) : (c.outstandingBalance ?? outstanding))}</p>
                        <p className={`text-xs mt-2 ${
                          outstanding > 0 ? "text-red-700" : "text-green-700"
                        }`}>Balance due</p>
                        {c.oldestUnpaidDate && (
                          <p className={`text-xs mt-2 font-semibold ${
                            outstanding > 0 ? "text-red-600" : "text-green-600"
                          }`}>Since {formatDate(new Date(c.oldestUnpaidDate))}</p>
                        )}
                      </div>
                      {outstanding > 0 && (
                        <AlertCircle className="h-5 w-5 text-red-600" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Invoice Dropdown */}
                <Collapsible defaultOpen={false}>
                  <CollapsibleTrigger asChild>
                    <Button variant="outline" className="w-full justify-between border-purple-300 hover:bg-purple-50">
                      <span className="font-semibold text-purple-900">View All Invoices ({transactions.data?.length ?? 0})</span>
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-4 space-y-2 max-h-96 overflow-y-auto">
                    {transactions.isLoading ? (
                      <Skeleton className="h-32 w-full" />
                    ) : transactions.data && transactions.data.length > 0 ? (
                      transactions.data.map((tx) => (
                        <div key={tx.id} className="p-4 bg-white rounded-lg border border-purple-200 hover:shadow-md transition">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <p className="font-semibold text-purple-900 text-sm">Invoice #{tx.invoiceNumber}</p>
                              <p className="text-xs text-purple-600 mt-1">{formatDate(new Date(tx.transactionDate))}</p>
                            </div>
                            <div className="text-right">
                              <p className="font-display text-lg text-purple-900">{formatCurrency(typeof tx.amount === 'string' ? parseFloat(tx.amount) : tx.amount)}</p>
                              <span className={`inline-block text-xs font-semibold px-2 py-1 rounded mt-1 ${
                                tx.status === "paid" ? "bg-green-100 text-green-700" :
                                tx.status === "pending" ? "bg-yellow-100 text-yellow-700" :
                                "bg-red-100 text-red-700"
                              }`}>
                                {tx.status}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="h-20 flex items-center justify-center text-sm text-purple-600">
                        No invoices
                      </div>
                    )}
                  </CollapsibleContent>
                </Collapsible>
              </>
            )}
          </CardContent>
        </Card>

        {/* Section 4: Monthly Trend */}
        <Card className="bg-gradient-to-br from-indigo-50 to-blue-50 border-indigo-200">
          <CardHeader>
            <CardTitle className="font-display text-lg flex items-center gap-2 text-indigo-900">
              <TrendingUp className="h-5 w-5 text-indigo-600" /> Monthly Trend
            </CardTitle>
            <p className="text-xs text-indigo-700 mt-1">12-month revenue breakdown</p>
          </CardHeader>
          <CardContent>
            {monthlyTrend.isLoading ? (
              <Skeleton className="h-80 w-full" />
            ) : trendData.length > 0 ? (
              <div className="h-80 bg-white rounded-lg p-4 border border-indigo-200">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={trendData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                    <XAxis
                      dataKey="month"
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
                      contentStyle={{
                        background: "var(--popover)",
                        border: "1px solid var(--border)",
                        borderRadius: "var(--radius-md)",
                        fontSize: 12,
                      }}
                    />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                    <Bar
                      dataKey="purchase"
                      name="Tool purchases"
                      stackId="a"
                      fill="#4f46e5"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="sharpening"
                      name="Sharpening"
                      stackId="a"
                      fill="#a78bfa"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-80 flex items-center justify-center text-sm text-indigo-600">
                No trend data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Dialogs - commented out for now */}
      </div>
    </DashboardLayout>
  );
}
