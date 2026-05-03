import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Check, AlertTriangle, Rocket } from "lucide-react";
import { toast } from "sonner";

type Client = {
  id: string;
  name: string;
  company: string | null;
  cnpj: string | null;
  products: string[] | null;
  contract_value: number | null;
};

interface Props {
  client: Client;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function IniciarOnboardingDialog({ client, open, onOpenChange }: Props) {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const products = client.products ?? [];
  const hasRh = products.includes("rh_digital");
  const hasVr = products.includes("vr_beneficios");

  const startOnboarding = useMutation({
    mutationFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const empresaNome = client.company || client.name;

      // 1. Criar implantação
      const { data: implantacao, error: errImp } = await supabase
        .from("implantacoes")
        .insert({
          client_id: client.id,
          client_name: empresaNome,
          cnpj: client.cnpj,
          etapa: "boas_vindas",
          produto: products.join(", ") || null,
          data_inicio: today,
        })
        .select("id")
        .single();
      if (errImp) throw errImp;

      // 2. Se incluir RH Digital, criar contrato (gera parcelas via trigger)
      if (hasRh) {
        const { error: errContr } = await supabase
          .from("contratos_rh_digital")
          .insert({
            client_id: client.id,
            cliente_nome: empresaNome,
            cnpj: client.cnpj,
            valor_mensalidade: client.contract_value ?? 0,
            percentual_nortear: 40,
            data_inicio: today,
            fidelidade_meses: 12,
            ativo: true,
            notificar_vencimento: true,
          });
        if (errContr) throw errContr;
      }

      // 3. Marcar onboarding iniciado no cliente
      const { error: errCli } = await supabase
        .from("clients")
        .update({ onboarding_iniciado_em: new Date().toISOString() })
        .eq("id", client.id);
      if (errCli) throw errCli;

      return implantacao.id as string;
    },
    onSuccess: (implantacaoId) => {
      toast.success("Onboarding iniciado com sucesso!");
      qc.invalidateQueries({ queryKey: ["client", client.id] });
      qc.invalidateQueries({ queryKey: ["client-implantacao", client.id] });
      qc.invalidateQueries({ queryKey: ["client-contrato-rh", client.id] });
      qc.invalidateQueries({ queryKey: ["implantacoes"] });
      onOpenChange(false);
      navigate(`/implantacao?id=${implantacaoId}`);
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao iniciar onboarding"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Rocket className="h-5 w-5" /> Iniciar onboarding
          </DialogTitle>
          <DialogDescription>
            Iniciar onboarding para <strong>{client.company || client.name}</strong>?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 rounded-md border bg-surface-muted/30 p-3 text-sm">
          <p className="font-medium">Será criado automaticamente:</p>
          <ul className="space-y-1.5">
            <li className="flex items-start gap-2">
              <Check className="mt-0.5 h-4 w-4 text-success" />
              <span>Implantação — etapa: <strong>E-mail de Boas-vindas</strong></span>
            </li>
            {hasRh && (
              <li className="flex items-start gap-2">
                <Check className="mt-0.5 h-4 w-4 text-success" />
                <span>Contrato <strong>RH Digital</strong> no Financeiro (12 meses, 40% Nortear)</span>
              </li>
            )}
            {hasVr && (
              <li className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 text-warning" />
                <span><strong>VR Benefícios:</strong> lançamento manual necessário após receber planilha VR</span>
              </li>
            )}
            {!hasRh && !hasVr && (
              <li className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 text-warning" />
                <span>Nenhum produto definido — ajuste em "Editar cliente" antes para criar contratos automaticamente.</span>
              </li>
            )}
          </ul>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={startOnboarding.isPending}>
            Cancelar
          </Button>
          <Button
            onClick={() => startOnboarding.mutate()}
            disabled={startOnboarding.isPending}
            className="bg-gradient-brand text-primary-foreground hover:opacity-90"
          >
            {startOnboarding.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Iniciar onboarding
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
