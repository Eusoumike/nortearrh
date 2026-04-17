import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { ListChecks, AlertTriangle, CheckCircle2 } from "lucide-react";

interface TicketTasksSummaryProps {
  ticketId: string;
}

export function TicketTasksSummary({ ticketId }: TicketTasksSummaryProps) {
  const { data: tasks } = useQuery({
    queryKey: ["ticket-tasks", ticketId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("id, status, due_date")
        .eq("ticket_id", ticketId);
      if (error) throw error;
      return data;
    },
  });

  if (!tasks || tasks.length === 0) return null;

  const pending = tasks.filter((t) => t.status !== "concluida");
  const done = tasks.filter((t) => t.status === "concluida");
  const overdue = pending.filter(
    (t) => t.due_date && new Date(t.due_date + "T23:59:59-03:00") < new Date(),
  ).length;

  return (
    <Card className="p-5 space-y-3">
      <div className="flex items-center gap-2">
        <ListChecks className="h-3.5 w-3.5 text-muted-foreground" />
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Tarefas
        </h3>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <Stat value={pending.length} label="Pendentes" tone="primary" />
        <Stat value={overdue} label="Atrasadas" tone={overdue > 0 ? "danger" : "muted"} />
        <Stat value={done.length} label="Concluídas" tone="success" />
      </div>
      {overdue > 0 && (
        <div className="flex items-center gap-1.5 rounded-md border border-destructive/30 bg-destructive/5 px-2.5 py-1.5 text-[11px] text-destructive">
          <AlertTriangle className="h-3 w-3 shrink-0" />
          <span>
            {overdue} tarefa{overdue > 1 ? "s" : ""} com prazo vencido
          </span>
        </div>
      )}
      {pending.length === 0 && done.length > 0 && (
        <div className="flex items-center gap-1.5 rounded-md border border-success/30 bg-success/5 px-2.5 py-1.5 text-[11px] text-success">
          <CheckCircle2 className="h-3 w-3 shrink-0" />
          <span>Todas as tarefas concluídas</span>
        </div>
      )}
    </Card>
  );
}

function Stat({
  value,
  label,
  tone,
}: {
  value: number;
  label: string;
  tone: "primary" | "danger" | "success" | "muted";
}) {
  const toneClass =
    tone === "danger"
      ? "text-destructive"
      : tone === "success"
        ? "text-success"
        : tone === "primary"
          ? "text-primary"
          : "text-muted-foreground";
  return (
    <div className="rounded-md border border-border bg-surface px-2 py-1.5">
      <p className={`text-lg font-semibold leading-tight ${toneClass}`}>{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
    </div>
  );
}
