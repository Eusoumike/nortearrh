import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { addMonths, format, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Loader2, CheckCircle2 } from "lucide-react";
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
import { ClientPreviewCard } from "@/components/ClientPreviewCard";
import { BRL, calcVencimento, ymdFirst } from "./financeiroUtils";
import { supabase } from "@/integrations/supabase/client";

export type LancamentoVR = {
  id: string;
  client_id: string | null;
  cliente_nome: string;
  cnpj: string | null;
  competencia: string;
  tipo: "primeira_carga" | "recorrencia";
  valor_base: number | null;
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
  const [percentualRecorrencia, setPercentualRecorrencia] = useState<string>("17.5");
  const [fidMeses, setFidMeses] = useState<string>("");
  const [fidInicio, setFidInicio] = useState<string>("");
  const [notificar, setNotificar] = useState(true);
  const [observacoes, setObservacoes] = useState<string>("");
  const [openFid, setOpenFid] = useState(false);
  const percentualRequestRef = useRef(0);

  const [padraoVrPrim, setPadraoVrPrim] = useState<number>(17.5);
  const [padraoVrRec, setPadraoVrRec] = useState<number>(17.5);

  const buscarPercentuaisVr = async () => {
    const { data: settings, error } = await supabase
      .from("system_settings")
      .select("percentual_vr_primeira_carga, percentual_vr_recorrencia")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return {
      primeiraCarga: Number(settings?.percentual_vr_primeira_carga ?? 17.5),
      recorrencia: Number(settings?.percentual_vr_recorrencia ?? 17.5),
    };
  };

  const aplicarPercentuais = async (tipoAtual: TipoLancamentoVR) => {
    const requestId = ++percentualRequestRef.current;
    try {
      const { primeiraCarga, recorrencia } = await buscarPercentuaisVr();
      if (percentualRequestRef.current !== requestId) return;
      setPadraoVrPrim(primeiraCarga);
      setPadraoVrRec(recorrencia);
      setPercentualRecorrencia(String(recorrencia));
      setPercentual(String(tipoAtual === "primeira_carga" ? primeiraCarga : recorrencia));
    } catch (e: any) {
      if (percentualRequestRef.current === requestId) {
        toast.error(e.message ?? "Erro ao buscar percentual configurado");
      }
    }
  };

  const handleClienteSelect = (selected: ClientOption | null) => {
    setClient(selected);
  };

  const handleTipoChange = (novoTipo: TipoLancamentoVR) => {
    setTipo(novoTipo);
    if (!isEdit) void aplicarPercentuais(novoTipo);
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
      setValorBase(initial.valor_base == null ? "" : String(initial.valor_base));
      setPercentual(String(initial.percentual_comissao));
      setPercentualRecorrencia(String(initial.percentual_comissao));
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
      setPercentualRecorrencia("17.5");
      setFidMeses("");
      setFidInicio("");
      setNotificar(true);
      setObservacoes("");
      setOpenFid(false);
      void aplicarPercentuais("recorrencia");
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

  // Lista de competências de recorrência a serem geradas
  const recorrenciasGeradas = useMemo<string[]>(() => {
    if (isEdit) return [];
    if (tipo !== "primeira_carga") return [];
    if (!competencia || !vencimentoCalc) return [];
    const start = startOfMonth(addMonths(new Date(competencia + "T00:00:00"), 1));
    const end = new Date(vencimentoCalc + "T00:00:00");
    const months: string[] = [];
    let cur = start;
    let safety = 0;
    while (cur <= end && safety < 60) {
      months.push(format(cur, "yyyy-MM-dd"));
      cur = addMonths(cur, 1);
      safety++;
    }
    return months;
  }, [isEdit, tipo, competencia, vencimentoCalc]);

  const competenciaInputValue = competencia ? competencia.slice(0, 7) : "";

  const formatMesAno = (ymd: string) =>
    format(new Date(ymd + "T00:00:00"), "MMM/yy", { locale: ptBR });

  const fmtPct = (v: string | number) => {
    const n = Number(v || 0);
    return `${n.toFixed(2).replace(".", ",")}%`;
  };

  const mutation = useMutation({
    mutationFn: async () => {
      if (!client) throw new Error("Selecione um cliente.");
      if (!competencia) throw new Error("Informe a competência.");
      if (Number(valorBase) <= 0) throw new Error("Valor base deve ser maior que zero.");

      const userRes = await supabase.auth.getUser();
      const userId = userRes.data.user?.id ?? null;

      const payload = {
        client_id: client.id,
        cliente_nome: client.razao_social || client.company || client.name,
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
        return { recorrencias: 0 };
      }

      const { error } = await supabase
        .from("lancamentos_vr")
        .insert({ ...payload, created_by: userId });
      if (error) throw error;

      // Gera recorrências futuras automaticamente
      if (tipo === "primeira_carga" && recorrenciasGeradas.length > 0) {
        const pctRec = Number(percentualRecorrencia || percentual);
        const recPayloads = recorrenciasGeradas.map((comp) => ({
          client_id: client.id,
          cliente_nome: client.razao_social || client.company || client.name,
          cnpj: client.cnpj,
          competencia: comp,
          tipo: "recorrencia" as const,
          valor_base: null,
          percentual_comissao: pctRec,
          fidelidade_meses: fidMeses ? Number(fidMeses) : null,
          fidelidade_inicio: fidInicio || null,
          notificar_vencimento: notificar,
          observacoes: "Gerado automaticamente a partir da Primeira Carga",
          created_by: userId,
        }));
        const { error: errRec } = await supabase.from("lancamentos_vr").insert(recPayloads);
        if (errRec) throw errRec;
      }

      return { recorrencias: tipo === "primeira_carga" ? recorrenciasGeradas.length : 0 };
    },
    onSuccess: ({ recorrencias }) => {
      if (isEdit) {
        toast.success("Lançamento VR atualizado!");
      } else if (recorrencias > 0) {
        toast.success(
          `Primeira carga salva + ${recorrencias} recorrência${recorrencias === 1 ? "" : "s"} gerada${recorrencias === 1 ? "" : "s"}.`,
        );
      } else {
        toast.success("Lançamento VR salvo com sucesso!");
      }
      qc.invalidateQueries({ queryKey: ["financeiro-vr"] });
      qc.invalidateQueries({ queryKey: ["financeiro-vr-tab"] });
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
            {client && <ClientPreviewCard client={client} />}
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
              {!isEdit && (
                <p className="text-[11px] text-muted-foreground">
                  {Number(percentual) ===
                  (tipo === "primeira_carga" ? padraoVrPrim : padraoVrRec)
                    ? "(padrão global)"
                    : "(exceção)"}
                </p>
              )}
            </div>
          </div>

          {!isEdit && tipo === "primeira_carga" && (
            <div className="grid gap-1.5">
              <Label htmlFor="perc-vr-rec">% Recorrência (para meses seguintes)</Label>
              <Input
                id="perc-vr-rec"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                max="100"
                value={percentualRecorrencia}
                onChange={(e) => setPercentualRecorrencia(e.target.value)}
              />
            </div>
          )}

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

          {!isEdit && tipo === "primeira_carga" && (
            <div className="rounded-md border-l-4 border-l-primary bg-primary/5 p-3 text-sm">
              <div className="mb-1.5 font-medium">Será gerado:</div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>
                  1 lançamento de <strong>primeira carga</strong> —{" "}
                  {competencia ? formatMesAno(competencia) : "—"} — {fmtPct(percentual)}
                </span>
              </div>
              {recorrenciasGeradas.length > 0 ? (
                <div className="mt-1 flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span>
                    {recorrenciasGeradas.length} lançamento
                    {recorrenciasGeradas.length === 1 ? "" : "s"} de <strong>recorrência</strong> —{" "}
                    {formatMesAno(recorrenciasGeradas[0])} a{" "}
                    {formatMesAno(recorrenciasGeradas[recorrenciasGeradas.length - 1])} —{" "}
                    {fmtPct(percentualRecorrencia)}
                  </span>
                </div>
              ) : (
                <div className="mt-1 text-xs text-muted-foreground">
                  Configure fidelidade (período + data de início) para gerar recorrências
                  automaticamente.
                </div>
              )}
            </div>
          )}

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
