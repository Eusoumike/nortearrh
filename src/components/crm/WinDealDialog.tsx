import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Loader2, CheckCircle2 } from "lucide-react";
import { fmtBRL } from "@/lib/crmOptions";
import type { Deal } from "@/pages/CrmPipeline";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  deal: Deal | null;
  onDone: () => void;
}

export function WinDealDialog({ open, onOpenChange, deal, onDone }: Props) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [createCliente, setCreateCliente] = useState(true);
  const [createImplantacao, setCreateImplantacao] = useState(true);
  const [createContrato, setCreateContrato] = useState(true);

  if (!deal) return null;

  const productLabel = deal.product === "rh_digital" ? "RH Digital" : deal.product === "vr_beneficios" ? "VR Benefícios" : deal.product === "ambos" ? "RH Digital + VR" : "—";

  const handleConfirm = async () => {
    setLoading(true);
    try {
      // 1. Atualiza deal
      const { error: e1 } = await supabase
        .from("deals")
        .update({ stage: "fechado_ganho" })
        .eq("id", deal.id);
      if (e1) throw e1;

      let clientId = deal.client_id;

      // 2. Cliente
      if (createCliente && !clientId) {
        const products: string[] = [];
        if (deal.product === "rh_digital" || deal.product === "ambos") products.push("rh_digital");
        if (deal.product === "vr_beneficios" || deal.product === "ambos") products.push("vr_beneficios");
        const { data: c, error: e2 } = await supabase
          .from("clients")
          .insert({
            name: deal.contact_name || deal.company_name,
            company: deal.company_name,
            email: deal.contact_email,
            phone: deal.contact_phone,
            products,
            valor_contratado: deal.value,
            account_owner: deal.owner_id,
            created_by: user?.id,
          })
          .select("id")
          .single();
        if (e2) throw e2;
        clientId = c.id;
        await supabase.from("deals").update({ client_id: clientId }).eq("id", deal.id);
      }

      // 3. Implantação
      if (createImplantacao && clientId) {
        await supabase.from("implantacoes").insert({
          client_id: clientId,
          client_name: deal.company_name,
          produto: deal.product,
          etapa: "boas_vindas",
          data_inicio: new Date().toISOString().slice(0, 10),
          created_by: user?.id,
        });
      }

      // 4. Contrato financeiro
      if (createContrato && clientId) {
        if (deal.product === "rh_digital" || deal.product === "ambos") {
          await supabase.from("contratos_rh_digital").insert({
            client_id: clientId,
            cliente_nome: deal.company_name,
            data_inicio: new Date().toISOString().slice(0, 10),
            fidelidade_meses: 12,
            valor_mensalidade: deal.value || 0,
            tipo_cobranca: "mensal",
            percentual_nortear: 40,
            created_by: user?.id,
          });
        }
        if (deal.product === "vr_beneficios" || deal.product === "ambos") {
          await supabase.from("lancamentos_vr").insert({
            client_id: clientId,
            cliente_nome: deal.company_name,
            competencia: new Date().toISOString().slice(0, 10),
            tipo: "primeira_carga",
            valor_base: deal.value || 0,
            percentual_comissao: 17.5,
            created_by: user?.id,
          });
        }
      }

      toast.success("Negócio convertido com sucesso!");
      onDone();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || "Erro ao converter negócio");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" /> Deal ganho! 🎉
          </DialogTitle>
          <DialogDescription>Confirme o que deve ser criado automaticamente.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 rounded-md border p-3 text-sm">
          <div><span className="text-muted-foreground">Empresa:</span> <strong>{deal.company_name}</strong></div>
          <div><span className="text-muted-foreground">Produto:</span> {productLabel}</div>
          <div><span className="text-muted-foreground">Valor:</span> {fmtBRL(deal.value)}</div>
        </div>

        <div className="space-y-3">
          {!deal.client_id && (
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={createCliente} onCheckedChange={(v) => setCreateCliente(!!v)} />
              Criar cliente na Carteira
            </label>
          )}
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={createImplantacao} onCheckedChange={(v) => setCreateImplantacao(!!v)} />
            Criar Implantação (etapa: E-mail de Boas-vindas)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={createContrato} onCheckedChange={(v) => setCreateContrato(!!v)} />
            Criar Contrato no Financeiro
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Confirmar e criar tudo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
