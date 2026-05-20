import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { BarChart3, Target } from "lucide-react";
import { fmtBRL, STAGE_LABELS } from "@/lib/crmOptions";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { toast } from "sonner";

const COLORS = ["hsl(210 90% 55%)", "hsl(140 65% 45%)", "hsl(35 95% 55%)", "hsl(265 75% 60%)", "hsl(0 75% 55%)", "hsl(190 85% 45%)", "hsl(330 75% 55%)", "hsl(50 95% 55%)"];

export default function CrmAnalytics() {
  const qc = useQueryClient();
  const [metaOpen, setMetaOpen] = useState(false);
  const [metaValor, setMetaValor] = useState("");
  const [metaQtd, setMetaQtd] = useState("");
  const [metaProduto, setMetaProduto] = useState("todos");

  const { data: deals = [] } = useQuery({
    queryKey: ["analytics-deals"],
    queryFn: async () => {
      const { data, error } = await supabase.from("deals").select("*");
      if (error) throw error;
      return data ?? [];
    },
  });

  const currentMonth = useMemo(() => {
    const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d;
  }, []);

  const { data: meta } = useQuery({
    queryKey: ["sales-meta", currentMonth.toISOString().slice(0, 10)],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales_metas")
        .select("*")
        .eq("mes", currentMonth.toISOString().slice(0, 10))
        .eq("produto", "todos")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const saveMeta = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("sales_metas").upsert({
        mes: currentMonth.toISOString().slice(0, 10),
        produto: metaProduto,
        valor_meta: Number(metaValor || 0),
        quantidade_meta: Number(metaQtd || 0),
      }, { onConflict: "mes,produto" });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Meta salva"); qc.invalidateQueries({ queryKey: ["sales-meta"] }); setMetaOpen(false); },
    onError: (e: any) => toast.error(e?.message || "Erro"),
  });

  // KPIs
  const ativos = deals.filter((d: any) => d.stage !== "fechado_ganho" && d.stage !== "fechado_perdido");
  const ganhos = deals.filter((d: any) => d.stage === "fechado_ganho");
  const perdidos = deals.filter((d: any) => d.stage === "fechado_perdido");
  const valorPipeline = ativos.reduce((s: number, d: any) => s + Number(d.value || 0), 0);
  const valorGanho = ganhos.reduce((s: number, d: any) => s + Number(d.value || 0), 0);
  const taxaConv = ganhos.length + perdidos.length > 0 ? (ganhos.length / (ganhos.length + perdidos.length)) * 100 : 0;
  const ticketMedio = ganhos.length > 0 ? valorGanho / ganhos.length : 0;

  // Funil
  const stages = ["lead", "contato", "apresentacao", "negociacao", "fechado_ganho"];
  const funilData = stages.map((s, i) => {
    const q = deals.filter((d: any) => d.stage === s).length;
    const nextQ = i < stages.length - 1 ? deals.filter((d: any) => d.stage === stages[i + 1]).length : 0;
    const conv = q > 0 && i < stages.length - 1 ? (nextQ / q) * 100 : 0;
    return { stage: STAGE_LABELS[s], qtd: q, conv };
  });

  // Origem
  const origemMap: Record<string, number> = {};
  deals.forEach((d: any) => { const k = d.origem_lead || "—"; origemMap[k] = (origemMap[k] || 0) + 1; });
  const origemData = Object.entries(origemMap).map(([name, value]) => ({ name, value }));

  // Segmento
  const segMap: Record<string, number> = {};
  deals.forEach((d: any) => { const k = d.segmento || "—"; segMap[k] = (segMap[k] || 0) + 1; });
  const segData = Object.entries(segMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 8);

  // Meta progresso
  const ganhosNoMes = ganhos.filter((d: any) => d.won_at && new Date(d.won_at) >= currentMonth);
  const valorGanhoMes = ganhosNoMes.reduce((s: number, d: any) => s + Number(d.value || 0), 0);
  const progressoValor = meta?.valor_meta ? Math.min(100, (valorGanhoMes / Number(meta.valor_meta)) * 100) : 0;
  const progressoQtd = meta?.quantidade_meta ? Math.min(100, (ganhosNoMes.length / meta.quantidade_meta) * 100) : 0;

  // Performance últimos 6 meses
  const perfData = useMemo(() => {
    const arr = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setMonth(d.getMonth() - i); d.setDate(1); d.setHours(0, 0, 0, 0);
      const next = new Date(d); next.setMonth(next.getMonth() + 1);
      const won = deals.filter((x: any) => x.won_at && new Date(x.won_at) >= d && new Date(x.won_at) < next);
      const lost = deals.filter((x: any) => x.lost_at && new Date(x.lost_at) >= d && new Date(x.lost_at) < next);
      const val = won.reduce((s: number, x: any) => s + Number(x.value || 0), 0);
      arr.push({
        mes: d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }),
        ganhos: won.length,
        valor: val,
        ticket: won.length > 0 ? val / won.length : 0,
        conv: won.length + lost.length > 0 ? (won.length / (won.length + lost.length)) * 100 : 0,
      });
    }
    return arr;
  }, [deals]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary"><BarChart3 className="h-4 w-4" /></div>
          <h1 className="text-lg font-semibold">Analytics de Vendas</h1>
        </div>
        <Button size="sm" onClick={() => {
          setMetaValor(meta?.valor_meta?.toString() || "");
          setMetaQtd(meta?.quantidade_meta?.toString() || "");
          setMetaOpen(true);
        }}><Target className="h-4 w-4" /> Definir meta do mês</Button>
      </div>

      {/* KPIs */}
      <div className="grid gap-3 md:grid-cols-4">
        <Kpi label="Deals ativos" value={String(ativos.length)} />
        <Kpi label="Valor em pipeline" value={fmtBRL(valorPipeline)} />
        <Kpi label="Taxa de conversão" value={`${taxaConv.toFixed(1)}%`} />
        <Kpi label="Ticket médio" value={fmtBRL(ticketMedio)} />
      </div>

      {/* Funil */}
      <Card className="p-4">
        <h2 className="text-sm font-semibold mb-3">Funil de conversão</h2>
        <div className="space-y-2">
          {funilData.map((f, i) => {
            const max = Math.max(...funilData.map((x) => x.qtd), 1);
            const width = (f.qtd / max) * 100;
            const worst = funilData.slice(0, -1).reduce((min, x, idx) => x.conv < funilData[min].conv ? idx : min, 0);
            const isWorst = i === worst && f.conv < 100;
            return (
              <div key={f.stage} className="flex items-center gap-3">
                <div className="w-32 text-xs">{f.stage}</div>
                <div className="flex-1 h-7 bg-muted rounded overflow-hidden">
                  <div className={`h-full flex items-center px-2 text-xs text-white font-medium ${isWorst ? "bg-destructive" : "bg-primary"}`} style={{ width: `${width}%` }}>
                    {f.qtd}
                  </div>
                </div>
                <div className="w-20 text-xs text-right text-muted-foreground">{i < funilData.length - 1 ? `${f.conv.toFixed(0)}%` : "—"}</div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Origem + Segmento */}
      <div className="grid gap-3 md:grid-cols-2">
        <Card className="p-4">
          <h2 className="text-sm font-semibold mb-3">Deals por origem</h2>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={origemData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                {origemData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </Card>
        <Card className="p-4">
          <h2 className="text-sm font-semibold mb-3">Top segmentos</h2>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={segData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis type="category" dataKey="name" width={100} fontSize={11} />
              <Tooltip />
              <Bar dataKey="value" fill="hsl(var(--primary))" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Meta */}
      <Card className="p-4">
        <h2 className="text-sm font-semibold mb-3">Meta do mês ({currentMonth.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })})</h2>
        {meta ? (
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-xs mb-1"><span>Valor</span><span>{fmtBRL(valorGanhoMes)} / {fmtBRL(Number(meta.valor_meta))}</span></div>
              <Progress value={progressoValor} />
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1"><span>Quantidade</span><span>{ganhosNoMes.length} / {meta.quantidade_meta}</span></div>
              <Progress value={progressoQtd} />
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Nenhuma meta definida para este mês.</p>
        )}
      </Card>

      {/* Performance */}
      <Card>
        <div className="p-4 border-b"><h2 className="text-sm font-semibold">Performance — últimos 7 meses</h2></div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
              <tr><th className="p-3 text-left">Mês</th><th className="p-3 text-right">Ganhos</th><th className="p-3 text-right">Valor</th><th className="p-3 text-right">Ticket médio</th><th className="p-3 text-right">% conversão</th></tr>
            </thead>
            <tbody>
              {perfData.map((p) => (
                <tr key={p.mes} className="border-b">
                  <td className="p-3 capitalize">{p.mes}</td>
                  <td className="p-3 text-right">{p.ganhos}</td>
                  <td className="p-3 text-right">{fmtBRL(p.valor)}</td>
                  <td className="p-3 text-right">{fmtBRL(p.ticket)}</td>
                  <td className="p-3 text-right">{p.conv.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog open={metaOpen} onOpenChange={setMetaOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Meta do mês</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Produto</Label>
              <Select value={metaProduto} onValueChange={setMetaProduto}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="rh_digital">RH Digital</SelectItem>
                  <SelectItem value="vr_beneficios">VR Benefícios</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Valor (R$)</Label><Input type="number" value={metaValor} onChange={(e) => setMetaValor(e.target.value)} /></div>
            <div><Label>Quantidade de deals</Label><Input type="number" value={metaQtd} onChange={(e) => setMetaQtd(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMetaOpen(false)}>Cancelar</Button>
            <Button onClick={() => saveMeta.mutate()} disabled={saveMeta.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-4">
      <div className="text-xs text-muted-foreground uppercase tracking-wide">{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
    </Card>
  );
}
