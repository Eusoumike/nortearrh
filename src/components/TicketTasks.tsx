import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Plus, Pencil } from "lucide-react";
import { ToneBadge } from "@/components/ui/tone-badge";
import { formatBrazilDateTime } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { EditTaskDialog } from "@/components/EditTaskDialog";

const PRIORITIES = [
  { value: "baixa", label: "Baixa", tone: "muted" as const },
  { value: "media", label: "Média", tone: "info" as const },
  { value: "alta", label: "Alta", tone: "warning" as const },
];

const PRIORITY_TONE: Record<string, "muted" | "info" | "warning"> = {
  baixa: "muted",
  media: "info",
  alta: "warning",
};

interface TicketTasksProps {
  ticketId: string;
}

export function TicketTasks({ ticketId }: TicketTasksProps) {
  const { user, role } = useAuth();
  const qc = useQueryClient();
  const canDelete = role === "admin" || role === "manager";

  const [newTitle, setNewTitle] = useState("");
  const [newPriority, setNewPriority] = useState<"baixa" | "media" | "alta">("media");
  const [newDueDate, setNewDueDate] = useState("");
  const [editing, setEditing] = useState<any | null>(null);

  const { data: tasks, isLoading } = useQuery({
    queryKey: ["ticket-tasks", ticketId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("ticket_id", ticketId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const createTask = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Não autenticado");
      const { error } = await supabase.from("tasks").insert({
        ticket_id: ticketId,
        title: newTitle.trim(),
        priority: newPriority,
        status: "pendente",
        due_date: newDueDate || null,
        created_by: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ticket-tasks", ticketId] });
      setNewTitle("");
      setNewDueDate("");
      setNewPriority("media");
      toast.success("Tarefa criada.");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleTask = useMutation({
    mutationFn: async ({ id, done }: { id: string; done: boolean }) => {
      const { error } = await supabase
        .from("tasks")
        .update({ status: done ? "concluida" : "pendente" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ticket-tasks", ticketId] }),
    onError: (e: any) => toast.error(e.message),
  });

  const pending = (tasks ?? []).filter((t: any) => t.status !== "concluida");
  const done = (tasks ?? []).filter((t: any) => t.status === "concluida");

  const renderRow = (t: any) => {
    const isDone = t.status === "concluida";
    const overdue =
      !isDone && t.due_date && new Date(t.due_date + "T23:59:59-03:00") < new Date();
    return (
      <div
        key={t.id}
        className="group flex items-center gap-2 rounded-md border border-border bg-surface p-2 transition-colors hover:bg-surface-muted/40"
      >
        <Checkbox
          checked={isDone}
          onCheckedChange={(v) => toggleTask.mutate({ id: t.id, done: !!v })}
        />
        <button
          type="button"
          onClick={() => setEditing(t)}
          className="min-w-0 flex-1 text-left"
        >
          <p className={cn("truncate text-sm", isDone && "text-muted-foreground line-through")}>
            {t.title}
          </p>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
            <ToneBadge tone={PRIORITY_TONE[t.priority] ?? "muted"} size="sm">
              {PRIORITIES.find((p) => p.value === t.priority)?.label ?? t.priority}
            </ToneBadge>
            {t.category && (
              <ToneBadge tone="muted" size="sm">{t.category}</ToneBadge>
            )}
            {t.due_date && (
              <span className={cn(overdue && "font-medium text-destructive")}>
                📅 {formatBrazilDateTime(t.due_date + "T12:00:00-03:00").split(" ")[0]}
                {overdue && " · atrasada"}
              </span>
            )}
          </div>
        </button>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100"
          onClick={() => setEditing(t)}
          aria-label="Editar tarefa"
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Form criar inline */}
      <div className="grid grid-cols-[1fr_140px_140px_auto] gap-2">
        <Input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && newTitle.trim()) {
              e.preventDefault();
              createTask.mutate();
            }
          }}
          placeholder="Nova tarefa…"
          className="h-9 text-sm"
        />
        <Select value={newPriority} onValueChange={(v) => setNewPriority(v as any)}>
          <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {PRIORITIES.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input
          type="date"
          value={newDueDate}
          onChange={(e) => setNewDueDate(e.target.value)}
          className="h-9 text-xs"
        />
        <Button
          onClick={() => createTask.mutate()}
          disabled={!newTitle.trim() || createTask.isPending}
          size="sm"
          className="bg-gradient-brand text-primary-foreground hover:opacity-90"
        >
          {createTask.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Adicionar
        </Button>
      </div>

      {isLoading ? (
        <p className="py-6 text-center text-xs text-muted-foreground">Carregando…</p>
      ) : (tasks ?? []).length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma tarefa criada ainda.</p>
      ) : (
        <div className="space-y-3">
          {pending.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Pendentes ({pending.length})
              </p>
              {pending.map(renderRow)}
            </div>
          )}

          {done.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Concluídas ({done.length})
              </p>
              {done.map(renderRow)}
            </div>
          )}
        </div>
      )}

      <EditTaskDialog
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        task={editing}
        invalidateKeys={[["ticket-tasks", ticketId]]}
        canDelete={canDelete || editing?.created_by === user?.id}
      />
    </div>
  );
}
