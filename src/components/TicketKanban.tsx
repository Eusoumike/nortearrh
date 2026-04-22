import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { PriorityBadge } from "@/components/badges";
import { toast } from "sonner";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { STATUS_FLOW, STATUS_LABEL, STATUS_TONE, type TicketStatus, TIMED_STAGES } from "@/lib/constants";
import { ToneBadge } from "@/components/ui/tone-badge";
import { formatDuration } from "@/lib/formatters";
import { AutoCloseWarning } from "@/components/AutoCloseWarning";

interface KanbanTicket {
  id: string;
  ticket_number: string;
  title: string;
  status: TicketStatus;
  priority: any;
  client?: { name: string } | null;
  current_stage_started_at: string;
  total_em_atendimento_seconds: number;
  total_aguardando_cliente_seconds: number;
  total_vera_n1_seconds: number;
  total_n2_seconds: number;
  entered_em_atendimento_at: string | null;
  entered_aguardando_cliente_at: string | null;
  entered_vera_n1_at: string | null;
  entered_n2_at: string | null;
}

interface Props {
  tickets: KanbanTicket[];
}

// Para uma etapa cronometrada, calcula o tempo decorrido na etapa atual
function timeOnCurrentStage(t: KanbanTicket, now: number): number {
  const stage = TIMED_STAGES.find((s) => s.key === t.status);
  if (stage) {
    const enteredAt = (t as any)[stage.enteredCol] as string | null;
    if (enteredAt) return Math.max(0, (now - new Date(enteredAt).getTime()) / 1000);
  }
  // Para 'novo'/'resolvido'/'fechado' usa current_stage_started_at
  return Math.max(0, (now - new Date(t.current_stage_started_at).getTime()) / 1000);
}

function TicketCard({ t, now }: { t: KanbanTicket; now: number }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: t.id });
  const navigate = useNavigate();
  const elapsed = timeOnCurrentStage(t, now);

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={() => navigate(`/tickets/${t.id}`)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          navigate(`/tickets/${t.id}`);
        }
      }}
      className={`group cursor-pointer rounded-md border border-border bg-card p-2.5 shadow-sm transition-all hover:border-primary/40 hover:shadow-md active:cursor-grabbing focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
        isDragging ? "opacity-40" : ""
      }`}
    >
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="font-mono text-[10px] text-muted-foreground group-hover:text-primary">
          #{t.ticket_number}
        </span>
        <PriorityBadge priority={t.priority} />
      </div>
      <p className="line-clamp-2 text-xs font-medium leading-snug">{t.title}</p>
      <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
        <span className="truncate">{t.client?.name ?? "Sem cliente"}</span>
        <span className="font-mono shrink-0">{formatDuration(elapsed)}</span>
      </div>
      <AutoCloseWarning
        status={t.status}
        enteredAt={t.entered_aguardando_cliente_at}
        variant="card"
      />
    </div>
  );
}

function Column({ status, tickets, now }: { status: TicketStatus; tickets: KanbanTicket[]; now: number }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div className="flex h-full min-w-0 flex-1 flex-col">
      <div className="mb-2 flex items-center justify-between px-1">
        <ToneBadge tone={STATUS_TONE[status]} dot>
          {STATUS_LABEL[status]}
        </ToneBadge>
        <span className="font-mono text-[11px] text-muted-foreground">{tickets.length}</span>
      </div>
      <div
        ref={setNodeRef}
        className={`flex-1 space-y-2 rounded-lg border border-dashed p-2 transition-colors ${
          isOver ? "border-primary bg-primary/5" : "border-border bg-surface-muted/30"
        }`}
      >
        {tickets.length === 0 ? (
          <p className="py-6 text-center text-[11px] text-muted-foreground">Nenhum chamado</p>
        ) : (
          tickets.map((t) => <TicketCard key={t.id} t={t} now={now} />)
        )}
      </div>
    </div>
  );
}

export function TicketKanban({ tickets }: Props) {
  const qc = useQueryClient();
  const [now, setNow] = useState(() => Date.now());
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(i);
  }, []);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: TicketStatus }) => {
      const { error } = await supabase.from("tickets").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["tickets"] });
      toast.success(`Status alterado para ${STATUS_LABEL[vars.status]}.`);
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Agrupa por status (fechado vai para resolvido)
  const grouped = useMemo(() => {
    const map: Record<TicketStatus, KanbanTicket[]> = {
      novo: [],
      em_atendimento: [],
      aguardando_cliente: [],
      suporte_vera_n1: [],
      abertura_chamado_n2: [],
      resolvido: [],
      fechado: [],
    };
    tickets.forEach((t) => {
      const key = t.status === "fechado" ? "resolvido" : t.status;
      map[key].push(t);
    });
    return map;
  }, [tickets]);

  const activeTicket = activeId ? tickets.find((t) => t.id === activeId) : null;

  const handleDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));
  const handleDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    if (!e.over) return;
    const id = String(e.active.id);
    const newStatus = e.over.id as TicketStatus;
    const ticket = tickets.find((t) => t.id === id);
    if (!ticket) return;
    const currentEffective = ticket.status === "fechado" ? "resolvido" : ticket.status;
    if (currentEffective === newStatus) return;
    updateStatus.mutate({ id, status: newStatus });
  };

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <Card className="p-2 md:p-3">
        <div className="overflow-x-auto">
          <div className="flex min-h-[60vh] gap-2" style={{ minWidth: `${STATUS_FLOW.length * 240}px` }}>
            {STATUS_FLOW.map((status) => (
              <Column key={status} status={status} tickets={grouped[status]} now={now} />
            ))}
          </div>
        </div>
      </Card>
      <DragOverlay>
        {activeTicket ? <TicketCard t={activeTicket} now={now} /> : null}
      </DragOverlay>
    </DndContext>
  );
}
