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
import { trpc } from "@/lib/trpc";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: number;
  machine?: {
    id: number;
    machineType: string;
    brand: string | null;
    model: string | null;
    serialNumber: string | null;
    specifications: string | null;
    notes: string | null;
  };
}

export function MachineFormDialog({ open, onOpenChange, clientId, machine }: Props) {
  const utils = trpc.useUtils();
  const [form, setForm] = useState({
    machineType: "",
    brand: "",
    model: "",
    serialNumber: "",
    specifications: "",
    notes: "",
  });

  useEffect(() => {
    if (open) {
      if (machine) {
        setForm({
          machineType: machine.machineType,
          brand: machine.brand ?? "",
          model: machine.model ?? "",
          serialNumber: machine.serialNumber ?? "",
          specifications: machine.specifications ?? "",
          notes: machine.notes ?? "",
        });
      } else {
        setForm({
          machineType: "",
          brand: "",
          model: "",
          serialNumber: "",
          specifications: "",
          notes: "",
        });
      }
    }
  }, [open, machine]);

  const createMut = trpc.machines.create.useMutation({
    onSuccess: () => {
      toast.success("Machine added");
      utils.machines.listByClient.invalidate({ clientId });
      onOpenChange(false);
    },
    onError: (e) => toast.error(e.message),
  });
  const updateMut = trpc.machines.update.useMutation({
    onSuccess: () => {
      toast.success("Machine updated");
      utils.machines.listByClient.invalidate({ clientId });
      onOpenChange(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const submit = () => {
    if (!form.machineType.trim()) {
      toast.error("Machine type is required");
      return;
    }
    const payload = {
      clientId,
      machineType: form.machineType.trim(),
      brand: form.brand.trim() || null,
      model: form.model.trim() || null,
      serialNumber: form.serialNumber.trim() || null,
      specifications: form.specifications.trim() || null,
      notes: form.notes.trim() || null,
    };
    if (machine) updateMut.mutate({ id: machine.id, data: payload });
    else createMut.mutate(payload);
  };

  const busy = createMut.isPending || updateMut.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">
            {machine ? "Edit machine" : "Add machine"}
          </DialogTitle>
          <DialogDescription>
            Register a machine so we can link tools to the equipment they are used on.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
          <div className="md:col-span-2 space-y-2">
            <Label>Machine type *</Label>
            <Input
              value={form.machineType}
              onChange={(e) => setForm({ ...form, machineType: e.target.value })}
              placeholder="e.g. Panel Saw, Edgebander, CNC Nesting"
            />
          </div>
          <div className="space-y-2">
            <Label>Brand</Label>
            <Input
              value={form.brand}
              onChange={(e) => setForm({ ...form, brand: e.target.value })}
              placeholder="e.g. Holzma, Biesse, SCM"
            />
          </div>
          <div className="space-y-2">
            <Label>Model</Label>
            <Input
              value={form.model}
              onChange={(e) => setForm({ ...form, model: e.target.value })}
              placeholder="e.g. HPP 300"
            />
          </div>
          <div className="md:col-span-2 space-y-2">
            <Label>Serial number</Label>
            <Input
              value={form.serialNumber}
              onChange={(e) => setForm({ ...form, serialNumber: e.target.value })}
            />
          </div>
          <div className="md:col-span-2 space-y-2">
            <Label>Specifications</Label>
            <Textarea
              rows={3}
              value={form.specifications}
              onChange={(e) => setForm({ ...form, specifications: e.target.value })}
              placeholder="Blade diameters, bore, motor, tooling, etc."
            />
          </div>
          <div className="md:col-span-2 space-y-2">
            <Label>Notes</Label>
            <Textarea
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy}>
            {busy ? "Saving…" : machine ? "Save" : "Add machine"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
