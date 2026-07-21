import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Copy, ExternalLink, TrendingUp, Building2, CalendarClock, Target } from "lucide-react";
import { toast } from "sonner";
import { formatCnpj, formatBrazilDateTime } from "@/lib/formatters";

function startOfToday() { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }
function startOfWeek() { const d = startOfToday(); d.setDate(d.getDate() - d.getDay()); return d; }

export default function DashboardLeadsTab({ onCadastrar }: { onCadastrar: (cnpj: string) => void }) {
  const [q, setQ] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["consultas-dashboard"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("consultas")
        .select("id, cnpj, razao_social, nome_fantasia, situacao_cadastral, consultado_em, encontrado_no_pipedrive, acao")
        .order("consultado_em", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return data ?? [];
    },
  });

  const metrics = useMemo(() => {
    const rows = data ?? [];
    const hoje = startOfToday();
    const semana = startOfWeek();
    const leadsPotenciais = rows.filter((c: any) => !c.encontrado_no_pipedrive && c.acao !== "criado_no_pipedrive");
    const cnpjsUnicos = new Set(rows.map((c: any) => c.cnpj)).size;
    return {
      total: rows.length,
      cnpjsUnicos,
      leadsPotenciais: leadsPotenciais.length,
      hoje: rows.filter((c: any) => new Date(c.consultado_em) >= hoje).length,
      semana: rows.filter((c: any) => new Date(c.consultado_em) >= semana).length,
      convertidos: rows.filter((c: any) => c.acao === "criado_no_pipedrive").length,
      leads: leadsPotenciais,
    };
  }, [data]);

  // Únicos por CNPJ (mais recente primeiro)
  const leadsUnicos = useMemo(() => {
    const seen = new Set<string>();
    const out: any[] = [];
    for (const l of metrics.leads) {
      if (seen.has(l.cnpj)) continue;
      seen.add(l.cnpj);
      out.push(l);
    }
    const term = q.trim().toLowerCase();
    return term
      ? out.filter((c) => `${c.cnpj} ${c.razao_social ?? ""} ${c.nome_fantasia ?? ""}`.toLowerCase().includes(term))
      : out;
  }, [metrics.leads, q]);

  const copy = async (v: string, label: string) => {
    try { await navigator.clipboard.writeText(v); toast.success(`${label} copiado`); } catch { toast.error("Falha ao copiar"); }
  };

  const cards = [
    { label: "Total de consultas", value: metrics.total, icon: Search, tone: "text-primary" },
    { label: "CNPJs únicos", value: metrics.cnpjsUnicos, icon: Building2, tone: "text-primary" },
    { label: "Leads em potencial", value: metrics.leadsPotenciais, icon: Target, tone: "text-warning" },
    { label: "Cadastrados no Pipedrive", value: metrics.convertidos, icon: TrendingUp, tone: "text-success" },
    { label: "Consultas hoje", value: metrics.hoje, icon: CalendarClock, tone: "text-primary" },
    { label: "Consultas na semana", value: metrics.semana, icon: CalendarClock, tone: "text-primary" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {cards.map((c) => (
          <Card key={c.label} className="p-3">
            <div className="flex items-center justify-between">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{c.label}</p>
              <c.icon className={`h-4 w-4 ${c.tone}`} />
            </div>
            <p className="mt-1 text-2xl font-semibold">
              {isLoading ? <Skeleton className="h-7 w-14" /> : c.value.toLocaleString("pt-BR")}
            </p>
          </Card>
        ))}
      </div>

      <Card className="p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <Target className="h-4 w-4 text-warning" />
              Leads em potencial ({leadsUnicos.length})
            </h3>
            <p className="text-xs text-muted-foreground">Empresas consultadas que ainda não estão no Pipedrive.</p>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Filtrar leads…"
              className="h-9 pl-9"
            />
          </div>
        </div>

        <div className="overflow-hidden rounded-md border border-border/60">
          <div className="max-h-[55vh] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">CNPJ</th>
                  <th className="px-3 py-2 text-left font-medium">Empresa</th>
                  <th className="px-3 py-2 text-left font-medium">Situação</th>
                  <th className="px-3 py-2 text-left font-medium">Consultado em</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading && [...Array(4)].map((_, i) => (
                  <tr key={i}><td colSpan={5} className="p-2"><Skeleton className="h-8 w-full" /></td></tr>
                ))}
                {!isLoading && leadsUnicos.length === 0 && (
                  <tr><td colSpan={5} className="p-6 text-center text-sm text-muted-foreground">Nenhum lead em potencial no momento.</td></tr>
                )}
                {leadsUnicos.map((c: any) => (
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
                      <p className="truncate font-medium">{c.razao_social ?? "—"}</p>
                      {c.nome_fantasia && <p className="truncate text-xs text-muted-foreground">{c.nome_fantasia}</p>}
                    </td>
                    <td className="px-3 py-2">
                      {c.situacao_cadastral ? (
                        <Badge variant={c.situacao_cadastral === "ATIVA" ? "default" : "destructive"} className="text-[10px]">
                          {c.situacao_cadastral}
                        </Badge>
                      ) : "—"}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{formatBrazilDateTime(c.consultado_em)}</td>
                    <td className="px-3 py-2 text-right">
                      <Button
                        size="sm"
                        onClick={() => onCadastrar(c.cnpj)}
                        className="h-7 bg-gradient-brand text-primary-foreground hover:opacity-90"
                      >
                        <ExternalLink className="mr-1 h-3.5 w-3.5" />
                        Cadastrar no Pipedrive
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Card>
    </div>
  );
}
