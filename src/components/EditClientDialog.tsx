import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Copy, Monitor } from "lucide-react";
import { toast } from "sonner";
import type { ClientHealth } from "@/lib/constants";

const STATUS_OPTIONS: { value: ClientHealth; label: string }[] = [
  { value: "saudavel", label: "Ativo" },
  { value: "em_atencao", label: "Em risco" },
  { value: "critico", label: "Inativo" },
];

interface EditClientDialogProps {
  client: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditClientDialog({ client, open, onOpenChange }: EditClientDialogProps) {
  const qc = useQueryClient();
  const [form, setForm] = useState<any>(null);

  useEffect(() => {
    if (open && client) {
      setForm({
        company: client.company ?? "",
        contact_name: client.contact_name ?? "",
        cnpj: client.cnpj ?? "",
        email: client.email ?? "",
        phone: client.phone ?? "",
        whatsapp: client.whatsapp ?? "",
        billing_email: client.billing_email ?? "",
        health: (client.health ?? "saudavel") as ClientHealth,
        notes: client.notes ?? "",
      });
    }
  }, [open, client]);

  const save = useMutation({
    mutationFn: async () => {
      if (!form) return;
      const company = form.company.trim();
      if (!company) throw new Error("Razão social / empresa é obrigatória.");
      const { error } = await supabase
        .from("clients")
        .update({
          company,
          // mantém o campo "name" sincronizado com o contato (ou empresa, fallback) para não quebrar listagens existentes
          name: form.contact_name?.trim() || company,
          contact_name: form.contact_name?.trim() || null,
          cnpj: form.cnpj?.trim() || null,
          email: form.email?.trim() || null,
          phone: form.phone?.trim() || null,
          whatsapp: form.whatsapp?.trim() || null,
          billing_email: form.billing_email?.trim() || null,
          health: form.health,
          notes: form.notes?.trim() || null,
        })
        .eq("id", client.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["client", client.id] });
      qc.invalidateQueries({ queryKey: ["clients-min"] });
      qc.invalidateQueries({ queryKey: ["dashboard-clients"] });
      toast.success("Cliente atualizado.");
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (!form) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Editar cliente</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <div className="space-y-1.5">
            <Label>Razão social / Empresa *</Label>
            <Input
              required
              value={form.company}
              onChange={(e) => setForm({ ...form, company: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Nome do contato</Label>
              <Input
                value={form.contact_name}
                onChange={(e) => setForm({ ...form, contact_name: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>CNPJ</Label>
              <Input
                value={form.cnpj}
                onChange={(e) => setForm({ ...form, cnpj: e.target.value })}
                placeholder="00.000.000/0000-00"
              />
            </div>
            <div className="space-y-1.5">
              <Label>E-mail</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Telefone</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>WhatsApp</Label>
              <Input
                value={form.whatsapp}
                onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>E-mail financeiro</Label>
              <Input
                type="email"
                value={form.billing_email}
                onChange={(e) => setForm({ ...form, billing_email: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Status do cliente</Label>
              <Select
                value={form.health}
                onValueChange={(v) => setForm({ ...form, health: v as ClientHealth })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Observações</Label>
            <Textarea
              rows={4}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={save.isPending || !form.company.trim()}
              className="bg-gradient-brand text-primary-foreground hover:opacity-90"
            >
              {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
