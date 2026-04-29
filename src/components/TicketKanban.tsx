import { memo, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
import { formatDuration } from "@/lib/formatters";
import { AutoCloseWarning } from "@/components/AutoCloseWarning";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 30;

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

// Map de cor da barra superior da coluna (estilo Pipedrive) por tom semântico
const STRIPE_BY_TONE: Record<string, string> = {
  info: "bg-info",
  warning: "bg-warning",
  muted: "bg-muted-foreground/40",
  success: "bg-success",
  neutral: "bg-muted-foreground/40",
  primary: "bg-primary",
  accent: "bg-accent",
  danger: "bg-danger",
};

// Para uma etapa cronometrada, calcula o tempo decorrido na etapa atual
function timeOnCurrentStage(t: KanbanTicket, now: number): number {
  const stage = TIMED_STAGES.find((s) => s.key === t.status);
  if (stage) {
    const enteredAt = (t as any)[stage.enteredCol] as string | null;
    if (enteredAt) return Math.max(0, (now - new Date(enteredAt).getTime()) / 1000);
  }
  return Math.max(0, (now - new Date(t.current_stage_started_at).getTime()) / 1000);
}

const TicketCard = memo(function TicketCard({ t, now, isOverlay = false }: { t: KanbanTicket; now: number; isOverlay?: boolean }) {
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
      style={{ contain: "layout paint", willChange: isDragging || isOverlay ? "transform" : undefined }}
      className={cn(
        "group cursor-pointer rounded-md border border-border bg-card p-2.5 shadow-sm transition-colors duration-150 hover:border-primary/40 hover:shadow-md active:cursor-grabbing focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        isDragging && !isOverlay && "opacity-30",
        isOverlay && "kanban-dragging shadow-lg",
      )}
    >
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="font-mono text-[10px] text-muted-foreground group-hover:text-primary">
          #{t.ticket_number}
        </span>
        <PriorityBadge priority={t.priority} />
      </div>
      <p className="line-clamp-2 text-xs font-semibold leading-snug">{t.title}</p>
      <div className="mt-2 flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
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
});

function ColumnHeader({ status, count }: { status: TicketStatus; count: number }) {
  const stripe = STRIPE_BY_TONE[STATUS_TONE[status]] ?? "bg-muted-foreground/40";
  return (
    <div className="flex w-72 shrink-0 flex-col rounded-lg bg-surface-muted/60">
      <div className={cn("h-[3px] w-full rounded-t-lg", stripe)} />
      <div className="flex items-center justify-between gap-2 px-3 pb-2 pt-2.5">
        <h3 className="truncate text-[11px] font-semibold uppercase tracking-wide text-foreground/80">
          {STATUS_LABEL[status]}
        </h3>
        <span className="shrink-0 rounded-md bg-background px-1.5 py-0.5 font-mono text-[10px] font-semibold text-muted-foreground">
          {count}
        </span>
      </div>
    </div>
  );
}
const MemoColumnHeader = memo(ColumnHeader);

function ColumnBody({ status, tickets, now }: { status: TicketStatus; tickets: KanbanTicket[]; now: number }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  useEffect(() => {
    setVisibleCount((prev) => Math.min(Math.max(prev, PAGE_SIZE), Math.max(tickets.length, PAGE_SIZE)));
  }, [tickets.length]);

  const visibleTickets = useMemo(() => tickets.slice(0, visibleCount), [tickets, visibleCount]);
  const hasMore = visibleCount < tickets.length;

  const onScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (!hasMore) return;
    const el = e.currentTarget;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 120) {
      setVisibleCount((c) => Math.min(c + PAGE_SIZE, tickets.length));
    }
  };

  return (
    <div
      ref={setNodeRef}
      onScroll={onScroll}
      className={cn(
        "scrollbar-thin flex h-full w-72 shrink-0 flex-1 flex-col overflow-y-auto overflow-x-hidden rounded-lg bg-surface-muted/60 transition-colors",
        isOver && "bg-primary/5 ring-2 ring-inset ring-primary/40",
      )}
      style={{ overscrollBehavior: "contain" }}
    >
      <div className="flex min-h-[80px] flex-col gap-2 px-2 pb-2 pt-2">
        {tickets.length === 0 ? (
          <p className="py-6 text-center text-[11px] text-muted-foreground/70">Nenhum chamado</p>
        ) : (
          <>
            {visibleTickets.map((t) => <TicketCard key={t.id} t={t} now={now} />)}
            {hasMore && (
              <button
                type="button"
                onClick={() => setVisibleCount((c) => Math.min(c + PAGE_SIZE, tickets.length))}
                className="mt-1 rounded-md border border-dashed border-border py-1.5 text-center text-[10px] text-muted-foreground hover:bg-background hover:text-foreground"
              >
                Carregar mais ({tickets.length - visibleCount})
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
const MemoColumnBody = memo(ColumnBody);

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

  const headerScrollRef = useRef<HTMLDivElement | null>(null);
  const bodyScrollRef = useRef<HTMLDivElement | null>(null);

  const handleBodyScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const left = e.currentTarget.scrollLeft;
    if (headerScrollRef.current && headerScrollRef.current.scrollLeft !== left) {
      headerScrollRef.current.scrollLeft = left;
    }
  };

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      {/* Wrapper: linha de headers (fixa) + body do kanban (scroll horizontal sincronizado) */}
      <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 200px)" }}>
        {/* LINHA DE HEADERS — fixa no topo, sincroniza scroll com o body */}
        <div
          ref={headerScrollRef}
          style={{
            flexShrink: 0,
            overflowX: "hidden",
            overflowY: "hidden",
            padding: "0 16px",
            marginBottom: "4px",
          }}
        >
          <div
            style={{
              display: "inline-flex",
              flexDirection: "row",
              gap: "12px",
              minWidth: "max-content",
            }}
          >
            {STATUS_FLOW.map((status) => (
              <MemoColumnHeader key={status} status={status} count={grouped[status].length} />
            ))}
          </div>
        </div>

        {/* BODY DO KANBAN — rola horizontalmente, colunas com scroll vertical próprio */}
        <div
          ref={bodyScrollRef}
          onScroll={handleBodyScroll}
          style={{
            flex: 1,
            minHeight: 0,
            overflowX: "auto",
            overflowY: "hidden",
          }}
        >
          <div
            style={{
              display: "inline-flex",
              flexDirection: "row",
              gap: "12px",
              minWidth: "max-content",
              height: "100%",
              alignItems: "stretch",
              padding: "0 16px 16px",
            }}
          >
            {STATUS_FLOW.map((status) => (
              <MemoColumnBody key={status} status={status} tickets={grouped[status]} now={now} />
            ))}
          </div>
        </div>
      </div>
      <DragOverlay dropAnimation={{ duration: 150, easing: "cubic-bezier(0.16, 1, 0.3, 1)" }}>
        {activeTicket ? <TicketCard t={activeTicket} now={now} isOverlay /> : null}
      </DragOverlay>
    </DndContext>
  );
}
