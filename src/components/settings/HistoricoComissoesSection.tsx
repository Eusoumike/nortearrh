import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, Loader2 } from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";

type Filtro = "todos" | "vr" | "ponto";

export function HistoricoComissoesSection() {
  const [busca, setBusca] = useState("");
  const [produtoFiltro, setProdutoFiltro] = useState<Filtro>("todos");
  const [mesAno, setMesAno] = useState<string>(""); // YYYY-MM

  const { data = [], isLoading } = useQuery({
    queryKey: ["historico-comissoes", produtoFiltro, mesAno],
    queryFn: async () => {
      let q = supabase
        .from("historico_comissoes")
        .select("id, data_alteracao, cliente_nome, produto, percentual_anterior, percentual_novo, vigencia_a_partir, retroativo, alterado_por, motivo")
        .order("data_alteracao", { ascending: false })
        .limit(500);

      if (produtoFiltro === "vr") {
        q = q.in("produto", ["vr_primeira_carga", "vr_recorrencia"]);
      } else if (produtoFiltro === "ponto") {
        q = q.eq("produto", "ponto");
      }

      if (mesAno) {
        const ref = new Date(`${mesAno}-01T00:00:00`);
        q = q
          .gte("data_alteracao", format(startOfMonth(ref), "yyyy-MM-dd"))
          .lte("data_alteracao", format(endOfMonth(ref), "yyyy-MM-dd"));
      }
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtrados = useMemo(() => {
    if (!busca.trim()) return data;
    const t = busca.trim().toLowerCase();
    return data.filter((h) => h.cliente_nome?.toLowerCase().includes(t));
  }, [data, busca]);

  const exportarCSV = () => {
    const header = [
      "Data",
      "Cliente",
      "Produto",
      "% Anterior",
      "% Novo",
      "Vigência",
      "Retroativo",
      "Alterado por",
      "Motivo",
    ];
    const rows = filtrados.map((h) => [
      h.data_alteracao,
      h.cliente_nome,
      produtoLabel(h.produto),
      h.percentual_anterior ?? "",
      h.percentual_novo,
      h.vigencia_a_partir,
      h.retroativo ? "Sim" : "Não",
      h.alterado_por ?? "",
      (h.motivo ?? "").replace(/\n/g, " "),
    ]);
    const csv = [header, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `historico-comissoes-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle>Histórico de Comissões</CardTitle>
            <CardDescription>
              Auditoria de todas as alterações de % por cliente.
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={exportarCSV} disabled={filtrados.length === 0}>
            <Download className="mr-2 h-4 w-4" />
            Exportar CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="grid gap-1.5">
            <Label htmlFor="hc-busca">Cliente</Label>
            <Input
              id="hc-busca"
              placeholder="Buscar por nome"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Produto</Label>
            <Select value={produtoFiltro} onValueChange={(v) => setProdutoFiltro(v as Filtro)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="vr">VR</SelectItem>
                <SelectItem value="ponto">Ponto</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="hc-mes">Período (mês/ano)</Label>
            <Input
              id="hc-mes"
              type="month"
              value={mesAno}
              onChange={(e) => setMesAno(e.target.value)}
            />
          </div>
        </div>

        {isLoading ? (
          <div className="flex h-32 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : filtrados.length === 0 ? (
          <p className="rounded border border-dashed p-6 text-center text-sm text-muted-foreground">
            Nenhuma alteração encontrada.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs">
                <tr>
                  <th className="px-3 py-2 text-left">Data</th>
                  <th className="px-3 py-2 text-left">Cliente</th>
                  <th className="px-3 py-2 text-left">Produto</th>
                  <th className="px-3 py-2 text-right">% Anterior</th>
                  <th className="px-3 py-2 text-right">% Novo</th>
                  <th className="px-3 py-2 text-left">Vigência</th>
                  <th className="px-3 py-2 text-left">Alterado por</th>
                  <th className="px-3 py-2 text-left">Motivo</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((h) => (
                  <tr key={h.id} className="border-t">
                    <td className="px-3 py-2">{formatBR(h.data_alteracao)}</td>
                    <td className="px-3 py-2">{h.cliente_nome}</td>
                    <td className="px-3 py-2">{produtoLabel(h.produto)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {h.percentual_anterior != null ? `${Number(h.percentual_anterior).toFixed(2)}%` : "—"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {Number(h.percentual_novo).toFixed(2)}%
                    </td>
                    <td className="px-3 py-2">
                      {formatBR(h.vigencia_a_partir)}
                      {h.retroativo && (
                        <Badge variant="destructive" className="ml-2 text-[10px]">
                          Retroativo
                        </Badge>
                      )}
                    </td>
                    <td className="px-3 py-2">{h.alterado_por ?? "—"}</td>
                    <td className="px-3 py-2 max-w-[260px] truncate" title={h.motivo ?? ""}>
                      {h.motivo ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function produtoLabel(p: string) {
  if (p === "vr_primeira_carga") return "VR — Primeira Carga";
  if (p === "vr_recorrencia") return "VR — Recorrência";
  if (p === "ponto") return "Ponto";
  return p;
}

function formatBR(date: string | null) {
  if (!date) return "—";
  return format(new Date(date + "T00:00:00"), "dd/MM/yyyy");
}
