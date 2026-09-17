import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type TxType = "purchase" | "sharpening";
type TxStatus = "paid" | "pending" | "overdue";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId?: number;
}

export function TransactionFormDialog({ open, onOpenChange, clientId }: Props) {
  const utils = trpc.useUtils();
  const clientsQuery = trpc.clients.list.useQuery(undefined, { enabled: !clientId });

  const [form, setForm] = useState({
    clientId: clientId ?? 0,
    type: "purchase" as TxType,
    description: "",
    quantity: 1,
    amount: "",
    status: "paid" as TxStatus,
    transactionDate: new Date().toISOString().slice(0, 10),
    notes: "",
  });

  useEffect(() => {
    if (open) {
      setForm({
        clientId: clientId ?? 0,
        type: "purchase",
        description: "",
        quantity: 1,
        amount: "",
        status: "paid",
        transactionDate: new Date().toISOString().slice(0, 10),
        notes: "",
      });
    }
  }, [open, clientId]);

  const createMut = trpc.transactions.create.useMutation({
    onSuccess: () => {
      toast.success("Transaction recorded");
      utils.transactions.list.invalidate();
      utils.clients.stats.invalidate();
      utils.analytics.kpis.invalidate();
      utils.analytics.monthlyRevenue.invalidate();
      utils.analytics.topClients.invalidate();
      onOpenChange(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const submit = () => {
    if (!form.clientId) return toast.error("Please select a client");
    if (!form.description.trim()) return toast.error("Description is required");
    if (!form.amount) return toast.error("Amount is required");
    const amt = parseFloat(form.amount);
    if (!isFinite(amt) || amt < 0) return toast.error("Invalid amount");

    createMut.mutate({
      clientId: form.clientId,
      type: form.type,
      description: form.description.trim(),
      quantity: form.quantity,
      amount: amt.toFixed(2),
      status: form.status,
      transactionDate: new Date(form.transactionDate),
      notes: form.notes.trim() || null,
    });
  };

  const busy = createMut.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Record transaction</DialogTitle>
          <DialogDescription>
            Log a tool purchase or sharpening order. This will update revenue, outstanding balance
            and client stats.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
          {!clientId && (
            <div className="md:col-span-2 space-y-2">
              <Label>Client *</Label>
              <Select
                value={form.clientId ? String(form.clientId) : ""}
                onValueChange={(v) => setForm({ ...form, clientId: parseInt(v, 10) })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select client" />
                </SelectTrigger>
                <SelectContent>
                  {(clientsQuery.data ?? []).map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.companyName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-2">
            <Label>Type *</Label>
            <Select
              value={form.type}
              onValueChange={(v) => setForm({ ...form, type: v as TxType })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="purchase">Tool purchase</SelectItem>
                <SelectItem value="sharpening">Sharpening</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select
              value={form.status}
              onValueChange={(v) => setForm({ ...form, status: v as TxStatus })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2 space-y-2">
            <Label>Description *</Label>
            <Input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="e.g. Inv #123 — Diamond saw blade D350"
            />
          </div>
          <div className="space-y-2">
            <Label>Quantity</Label>
            <Input
              type="number"
              min={1}
              value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: parseInt(e.target.value, 10) || 1 })}
            />
          </div>
          <div className="space-y-2">
            <Label>Amount (AED) *</Label>
            <Input
              type="number"
              step="0.01"
              min={0}
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              placeholder="0.00"
            />
          </div>
          <div className="md:col-span-2 space-y-2">
            <Label>Date</Label>
            <Input
              type="date"
              value={form.transactionDate}
              onChange={(e) => setForm({ ...form, transactionDate: e.target.value })}
            />
          </div>
          <div className="md:col-span-2 space-y-2">
            <Label>Notes</Label>
            <Textarea
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Invoice notes, salesperson, payment terms…"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy}>
            {busy ? "Saving…" : "Record transaction"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
