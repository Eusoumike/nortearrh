import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addMonths, format, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Infinity as InfinityIcon, Loader2, Handshake } from "lucide-react";
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

import { ClientCombobox, ClientOption } from "./ClientCombobox";
import { ClientPreviewCard } from "@/components/ClientPreviewCard";
import { BRL, ymdFirst } from "./financeiroUtils";
import { supabase } from "@/integrations/supabase/client";

export type TipoCobrancaRh = "mensal" | "anual";
export type TipoPeriodoRh = "fidelidade" | "enquanto_ativo";

// Modo combinado usado apenas pela UI do select
type ModoContrato = "mensal_fidelidade" | "anual" | "enquanto_ativo";

export type ContratoRh = {
  id: string;
  client_id: string | null;
  cliente_nome: string;
  cnpj: string | null;
  valor_mensalidade: number;
  percentual_nortear: number;
  data_inicio: string;
  fidelidade_meses: number | null;
  notificar_vencimento: boolean;
  observacoes: string | null;
  tipo_cobranca?: TipoCobrancaRh;
  tipo_periodo?: TipoPeriodoRh;
};

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: ContratoRh | null;
}

export function ContratoRhDialog({ open, onOpenChange, initial }: Props) {
  const qc = useQueryClient();
  const isEdit = !!initial;

  const [client, setClient] = useState<ClientOption | null>(null);
  const [valorMensalidade, setValorMensalidade] = useState<string>("0");
  const [percentual, setPercentual] = useState<string>("40");
  const [dataInicio, setDataInicio] = useState<string>(ymdFirst(new Date()));
  const [fidMeses, setFidMeses] = useState<string>("12");
  const [modo, setModo] = useState<ModoContrato>("mensal_fidelidade");
  const [notificar, setNotificar] = useState(true);
  const [observacoes, setObservacoes] = useState<string>("");
  const percentualRequestRef = useRef(0);

  const tipoCobranca: TipoCobrancaRh = modo === "anual" ? "anual" : "mensal";
  const tipoPeriodo: TipoPeriodoRh = modo === "enquanto_ativo" ? "enquanto_ativo" : "fidelidade";

  const [padraoPonto, setPadraoPonto] = useState<number>(40);

  const buscarPercentualPonto = async () => {
    const { data: settings, error } = await supabase
      .from("system_settings")
      .select("percentual_ponto")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return Number(settings?.percentual_ponto ?? 40);
  };

  const aplicarPercentualPonto = async () => {
    const requestId = ++percentualRequestRef.current;
    try {
      const valor = await buscarPercentualPonto();
      if (percentualRequestRef.current === requestId) {
        setPadraoPonto(valor);
        setPercentual(String(valor));
      }
    } catch (e: any) {
      if (percentualRequestRef.current === requestId) {
        toast.error(e.message ?? "Erro ao buscar percentual configurado");
      }
    }
  };

  const handleClienteSelect = (selected: ClientOption | null) => {
    setClient(selected);
  };

  useEffect(() => {
    if (!open) return;
    percentualRequestRef.current += 1;
    if (initial) {
      setClient(
        initial.client_id
          ? { id: initial.client_id, name: initial.cliente_nome, cnpj: initial.cnpj }
          : null,
      );
      setValorMensalidade(String(initial.valor_mensalidade));
      setPercentual(String(initial.percentual_nortear));
      setDataInicio(initial.data_inicio);
      setFidMeses(String(initial.fidelidade_meses ?? 12));
      const initModo: ModoContrato =
        initial.tipo_periodo === "enquanto_ativo"
          ? "enquanto_ativo"
          : initial.tipo_cobranca === "anual"
          ? "anual"
          : "mensal_fidelidade";
      setModo(initModo);
      setNotificar(initial.notificar_vencimento);
      setObservacoes(initial.observacoes ?? "");
    } else {
      setClient(null);
      setValorMensalidade("0");
      setPercentual("40");
      setDataInicio(ymdFirst(new Date()));
      setFidMeses("12");
      setModo("mensal_fidelidade");
      setNotificar(true);
      setObservacoes("");
      void aplicarPercentualPonto();
    }
  }, [open, initial]);

  // Quando muda para anual, força fidelidade 12
  useEffect(() => {
    if (modo === "anual") setFidMeses("12");
  }, [modo]);

  const valorMensalNum = Number(valorMensalidade || 0);
  const percentualNum = Number(percentual || 0);
  const valorNorteaMensal = Math.round(valorMensalNum * (percentualNum / 100) * 100) / 100;
  // Para anual, valor informado JÁ é o valor total do ano (não multiplica por 12)
  const valorAnual = valorMensalNum;
  const valorNorteaAnual = Math.round(valorAnual * (percentualNum / 100) * 100) / 100;

  const meses = useMemo(() => {
    const m = Number(fidMeses || 0);
    if (!dataInicio || !m) return [] as { key: string; label: string }[];
    const start = startOfMonth(new Date(dataInicio + "T00:00:00"));
    return Array.from({ length: m }).map((_, i) => {
      const d = addMonths(start, i);
      return {
        key: format(d, "yyyy-MM"),
        label: format(d, "LLL/yy", { locale: ptBR }).replace(/^./, (c) => c.toUpperCase()),
      };
    });
  }, [dataInicio, fidMeses]);

  const vencimentoCalc = useMemo(() => {
    const m = Number(fidMeses || 0);
    if (!dataInicio || !m) return null;
    const start = startOfMonth(new Date(dataInicio + "T00:00:00"));
    return format(
      new Date(addMonths(start, m).getTime() - 24 * 3600 * 1000),
      "dd/MM/yyyy",
    );
  }, [dataInicio, fidMeses]);

  const { data: configParceiro } = useQuery({
    queryKey: ["config-parceiro-rh", client?.id],
    enabled: !!client?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("configuracoes_parceiro")
        .select("percentual, tipo_repasse, ativo, parceiros(nome)")
        .eq("client_id", client!.id)
        .eq("produto", "rh_digital")
        .eq("ativo", true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const mutation = useMutation({

    mutationFn: async () => {
      if (!client) throw new Error("Selecione um cliente.");
      if (!dataInicio) throw new Error("Informe a data de início.");
      if (Number(valorMensalidade) <= 0)
        throw new Error("Valor da mensalidade deve ser maior que zero.");
      if (modo === "mensal_fidelidade" && !fidMeses)
        throw new Error("Selecione o período de fidelidade.");

      const userRes = await supabase.auth.getUser();
      const userId = userRes.data.user?.id ?? null;

      if (isEdit && initial) {
        const { error } = await supabase
          .from("contratos_rh_digital")
          .update({
            valor_mensalidade: Number(valorMensalidade),
            percentual_nortear: Number(percentual),
            notificar_vencimento: notificar,
            observacoes: observacoes.trim() || null,
            cliente_nome: client.razao_social || client.company || client.name,
            cnpj: client.cnpj,
            client_id: client.id,
          })
          .eq("id", initial.id);
        if (error) throw error;
      } else {
        const fidelidade_meses =
          modo === "enquanto_ativo" ? null : modo === "anual" ? 12 : Number(fidMeses);
        const { error } = await supabase.from("contratos_rh_digital").insert({
          client_id: client.id,
          cliente_nome: client.razao_social || client.company || client.name,
          cnpj: client.cnpj,
          valor_mensalidade: Number(valorMensalidade),
          percentual_nortear: Number(percentual),
          data_inicio: dataInicio,
          fidelidade_meses,
          tipo_cobranca: tipoCobranca,
          tipo_periodo: tipoPeriodo,
          notificar_vencimento: modo === "enquanto_ativo" ? false : notificar,
          observacoes: observacoes.trim() || null,
          ativo: true,
          created_by: userId,
        } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(
        isEdit
          ? "Contrato atualizado. Parcelas futuras pendentes foram sincronizadas."
          : modo === "anual"
          ? "Contrato anual criado e parcela única gerada."
          : modo === "enquanto_ativo"
          ? "Contrato criado. 12 parcelas iniciais geradas — novas parcelas são adicionadas todo mês."
          : `Contrato criado e ${meses.length} parcelas geradas.`,
      );
      qc.invalidateQueries({ queryKey: ["financeiro-rh-contratos"] });
      qc.invalidateQueries({ queryKey: ["financeiro-rh-parcelas"] });
      qc.invalidateQueries({ queryKey: ["contratos-rh-digital"] });
      qc.invalidateQueries({ queryKey: ["parcelas-rh-digital"] });
      qc.refetchQueries({ queryKey: ["financeiro-rh"] });
      qc.invalidateQueries({ queryKey: ["financeiro-ponto"] });
      qc.invalidateQueries({ queryKey: ["financeiro-fidelidade-alertas"] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao salvar"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar contrato RH Digital" : "Novo contrato RH Digital"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Apenas valor e percentual podem ser alterados. Parcelas pagas não serão afetadas."
              : modo === "anual"
              ? "Contrato anual — uma única parcela referente ao ano inteiro."
              : modo === "enquanto_ativo"
              ? "Contrato sem prazo — gera parcelas mensais enquanto estiver ativo."
              : "Contrato recorrente — as parcelas mensais são geradas automaticamente."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <Label>Cliente *</Label>
            <ClientCombobox value={client?.id ?? null} onSelect={handleClienteSelect} />
            {client && <ClientPreviewCard client={client} />}
          </div>

          {client && configParceiro && (configParceiro as any).parceiros && (
            <div className="flex items-start gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-sm">
              <Handshake className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              <div>
                <div className="font-medium">
                  Parceiro: {(configParceiro as any).parceiros.nome} —{" "}
                  {configParceiro.tipo_repasse === "primeira_mensalidade"
                    ? "1ª mensalidade"
                    : "recorrência"}{" "}
                  ({Number(configParceiro.percentual)}%)
                </div>
                <div className="text-xs text-muted-foreground">
                  Um repasse será gerado automaticamente ao confirmar o{" "}
                  {configParceiro.tipo_repasse === "primeira_mensalidade"
                    ? "primeiro pagamento"
                    : "pagamento de cada parcela"}.
                </div>
              </div>
            </div>
          )}
          {client && configParceiro === null && (
            <div className="rounded-md border border-dashed bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              Este cliente não possui parceiro vinculado para RH Digital. Configure em Financeiro → Parceiros se necessário.
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="valor-mensalidade-rh">
                {modo === "anual" ? "Valor anual (R$) *" : "Mensalidade (R$) *"}
              </Label>
              <Input
                id="valor-mensalidade-rh"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={valorMensalidade}
                onChange={(e) => setValorMensalidade(e.target.value)}
              />
              {modo === "anual" && (
                <p className="text-[11px] text-muted-foreground">
                  Valor total pago pelo cliente no ano.
                </p>
              )}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="perc-rh">% Nortear *</Label>
              <Input
                id="perc-rh"
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
                  {Number(percentual) === padraoPonto ? "(padrão global)" : "(exceção)"}
                </p>
              )}
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label>Tipo de cobrança *</Label>
            <Select
              value={modo}
              onValueChange={(v) => setModo(v as ModoContrato)}
              disabled={isEdit}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mensal_fidelidade">
                  Mensal com fidelidade — gera parcelas durante o período
                </SelectItem>
                <SelectItem value="enquanto_ativo">
                  Mensal (enquanto ativo) — sem prazo, renova todo mês
                </SelectItem>
                <SelectItem value="anual">Anual — pagamento único anual</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {modo === "mensal_fidelidade" && (
            <div className="rounded-md border bg-primary/5 px-4 py-3 text-center">
              <div className="text-xs text-muted-foreground">Valor mensal Nortear</div>
              <div className="text-xl font-semibold tabular-nums">
                = {BRL.format(valorNorteaMensal)} / mês
              </div>
            </div>
          )}

          {modo === "enquanto_ativo" && (
            <div className="rounded-md border border-sky-500/30 bg-sky-500/5 px-4 py-3">
              <div className="flex items-center justify-center gap-2 text-sm font-medium text-sky-600">
                <InfinityIcon className="h-4 w-4" />
                Contrato sem prazo definido
              </div>
              <div className="mt-2 text-center text-sm">
                <strong className="tabular-nums">{BRL.format(valorNorteaMensal)}</strong>{" "}
                <span className="text-muted-foreground">/ mês para a Nortear</span>
              </div>
              <p className="mt-2 text-center text-[11px] text-muted-foreground">
                Válido até cancelamento manual. As 12 primeiras parcelas são geradas agora e novas
                parcelas são adicionadas automaticamente todo mês.
              </p>
            </div>
          )}

          {modo === "anual" && (
            <div className="rounded-md border bg-purple-500/5 px-4 py-3 text-center">
              <div className="text-xs font-medium text-purple-600">Contrato anual — pagamento único</div>
              <div className="mt-2 text-base">
                <strong>1 parcela única</strong> de{" "}
                <strong className="tabular-nums">{BRL.format(valorAnual)}</strong>
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                Valor Nortear:{" "}
                <span className="tabular-nums text-foreground">{BRL.format(valorNorteaAnual)}</span>{" "}
                ({percentualNum}%)
              </div>
              {dataInicio && vencimentoCalc && (
                <div className="mt-1 text-xs text-muted-foreground">
                  Período: {format(new Date(dataInicio + "T00:00:00"), "MM/yyyy")} a {vencimentoCalc.slice(3)}
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="data-inicio-rh">Data de início *</Label>
              <Input
                id="data-inicio-rh"
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                disabled={isEdit}
              />
            </div>
            {modo === "mensal_fidelidade" ? (
              <div className="grid gap-1.5">
                <Label>Período de fidelidade *</Label>
                <Select value={fidMeses} onValueChange={setFidMeses} disabled={isEdit}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="6">6 meses</SelectItem>
                    <SelectItem value="12">12 meses</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : modo === "anual" ? (
              <div className="grid gap-1.5">
                <Label>Fidelidade</Label>
                <div className="flex h-10 items-center rounded-md border bg-muted/40 px-3 text-sm text-muted-foreground">
                  12 meses (anual)
                </div>
              </div>
            ) : (
              <div className="grid gap-1.5">
                <Label>Fidelidade</Label>
                <div className="flex h-10 items-center gap-1.5 rounded-md border bg-muted/40 px-3 text-sm text-muted-foreground">
                  <InfinityIcon className="h-3.5 w-3.5" /> Sem vencimento
                </div>
              </div>
            )}
          </div>

          {modo === "mensal_fidelidade" && vencimentoCalc && (
            <div className="text-sm">
              Vencimento da fidelidade:{" "}
              <span className="font-medium">{vencimentoCalc}</span>
            </div>
          )}

          {!isEdit && modo === "mensal_fidelidade" && meses.length > 0 && (
            <div className="rounded-md border p-3 text-sm">
              <div className="mb-1 font-medium">
                Serão geradas {meses.length} parcelas:
              </div>
              <div className="text-muted-foreground">
                {meses[0].label} a {meses[meses.length - 1].label}
              </div>
            </div>
          )}

          {modo !== "enquanto_ativo" && (
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={notificar}
                onCheckedChange={(v) => setNotificar(v === true)}
              />
              Notificar 30 dias antes do vencimento da fidelidade
            </label>
          )}

          <div className="grid gap-1.5">
            <Label htmlFor="obs-rh">Observações</Label>
            <Textarea
              id="obs-rh"
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
            {isEdit
              ? "Salvar alterações"
              : modo === "anual"
              ? "Criar contrato anual"
              : modo === "enquanto_ativo"
              ? "Criar contrato sem prazo"
              : "Criar contrato e gerar parcelas"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
