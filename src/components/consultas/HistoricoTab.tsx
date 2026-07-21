import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import { Search, Copy, ExternalLink, Filter } from "lucide-react";
import { toast } from "sonner";
import { formatCnpj, formatBrazilDateTime } from "@/lib/formatters";

const ACOES = [
  { value: "all", label: "Todas ações" },
  { value: "somente_consulta", label: "Somente consulta" },
  { value: "criado_no_pipedrive", label: "Criado no Pipedrive" },
  { value: "atualizado_no_pipedrive", label: "Atualizado no Pipedrive" },
];

const SITUACOES = ["all", "ATIVA", "BAIXADA", "SUSPENSA", "INAPTA", "NULA"];

function acaoLabel(a: string | null) {
  return ACOES.find((x) => x.value === a)?.label ?? a ?? "—";
}

export default function HistoricoTab({ onReabrir }: { onReabrir: (cnpj: string) => void }) {
  const [q, setQ] = useState("");
  const [acao, setAcao] = useState("all");
  const [situacao, setSituacao] = useState("all");
  const [pipedrive, setPipedrive] = useState<"all" | "sim" | "nao">("all");
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["consultas-historico"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("consultas")
        .select("id, cnpj, razao_social, nome_fantasia, situacao_cadastral, consultado_em, encontrado_no_pipedrive, acao, consultado_por_nome, pipedrive_org_id")
        .order("consultado_em", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (data ?? []).filter((c: any) => {
      if (term) {
        const hay = `${c.cnpj} ${c.razao_social ?? ""} ${c.nome_fantasia ?? ""}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      if (acao !== "all" && c.acao !== acao) return false;
      if (situacao !== "all" && c.situacao_cadastral !== situacao) return false;
      if (pipedrive === "sim" && !c.encontrado_no_pipedrive) return false;
      if (pipedrive === "nao" && c.encontrado_no_pipedrive) return false;
      if (de && new Date(c.consultado_em) < new Date(de)) return false;
      if (ate && new Date(c.consultado_em) > new Date(`${ate}T23:59:59`)) return false;
      return true;
    });
  }, [data, q, acao, situacao, pipedrive, de, ate]);

  const copy = async (v: string, label: string) => {
    try { await navigator.clipboard.writeText(v); toast.success(`${label} copiado`); } catch { toast.error("Falha ao copiar"); }
  };

  return (
    <div className="space-y-3">
      <Card className="p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[240px] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por CNPJ, razão social ou nome fantasia…"
              className="h-9 pl-9"
            />
          </div>
          <Select value={acao} onValueChange={setAcao}>
            <SelectTrigger className="h-9 w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {ACOES.map((a) => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={situacao} onValueChange={setSituacao}>
            <SelectTrigger className="h-9 w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {SITUACOES.map((s) => <SelectItem key={s} value={s}>{s === "all" ? "Todas situações" : s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={pipedrive} onValueChange={(v: any) => setPipedrive(v)}>
            <SelectTrigger className="h-9 w-[170px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Pipedrive: todos</SelectItem>
              <SelectItem value="sim">No Pipedrive</SelectItem>
              <SelectItem value="nao">Fora do Pipedrive</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center gap-1">
            <Input type="date" value={de} onChange={(e) => setDe(e.target.value)} className="h-9 w-[150px]" />
            <span className="text-xs text-muted-foreground">até</span>
            <Input type="date" value={ate} onChange={(e) => setAte(e.target.value)} className="h-9 w-[150px]" />
          </div>
          {(q || acao !== "all" || situacao !== "all" || pipedrive !== "all" || de || ate) && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => { setQ(""); setAcao("all"); setSituacao("all"); setPipedrive("all"); setDe(""); setAte(""); }}
            >
              <Filter className="mr-1 h-3.5 w-3.5" />Limpar
            </Button>
          )}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{filtered.length} resultado(s) de {data?.length ?? 0} consultas</p>
      </Card>

      <Card className="overflow-hidden">
        <div className="max-h-[65vh] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">CNPJ</th>
                <th className="px-3 py-2 text-left font-medium">Razão social</th>
                <th className="px-3 py-2 text-left font-medium">Situação</th>
                <th className="px-3 py-2 text-left font-medium">Data</th>
                <th className="px-3 py-2 text-left font-medium">Ação</th>
                <th className="px-3 py-2 text-left font-medium">Pipedrive</th>
                <th className="px-3 py-2 text-left font-medium">Consultado por</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading && [...Array(6)].map((_, i) => (
                <tr key={i}><td colSpan={8} className="p-2"><Skeleton className="h-8 w-full" /></td></tr>
              ))}
              {!isLoading && filtered.length === 0 && (
                <tr><td colSpan={8} className="p-6 text-center text-sm text-muted-foreground">Nenhuma consulta encontrada.</td></tr>
              )}
              {filtered.map((c: any) => (
                <tr key={c.id} className="hover:bg-muted/30">
                  <td className="px-3 py-2 font-mono text-xs">
                    <div className="flex items-center gap-1">
                      {formatCnpj(c.cnpj)}
                      <button onClick={() => copy(c.cnpj, "CNPJ")} className="text-muted-foreground hover:text-foreground">
                        <Copy className="h-3 w-3" />
                      </button>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{c.razao_social ?? "—"}</p>
                      {c.nome_fantasia && <p className="truncate text-xs text-muted-foreground">{c.nome_fantasia}</p>}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    {c.situacao_cadastral ? (
                      <Badge variant={c.situacao_cadastral === "ATIVA" ? "default" : "destructive"} className="text-[10px]">
                        {c.situacao_cadastral}
                      </Badge>
                    ) : "—"}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{formatBrazilDateTime(c.consultado_em)}</td>
                  <td className="px-3 py-2 text-xs">{acaoLabel(c.acao)}</td>
                  <td className="px-3 py-2 text-xs">
                    {c.encontrado_no_pipedrive ? (
                      <Badge variant="secondary" className="text-[10px]">Sim{c.pipedrive_org_id ? ` · #${c.pipedrive_org_id}` : ""}</Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{c.consultado_por_nome ?? "—"}</td>
                  <td className="px-3 py-2 text-right">
                    <Button size="sm" variant="ghost" className="h-7" onClick={() => onReabrir(c.cnpj)}>
                      <ExternalLink className="mr-1 h-3.5 w-3.5" />Reabrir
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
