import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, startOfMonth } from "date-fns";
import { AlertTriangle, CalendarIcon, Loader2 } from "lucide-react";
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
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ymdFirst } from "./financeiroUtils";

type Produto = "vr_primeira_carga" | "vr_recorrencia" | "ponto";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  clientId: string;
  clienteNome: string;
  produto: Produto; // determina qual coluna atualizar
  produtoLabel: string; // "VR" ou "Ponto"
  percentualAtual: number | null;
}

export function EditarPercentualDialog({
  open,
  onOpenChange,
  clientId,
  clienteNome,
  produto,
  produtoLabel,
  percentualAtual,
}: Props) {
  const qc = useQueryClient();
  const { user } = useAuth();

  const hojeFirst = useMemo(() => startOfMonth(new Date()), []);
  const [perc, setPerc] = useState<string>("");
  const [vigencia, setVigencia] = useState<Date>(hojeFirst);
  const [motivo, setMotivo] = useState("");
  const [confirmRetro, setConfirmRetro] = useState(false);

  useEffect(() => {
    if (open) {
      setPerc(percentualAtual != null ? String(percentualAtual) : "");
      setVigencia(hojeFirst);
      setMotivo("");
      setConfirmRetro(false);
    }
  }, [open, percentualAtual, hojeFirst]);

  const vigenciaYmd = ymdFirst(vigencia);
  const isRetroativo = vigencia < hojeFirst;
  const isFuturo = vigencia > hojeFirst;

  // Preview de impacto: contar parcelas/lançamentos pendentes a partir da vigência
  const { data: preview } = useQuery({
    queryKey: ["preview-impacto-perc", clientId, produto, vigenciaYmd],
    enabled: open,
    queryFn: async () => {
      if (produto === "ponto") {
        const { data, error } = await supabase
          .from("parcelas_rh_digital")
          .select("competencia")
          .eq("client_id", clientId)
          .eq("status", "pendente")
          .gte("competencia", vigenciaYmd)
          .order("competencia", { ascending: true });
        if (error) throw error;
        return {
          total: data?.length ?? 0,
          de: data?.[0]?.competencia ?? null,
          ate: data?.[data.length - 1]?.competencia ?? null,
        };
      } else {
        const { data, error } = await supabase
          .from("lancamentos_vr")
          .select("competencia")
          .eq("client_id", clientId)
          .gte("competencia", vigenciaYmd)
          .order("competencia", { ascending: true });
        if (error) throw error;
        return {
          total: data?.length ?? 0,
          de: data?.[0]?.competencia ?? null,
          ate: data?.[data.length - 1]?.competencia ?? null,
        };
      }
    },
  });

  const salvar = useMutation({
    mutationFn: async () => {
      const valor = Number(perc);
      if (!Number.isFinite(valor) || valor < 0 || valor > 100) {
        throw new Error("Informe um percentual entre 0 e 100");
      }

      // 1) upsert config_comissoes
      const existing = await supabase
        .from("config_comissoes")
        .select("id, percentual_vr_primeira_carga, percentual_vr_recorrencia, percentual_ponto")
        .eq("client_id", clientId)
        .maybeSingle();
      if (existing.error) throw existing.error;

      const upd: {
        percentual_ponto?: number;
        percentual_vr_recorrencia?: number;
        percentual_vr_primeira_carga?: number;
      } = {};
      if (produto === "ponto") upd.percentual_ponto = valor;
      if (produto === "vr_recorrencia") upd.percentual_vr_recorrencia = valor;
      if (produto === "vr_primeira_carga") upd.percentual_vr_primeira_carga = valor;

      if (existing.data?.id) {
        const { error } = await supabase
          .from("config_comissoes")
          .update(upd)
          .eq("id", existing.data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("config_comissoes").insert({
          client_id: clientId,
          percentual_ponto: produto === "ponto" ? valor : 40,
          percentual_vr_recorrencia: produto === "vr_recorrencia" ? valor : 17.5,
          percentual_vr_primeira_carga: produto === "vr_primeira_carga" ? valor : 17.5,
        });
        if (error) throw error;
      }

      // 2) Atualizar APENAS registros futuros (>= vigência) e pendentes
      if (produto === "ponto") {
        // Atualizar contratos ativos (para refletir % atual exibido)
        const contratos = await supabase
          .from("contratos_rh_digital")
          .select("id")
          .eq("client_id", clientId)
          .eq("ativo", true);
        if (contratos.error) throw contratos.error;
        const ids = (contratos.data ?? []).map((c) => c.id);

        // Atualiza parcelas pendentes a partir da vigência (não toca em pagas nem passadas)
        const { error: pErr } = await supabase
          .from("parcelas_rh_digital")
          .update({
            percentual_nortear: valor,
          })
          .eq("client_id", clientId)
          .eq("status", "pendente")
          .gte("competencia", vigenciaYmd);
        if (pErr) throw pErr;

        // Recalcular valor_nortear das parcelas afetadas
        const { data: parcelas, error: lErr } = await supabase
          .from("parcelas_rh_digital")
          .select("id, valor_mensalidade")
          .eq("client_id", clientId)
          .eq("status", "pendente")
          .gte("competencia", vigenciaYmd);
        if (lErr) throw lErr;
        for (const p of parcelas ?? []) {
          const novoValor = Math.round(Number(p.valor_mensalidade) * valor) / 100;
          await supabase
            .from("parcelas_rh_digital")
            .update({ valor_nortear: novoValor })
            .eq("id", p.id);
        }

        // Atualiza % nos contratos ativos (para próximas parcelas geradas)
        if (ids.length > 0) {
          await supabase
            .from("contratos_rh_digital")
            .update({ percentual_nortear: valor })
            .in("id", ids);
        }
      } else {
        // VR: atualiza lançamentos a partir da vigência (não toca em meses anteriores)
        const { error: vErr } = await supabase
          .from("lancamentos_vr")
          .update({ percentual_comissao: valor })
          .eq("client_id", clientId)
          .gte("competencia", vigenciaYmd);
        if (vErr) throw vErr;
      }

      // 3) Registrar no histórico
      const { error: hErr } = await supabase.from("historico_comissoes").insert({
        client_id: clientId,
        cliente_nome: clienteNome,
        produto,
        percentual_anterior: percentualAtual,
        percentual_novo: valor,
        data_alteracao: format(new Date(), "yyyy-MM-dd"),
        vigencia_a_partir: vigenciaYmd,
        retroativo: isRetroativo,
        alterado_por: user?.email ?? null,
        alterado_por_id: user?.id ?? null,
        motivo: motivo.trim() || null,
      });
      if (hErr) throw hErr;
    },
    onSuccess: () => {
      toast.success(`% atualizado com vigência a partir de ${format(vigencia, "dd/MM/yyyy")}`);
      qc.invalidateQueries({ queryKey: ["financeiro-fidelidades-todos"] });
      qc.invalidateQueries({ queryKey: ["financeiro-rh-contratos"] });
      qc.invalidateQueries({ queryKey: ["financeiro-rh-parcelas"] });
      qc.invalidateQueries({ queryKey: ["financeiro-vr"] });
      qc.invalidateQueries({ queryKey: ["historico-comissoes"] });
      qc.invalidateQueries({ queryKey: ["historico-cliente", clientId] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao salvar"),
  });

  const handleSalvar = () => {
    if (isRetroativo && !confirmRetro) {
      toast.error("Confirme a alteração retroativa antes de salvar");
      return;
    }
    salvar.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar % {produtoLabel} — {clienteNome}</DialogTitle>
          <DialogDescription>
            Alterações valem da data de vigência em diante. Lançamentos anteriores não são afetados.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="ed-perc">% atual</Label>
            <Input
              id="ed-perc"
              type="number"
              step="0.01"
              min="0"
              max="100"
              value={perc}
              onChange={(e) => setPerc(e.target.value)}
            />
          </div>

          <div className="grid gap-1.5">
            <Label>Vigência a partir de</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn("justify-start text-left font-normal", !vigencia && "text-muted-foreground")}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {vigencia ? format(vigencia, "dd/MM/yyyy") : "Selecionar"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={vigencia}
                  onSelect={(d) => d && setVigencia(startOfMonth(d))}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
            <p className="text-xs text-muted-foreground">
              Alterações não afetam lançamentos anteriores a esta data.
            </p>
          </div>

          {isRetroativo && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 text-destructive" />
                <div className="flex-1">
                  <p className="font-medium text-destructive">
                    ⚠ Você está selecionando uma data no passado.
                  </p>
                  <p className="mt-1 text-xs text-destructive/90">
                    Isso pode afetar lançamentos já existentes. Tem certeza?
                  </p>
                  <label className="mt-2 flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={confirmRetro}
                      onChange={(e) => setConfirmRetro(e.target.checked)}
                    />
                    Sim, confirmo a alteração retroativa
                  </label>
                </div>
              </div>
            </div>
          )}

          {isFuturo && (
            <div className="rounded-md border border-blue-500/40 bg-blue-500/10 p-2 text-xs text-blue-700 dark:text-blue-300">
              Vigência futura — alterações entrarão em vigor a partir de {format(vigencia, "dd/MM/yyyy")}.
            </div>
          )}

          <div className="grid gap-1.5">
            <Label htmlFor="ed-motivo">Motivo da alteração (opcional)</Label>
            <Textarea
              id="ed-motivo"
              placeholder="Ex.: Reclassificação semestral, Negociação comercial"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={2}
            />
          </div>

          {preview && (
            <div className="rounded-md border bg-muted/40 p-3 text-sm">
              <p className="font-medium">Preview do impacto</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {preview.total === 0
                  ? "Nenhum lançamento futuro será afetado."
                  : `${preview.total} ${produto === "ponto" ? "parcela(s) pendente(s)" : "lançamento(s) VR"} ${
                      preview.total === 1 ? "será atualizado" : "serão atualizados"
                    } (de ${formatCompFromYmd(preview.de)} a ${formatCompFromYmd(preview.ate)}).`}
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={salvar.isPending}>
            Cancelar
          </Button>
          <Button onClick={handleSalvar} disabled={salvar.isPending || (isRetroativo && !confirmRetro)}>
            {salvar.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar alteração
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function formatCompFromYmd(ymd: string | null) {
  if (!ymd) return "—";
  const [y, m] = ymd.split("-");
  return `${m}/${y}`;
}
