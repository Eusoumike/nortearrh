import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, startOfMonth } from "date-fns";
import { AlertTriangle, CalendarIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type Produto = "vr_primeira_carga" | "vr_recorrencia" | "ponto";

const LABEL: Record<Produto, string> = {
  vr_primeira_carga: "VR — Primeira Carga",
  vr_recorrencia: "VR — Recorrência",
  ponto: "RH Digital",
};

export function ComissoesPadraoSection() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [primeira, setPrimeira] = useState("17.5");
  const [recorrencia, setRecorrencia] = useState("17.5");
  const [ponto, setPonto] = useState("40");

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [vigencia, setVigencia] = useState<Date>(startOfMonth(new Date()));
  const [pendingChanges, setPendingChanges] = useState<
    { produto: Produto; anterior: number; novo: number }[]
  >([]);

  const { data, isLoading } = useQuery({
    queryKey: ["system-settings-comissoes"],
    queryFn: async () => {
      const { data } = await supabase
        .from("system_settings")
        .select("id, percentual_vr_primeira_carga, percentual_vr_recorrencia, percentual_ponto")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  // Conta clientes com configuração individual ativa
  const { data: individuaisCount = 0 } = useQuery({
    queryKey: ["config-comissoes-count"],
    queryFn: async () => {
      const { count } = await supabase
        .from("config_comissoes")
        .select("id", { count: "exact", head: true });
      return count ?? 0;
    },
  });

  useEffect(() => {
    if (data) {
      setPrimeira(String(data.percentual_vr_primeira_carga ?? 17.5));
      setRecorrencia(String(data.percentual_vr_recorrencia ?? 17.5));
      setPonto(String(data.percentual_ponto ?? 40));
    }
  }, [data]);

  const detectChanges = (): { produto: Produto; anterior: number; novo: number }[] => {
    const changes: { produto: Produto; anterior: number; novo: number }[] = [];
    const cur = {
      vr_primeira_carga: Number(data?.percentual_vr_primeira_carga ?? 17.5),
      vr_recorrencia: Number(data?.percentual_vr_recorrencia ?? 17.5),
      ponto: Number(data?.percentual_ponto ?? 40),
    };
    const next = {
      vr_primeira_carga: Number(primeira),
      vr_recorrencia: Number(recorrencia),
      ponto: Number(ponto),
    };
    (Object.keys(next) as Produto[]).forEach((p) => {
      if (next[p] !== cur[p] && Number.isFinite(next[p])) {
        changes.push({ produto: p, anterior: cur[p], novo: next[p] });
      }
    });
    return changes;
  };

  const onClickSalvar = () => {
    const changes = detectChanges();
    if (changes.length === 0) {
      toast.info("Nenhuma alteração para salvar");
      return;
    }
    setPendingChanges(changes);
    setVigencia(startOfMonth(new Date()));
    setConfirmOpen(true);
  };

  const confirmar = useMutation({
    mutationFn: async () => {
      const vigenciaYmd = format(vigencia, "yyyy-MM-dd");
      const hojeFirst = startOfMonth(new Date());
      const retroativo = vigencia < hojeFirst;

      // 1) Salvar system_settings
      const payload = {
        ...(data?.id ? { id: data.id } : {}),
        percentual_vr_primeira_carga: Number(primeira),
        percentual_vr_recorrencia: Number(recorrencia),
        percentual_ponto: Number(ponto),
        updated_by: user?.id,
      };
      const { error } = await supabase.from("system_settings").upsert(payload);
      if (error) throw error;

      // 2) Histórico (uma linha por produto alterado)
      const histRows = pendingChanges.map((c) => ({
        client_id: null,
        cliente_nome: null,
        produto: c.produto,
        percentual_anterior: c.anterior,
        percentual_novo: c.novo,
        data_alteracao: format(new Date(), "yyyy-MM-dd"),
        vigencia_a_partir: vigenciaYmd,
        retroativo,
        alterado_por: user?.email ?? null,
        alterado_por_id: user?.id ?? null,
        motivo: "Alteração global em Configurações",
      }));
      if (histRows.length > 0) {
        const { error: hErr } = await supabase.from("historico_comissoes").insert(histRows);
        if (hErr) throw hErr;
      }

      // 3) Atualizar registros pendentes >= vigência
      for (const c of pendingChanges) {
        if (c.produto === "ponto") {
          // Atualiza parcelas pendentes
          const { data: parcelas } = await supabase
            .from("parcelas_rh_digital")
            .select("id, valor_mensalidade")
            .eq("status", "pendente")
            .gte("competencia", vigenciaYmd);
          for (const p of parcelas ?? []) {
            const novoValor = Math.round(Number(p.valor_mensalidade) * c.novo) / 100;
            await supabase
              .from("parcelas_rh_digital")
              .update({ percentual_nortear: c.novo, valor_nortear: novoValor })
              .eq("id", p.id);
          }
          // Atualiza contratos ativos para que próximas parcelas usem o novo %
          await supabase
            .from("contratos_rh_digital")
            .update({ percentual_nortear: c.novo })
            .eq("ativo", true);
        } else {
          // VR: lançamentos por tipo, a partir da vigência
          const tipoFiltro = c.produto === "vr_primeira_carga" ? "primeira_carga" : "recorrencia";
          await supabase
            .from("lancamentos_vr")
            .update({ percentual_comissao: c.novo })
            .eq("tipo", tipoFiltro)
            .gte("competencia", vigenciaYmd);
        }
      }
    },
    onSuccess: () => {
      toast.success("Comissões padrão atualizadas com sucesso!");
      qc.invalidateQueries({ queryKey: ["system-settings-comissoes"] });
      qc.invalidateQueries({ queryKey: ["system-settings"] });
      qc.invalidateQueries({ queryKey: ["financeiro-vr"] });
      qc.invalidateQueries({ queryKey: ["financeiro-rh-parcelas"] });
      qc.invalidateQueries({ queryKey: ["financeiro-rh-contratos"] });
      qc.invalidateQueries({ queryKey: ["historico-comissoes"] });
      setConfirmOpen(false);
      setPendingChanges([]);
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao salvar"),
  });

  const migrarIndividuais = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("config_comissoes")
        .delete()
        .not("id", "is", null);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Configurações individuais removidas — todos usarão o padrão global.");
      qc.invalidateQueries({ queryKey: ["config-comissoes-count"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao migrar"),
  });

  const isRetroativo = useMemo(() => vigencia < startOfMonth(new Date()), [vigencia]);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Comissões padrão</CardTitle>
          <CardDescription>
            Percentuais aplicados globalmente a todos os clientes. Alterações afetam apenas
            lançamentos pendentes a partir da vigência informada.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {individuaisCount > 0 && (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-600" />
                <div className="flex-1">
                  <p className="font-medium text-amber-700 dark:text-amber-400">
                    Existem {individuaisCount} cliente(s) com % configurado individualmente.
                  </p>
                  <p className="mt-1 text-xs text-amber-700/90 dark:text-amber-400/90">
                    Deseja migrar todos para o padrão global? Isso removerá as configurações
                    individuais.
                  </p>
                  <div className="mt-2 flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => migrarIndividuais.mutate()}
                      disabled={migrarIndividuais.isPending}
                    >
                      {migrarIndividuais.isPending && (
                        <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                      )}
                      Migrar para global
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : (
            <>
              <div>
                <h4 className="mb-2 text-sm font-semibold text-muted-foreground">RH Digital</h4>
                <div className="grid gap-1.5 max-w-xs">
                  <Label htmlFor="pct-ponto">% Canal Nortear</Label>
                  <Input
                    id="pct-ponto"
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={ponto}
                    onChange={(e) => setPonto(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <h4 className="mb-2 text-sm font-semibold text-muted-foreground">VR Benefícios</h4>
                <div className="grid gap-4 md:grid-cols-2 max-w-xl">
                  <div className="grid gap-1.5">
                    <Label htmlFor="pct-vr-primeira">% Primeira Carga</Label>
                    <Input
                      id="pct-vr-primeira"
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={primeira}
                      onChange={(e) => setPrimeira(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="pct-vr-rec">% Recorrência</Label>
                    <Input
                      id="pct-vr-rec"
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={recorrencia}
                      onChange={(e) => setRecorrencia(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div>
                <Button onClick={onClickSalvar} disabled={confirmar.isPending}>
                  Salvar comissões
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar alteração de comissões</DialogTitle>
            <DialogDescription>
              {pendingChanges.length === 1
                ? "1 percentual será alterado."
                : `${pendingChanges.length} percentuais serão alterados.`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="rounded-md border bg-muted/40 p-3 text-sm">
              {pendingChanges.map((c) => (
                <div key={c.produto} className="flex justify-between py-0.5">
                  <span>{LABEL[c.produto]}</span>
                  <span className="tabular-nums">
                    {c.anterior.toFixed(2).replace(".", ",")}% →{" "}
                    <strong>{c.novo.toFixed(2).replace(".", ",")}%</strong>
                  </span>
                </div>
              ))}
            </div>

            <div className="grid gap-1.5">
              <Label>Vigência a partir de</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(vigencia, "dd/MM/yyyy")}
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
                ⚠ Lançamentos anteriores a essa data não serão alterados.
              </p>
            </div>

            {isRetroativo && (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
                Você selecionou uma data no passado — alterações afetarão lançamentos já existentes.
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => confirmar.mutate()} disabled={confirmar.isPending}>
              {confirmar.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
