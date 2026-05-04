import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { History, Loader2 } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { formatBRDate, vencimentoTone } from "./financeiroUtils";
import { EditarPercentualDialog } from "./EditarPercentualDialog";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onRenovarVR?: (clientId: string) => void;
  onRenovarPonto?: (clientId: string) => void;
}

type Item = {
  client_id: string;
  cliente_nome: string;
  produtos: Set<"VR" | "Ponto">;
  vencimentoVR: string | null;
  vencimentoPonto: string | null;
  percVR: number | null;
  percPonto: number | null;
};

export function GerenciarFidelidadesDialog({
  open,
  onOpenChange,
  onRenovarVR,
  onRenovarPonto,
}: Props) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<{
    clientId: string;
    clienteNome: string;
    produto: "vr_recorrencia" | "ponto";
    produtoLabel: string;
    perc: number | null;
  } | null>(null);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["financeiro-fidelidades-todos"],
    enabled: open,
    queryFn: async () => {
      const [vrRes, contRes, cfgRes] = await Promise.all([
        supabase
          .from("lancamentos_vr")
          .select("client_id, cliente_nome, fidelidade_vencimento, percentual_comissao")
          .not("client_id", "is", null)
          .order("fidelidade_vencimento", { ascending: true }),
        supabase
          .from("contratos_rh_digital")
          .select("client_id, cliente_nome, fidelidade_vencimento, percentual_nortear, ativo")
          .eq("ativo", true)
          .not("client_id", "is", null),
        supabase
          .from("config_comissoes")
          .select("client_id, percentual_vr_recorrencia, percentual_ponto"),
      ]);
      if (vrRes.error) throw vrRes.error;
      if (contRes.error) throw contRes.error;
      if (cfgRes.error) throw cfgRes.error;

      const cfgMap = new Map<string, { percVR: number; percPonto: number }>();
      for (const c of cfgRes.data ?? []) {
        cfgMap.set(c.client_id, {
          percVR: Number(c.percentual_vr_recorrencia),
          percPonto: Number(c.percentual_ponto),
        });
      }

      const map = new Map<string, Item>();
      const ensure = (id: string, nome: string) => {
        let it = map.get(id);
        if (!it) {
          it = {
            client_id: id,
            cliente_nome: nome,
            produtos: new Set(),
            vencimentoVR: null,
            vencimentoPonto: null,
            percVR: cfgMap.get(id)?.percVR ?? null,
            percPonto: cfgMap.get(id)?.percPonto ?? null,
          };
          map.set(id, it);
        }
        return it;
      };
      for (const r of vrRes.data ?? []) {
        const it = ensure(r.client_id as string, r.cliente_nome);
        it.produtos.add("VR");
        if (
          !it.vencimentoVR ||
          (r.fidelidade_vencimento && r.fidelidade_vencimento > it.vencimentoVR)
        ) {
          it.vencimentoVR = r.fidelidade_vencimento;
        }
        if (it.percVR == null) it.percVR = Number(r.percentual_comissao);
      }
      for (const r of contRes.data ?? []) {
        const it = ensure(r.client_id as string, r.cliente_nome);
        it.produtos.add("Ponto");
        it.vencimentoPonto = r.fidelidade_vencimento;
        if (it.percPonto == null) it.percPonto = Number(r.percentual_nortear);
      }
      return Array.from(map.values()).sort((a, b) =>
        a.cliente_nome.localeCompare(b.cliente_nome),
      );
    },
  });

  // Padrões globais em system_settings
  const { data: padroes } = useQuery({
    queryKey: ["financeiro-padroes-globais"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_settings")
        .select("id, percentual_vr_primeira_carga, percentual_vr_recorrencia, percentual_ponto")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const [pVrPrim, setPVrPrim] = useState("17.5");
  const [pVrRec, setPVrRec] = useState("17.5");
  const [pPonto, setPPonto] = useState("40");

  useEffect(() => {
    if (padroes) {
      setPVrPrim(String(padroes.percentual_vr_primeira_carga ?? 17.5));
      setPVrRec(String(padroes.percentual_vr_recorrencia ?? 17.5));
      setPPonto(String(padroes.percentual_ponto ?? 40));
    }
  }, [padroes]);

  const salvarPadroes = useMutation({
    mutationFn: async () => {
      const payload = {
        percentual_vr_primeira_carga: Number(pVrPrim),
        percentual_vr_recorrencia: Number(pVrRec),
        percentual_ponto: Number(pPonto),
      };
      if (padroes?.id) {
        const { error } = await supabase
          .from("system_settings")
          .update(payload)
          .eq("id", padroes.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("system_settings").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Percentuais padrão atualizados");
      qc.invalidateQueries({ queryKey: ["financeiro-padroes-globais"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao salvar"),
  });

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Gerenciar fidelidades</DialogTitle>
            <DialogDescription>
              Visualize todos os clientes com fidelidade ativa e ajuste percentuais.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3">
            {isLoading ? (
              <div className="flex h-32 items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : items.length === 0 ? (
              <p className="rounded border border-dashed p-6 text-center text-sm text-muted-foreground">
                Nenhum cliente com fidelidade configurada.
              </p>
            ) : (
              items.map((it) => (
                <ClienteFidRow
                  key={it.client_id}
                  item={it}
                  onEditar={(produto, produtoLabel, perc) =>
                    setEditing({
                      clientId: it.client_id,
                      clienteNome: it.cliente_nome,
                      produto,
                      produtoLabel,
                      perc,
                    })
                  }
                  onRenovarVR={onRenovarVR}
                  onRenovarPonto={onRenovarPonto}
                />
              ))
            )}
          </div>

          <Card className="mt-4 grid gap-3 p-4">
            <h3 className="text-sm font-semibold">Percentuais padrão globais</h3>
            <div className="grid grid-cols-3 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="p-vr-prim">% VR Primeira Carga</Label>
                <Input id="p-vr-prim" type="number" step="0.01" value={pVrPrim} onChange={(e) => setPVrPrim(e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="p-vr-rec">% VR Recorrência</Label>
                <Input id="p-vr-rec" type="number" step="0.01" value={pVrRec} onChange={(e) => setPVrRec(e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="p-ponto">% Nortear Ponto</Label>
                <Input id="p-ponto" type="number" step="0.01" value={pPonto} onChange={(e) => setPPonto(e.target.value)} />
              </div>
            </div>
            <div className="flex justify-end">
              <Button size="sm" onClick={() => salvarPadroes.mutate()} disabled={salvarPadroes.isPending}>
                {salvarPadroes.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar padrões
              </Button>
            </div>
          </Card>

          <DialogFooter>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {editing && (
        <EditarPercentualDialog
          open={!!editing}
          onOpenChange={(v) => !v && setEditing(null)}
          clientId={editing.clientId}
          clienteNome={editing.clienteNome}
          produto={editing.produto}
          produtoLabel={editing.produtoLabel}
          percentualAtual={editing.perc}
        />
      )}
    </>
  );
}

function ClienteFidRow({
  item,
  onEditar,
  onRenovarVR,
  onRenovarPonto,
}: {
  item: Item;
  onEditar: (
    produto: "vr_recorrencia" | "ponto",
    produtoLabel: string,
    perc: number | null,
  ) => void;
  onRenovarVR?: (id: string) => void;
  onRenovarPonto?: (id: string) => void;
}) {
  const toneVR = vencimentoTone(item.vencimentoVR);
  const tonePonto = vencimentoTone(item.vencimentoPonto);
  const produtos = Array.from(item.produtos).join(" + ");
  const [showHist, setShowHist] = useState(false);

  return (
    <Card className="p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link to={`/clientes/${item.client_id}`} className="font-medium text-primary hover:underline">
            {item.cliente_nome}
          </Link>
          <div className="text-xs text-muted-foreground">{produtos}</div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {item.produtos.has("VR") && (
            <FidPill
              label="VR"
              tone={toneVR}
              vencimento={item.vencimentoVR}
              perc={item.percVR}
              onEditar={() => onEditar("vr_recorrencia", "VR", item.percVR)}
              onRenovar={toneVR === "danger" && onRenovarVR ? () => onRenovarVR(item.client_id) : undefined}
            />
          )}
          {item.produtos.has("Ponto") && (
            <FidPill
              label="Ponto"
              tone={tonePonto}
              vencimento={item.vencimentoPonto}
              perc={item.percPonto}
              onEditar={() => onEditar("ponto", "Ponto", item.percPonto)}
              onRenovar={tonePonto === "danger" && onRenovarPonto ? () => onRenovarPonto(item.client_id) : undefined}
            />
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 px-2 text-xs"
            onClick={() => setShowHist((v) => !v)}
          >
            <History className="h-3 w-3" />
            {showHist ? "Ocultar histórico" : "Ver histórico"}
          </Button>
        </div>
      </div>
      <Collapsible open={showHist}>
        <CollapsibleContent>
          {showHist && <HistoricoCliente clientId={item.client_id} />}
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

function HistoricoCliente({ clientId }: { clientId: string }) {
  const [showAll, setShowAll] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ["historico-cliente", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("historico_comissoes")
        .select("*")
        .eq("client_id", clientId)
        .order("data_alteracao", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  if (isLoading) {
    return (
      <div className="mt-3 flex justify-center py-2">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!data || data.length === 0) {
    return <p className="mt-3 text-xs text-muted-foreground">Nenhuma alteração registrada.</p>;
  }

  const list = showAll ? data : data.slice(0, 5);

  return (
    <div className="mt-3 overflow-x-auto rounded-md border">
      <table className="w-full text-xs">
        <thead className="bg-muted/50">
          <tr>
            <th className="px-2 py-1 text-left">Data</th>
            <th className="px-2 py-1 text-left">Produto</th>
            <th className="px-2 py-1 text-right">% Anterior</th>
            <th className="px-2 py-1 text-right">% Novo</th>
            <th className="px-2 py-1 text-left">Vigência</th>
            <th className="px-2 py-1 text-left">Alterado por</th>
            <th className="px-2 py-1 text-left">Motivo</th>
          </tr>
        </thead>
        <tbody>
          {list.map((h) => (
            <tr key={h.id} className="border-t">
              <td className="px-2 py-1">{formatBRDate(h.data_alteracao)}</td>
              <td className="px-2 py-1">{produtoLabel(h.produto)}</td>
              <td className="px-2 py-1 text-right tabular-nums">
                {h.percentual_anterior != null ? `${Number(h.percentual_anterior).toFixed(2)}%` : "—"}
              </td>
              <td className="px-2 py-1 text-right tabular-nums">{Number(h.percentual_novo).toFixed(2)}%</td>
              <td className="px-2 py-1">
                {formatBRDate(h.vigencia_a_partir)}
                {h.retroativo && (
                  <Badge variant="destructive" className="ml-1 px-1 py-0 text-[10px]">
                    Retroativo
                  </Badge>
                )}
              </td>
              <td className="px-2 py-1">{h.alterado_por ?? "—"}</td>
              <td className="px-2 py-1 max-w-[200px] truncate" title={h.motivo ?? ""}>
                {h.motivo ?? "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {data.length > 5 && (
        <div className="border-t p-2 text-center">
          <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setShowAll((v) => !v)}>
            {showAll ? "Mostrar menos" : `Ver todas (${data.length})`}
          </Button>
        </div>
      )}
    </div>
  );
}

function produtoLabel(p: string) {
  if (p === "vr_primeira_carga") return "VR — Primeira Carga";
  if (p === "vr_recorrencia") return "VR — Recorrência";
  if (p === "ponto") return "Ponto";
  return p;
}

function FidPill({
  label,
  tone,
  vencimento,
  perc,
  onEditar,
  onRenovar,
}: {
  label: string;
  tone: "ok" | "warning" | "danger" | "muted";
  vencimento: string | null;
  perc: number | null;
  onEditar: () => void;
  onRenovar?: () => void;
}) {
  const badgeClass = cn(
    "border-transparent",
    tone === "danger" && "bg-destructive/15 text-destructive",
    tone === "warning" && "bg-amber-500/15 text-amber-600",
    tone === "ok" && "bg-emerald-500/15 text-emerald-600",
    tone === "muted" && "bg-muted text-muted-foreground",
  );

  return (
    <div className="flex items-center gap-2 rounded-md border px-2 py-1">
      <Badge className={badgeClass}>{label}</Badge>
      <span className="text-xs text-muted-foreground">{formatBRDate(vencimento)}</span>
      <span className="text-xs tabular-nums">{perc != null ? `${perc.toFixed(1)}%` : "—"}</span>
      <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={onEditar}>
        Editar %
      </Button>
      {onRenovar && (
        <Button size="sm" variant="outline" className="h-7" onClick={onRenovar}>
          Renovar
        </Button>
      )}
    </div>
  );
}
