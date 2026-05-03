import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";
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
import { ChevronDown } from "lucide-react";

import { ClientCombobox, ClientOption } from "./ClientCombobox";
import { BRL, calcVencimento, ymdFirst } from "./financeiroUtils";
import { supabase } from "@/integrations/supabase/client";

export type LancamentoVR = {
  id: string;
  client_id: string | null;
  cliente_nome: string;
  cnpj: string | null;
  competencia: string;
  tipo: "primeira_carga" | "recorrencia";
  valor_base: number;
  percentual_comissao: number;
  fidelidade_meses: number | null;
  fidelidade_inicio: string | null;
  notificar_vencimento: boolean;
  observacoes: string | null;
};

type TipoLancamentoVR = "primeira_carga" | "recorrencia";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultCompetencia: Date;
  initial?: LancamentoVR | null;
}

export function LancamentoVrDialog({ open, onOpenChange, defaultCompetencia, initial }: Props) {
  const qc = useQueryClient();
  const isEdit = !!initial;

  const [client, setClient] = useState<ClientOption | null>(null);
  const [competencia, setCompetencia] = useState<string>(ymdFirst(defaultCompetencia));
  const [tipo, setTipo] = useState<TipoLancamentoVR>("recorrencia");
  const [valorBase, setValorBase] = useState<string>("0");
  const [percentual, setPercentual] = useState<string>("17.5");
  const [fidMeses, setFidMeses] = useState<string>("");
  const [fidInicio, setFidInicio] = useState<string>("");
  const [notificar, setNotificar] = useState(true);
  const [observacoes, setObservacoes] = useState<string>("");
  const [openFid, setOpenFid] = useState(false);
  const percentualRequestRef = useRef(0);

  const buscarPercentualVr = async (
    clientId: string | null,
    tipoAtual: TipoLancamentoVR,
  ) => {
    let config: {
      percentual_vr_primeira_carga: number | null;
      percentual_vr_recorrencia: number | null;
    } | null = null;

    if (clientId) {
      const { data, error } = await supabase
        .from("config_comissoes")
        .select("percentual_vr_primeira_carga, percentual_vr_recorrencia")
        .eq("client_id", clientId)
        .maybeSingle();
      if (error) throw error;
      config = data;
    }

    const { data: settings, error: settingsError } = await supabase
      .from("system_settings")
      .select("percentual_vr_primeira_carga, percentual_vr_recorrencia")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (settingsError) throw settingsError;

    const valor =
      tipoAtual === "primeira_carga"
        ? config?.percentual_vr_primeira_carga ??
          settings?.percentual_vr_primeira_carga ??
          17.5
        : config?.percentual_vr_recorrencia ?? settings?.percentual_vr_recorrencia ?? 17.5;

    return String(valor);
  };

  const aplicarPercentualVr = async (
    clientId: string | null,
    tipoAtual: TipoLancamentoVR,
  ) => {
    const requestId = ++percentualRequestRef.current;
    try {
      const valor = await buscarPercentualVr(clientId, tipoAtual);
      if (percentualRequestRef.current === requestId) setPercentual(valor);
    } catch (e: any) {
      if (percentualRequestRef.current === requestId) {
        toast.error(e.message ?? "Erro ao buscar percentual configurado");
      }
    }
  };

  const handleClienteSelect = (selected: ClientOption | null) => {
    setClient(selected);
    if (!isEdit) void aplicarPercentualVr(selected?.id ?? null, tipo);
  };

  const handleTipoChange = (novoTipo: TipoLancamentoVR) => {
    setTipo(novoTipo);
    if (!isEdit) void aplicarPercentualVr(client?.id ?? null, novoTipo);
  };

  // Reset/initialize on open
  useEffect(() => {
    if (!open) return;
    percentualRequestRef.current += 1;
    if (initial) {
      setClient(
        initial.client_id
          ? { id: initial.client_id, name: initial.cliente_nome, cnpj: initial.cnpj }
          : null,
      );
      setCompetencia(initial.competencia);
      setTipo(initial.tipo);
      setValorBase(String(initial.valor_base));
      setPercentual(String(initial.percentual_comissao));
      setFidMeses(initial.fidelidade_meses ? String(initial.fidelidade_meses) : "");
      setFidInicio(initial.fidelidade_inicio ?? "");
      setNotificar(initial.notificar_vencimento);
      setObservacoes(initial.observacoes ?? "");
      setOpenFid(!!initial.fidelidade_meses);
    } else {
      setClient(null);
      setCompetencia(ymdFirst(defaultCompetencia));
      setTipo("recorrencia");
      setValorBase("0");
      setPercentual("17.5");
      setFidMeses("");
      setFidInicio("");
      setNotificar(true);
      setObservacoes("");
      setOpenFid(false);
      void aplicarPercentualVr(null, "recorrencia");
    }
  }, [open, initial, defaultCompetencia]);

  const valorComissao = useMemo(() => {
    const v = Number(valorBase || 0);
    const p = Number(percentual || 0);
    return Math.round(v * (p / 100) * 100) / 100;
  }, [valorBase, percentual]);

  const vencimentoCalc = useMemo(
    () => calcVencimento(fidInicio || null, fidMeses ? Number(fidMeses) : null),
    [fidInicio, fidMeses],
  );

  const competenciaInputValue = competencia ? competencia.slice(0, 7) : "";

  const mutation = useMutation({
    mutationFn: async () => {
      if (!client) throw new Error("Selecione um cliente.");
      if (!competencia) throw new Error("Informe a competência.");
      if (Number(valorBase) <= 0) throw new Error("Valor base deve ser maior que zero.");

      const userRes = await supabase.auth.getUser();
      const userId = userRes.data.user?.id ?? null;

      const payload = {
        client_id: client.id,
        cliente_nome: client.name,
        cnpj: client.cnpj,
        competencia,
        tipo,
        valor_base: Number(valorBase),
        percentual_comissao: Number(percentual),
        fidelidade_meses: fidMeses ? Number(fidMeses) : null,
        fidelidade_inicio: fidInicio || null,
        notificar_vencimento: notificar,
        observacoes: observacoes.trim() ? observacoes.trim() : null,
      };

      if (isEdit && initial) {
        const { error } = await supabase
          .from("lancamentos_vr")
          .update(payload)
          .eq("id", initial.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("lancamentos_vr")
          .insert({ ...payload, created_by: userId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(isEdit ? "Lançamento VR atualizado!" : "Lançamento VR salvo com sucesso!");
      qc.invalidateQueries({ queryKey: ["financeiro-vr"] });
      qc.invalidateQueries({ queryKey: ["financeiro-fidelidade-alertas"] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao salvar"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar lançamento VR" : "Novo lançamento VR"}</DialogTitle>
          <DialogDescription>
            Comissão VR Benefícios por competência. O valor da comissão é calculado
            automaticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <Label>Cliente *</Label>
            <ClientCombobox value={client?.id ?? null} onSelect={handleClienteSelect} />
            {client && (
              <p className="text-xs text-muted-foreground">
                {client.cnpj ? `CNPJ: ${client.cnpj} · ` : ""}
                <a
                  href={`/clientes/${client.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary hover:underline"
                >
                  Ver perfil
                </a>
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="competencia-vr">Competência *</Label>
              <Input
                id="competencia-vr"
                type="month"
                value={competenciaInputValue}
                onChange={(e) => setCompetencia(e.target.value ? `${e.target.value}-01` : "")}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Tipo *</Label>
              <div className="flex rounded-md border p-0.5">
                {(
                  [
                    { v: "primeira_carga", l: "Primeira carga" },
                    { v: "recorrencia", l: "Recorrência" },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.v}
                    type="button"
                    onClick={() => handleTipoChange(opt.v)}
                    className={`flex-1 rounded-sm px-2 py-1.5 text-xs font-medium transition-colors ${
                      tipo === opt.v
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {opt.l}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="valor-base">Valor base (R$) *</Label>
              <Input
                id="valor-base"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={valorBase}
                onChange={(e) => setValorBase(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="perc-vr">% Comissão *</Label>
              <Input
                id="perc-vr"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                max="100"
                value={percentual}
                onChange={(e) => setPercentual(e.target.value)}
              />
            </div>
          </div>

          <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
            Valor da comissão:{" "}
            <span className="font-semibold tabular-nums">= {BRL.format(valorComissao)}</span>
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
                      <SelectItem value="12">12 meses</SelectItem>
                      <SelectItem value="24">24 meses</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="fid-inicio-vr">Data de início</Label>
                  <Input
                    id="fid-inicio-vr"
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
            <Label htmlFor="obs-vr">Observações</Label>
            <Textarea
              id="obs-vr"
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
