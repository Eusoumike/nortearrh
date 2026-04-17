import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToneBadge } from "@/components/ui/tone-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ListChecks, Search } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatBrazilDateTime } from "@/lib/formatters";

type TaskFilter = "abertas" | "atrasadas" | "hoje" | "concluidas";

const PRIORITY_TONE: Record<string, "muted" | "info" | "warning"> = {
  baixa: "muted",
  media: "info",
  alta: "warning",
};
const PRIORITY_LABEL: Record<string, string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
};

function isOverdue(due: string | null) {
  if (!due) return false;
  return new Date(due + "T23:59:59-03:00") < new Date();
}
function isToday(due: string | null) {
  if (!due) return false;
  const today = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Sao_Paulo",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
  return due === today;
}

export default function MyTasks() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<TaskFilter>("abertas");
  const [q, setQ] = useState("");

  // Busca todas as tarefas (criadas ou atribuídas ao usuário) + ticket relacionado
  const { data: tasks, isLoading } = useQuery({
    queryKey: ["my-tasks", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("tasks")
        .select("*, ticket:tickets(id, ticket_number, title, status)")
        .or(`assigned_to.eq.${user.id},created_by.eq.${user.id}`)
        .order("due_date", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const toggle = useMutation({
    mutationFn: async ({ id, done }: { id: string; done: boolean }) => {
      const { error } = await supabase
        .from("tasks")
        .update({ status: done ? "concluida" : "pendente" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-tasks", user?.id] }),
    onError: (e: any) => toast.error(e.message),
  });

  const counts = useMemo(() => {
    const list = tasks ?? [];
    const open = list.filter((t: any) => t.status !== "concluida");
    return {
      abertas: open.length,
      atrasadas: open.filter((t: any) => isOverdue(t.due_date)).length,
      hoje: open.filter((t: any) => isToday(t.due_date)).length,
      concluidas: list.filter((t: any) => t.status === "concluida").length,
    };
  }, [tasks]);

  const filtered = useMemo(() => {
    const list = tasks ?? [];
    let out = list;
    if (filter === "abertas") out = list.filter((t: any) => t.status !== "concluida");
    else if (filter === "atrasadas") out = list.filter((t: any) => t.status !== "concluida" && isOverdue(t.due_date));
    else if (filter === "hoje") out = list.filter((t: any) => t.status !== "concluida" && isToday(t.due_date));
    else out = list.filter((t: any) => t.status === "concluida");

    if (q.trim()) {
      const needle = q.trim().toLowerCase();
      out = out.filter(
        (t: any) =>
          t.title?.toLowerCase().includes(needle) ||
          t.ticket?.title?.toLowerCase().includes(needle) ||
          String(t.ticket?.ticket_number ?? "").includes(needle),
      );
    }
    return out;
  }, [tasks, filter, q]);

  return (
    <div className="space-y-4 p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <ListChecks className="h-5 w-5 text-primary" />
            Minhas tarefas
          </h1>
          <p className="text-sm text-muted-foreground">
            Tarefas atribuídas a você ou criadas por você, em todos os chamados.
          </p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar tarefa, chamado, #número…"
            className="h-9 pl-8 text-sm"
          />
        </div>
      </div>

      <Tabs value={filter} onValueChange={(v) => setFilter(v as TaskFilter)}>
        <TabsList>
          <TabsTrigger value="abertas">Abertas <span className="ml-1.5 text-muted-foreground">({counts.abertas})</span></TabsTrigger>
          <TabsTrigger value="atrasadas" className="data-[state=active]:text-destructive">
            Atrasadas <span className="ml-1.5 text-muted-foreground">({counts.atrasadas})</span>
          </TabsTrigger>
          <TabsTrigger value="hoje">Hoje <span className="ml-1.5 text-muted-foreground">({counts.hoje})</span></TabsTrigger>
          <TabsTrigger value="concluidas">Concluídas <span className="ml-1.5 text-muted-foreground">({counts.concluidas})</span></TabsTrigger>
        </TabsList>
      </Tabs>

      <Card className="p-3">
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            Nenhuma tarefa nessa visão.
          </p>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((t: any) => {
              const done = t.status === "concluida";
              const overdue = !done && isOverdue(t.due_date);
              return (
                <div
                  key={t.id}
                  className="flex items-center gap-3 px-2 py-2.5 transition-colors hover:bg-surface-muted/40"
                >
                  <Checkbox
                    checked={done}
                    onCheckedChange={(v) => toggle.mutate({ id: t.id, done: !!v })}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className={cn("truncate text-sm font-medium", done && "text-muted-foreground line-through")}>
                        {t.title}
                      </p>
                      <ToneBadge tone={PRIORITY_TONE[t.priority] ?? "muted"} size="sm">
                        {PRIORITY_LABEL[t.priority] ?? t.priority}
                      </ToneBadge>
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                      {t.ticket && (
                        <Link
                          to={`/tickets/${t.ticket.id}`}
                          className="font-mono text-primary hover:underline"
                        >
                          #{String(t.ticket.ticket_number).padStart(3, "0")} · {t.ticket.title}
                        </Link>
                      )}
                      {t.due_date && (
                        <span className={cn(overdue && "font-medium text-destructive")}>
                          📅 {formatBrazilDateTime(t.due_date + "T12:00:00-03:00").split(" ")[0]}
                          {overdue && " · atrasada"}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
