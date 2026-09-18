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

type Activity = "high" | "medium" | "low" | "inactive";

export interface ClientFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client?: {
    id: number;
    companyName: string;
    contactPerson: string | null;
    email: string | null;
    phone: string | null;
    address: string | null;
    industry: string | null;
    activityLevel: Activity;
    notes: string | null;
  };
  onSaved?: () => void;
}

const INDUSTRY_OPTIONS = ["Wood", "HPL", "Machinery", "Steel", "Composite", "Other"];

export function ClientFormDialog({ open, onOpenChange, client, onSaved }: ClientFormDialogProps) {
  const utils = trpc.useUtils();
  const isEdit = !!client;

  const [form, setForm] = useState({
    companyName: "",
    contactPerson: "",
    email: "",
    phone: "",
    address: "",
    industry: "Wood",
    activityLevel: "medium" as Activity,
    notes: "",
  });

  useEffect(() => {
    if (open && client) {
      setForm({
        companyName: client.companyName ?? "",
        contactPerson: client.contactPerson ?? "",
        email: client.email ?? "",
        phone: client.phone ?? "",
        address: client.address ?? "",
        industry: client.industry ?? "Wood",
        activityLevel: client.activityLevel,
        notes: client.notes ?? "",
      });
    } else if (open && !client) {
      setForm({
        companyName: "",
        contactPerson: "",
        email: "",
        phone: "",
        address: "",
        industry: "Wood",
        activityLevel: "medium",
        notes: "",
      });
    }
  }, [open, client]);

  const createMut = trpc.clients.create.useMutation({
    onSuccess: () => {
      toast.success("Client created");
      utils.clients.list.invalidate();
      onOpenChange(false);
      onSaved?.();
    },
    onError: (e) => toast.error(e.message),
  });
  const updateMut = trpc.clients.update.useMutation({
    onSuccess: () => {
      toast.success("Client updated");
      utils.clients.list.invalidate();
      utils.clients.get.invalidate();
      onOpenChange(false);
      onSaved?.();
    },
    onError: (e) => toast.error(e.message),
  });

  const submit = () => {
    if (!form.companyName.trim()) {
      toast.error("Company name is required");
      return;
    }
    const payload = {
      companyName: form.companyName.trim(),
      contactPerson: form.contactPerson.trim() || null,
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      address: form.address.trim() || null,
      industry: form.industry || null,
      activityLevel: form.activityLevel,
      notes: form.notes.trim() || null,
    };
    if (isEdit && client) {
      updateMut.mutate({ id: client.id, data: payload });
    } else {
      createMut.mutate(payload);
    }
  };

  const busy = createMut.isPending || updateMut.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">
            {isEdit ? "Edit client" : "Add new client"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update this client's profile information."
              : "Create a new client record with profile, contact and activity details."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
          <div className="md:col-span-2 space-y-2">
            <Label>Company name *</Label>
            <Input
              value={form.companyName}
              onChange={(e) => setForm({ ...form, companyName: e.target.value })}
              placeholder="e.g. Star Wood Industries LLC"
            />
          </div>
          <div className="space-y-2">
            <Label>Contact person</Label>
            <Input
              value={form.contactPerson}
              onChange={(e) => setForm({ ...form, contactPerson: e.target.value })}
              placeholder="e.g. Mr. Samer"
            />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="contact@company.ae"
            />
          </div>
          <div className="space-y-2">
            <Label>Phone</Label>
            <Input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="+971…"
            />
          </div>
          <div className="space-y-2">
            <Label>Industry</Label>
            <Select
              value={form.industry}
              onValueChange={(v) => setForm({ ...form, industry: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INDUSTRY_OPTIONS.map((i) => (
                  <SelectItem key={i} value={i}>
                    {i}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2 space-y-2">
            <Label>Address</Label>
            <Input
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="Full address"
            />
          </div>
          <div className="space-y-2">
            <Label>Activity level</Label>
            <Select
              value={form.activityLevel}
              onValueChange={(v) => setForm({ ...form, activityLevel: v as Activity })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2 space-y-2">
            <Label>Notes</Label>
            <Textarea
              rows={3}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="TRN, currency, internal remarks…"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy}>
            {busy ? "Saving…" : isEdit ? "Save changes" : "Create client"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
