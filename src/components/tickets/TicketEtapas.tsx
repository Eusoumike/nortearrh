import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ToneBadge } from "@/components/ui/tone-badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Loader2, Plus, Pencil, Trash2, GripVertical, Clock, CheckCircle2, Circle, PlayCircle, History } from "lucide-react";
import { formatBrazilDateTime, brazilInputToISO, nowBrasilia } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type EtapaStatus = "pendente" | "em_andamento" | "concluida";

interface Etapa {
  id: string;
  ticket_id: string;
  nome: string;
  descricao: string | null;
  responsavel_id: string | null;
  data_inicio: string | null;
  data_conclusao: string | null;
  prazo: string | null;
  status: EtapaStatus;
  ordem: number;
}

const STATUS_LABEL: Record<EtapaStatus, string> = {
  pendente: "Pendente",
  em_andamento: "Em andamento",
  concluida: "Concluída",
};
const STATUS_TONE: Record<EtapaStatus, "muted" | "info" | "success"> = {
  pendente: "muted",
  em_andamento: "info",
  concluida: "success",
};
const STATUS_ICON: Record<EtapaStatus, typeof Circle> = {
  pendente: Circle,
  em_andamento: PlayCircle,
  concluida: CheckCircle2,
};

interface Props {
  ticketId: string;
}

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Sao_Paulo",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(d);
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${g("year")}-${g("month")}-${g("day")}T${g("hour")}:${g("minute")}`;
}

export function TicketEtapas({ ticketId }: Props) {
  const { user, role } = useAuth();
  const qc = useQueryClient();
  const canManage = role === "admin" || role === "manager";

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Etapa | null>(null);
  const [deleting, setDeleting] = useState<Etapa | null>(null);
  const [historicoOpen, setHistoricoOpen] = useState(false);

  const { data: etapas = [], isLoading } = useQuery({
    queryKey: ["ticket-etapas", ticketId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ticket_etapas" as any)
        .select("*")
        .eq("ticket_id", ticketId)
        .order("ordem", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Etapa[];
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles-min"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, full_name, email").order("full_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const profileName = (id: string | null) => {
    if (!id) return "—";
    const p = profiles.find((x: any) => x.id === id);
    return p?.full_name || p?.email || "—";
  };

  const upsert = useMutation({
    mutationFn: async (payload: Partial<Etapa> & { id?: string }) => {
      if (payload.id) {
        const { error } = await supabase.from("ticket_etapas" as any).update(payload).eq("id", payload.id);
        if (error) throw error;
      } else {
        const maxOrdem = etapas.reduce((m, e) => Math.max(m, e.ordem), -1);
        const { error } = await supabase.from("ticket_etapas" as any).insert({
          ...payload,
          ticket_id: ticketId,
          ordem: maxOrdem + 1,
          created_by: user?.id ?? null,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ticket-etapas", ticketId] });
      setDialogOpen(false);
      setEditing(null);
      toast.success("Etapa salva");
    },
    onError: (e: any) => toast.error(e.message ?? "Falha ao salvar"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("ticket_etapas" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ticket-etapas", ticketId] });
      setDeleting(null);
      toast.success("Etapa removida");
    },
    onError: (e: any) => toast.error(e.message ?? "Falha ao excluir"),
  });

  const reorder = useMutation({
    mutationFn: async (items: Etapa[]) => {
      // Atualiza apenas o campo `ordem` de cada item alterado.
      await Promise.all(
        items.map((e, i) =>
          supabase.from("ticket_etapas" as any).update({ ordem: i }).eq("id", e.id),
        ),
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ticket-etapas", ticketId] }),
    onError: (e: any) => toast.error(e.message ?? "Falha ao reordenar"),
  });

  const setStatus = (etapa: Etapa, status: EtapaStatus) => {
    upsert.mutate({ id: etapa.id, status });
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = etapas.findIndex((x) => x.id === active.id);
    const newIndex = etapas.findIndex((x) => x.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(etapas, oldIndex, newIndex);
    qc.setQueryData(["ticket-etapas", ticketId], next);
    reorder.mutate(next);
  };

  const total = etapas.length;
  const concluidas = etapas.filter((e) => e.status === "concluida").length;
  const progresso = total === 0 ? 0 : Math.round((concluidas / total) * 100);
  const atual = etapas.find((e) => e.status === "em_andamento") ?? etapas.find((e) => e.status === "pendente") ?? null;

  return (
    <div className="space-y-3">
      {/* Header com progresso */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              {concluidas} de {total} concluída(s){atual ? ` · atual: ${atual.nome}` : ""}
            </span>
            <span className="font-medium tabular-nums">{progresso}%</span>
          </div>
          <Progress value={progresso} className="mt-1 h-1.5" />
        </div>
        <div className="flex shrink-0 gap-1">
          <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => setHistoricoOpen(true)}>
            <History className="h-3.5 w-3.5" />
          </Button>
          {canManage && (
            <Button size="sm" className="h-8" onClick={() => { setEditing(null); setDialogOpen(true); }}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Etapa
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <p className="text-xs text-muted-foreground">Carregando…</p>
      ) : total === 0 ? (
        <p className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
          Nenhuma etapa cadastrada.{canManage && " Clique em \"Etapa\" para adicionar."}
        </p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={etapas.map((e) => e.id)} strategy={verticalListSortingStrategy}>
            <ul className="space-y-2">
              {etapas.map((etapa) => (
                <EtapaRow
                  key={etapa.id}
                  etapa={etapa}
                  canManage={canManage}
                  canEditOwn={role === "agent" && etapa.responsavel_id === user?.id}
                  responsavelLabel={profileName(etapa.responsavel_id)}
                  onEdit={() => { setEditing(etapa); setDialogOpen(true); }}
                  onDelete={() => setDeleting(etapa)}
                  onStatus={(s) => setStatus(etapa, s)}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}

      <EtapaDialog
        open={dialogOpen}
        onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditing(null); }}
        etapa={editing}
        profiles={profiles}
        canManage={canManage}
        onSubmit={(values) => upsert.mutate(editing ? { ...values, id: editing.id } : values)}
        saving={upsert.isPending}
      />

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir etapa?</AlertDialogTitle>
            <AlertDialogDescription>
              A etapa "{deleting?.nome}" será removida. Esta ação é registrada no histórico.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleting && remove.mutate(deleting.id)}>
              {remove.isPending && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <HistoricoDialog open={historicoOpen} onOpenChange={setHistoricoOpen} ticketId={ticketId} profiles={profiles} />
    </div>
  );
}

/* ---------------------------- Sortable row ---------------------------- */

function EtapaRow({
  etapa, canManage, canEditOwn, responsavelLabel, onEdit, onDelete, onStatus,
}: {
  etapa: Etapa;
  canManage: boolean;
  canEditOwn: boolean;
  responsavelLabel: string;
  onEdit: () => void;
  onDelete: () => void;
  onStatus: (s: EtapaStatus) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: etapa.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const Icon = STATUS_ICON[etapa.status];
  const canEditThis = canManage || canEditOwn;
  const overdue = etapa.prazo && etapa.status !== "concluida" && new Date(etapa.prazo) < new Date();

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn(
        "rounded-md border bg-card p-3 transition",
        isDragging && "opacity-60 shadow-lg",
        etapa.status === "concluida" && "bg-muted/40",
      )}
    >
      <div className="flex items-start gap-2">
        {canManage && (
          <button
            type="button"
            className="mt-0.5 cursor-grab text-muted-foreground hover:text-foreground"
            {...attributes}
            {...listeners}
            aria-label="Reordenar"
          >
            <GripVertical className="h-4 w-4" />
          </button>
        )}
        <Icon
          className={cn(
            "mt-0.5 h-4 w-4 shrink-0",
            etapa.status === "concluida" && "text-success",
            etapa.status === "em_andamento" && "text-primary",
            etapa.status === "pendente" && "text-muted-foreground",
          )}
        />
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn("text-sm font-medium", etapa.status === "concluida" && "line-through text-muted-foreground")}>
              {etapa.nome}
            </span>
            <ToneBadge tone={STATUS_TONE[etapa.status]}>{STATUS_LABEL[etapa.status]}</ToneBadge>
            {overdue && <ToneBadge tone="warning">Prazo vencido</ToneBadge>}
          </div>
          {etapa.descricao && (
            <p className="text-xs text-muted-foreground whitespace-pre-wrap">{etapa.descricao}</p>
          )}
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            <span>👤 {responsavelLabel}</span>
            {etapa.prazo && <span className={cn("inline-flex items-center gap-1", overdue && "text-warning")}><Clock className="h-3 w-3" /> {formatBrazilDateTime(etapa.prazo)}</span>}
            {etapa.data_inicio && <span>Início: {formatBrazilDateTime(etapa.data_inicio)}</span>}
            {etapa.data_conclusao && <span>Concluída: {formatBrazilDateTime(etapa.data_conclusao)}</span>}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {canEditThis && (
            <Select value={etapa.status} onValueChange={(v) => onStatus(v as EtapaStatus)}>
              <SelectTrigger className="h-7 w-[140px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="em_andamento">Em andamento</SelectItem>
                <SelectItem value="concluida">Concluída</SelectItem>
              </SelectContent>
            </Select>
          )}
          {canManage && (
            <>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onEdit}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={onDelete}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
        </div>
      </div>
    </li>
  );
}

/* ---------------------------- Dialog ---------------------------- */

function EtapaDialog({
  open, onOpenChange, etapa, profiles, canManage, onSubmit, saving,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  etapa: Etapa | null;
  profiles: any[];
  canManage: boolean;
  onSubmit: (values: Partial<Etapa>) => void;
  saving: boolean;
}) {
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [responsavelId, setResponsavelId] = useState<string>("__none__");
  const [prazo, setPrazo] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [status, setStatus] = useState<EtapaStatus>("pendente");

  // Reset on open
  useMemo(() => {
    if (open) {
      setNome(etapa?.nome ?? "");
      setDescricao(etapa?.descricao ?? "");
      setResponsavelId(etapa?.responsavel_id ?? "__none__");
      setPrazo(toLocalInput(etapa?.prazo ?? null));
      setDataInicio(toLocalInput(etapa?.data_inicio ?? null));
      setStatus(etapa?.status ?? "pendente");
    }
  }, [open, etapa]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) return;
    onSubmit({
      nome: nome.trim(),
      descricao: descricao.trim() || null,
      responsavel_id: responsavelId === "__none__" ? null : responsavelId,
      prazo: brazilInputToISO(prazo),
      data_inicio: brazilInputToISO(dataInicio),
      status,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{etapa ? "Editar etapa" : "Nova etapa"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label>Nome *</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} required disabled={!canManage && !etapa} />
          </div>
          <div className="space-y-1.5">
            <Label>Descrição</Label>
            <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={3} disabled={!canManage && !etapa} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Responsável</Label>
              <Select value={responsavelId} onValueChange={setResponsavelId} disabled={!canManage}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Sem responsável</SelectItem>
                  {profiles.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>{p.full_name || p.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as EtapaStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="em_andamento">Em andamento</SelectItem>
                  <SelectItem value="concluida">Concluída</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Data de início</Label>
              <Input type="datetime-local" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Prazo</Label>
              <Input type="datetime-local" value={prazo} onChange={(e) => setPrazo(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={saving || !nome.trim()}>
              {saving && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------------------- Histórico ---------------------------- */

function HistoricoDialog({
  open, onOpenChange, ticketId, profiles,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  ticketId: string;
  profiles: any[];
}) {
  const { data = [], isLoading } = useQuery({
    queryKey: ["ticket-etapa-historico", ticketId],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ticket_etapa_historico" as any)
        .select("*")
        .eq("ticket_id", ticketId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const userLabel = (id: string | null) => {
    if (!id) return "Sistema";
    const p = profiles.find((x: any) => x.id === id);
    return p?.full_name || p?.email || "Usuário";
  };

  const acaoLabel: Record<string, string> = {
    criada: "criou",
    editada: "editou",
    concluida: "concluiu",
    excluida: "excluiu",
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Histórico de etapas</DialogTitle>
        </DialogHeader>
        <div className="max-h-[420px] space-y-2 overflow-y-auto">
          {isLoading ? (
            <p className="text-xs text-muted-foreground">Carregando…</p>
          ) : data.length === 0 ? (
            <p className="text-xs text-muted-foreground">Sem registros ainda.</p>
          ) : (
            data.map((h: any) => {
              const nome = h.payload?.depois?.nome ?? h.payload?.nome ?? "etapa";
              return (
                <div key={h.id} className="rounded border bg-card p-2 text-xs">
                  <div className="font-medium">
                    {userLabel(h.user_id)} {acaoLabel[h.acao] ?? h.acao} <span className="text-muted-foreground">"{nome}"</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground">{formatBrazilDateTime(h.created_at)}</div>
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
