import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Copy, Monitor } from "lucide-react";
import { toast } from "sonner";
import type { ClientHealth } from "@/lib/constants";
import { VincularClienteDialog } from "@/components/financeiro/ParceirosTab";

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
        anydesk_id: client.anydesk_id ?? "",
        products: (client.products ?? []) as string[],
        contract_value: client.contract_value ?? "",
        fonte_indicacao: client.fonte_indicacao ?? "",
        parceiro_id: client.parceiro_id ?? "",
      });
    }
  }, [open, client]);

  const { data: parceiros = [] } = useQuery({
    queryKey: ["parceiros-ativos"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("parceiros").select("id, nome, contato, ativo, observacoes")
        .eq("ativo", true).order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });
  const [vincularParceiro, setVincularParceiro] = useState<any>(null);

  const save = useMutation({
    mutationFn: async () => {
      if (!form) return;
      const company = form.company.trim();
      if (!company) throw new Error("Razão social / empresa é obrigatória.");

      // Validação AnyDesk: apenas ID
      const adIdRaw = form.anydesk_id?.trim() ?? "";
      let anydeskIdValue: string | null = null;
      if (adIdRaw) {
        const idDigits = adIdRaw.replace(/[\s-]/g, "");
        if (!/^\d+$/.test(idDigits)) throw new Error("ID do AnyDesk inválido: use apenas números.");
        if (idDigits.length < 6 || idDigits.length > 12) throw new Error("ID do AnyDesk inválido: deve ter entre 6 e 12 dígitos.");
        anydeskIdValue = idDigits;
      }

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
          anydesk_id: anydeskIdValue,
          anydesk_senha: null,
          products: form.products ?? [],
          contract_value:
            form.contract_value === "" || form.contract_value == null
              ? null
              : Number(form.contract_value),
          fonte_indicacao: form.fonte_indicacao?.trim() || null,
          parceiro_id: form.parceiro_id || null,
        } as any)
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
    onError: (e: any) => toast.error(e?.message || "Erro ao salvar. Tente novamente."),
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

          <div className="space-y-3 rounded-lg border border-border bg-surface-muted/30 p-3">
            <div className="text-sm font-medium">Produto(s) contratado(s)</div>
            <div className="flex flex-wrap gap-4">
              {[
                { id: "rh_digital", label: "RH Digital (Ponto)" },
                { id: "vr_beneficios", label: "VR Benefícios" },
              ].map((p) => {
                const checked = (form.products ?? []).includes(p.id);
                return (
                  <label key={p.id} className="flex cursor-pointer items-center gap-2 text-sm">
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(v) => {
                        const set = new Set<string>(form.products ?? []);
                        if (v) set.add(p.id); else set.delete(p.id);
                        setForm({ ...form, products: Array.from(set) });
                      }}
                    />
                    {p.label}
                  </label>
                );
              })}
            </div>
            <div className="space-y-1.5">
              <Label>Valor de contrato (R$)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={form.contract_value}
                onChange={(e) => setForm({ ...form, contract_value: e.target.value })}
                placeholder="0,00"
              />
            </div>
          </div>

          <div className="space-y-2 rounded-lg border border-border bg-surface-muted/30 p-3">
            <div className="flex items-center justify-between gap-2 text-sm font-medium">
              <div className="flex items-center gap-2">
                <Monitor className="h-4 w-4 text-muted-foreground" />
                Acesso Remoto
              </div>
              {!form.anydesk_id?.trim() && (
                <span className="text-xs font-normal text-muted-foreground">
                  Nenhum AnyDesk cadastrado — preencha abaixo
                </span>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>ID AnyDesk</Label>
              <div className="flex gap-1.5">
                <Input
                  value={form.anydesk_id}
                  onChange={(e) => setForm({ ...form, anydesk_id: e.target.value })}
                  placeholder="000 000 000"
                  inputMode="numeric"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  disabled={!form.anydesk_id?.trim()}
                  onClick={() => {
                    navigator.clipboard.writeText(form.anydesk_id);
                    toast.success("ID copiado");
                  }}
                  title="Copiar ID"
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
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

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Fonte de indicação</Label>
              <Input
                value={form.fonte_indicacao}
                onChange={(e) => setForm({ ...form, fonte_indicacao: e.target.value })}
                placeholder="Como nos conheceu?"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Parceiro</Label>
              <Select
                value={form.parceiro_id || "none"}
                onValueChange={(v) => {
                  if (v === "none") {
                    setForm({ ...form, parceiro_id: "" });
                  } else {
                    setForm({ ...form, parceiro_id: v });
                    const p = parceiros.find((x: any) => x.id === v);
                    if (p) setVincularParceiro(p);
                  }
                }}
              >
                <SelectTrigger><SelectValue placeholder="Sem parceiro" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem parceiro</SelectItem>
                  {parceiros.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
