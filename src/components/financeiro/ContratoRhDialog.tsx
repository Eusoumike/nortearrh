import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { addMonths, format, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
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

import { ClientCombobox, ClientOption } from "./ClientCombobox";
import { BRL, ymdFirst } from "./financeiroUtils";
import { supabase } from "@/integrations/supabase/client";

export type TipoCobrancaRh = "mensal" | "anual";

export type ContratoRh = {
  id: string;
  client_id: string | null;
  cliente_nome: string;
  cnpj: string | null;
  valor_mensalidade: number;
  percentual_nortear: number;
  data_inicio: string;
  fidelidade_meses: number;
  notificar_vencimento: boolean;
  observacoes: string | null;
  tipo_cobranca?: TipoCobrancaRh;
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
  const [tipoCobranca, setTipoCobranca] = useState<TipoCobrancaRh>("mensal");
  const [notificar, setNotificar] = useState(true);
  const [observacoes, setObservacoes] = useState<string>("");
  const percentualRequestRef = useRef(0);

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
      setFidMeses(String(initial.fidelidade_meses));
      setTipoCobranca(initial.tipo_cobranca ?? "mensal");
      setNotificar(initial.notificar_vencimento);
      setObservacoes(initial.observacoes ?? "");
    } else {
      setClient(null);
      setValorMensalidade("0");
      setPercentual("40");
      setDataInicio(ymdFirst(new Date()));
      setFidMeses("12");
      setTipoCobranca("mensal");
      setNotificar(true);
      setObservacoes("");
      void aplicarPercentualPonto(null);
    }
  }, [open, initial]);

  // Quando muda para anual, força fidelidade 12
  useEffect(() => {
    if (tipoCobranca === "anual") setFidMeses("12");
  }, [tipoCobranca]);

  const valorMensalNum = Number(valorMensalidade || 0);
  const percentualNum = Number(percentual || 0);
  const valorNorteaMensal = Math.round(valorMensalNum * (percentualNum / 100) * 100) / 100;
  const valorAnual = Math.round(valorMensalNum * 12 * 100) / 100;
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

  const mutation = useMutation({
    mutationFn: async () => {
      if (!client) throw new Error("Selecione um cliente.");
      if (!dataInicio) throw new Error("Informe a data de início.");
      if (Number(valorMensalidade) <= 0)
        throw new Error("Valor da mensalidade deve ser maior que zero.");
      if (!fidMeses) throw new Error("Selecione o período de fidelidade.");

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
            cliente_nome: client.name,
            cnpj: client.cnpj,
            client_id: client.id,
          })
          .eq("id", initial.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("contratos_rh_digital").insert({
          client_id: client.id,
          cliente_nome: client.name,
          cnpj: client.cnpj,
          valor_mensalidade: Number(valorMensalidade),
          percentual_nortear: Number(percentual),
          data_inicio: dataInicio,
          fidelidade_meses: tipoCobranca === "anual" ? 12 : Number(fidMeses),
          tipo_cobranca: tipoCobranca,
          notificar_vencimento: notificar,
          observacoes: observacoes.trim() || null,
          ativo: true,
          created_by: userId,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(
        isEdit
          ? "Contrato atualizado. Parcelas futuras pendentes foram sincronizadas."
          : tipoCobranca === "anual"
          ? "Contrato anual criado e parcela única gerada."
          : `Contrato criado e ${meses.length} parcelas geradas.`,
      );
      qc.invalidateQueries({ queryKey: ["financeiro-rh-contratos"] });
      qc.invalidateQueries({ queryKey: ["financeiro-rh-parcelas"] });
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
              : tipoCobranca === "anual"
              ? "Contrato anual — uma única parcela referente ao ano inteiro."
              : "Contrato recorrente — as parcelas mensais são geradas automaticamente."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <Label>Cliente *</Label>
            <ClientCombobox value={client?.id ?? null} onSelect={handleClienteSelect} />
            {client?.cnpj && (
              <p className="text-xs text-muted-foreground">CNPJ: {client.cnpj}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="valor-mensalidade-rh">Mensalidade (R$) *</Label>
              <Input
                id="valor-mensalidade-rh"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={valorMensalidade}
                onChange={(e) => setValorMensalidade(e.target.value)}
              />
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
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label>Tipo de cobrança *</Label>
            <Select
              value={tipoCobranca}
              onValueChange={(v) => setTipoCobranca(v as TipoCobrancaRh)}
              disabled={isEdit}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mensal">Mensal — gera parcelas todo mês</SelectItem>
                <SelectItem value="anual">Anual — pagamento único anual</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {tipoCobranca === "mensal" ? (
            <div className="rounded-md border bg-primary/5 px-4 py-3 text-center">
              <div className="text-xs text-muted-foreground">Valor mensal Nortear</div>
              <div className="text-xl font-semibold tabular-nums">
                = {BRL.format(valorNorteaMensal)} / mês
              </div>
            </div>
          ) : (
            <div className="rounded-md border bg-purple-500/5 px-4 py-3 text-center">
              <div className="text-xs font-medium text-purple-600">Contrato anual — pagamento único</div>
              <div className="mt-1 text-xl font-semibold tabular-nums">
                Valor total: {BRL.format(valorAnual)}
              </div>
              <div className="text-xs text-muted-foreground">
                ({BRL.format(valorMensalNum)} × 12 meses)
              </div>
              <div className="mt-2 text-sm">
                Será gerada <strong>1 parcela</strong> de{" "}
                <strong className="tabular-nums">{BRL.format(valorAnual)}</strong>
                {dataInicio && vencimentoCalc && (
                  <> referente ao período {format(new Date(dataInicio + "T00:00:00"), "MM/yyyy")} a {vencimentoCalc.slice(3)}</>
                )}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                Comissão Nortear: {BRL.format(valorNorteaAnual)}
              </div>
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
            {tipoCobranca === "mensal" ? (
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
            ) : (
              <div className="grid gap-1.5">
                <Label>Fidelidade</Label>
                <div className="flex h-10 items-center rounded-md border bg-muted/40 px-3 text-sm text-muted-foreground">
                  12 meses (anual)
                </div>
              </div>
            )}
          </div>

          {vencimentoCalc && (
            <div className="text-sm">
              Vencimento da fidelidade:{" "}
              <span className="font-medium">{vencimentoCalc}</span>
            </div>
          )}

          {!isEdit && tipoCobranca === "mensal" && meses.length > 0 && (
            <div className="rounded-md border p-3 text-sm">
              <div className="mb-1 font-medium">
                Serão geradas {meses.length} parcelas:
              </div>
              <div className="text-muted-foreground">
                {meses[0].label} a {meses[meses.length - 1].label}
              </div>
            </div>
          )}

          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={notificar}
              onCheckedChange={(v) => setNotificar(v === true)}
            />
            Notificar 30 dias antes do vencimento da fidelidade
          </label>

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
              : tipoCobranca === "anual"
              ? "Criar contrato anual"
              : "Criar contrato e gerar parcelas"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
