import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ChevronDown, Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

import { ClientCombobox, ClientOption } from "./ClientCombobox";
import { BRL, calcVencimento, ymdFirst } from "./financeiroUtils";
import { supabase } from "@/integrations/supabase/client";

export type LancamentoPonto = {
  id: string;
  client_id: string | null;
  cliente_nome: string;
  cnpj: string | null;
  competencia: string;
  valor_mensalidade: number;
  percentual_nortear: number;
  fidelidade_meses: number | null;
  fidelidade_inicio: string | null;
  notificar_vencimento: boolean;
  observacoes: string | null;
};

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultCompetencia: Date;
  initial?: LancamentoPonto | null;
}

export function LancamentoPontoDialog({
  open,
  onOpenChange,
  defaultCompetencia,
  initial,
}: Props) {
  const qc = useQueryClient();
  const isEdit = !!initial;

  const [client, setClient] = useState<ClientOption | null>(null);
  const [competencia, setCompetencia] = useState<string>(ymdFirst(defaultCompetencia));
  const [valorMensalidade, setValorMensalidade] = useState<string>("0");
  const [percentual, setPercentual] = useState<string>("40");
  const [fidMeses, setFidMeses] = useState<string>("");
  const [fidInicio, setFidInicio] = useState<string>("");
  const [notificar, setNotificar] = useState(true);
  const [observacoes, setObservacoes] = useState<string>("");
  const [openFid, setOpenFid] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setClient(
        initial.client_id
          ? { id: initial.client_id, name: initial.cliente_nome, cnpj: initial.cnpj }
          : null,
      );
      setCompetencia(initial.competencia);
      setValorMensalidade(String(initial.valor_mensalidade));
      setPercentual(String(initial.percentual_nortear));
      setFidMeses(initial.fidelidade_meses ? String(initial.fidelidade_meses) : "");
      setFidInicio(initial.fidelidade_inicio ?? "");
      setNotificar(initial.notificar_vencimento);
      setObservacoes(initial.observacoes ?? "");
      setOpenFid(!!initial.fidelidade_meses);
    } else {
      setClient(null);
      setCompetencia(ymdFirst(defaultCompetencia));
      setValorMensalidade("0");
      setPercentual("40");
      setFidMeses("");
      setFidInicio("");
      setNotificar(true);
      setObservacoes("");
      setOpenFid(false);
    }
  }, [open, initial, defaultCompetencia]);

  useEffect(() => {
    if (!open || isEdit || !client?.id) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("config_comissoes")
        .select("percentual_ponto")
        .eq("client_id", client.id)
        .maybeSingle();
      if (cancelled) return;
      setPercentual(data ? String(data.percentual_ponto) : "40");
    })();
    return () => {
      cancelled = true;
    };
  }, [client?.id, open, isEdit]);

  const valorNortear = useMemo(() => {
    const v = Number(valorMensalidade || 0);
    const p = Number(percentual || 0);
    return Math.round(v * p) / 100;
  }, [valorMensalidade, percentual]);

  const vencimentoCalc = useMemo(
    () => calcVencimento(fidInicio || null, fidMeses ? Number(fidMeses) : null),
    [fidInicio, fidMeses],
  );

  const competenciaInputValue = competencia ? competencia.slice(0, 7) : "";

  const mutation = useMutation({
    mutationFn: async () => {
      if (!client) throw new Error("Selecione um cliente.");
      if (!competencia) throw new Error("Informe a competência.");
      if (Number(valorMensalidade) <= 0)
        throw new Error("Valor da mensalidade deve ser maior que zero.");

      const userRes = await supabase.auth.getUser();
      const userId = userRes.data.user?.id ?? null;

      const payload = {
        client_id: client.id,
        cliente_nome: client.name,
        cnpj: client.cnpj,
        competencia,
        valor_mensalidade: Number(valorMensalidade),
        percentual_nortear: Number(percentual),
        fidelidade_meses: fidMeses ? Number(fidMeses) : null,
        fidelidade_inicio: fidInicio || null,
        notificar_vencimento: notificar,
        observacoes: observacoes.trim() ? observacoes.trim() : null,
      };

      if (isEdit && initial) {
        const { error } = await supabase
          .from("lancamentos_ponto")
          .update(payload)
          .eq("id", initial.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("lancamentos_ponto")
          .insert({ ...payload, created_by: userId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(
        isEdit ? "Lançamento Ponto atualizado!" : "Lançamento Ponto salvo com sucesso!",
      );
      qc.invalidateQueries({ queryKey: ["financeiro-ponto"] });
      qc.invalidateQueries({ queryKey: ["financeiro-fidelidade-alertas"] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao salvar"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Editar lançamento Ponto" : "Novo lançamento Ponto"}
          </DialogTitle>
          <DialogDescription>
            Mensalidade RH Digital e o valor que cabe à Nortear, por competência.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <Label>Cliente *</Label>
            <ClientCombobox value={client?.id ?? null} onSelect={setClient} />
            {client?.cnpj && (
              <p className="text-xs text-muted-foreground">CNPJ: {client.cnpj}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="competencia-ponto">Competência *</Label>
              <Input
                id="competencia-ponto"
                type="month"
                value={competenciaInputValue}
                onChange={(e) => setCompetencia(e.target.value ? `${e.target.value}-01` : "")}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="valor-mensalidade">Mensalidade (R$) *</Label>
              <Input
                id="valor-mensalidade"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={valorMensalidade}
                onChange={(e) => setValorMensalidade(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="perc-ponto">% Nortear *</Label>
              <Input
                id="perc-ponto"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                max="100"
                value={percentual}
                onChange={(e) => setPercentual(e.target.value)}
              />
            </div>
            <div className="grid items-end">
              <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
                Valor Nortear:{" "}
                <span className="font-semibold tabular-nums">
                  = {BRL.format(valorNortear)}
                </span>
              </div>
            </div>
          </div>

          <Collapsible open={openFid} onOpenChange={setOpenFid}>
            <CollapsibleTrigger asChild>
              <Button type="button" variant="outline" size="sm" className="w-full justify-between">
                Configurar fidelidade
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${openFid ? "rotate-180" : ""}`}
                />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-3 grid gap-4 rounded-md border p-3">
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-1.5">
                  <Label>Período</Label>
                  <Select value={fidMeses} onValueChange={setFidMeses}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecionar" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="6">6 meses</SelectItem>
                      <SelectItem value="12">12 meses</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="fid-inicio-ponto">Data de início</Label>
                  <Input
                    id="fid-inicio-ponto"
                    type="date"
                    value={fidInicio}
                    onChange={(e) => setFidInicio(e.target.value)}
                  />
                </div>
              </div>
              <div className="text-sm text-muted-foreground">
                Vencimento:{" "}
                <span className="font-medium text-foreground">
                  {vencimentoCalc
                    ? format(new Date(vencimentoCalc + "T00:00:00"), "dd/MM/yyyy")
                    : "—"}
                </span>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={notificar}
                  onCheckedChange={(v) => setNotificar(v === true)}
                />
                Notificar 30 dias antes do vencimento
              </label>
            </CollapsibleContent>
          </Collapsible>

          <div className="grid gap-1.5">
            <Label htmlFor="obs-ponto">Observações</Label>
            <Textarea
              id="obs-ponto"
              rows={3}
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              maxLength={500}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
            Cancelar
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEdit ? "Salvar alterações" : "Salvar lançamento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
