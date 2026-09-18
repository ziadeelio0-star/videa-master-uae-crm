import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { formatCurrency, formatDate } from "@/lib/format";
import { Plus, Search, Wallet, Wrench } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";
import { StatusBadge } from "./Home";
import { TransactionFormDialog } from "@/components/TransactionFormDialog";
import SectionHeader from "@/components/SectionHeader";

export default function Transactions() {
  const [search, setSearch] = useState("");
  const [type, setType] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [open, setOpen] = useState(false);

  const txs = trpc.transactions.list.useQuery({
    search: search || undefined,
    type: type === "all" ? undefined : (type as "purchase" | "sharpening"),
    status: status === "all" ? undefined : (status as "paid" | "pending" | "overdue"),
  });

  const total = (txs.data ?? []).reduce((sum, t) => sum + Number(t.amount), 0);

  return (
    <DashboardLayout>
      <div className="container py-8 space-y-8">
        <SectionHeader
          eyebrow="Accounting Ledger"
          title="Transactions"
          description="Every invoice, sharpening order and line item across the business. Filter by type, status or search descriptions."
          actions={
            <Button onClick={() => setOpen(true)} size="lg" className="shrink-0">
              <Plus className="h-4 w-4" /> New transaction
            </Button>
          }
        />

        <Card>
          <CardContent className="p-4 flex flex-col md:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by description…"
                className="pl-9 h-10"
              />
            </div>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="w-full md:w-[180px] h-10">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="purchase">Tool purchases</SelectItem>
                <SelectItem value="sharpening">Sharpening</SelectItem>
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-full md:w-[180px] h-10">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {!txs.isLoading && (
          <div className="flex items-center gap-6 text-sm">
            <p className="text-muted-foreground">
              <span className="font-display text-foreground text-lg mr-2">
                {txs.data?.length ?? 0}
              </span>
              transactions
            </p>
            <p className="text-muted-foreground">
              Filtered total:{" "}
              <span className="font-display text-foreground text-lg font-mono-num ml-1">
                {formatCurrency(total)}
              </span>
            </p>
          </div>
        )}

        <Card>
          <CardContent className="p-0 overflow-x-auto">
            {txs.isLoading ? (
              <div className="p-6 space-y-3">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-10" />
                ))}
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground border-y border-border bg-muted/40">
                  <tr>
                    <th className="text-left py-3 px-6 font-medium">Date</th>
                    <th className="text-left py-3 px-6 font-medium">Client</th>
                    <th className="text-left py-3 px-6 font-medium">Description</th>
                    <th className="text-left py-3 px-6 font-medium">Type</th>
                    <th className="text-right py-3 px-6 font-medium">Qty</th>
                    <th className="text-right py-3 px-6 font-medium">Amount</th>
                    <th className="text-left py-3 px-6 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(txs.data ?? []).map((tx) => (
                    <tr key={tx.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                      <td className="py-3 px-6 text-muted-foreground font-mono-num text-xs">
                        {formatDate(tx.transactionDate)}
                      </td>
                      <td className="py-3 px-6">
                        <Link
                          href={`/clients/${tx.clientId}`}
                          className="hover:text-primary hover:underline"
                        >
                          {tx.clientName}
                        </Link>
                      </td>
                      <td className="py-3 px-6 max-w-[360px]">
                        <p className="truncate">{tx.description}</p>
                        {tx.notes && (
                          <p className="text-[11px] text-muted-foreground truncate">{tx.notes}</p>
                        )}
                      </td>
                      <td className="py-3 px-6">
                        <span
                          className={`inline-flex items-center gap-1.5 text-[11px] tracking-wide uppercase ${
                            tx.type === "sharpening" ? "text-amber-700" : "text-primary"
                          }`}
                        >
                          {tx.type === "sharpening" ? (
                            <Wrench className="h-3 w-3" />
                          ) : (
                            <Wallet className="h-3 w-3" />
                          )}
                          {tx.type}
                        </span>
                      </td>
                      <td className="py-3 px-6 text-right font-mono-num">{tx.quantity}</td>
                      <td className="py-3 px-6 text-right font-mono-num font-medium">
                        {formatCurrency(Number(tx.amount))}
                      </td>
                      <td className="py-3 px-6">
                        <StatusBadge status={tx.status} />
                      </td>
                    </tr>
                  ))}
                  {(txs.data ?? []).length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-14 text-center text-muted-foreground">
                        No transactions match your filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>

      <TransactionFormDialog open={open} onOpenChange={setOpen} />
    </DashboardLayout>
  );
}
