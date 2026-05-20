import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, CheckCircle2, ListChecks } from "lucide-react";
import { ATIVIDADE_TIPOS } from "@/lib/crmOptions";
import { ActivityDialog } from "@/components/crm/ActivityDialog";
import { toast } from "sonner";

export default function CrmActivities() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [fStatus, setFStatus] = useState("todos");
  const [fTipo, setFTipo] = useState("todos");
  const [fPeriodo, setFPeriodo] = useState("todos");

  const { data: items = [] } = useQuery({
    queryKey: ["activities-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deal_activities")
        .select("*, deals(id, company_name)")
        .order("agendado_para", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    const now = new Date();
    return items.filter((a: any) => {
      if (fStatus !== "todos" && a.status !== fStatus) return false;
      if (fTipo !== "todos" && a.tipo !== fTipo) return false;
      if (fPeriodo !== "todos" && a.agendado_para) {
        const d = new Date(a.agendado_para);
        if (fPeriodo === "hoje" && d.toDateString() !== now.toDateString()) return false;
        if (fPeriodo === "semana") {
          const diff = (d.getTime() - now.getTime()) / 86400000;
          if (diff < -7 || diff > 7) return false;
        }
        if (fPeriodo === "mes") {
          if (d.getMonth() !== now.getMonth() || d.getFullYear() !== now.getFullYear()) return false;
        }
      }
      return true;
    });
  }, [items, fStatus, fTipo, fPeriodo]);

  const markDone = useMutation({
    mutationFn: async (id: string) => {
      const r = window.prompt("Resultado:") || null;
      const { error } = await supabase.from("deal_activities").update({ status: "realizada", realizado_em: new Date().toISOString(), resultado: r }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["activities-all"] }); toast.success("Realizada"); },
  });

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("deal_activities").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["activities-all"] }),
  });

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary"><ListChecks className="h-4 w-4" /></div>
          <h1 className="text-lg font-semibold">Atividades</h1>
        </div>
        <Button onClick={() => { setEditing(null); setOpen(true); }} size="sm"><Plus className="h-4 w-4" /> Nova atividade</Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <Select value={fStatus} onValueChange={setFStatus}>
          <SelectTrigger className="h-8 w-[150px] text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos status</SelectItem>
            <SelectItem value="pendente">Pendente</SelectItem>
            <SelectItem value="realizada">Realizada</SelectItem>
            <SelectItem value="cancelada">Cancelada</SelectItem>
          </SelectContent>
        </Select>
        <Select value={fTipo} onValueChange={setFTipo}>
          <SelectTrigger className="h-8 w-[150px] text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos tipos</SelectItem>
            {ATIVIDADE_TIPOS.map((t) => <SelectItem key={t.value} value={t.value}>{t.emoji} {t.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={fPeriodo} onValueChange={setFPeriodo}>
          <SelectTrigger className="h-8 w-[150px] text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos períodos</SelectItem>
            <SelectItem value="hoje">Hoje</SelectItem>
            <SelectItem value="semana">Esta semana</SelectItem>
            <SelectItem value="mes">Este mês</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/30">
              <tr className="text-left text-xs uppercase text-muted-foreground">
                <th className="p-3">Tipo</th>
                <th className="p-3">Título</th>
                <th className="p-3">Deal</th>
                <th className="p-3">Agendado</th>
                <th className="p-3">Prioridade</th>
                <th className="p-3">Status</th>
                <th className="p-3">Resultado</th>
                <th className="p-3">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">Nenhuma atividade</td></tr>
              ) : filtered.map((a: any) => {
                const tipo = ATIVIDADE_TIPOS.find((t) => t.value === a.tipo);
                return (
                  <tr key={a.id} className="border-b hover:bg-muted/20">
                    <td className="p-3">{tipo?.emoji} {tipo?.label}</td>
                    <td className="p-3 font-medium">{a.titulo}</td>
                    <td className="p-3">{a.deals?.company_name ? <Link to={`/crm/${a.deal_id}`} className="text-primary hover:underline">{a.deals.company_name}</Link> : "—"}</td>
                    <td className="p-3 text-xs">{a.agendado_para ? new Date(a.agendado_para).toLocaleString("pt-BR") : "—"}</td>
                    <td className="p-3"><Badge variant={a.prioridade === "alta" ? "destructive" : "outline"} className="text-[10px]">{a.prioridade}</Badge></td>
                    <td className="p-3"><Badge variant={a.status === "realizada" ? "default" : "outline"} className="text-[10px]">{a.status}</Badge></td>
                    <td className="p-3 text-xs text-muted-foreground max-w-xs truncate">{a.resultado || "—"}</td>
                    <td className="p-3">
                      <div className="flex gap-1">
                        {a.status === "pendente" && <Button size="sm" variant="ghost" onClick={() => markDone.mutate(a.id)}><CheckCircle2 className="h-3.5 w-3.5" /></Button>}
                        <Button size="sm" variant="ghost" onClick={() => { setEditing(a); setOpen(true); }}><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => confirm("Excluir?") && del.mutate(a.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <ActivityDialog open={open} onOpenChange={setOpen} activity={editing} dealId={editing?.deal_id} onSaved={() => qc.invalidateQueries({ queryKey: ["activities-all"] })} />
    </div>
  );
}
