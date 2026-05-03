import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { formatBRDate, vencimentoTone } from "./financeiroUtils";

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

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["financeiro-fidelidades-todos"],
    enabled: open,
    queryFn: async () => {
      const [vrRes, contRes] = await Promise.all([
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
      ]);
      if (vrRes.error) throw vrRes.error;
      if (contRes.error) throw contRes.error;

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
            percVR: null,
            percPonto: null,
          };
          map.set(id, it);
        }
        return it;
      };
      for (const r of vrRes.data ?? []) {
        const it = ensure(r.client_id as string, r.cliente_nome);
        it.produtos.add("VR");
        // mais recente vencimento
        if (
          !it.vencimentoVR ||
          (r.fidelidade_vencimento && r.fidelidade_vencimento > it.vencimentoVR)
        ) {
          it.vencimentoVR = r.fidelidade_vencimento;
          it.percVR = Number(r.percentual_comissao);
        }
      }
      for (const r of contRes.data ?? []) {
        const it = ensure(r.client_id as string, r.cliente_nome);
        it.produtos.add("Ponto");
        it.vencimentoPonto = r.fidelidade_vencimento;
        it.percPonto = Number(r.percentual_nortear);
      }
      return Array.from(map.values()).sort((a, b) =>
        a.cliente_nome.localeCompare(b.cliente_nome),
      );
    },
  });

  // Padrões globais (config_comissoes sem client_id é um padrão; usamos tabela mesmo assim
  // armazenando 1 linha "global" via client_id null não permitido. Em vez disso usamos um cliente fictício?
  // Melhor: persistimos em system_settings via JSON? Mantemos por enquanto na primeira linha sem filtro.)
  const { data: padroes } = useQuery({
    queryKey: ["financeiro-padroes-globais"],
    enabled: open,
    queryFn: async () => {
      // Usa a linha mais antiga como referência global
      const { data } = await supabase
        .from("config_comissoes")
        .select("id, percentual_vr_primeira_carga, percentual_vr_recorrencia, percentual_ponto")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  const [pVrPrim, setPVrPrim] = useState("17.5");
  const [pVrRec, setPVrRec] = useState("17.5");
  const [pPonto, setPPonto] = useState("40");

  useEffect(() => {
    if (padroes) {
      setPVrPrim(String(padroes.percentual_vr_primeira_carga));
      setPVrRec(String(padroes.percentual_vr_recorrencia));
      setPPonto(String(padroes.percentual_ponto));
    }
  }, [padroes]);

  const salvarPadroes = useMutation({
    mutationFn: async () => {
      if (padroes?.id) {
        const { error } = await supabase
          .from("config_comissoes")
          .update({
            percentual_vr_primeira_carga: Number(pVrPrim),
            percentual_vr_recorrencia: Number(pVrRec),
            percentual_ponto: Number(pPonto),
          })
          .eq("id", padroes.id);
        if (error) throw error;
      } else {
        toast.info(
          "Configure pelo menos um cliente para definir padrões. Os valores serão usados como referência.",
        );
      }
    },
    onSuccess: () => {
      toast.success("Percentuais padrão atualizados");
      qc.invalidateQueries({ queryKey: ["financeiro-padroes-globais"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao salvar"),
  });

  const editarPercVR = useMutation({
    mutationFn: async ({ clientId, valor }: { clientId: string; valor: number }) => {
      const { error } = await supabase
        .from("config_comissoes")
        .upsert(
          {
            client_id: clientId,
            percentual_vr_recorrencia: valor,
            percentual_vr_primeira_carga: valor,
            percentual_ponto: 40,
          },
          { onConflict: "client_id" },
        );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("% VR atualizado");
      qc.invalidateQueries({ queryKey: ["financeiro-fidelidades-todos"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });

  const editarPercPonto = useMutation({
    mutationFn: async ({ clientId, valor }: { clientId: string; valor: number }) => {
      const { error } = await supabase
        .from("config_comissoes")
        .upsert(
          {
            client_id: clientId,
            percentual_ponto: valor,
            percentual_vr_recorrencia: 17.5,
            percentual_vr_primeira_carga: 17.5,
          },
          { onConflict: "client_id" },
        );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("% Nortear atualizado");
      qc.invalidateQueries({ queryKey: ["financeiro-fidelidades-todos"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });

  return (
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
            items.map((it) => <ClienteFidRow key={it.client_id} item={it}
              onEditarVR={(v) => editarPercVR.mutate({ clientId: it.client_id, valor: v })}
              onEditarPonto={(v) => editarPercPonto.mutate({ clientId: it.client_id, valor: v })}
              onRenovarVR={onRenovarVR}
              onRenovarPonto={onRenovarPonto}
            />)
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
  );
}

function ClienteFidRow({
  item,
  onEditarVR,
  onEditarPonto,
  onRenovarVR,
  onRenovarPonto,
}: {
  item: Item;
  onEditarVR: (v: number) => void;
  onEditarPonto: (v: number) => void;
  onRenovarVR?: (id: string) => void;
  onRenovarPonto?: (id: string) => void;
}) {
  const toneVR = vencimentoTone(item.vencimentoVR);
  const tonePonto = vencimentoTone(item.vencimentoPonto);
  const produtos = Array.from(item.produtos).join(" + ");

  return (
    <Card className="p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link to={`/clientes/${item.client_id}`} className="font-medium text-primary hover:underline">
            {item.cliente_nome}
          </Link>
          <div className="text-xs text-muted-foreground">{produtos}</div>
        </div>
        <div className="flex flex-wrap gap-3">
          {item.produtos.has("VR") && (
            <FidPill
              label="VR"
              tone={toneVR}
              vencimento={item.vencimentoVR}
              perc={item.percVR}
              onEditPerc={onEditarVR}
              onRenovar={toneVR === "danger" && onRenovarVR ? () => onRenovarVR(item.client_id) : undefined}
            />
          )}
          {item.produtos.has("Ponto") && (
            <FidPill
              label="Ponto"
              tone={tonePonto}
              vencimento={item.vencimentoPonto}
              perc={item.percPonto}
              onEditPerc={onEditarPonto}
              onRenovar={tonePonto === "danger" && onRenovarPonto ? () => onRenovarPonto(item.client_id) : undefined}
            />
          )}
        </div>
      </div>
    </Card>
  );
}

function FidPill({
  label,
  tone,
  vencimento,
  perc,
  onEditPerc,
  onRenovar,
}: {
  label: string;
  tone: "ok" | "warning" | "danger" | "muted";
  vencimento: string | null;
  perc: number | null;
  onEditPerc: (v: number) => void;
  onRenovar?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(perc != null ? String(perc) : "");

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
      {editing ? (
        <>
          <Input
            type="number"
            step="0.01"
            value={val}
            onChange={(e) => setVal(e.target.value)}
            className="h-7 w-20"
          />
          <Button size="sm" variant="secondary" className="h-7" onClick={() => { onEditPerc(Number(val)); setEditing(false); }}>
            OK
          </Button>
        </>
      ) : (
        <>
          <span className="text-xs tabular-nums">{perc != null ? `${perc.toFixed(1)}%` : "—"}</span>
          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setEditing(true)}>
            Editar %
          </Button>
        </>
      )}
      {onRenovar && (
        <Button size="sm" variant="outline" className="h-7" onClick={onRenovar}>
          Renovar
        </Button>
      )}
    </div>
  );
}
