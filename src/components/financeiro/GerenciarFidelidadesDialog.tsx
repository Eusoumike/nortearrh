import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { History, Loader2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
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
};

export function GerenciarFidelidadesDialog({
  open,
  onOpenChange,
  onRenovarVR,
  onRenovarPonto,
}: Props) {
  const { data: items = [], isLoading } = useQuery({
    queryKey: ["financeiro-fidelidades-todos"],
    enabled: open,
    queryFn: async () => {
      const [vrRes, contRes] = await Promise.all([
        supabase
          .from("lancamentos_vr")
          .select("client_id, cliente_nome, fidelidade_vencimento")
          .not("client_id", "is", null)
          .order("fidelidade_vencimento", { ascending: true }),
        supabase
          .from("contratos_rh_digital")
          .select("client_id, cliente_nome, fidelidade_vencimento, ativo")
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
      }
      for (const r of contRes.data ?? []) {
        const it = ensure(r.client_id as string, r.cliente_nome);
        it.produtos.add("Ponto");
        it.vencimentoPonto = r.fidelidade_vencimento;
      }
      return Array.from(map.values()).sort((a, b) =>
        a.cliente_nome.localeCompare(b.cliente_nome),
      );
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Gerenciar fidelidades</DialogTitle>
          <DialogDescription>
            Visualize todos os clientes com fidelidade ativa. Os percentuais são definidos em
            Configurações → Comissões.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2">
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
                onRenovarVR={onRenovarVR}
                onRenovarPonto={onRenovarPonto}
              />
            ))
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ClienteFidRow({
  item,
  onRenovarVR,
  onRenovarPonto,
}: {
  item: Item;
  onRenovarVR?: (id: string) => void;
  onRenovarPonto?: (id: string) => void;
}) {
  const toneVR = vencimentoTone(item.vencimentoVR);
  const tonePonto = vencimentoTone(item.vencimentoPonto);
  const [showHist, setShowHist] = useState(false);

  return (
    <Card className="p-3">
      <div className="flex items-center gap-3">
        <Link
          to={`/clientes/${item.client_id}`}
          className="min-w-0 flex-1 truncate font-medium text-primary hover:underline"
          title={item.cliente_nome}
        >
          {item.cliente_nome}
        </Link>
        <div className="flex shrink-0 items-center gap-2">
          {item.produtos.has("VR") && (
            <FidPill
              label="VR"
              tone={toneVR}
              vencimento={item.vencimentoVR}
              onRenovar={
                toneVR === "danger" && onRenovarVR
                  ? () => onRenovarVR(item.client_id)
                  : undefined
              }
            />
          )}
          {item.produtos.has("Ponto") && (
            <FidPill
              label="Ponto"
              tone={tonePonto}
              vencimento={item.vencimentoPonto}
              onRenovar={
                tonePonto === "danger" && onRenovarPonto
                  ? () => onRenovarPonto(item.client_id)
                  : undefined
              }
            />
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 px-2 text-xs"
            onClick={() => setShowHist((v) => !v)}
          >
            <History className="h-3 w-3" />
            {showHist ? "Ocultar" : "Histórico"}
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
  const { data, isLoading } = useQuery({
    queryKey: ["historico-cliente", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("historico_comissoes")
        .select("id, data_alteracao, produto, percentual_anterior, percentual_novo, vigencia_a_partir")
        .eq("client_id", clientId)
        .order("data_alteracao", { ascending: false })
        .limit(20);
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
          </tr>
        </thead>
        <tbody>
          {data.map((h) => (
            <tr key={h.id} className="border-t">
              <td className="px-2 py-1">{formatBRDate(h.data_alteracao)}</td>
              <td className="px-2 py-1">{produtoLabel(h.produto)}</td>
              <td className="px-2 py-1 text-right tabular-nums">
                {h.percentual_anterior != null
                  ? `${Number(h.percentual_anterior).toFixed(2)}%`
                  : "—"}
              </td>
              <td className="px-2 py-1 text-right tabular-nums">
                {Number(h.percentual_novo).toFixed(2)}%
              </td>
              <td className="px-2 py-1">{formatBRDate(h.vigencia_a_partir)}</td>
            </tr>
          ))}
        </tbody>
      </table>
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
  onRenovar,
}: {
  label: string;
  tone: "ok" | "warning" | "danger" | "muted";
  vencimento: string | null;
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
      {onRenovar && (
        <Button size="sm" variant="outline" className="h-7" onClick={onRenovar}>
          Renovar
        </Button>
      )}
    </div>
  );
}
