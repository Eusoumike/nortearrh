import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge, PriorityBadge } from "@/components/badges";
import { SLAIndicator } from "@/components/SLAIndicator";
import { ToneBadge } from "@/components/ui/tone-badge";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, MessageSquare, Mail, Phone, FileText, Loader2, Calendar as CalendarIcon, Trash2, Pencil, ListChecks, Building2, History, Send, Monitor, Copy, Plus, ChevronLeft, ChevronRight } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { TicketTasks } from "@/components/TicketTasks";
import { TicketTasksSummary } from "@/components/TicketTasksSummary";
import { EditTicketDialog } from "@/components/EditTicketDialog";
import { UserAvatar } from "@/components/UserAvatar";
import { AutoCloseWarning } from "@/components/AutoCloseWarning";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  STATUS_LABEL,
  STATUS_FLOW,
  PRIORITY_LABEL,
  CHANNEL_LABEL,
  INTERACTION_LABEL,
  TICKET_TYPE_LABEL,
  TICKET_TYPE_GROUPS,
  INTERACTION_RESULT_LABEL,
  INTERACTION_RESULT_TONE,
  TIMED_STAGES,
  SLA_PER_STAGE_HOURS,
  type TicketStatus,
  type TicketPriority,
  type TicketType,
  type InteractionType,
  type InteractionResult,
  type TicketChannel,
} from "@/lib/constants";
import { timeAgo, formatDuration, nowBrasilia, brazilInputToISO, formatBrazilDateTime } from "@/lib/formatters";

const TYPE_ICON: Record<InteractionType, React.ComponentType<{ className?: string }>> = {
  nota: FileText,
  anotacao: FileText,
  email: Mail,
  ligacao: Phone,
  whatsapp: MessageSquare,
  reuniao: CalendarIcon,
  remoto: MessageSquare,
  mudanca_status: FileText,
};

export default function TicketDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const qc = useQueryClient();
  const [now, setNow] = useState(() => Date.now());
  const [editOpen, setEditOpen] = useState(false);
  const canDelete = role === "admin" || role === "manager";

  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(i);
  }, []);

  const { data: ticket, isLoading } = useQuery({
    queryKey: ["ticket", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tickets")
        .select("*, client:clients!fk_tickets_client(id, name, email, company, phone, health, anydesk_id, anydesk_senha), assignee:profiles!assigned_to(id, full_name, avatar_url, email), creator:profiles!created_by(full_name, avatar_url)")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: interactions } = useQuery({
    queryKey: ["interactions", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ticket_interactions")
        .select("*, author:profiles!author_id(full_name, avatar_url)")
        .eq("ticket_id", id!)
        .order("interaction_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: clientHistory } = useQuery({
    queryKey: ["client-history", ticket?.client_id, id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tickets")
        .select("id, ticket_number, title, status, ticket_type, created_at")
        .eq("client_id", ticket!.client_id!)
        .neq("id", id!)
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data;
    },
    enabled: !!ticket?.client_id,
  });

  // Vizinhos no kanban: mesma coluna (status) ordem desc por created_at, igual ao kanban
  const effectiveStatus = ticket?.status === "fechado" ? "resolvido" : ticket?.status;
  const { data: columnSiblings } = useQuery({
    queryKey: ["ticket-column-siblings", effectiveStatus],
    enabled: !!effectiveStatus,
    queryFn: async () => {
      const statuses = effectiveStatus === "resolvido" ? ["resolvido", "fechado"] : [effectiveStatus!];
      const { data, error } = await supabase
        .from("tickets")
        .select("id, created_at")
        .in("status", statuses as any)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { prevTicketId, nextTicketId } = useMemo(() => {
    if (!columnSiblings || !id) return { prevTicketId: null as string | null, nextTicketId: null as string | null };
    const idx = columnSiblings.findIndex((t: any) => t.id === id);
    if (idx === -1) return { prevTicketId: null, nextTicketId: null };
    return {
      prevTicketId: idx > 0 ? (columnSiblings[idx - 1] as any).id : null,
      nextTicketId: idx < columnSiblings.length - 1 ? (columnSiblings[idx + 1] as any).id : null,
    };
  }, [columnSiblings, id]);

  // Atalhos: Alt+← / Alt+→
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.altKey) return;
      if (e.key === "ArrowLeft" && prevTicketId) {
        e.preventDefault();
        navigate(`/tickets/${prevTicketId}`);
      } else if (e.key === "ArrowRight" && nextTicketId) {
        e.preventDefault();
        navigate(`/tickets/${nextTicketId}`);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [prevTicketId, nextTicketId, navigate]);

  const { data: profiles } = useQuery({
    queryKey: ["profiles-min"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, full_name, avatar_url");
      if (error) throw error;
      return data;
    },
  });

  const myProfile = profiles?.find((p) => p.id === user?.id);

  const updateStatus = useMutation({
    mutationFn: async (status: TicketStatus) => {
      const { error } = await supabase.from("tickets").update({ status }).eq("id", id!);
      if (error) throw error;
    },
    onSuccess: (_d, status) => {
      qc.invalidateQueries({ queryKey: ["ticket", id] });
      qc.invalidateQueries({ queryKey: ["tickets"] });
      toast.success(`Status alterado para ${STATUS_LABEL[status]}.`);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateField = useMutation({
    mutationFn: async (patch: { priority?: TicketPriority; assigned_to?: string | null; ticket_type?: TicketType | null }) => {
      const { error } = await supabase.from("tickets").update(patch).eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ticket", id] });
      qc.invalidateQueries({ queryKey: ["tickets"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteTicket = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("tickets").delete().eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tickets"] });
      qc.invalidateQueries({ queryKey: ["dashboard-tickets"] });
      toast.success("Chamado excluído.");
      navigate("/tickets");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const [newInt, setNewInt] = useState({
    type: "ligacao" as InteractionType,
    channel: "telefone" as TicketChannel,
    summary: "",
    result: "resolvido" as InteractionResult,
    interaction_at: nowBrasilia(),
    time_spent_minutes: "" as string,
    is_internal: true,
  });

  const addInteraction = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Não autenticado");
      const { error } = await supabase.from("ticket_interactions").insert({
        ticket_id: id!,
        type: newInt.type,
        channel: newInt.channel,
        result: newInt.result,
        interaction_at: brazilInputToISO(newInt.interaction_at) ?? new Date().toISOString(),
        time_spent_minutes: newInt.time_spent_minutes ? parseInt(newInt.time_spent_minutes, 10) : null,
        summary: newInt.summary,
        content: newInt.summary,
        is_internal: newInt.is_internal,
        author_id: user.id,
      });
      if (error) throw error;
      return newInt.result;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["interactions", id] });
      qc.invalidateQueries({ queryKey: ["ticket", id] });
      toast.success("Atendimento registrado.");

      setNewInt({
        type: "ligacao",
        channel: "telefone",
        summary: "",
        result: "resolvido",
        interaction_at: nowBrasilia(),
        time_spent_minutes: "",
        is_internal: true,
      });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const [editingInteractionId, setEditingInteractionId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");

  const updateInteraction = useMutation({
    mutationFn: async ({ id: intId, summary }: { id: string; summary: string }) => {
      const { error } = await supabase
        .from("ticket_interactions")
        .update({ summary, content: summary })
        .eq("id", intId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["interactions", id] });
      toast.success("Atendimento atualizado.");
      setEditingInteractionId(null);
      setEditingText("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteInteraction = useMutation({
    mutationFn: async (intId: string) => {
      const { error } = await supabase.from("ticket_interactions").delete().eq("id", intId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["interactions", id] });
      toast.success("Atendimento removido.");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const [anydeskEditOpen, setAnydeskEditOpen] = useState(false);
  const [anydeskDraft, setAnydeskDraft] = useState({ id: "" });

  const saveClientAnydesk = useMutation({
    mutationFn: async () => {
      if (!ticket?.client_id) throw new Error("Cliente não vinculado ao chamado.");
      const idTrim = anydeskDraft.id.trim();
      const idDigits = idTrim.replace(/[\s-]/g, "");
      if (!idTrim) throw new Error("Informe o ID do AnyDesk.");
      if (!/^\d+$/.test(idDigits)) throw new Error("ID do AnyDesk inválido: use apenas números.");
      if (idDigits.length < 6 || idDigits.length > 12) throw new Error("ID do AnyDesk inválido: deve ter entre 6 e 12 dígitos.");
      const { error } = await supabase
        .from("clients")
        .update({
          anydesk_id: idDigits,
          anydesk_senha: null,
        } as any)
        .eq("id", ticket.client_id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ticket", id] });
      qc.invalidateQueries({ queryKey: ["client", ticket?.client_id] });
      qc.invalidateQueries({ queryKey: ["clients"] });
      toast.success("AnyDesk cadastrado.");
      setAnydeskEditOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado`);
  };

  const lastInteractionAt = useMemo(() => {
    if (!interactions || interactions.length === 0) return null;
    return interactions
      .map((i: any) => i.interaction_at as string)
      .sort()
      .at(-1) ?? null;
  }, [interactions]);

  if (isLoading || !ticket) {
    return <div className="space-y-3 p-6"><Skeleton className="h-6 w-32" /><Skeleton className="h-32" /><Skeleton className="h-64" /></div>;
  }

  const isClosed = ["resolvido", "fechado"].includes(ticket.status);
  const interactionFormReady = newInt.summary.trim().length > 0;
  const effectiveStatusTyped: TicketStatus = ticket.status === "fechado" ? "resolvido" : ticket.status;

  const stageDurations = TIMED_STAGES.map((stage) => {
    const total = ((ticket as any)[stage.totalCol] as number) ?? 0;
    const enteredAt = (ticket as any)[stage.enteredCol] as string | null;
    const live = enteredAt ? Math.max(0, (now - new Date(enteredAt).getTime()) / 1000) : 0;
    return {
      ...stage,
      seconds: total + live,
      isActive: ticket.status === stage.key,
    };
  });

  const clientCompany = (ticket.client as any)?.company;
  const clientEmail = (ticket.client as any)?.email;
  const clientPhone = (ticket.client as any)?.phone;
  const anydeskId = (ticket.client as any)?.anydesk_id ?? (ticket as any).anydesk_id ?? "";
  const hasAnydesk = Boolean(anydeskId);

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <Link to="/tickets" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Voltar para tickets
        </Link>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => setEditOpen(true)}>
            <Pencil className="h-3.5 w-3.5" />
            Editar
          </Button>
          {canDelete && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10 hover:text-destructive">
                  <Trash2 className="h-3.5 w-3.5" />
                  Excluir
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Excluir chamado #{ticket.ticket_number}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta ação é permanente. Todos os atendimentos e o histórico de status deste chamado também serão removidos.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => deleteTicket.mutate()}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {deleteTicket.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Excluir
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        {/* COLUNA ESQUERDA */}
        <div className="space-y-6 min-w-0">
          {/* Header — bloco com fundo sutil */}
          <div className="rounded-xl border border-border bg-gradient-to-br from-surface to-surface-muted/40 p-5 space-y-3 shadow-sm">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs">
                <span className="font-mono font-medium text-muted-foreground">#{ticket.ticket_number}</span>
                <span className="text-muted-foreground">·</span>
                <span className="text-muted-foreground">
                  Aberto {timeAgo(ticket.opened_at ?? ticket.created_at)} por {(ticket as any).creator?.full_name ?? "—"}
                </span>
              </div>
              <div className="flex items-start gap-2">
                <h1 className="flex-1 text-2xl font-semibold tracking-tight leading-tight text-foreground">{ticket.title}</h1>
                <div className="flex shrink-0 items-center gap-1 pt-0.5">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    disabled={!prevTicketId}
                    onClick={() => prevTicketId && navigate(`/tickets/${prevTicketId}`)}
                    title="Chamado anterior na coluna (Alt + ←)"
                    aria-label="Chamado anterior"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    disabled={!nextTicketId}
                    onClick={() => nextTicketId && navigate(`/tickets/${nextTicketId}`)}
                    title="Próximo chamado na coluna (Alt + →)"
                    aria-label="Próximo chamado"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <StatusBadge status={ticket.status} />
              <PriorityBadge priority={ticket.priority} />
              <ToneBadge tone="muted">{CHANNEL_LABEL[ticket.channel as keyof typeof CHANNEL_LABEL]}</ToneBadge>
              {(ticket as any).ticket_type && (
                <ToneBadge tone="info">{TICKET_TYPE_LABEL[(ticket as any).ticket_type as TicketType]}</ToneBadge>
              )}
              <SLAIndicator deadline={ticket.sla_resolution_deadline} resolved={isClosed} label="Resolução" size="sm" />
              {ticket.sla_response_deadline && !ticket.first_response_at && (
                <SLAIndicator deadline={ticket.sla_response_deadline} label="1ª resp." size="sm" />
              )}
            </div>
            <AutoCloseWarning
              status={ticket.status}
              enteredAt={(ticket as any).entered_aguardando_cliente_at}
              lastInteractionAt={lastInteractionAt}
            />
            {ticket.description && (
              <p className="whitespace-pre-wrap border-t border-border/60 pt-3 text-sm leading-relaxed text-muted-foreground">
                {ticket.description}
              </p>
            )}
            {ticket.client && (
              <div className="space-y-3 border-t border-border/60 pt-3">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <Link to={`/clientes/${ticket.client.id}`} className="flex items-center gap-2 text-sm font-semibold hover:text-primary">
                    <UserAvatar name={ticket.client.name} size="sm" />
                    {ticket.client.name}
                  </Link>
                  {clientCompany && (
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <Building2 className="h-3 w-3" />
                      {clientCompany}
                    </span>
                  )}
                  {clientEmail && (
                    <a href={`mailto:${clientEmail}`} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary">
                      <Mail className="h-3 w-3" />
                      {clientEmail}
                    </a>
                  )}
                  {clientPhone && (
                    <a href={`tel:${clientPhone}`} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary">
                      <Phone className="h-3 w-3" />
                      {clientPhone}
                    </a>
                  )}
                </div>

                {/* Acesso Remoto - AnyDesk */}
                <div className="rounded-lg border border-border bg-surface-muted/30 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      <Monitor className="h-3.5 w-3.5" />
                      Acesso Remoto (AnyDesk)
                    </div>
                    {hasAnydesk && !anydeskEditOpen && ticket.client_id && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={() => {
                          setAnydeskDraft({ id: anydeskId });
                          setAnydeskEditOpen(true);
                        }}
                      >
                        <Pencil className="mr-1 h-3 w-3" />
                        Editar
                      </Button>
                    )}
                  </div>

                  {anydeskEditOpen ? (
                    <div className="space-y-2">
                      <Input
                        value={anydeskDraft.id}
                        onChange={(e) => setAnydeskDraft({ id: e.target.value })}
                        placeholder="ID AnyDesk"
                        className="h-8 text-xs"
                        inputMode="numeric"
                      />
                      <div className="flex justify-end gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => setAnydeskEditOpen(false)}
                        >
                          Cancelar
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          className="h-7 text-xs"
                          disabled={saveClientAnydesk.isPending || !anydeskDraft.id.trim()}
                          onClick={() => saveClientAnydesk.mutate()}
                        >
                          {saveClientAnydesk.isPending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                          Salvar
                        </Button>
                      </div>
                    </div>
                  ) : hasAnydesk ? (
                    <div className="flex items-center justify-between gap-2 rounded border border-border/50 bg-background px-2 py-1.5">
                      <div className="min-w-0">
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">ID</div>
                        <div className="truncate font-mono text-xs">{anydeskId || "—"}</div>
                      </div>
                      {anydeskId && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 shrink-0"
                          onClick={() => copyToClipboard(anydeskId, "ID")}
                          title="Copiar ID"
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => {
                        setAnydeskDraft({ id: "" });
                        setAnydeskEditOpen(true);
                      }}
                    >
                      <Plus className="mr-1 h-3 w-3" />
                      Cadastrar AnyDesk
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Atendimentos */}
          <div>
            <Tabs defaultValue="add">
              <TabsList className="h-9 bg-surface-muted">
                <TabsTrigger value="add" className="gap-1.5 text-xs"><Send className="h-3 w-3" />Registrar</TabsTrigger>
                <TabsTrigger value="timeline" className="gap-1.5 text-xs"><History className="h-3 w-3" />Histórico {interactions && interactions.length > 0 && <span className="ml-0.5 rounded-full bg-muted px-1.5 text-[10px] font-medium">{interactions.length}</span>}</TabsTrigger>
                <TabsTrigger value="tasks" className="gap-1.5 text-xs"><ListChecks className="h-3 w-3" />Tarefas</TabsTrigger>
              </TabsList>


              <TabsContent value="timeline" className="m-0 mt-4">
                {!interactions || interactions.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border py-10 text-center">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                      <History className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <p className="text-xs text-muted-foreground">Nenhum atendimento registrado ainda.</p>
                  </div>
                ) : (
                  <ol className="relative space-y-4 border-l border-border pl-5">
                    {interactions.map((it: any) => {
                      const Icon = TYPE_ICON[it.type as InteractionType] ?? FileText;
                      const summaryText = it.summary || it.content;
                      const hasLegacy = !summaryText && (it.problem_description || it.solution_applied);
                      const isAuthor = user?.id === it.author_id;
                      const canEdit = isAuthor;
                      const canRemove = isAuthor || role === "admin" || role === "manager";
                      const isEditing = editingInteractionId === it.id;
                      return (
                        <li key={it.id} className="group relative">
                          <span className="absolute -left-[27px] top-0.5 flex h-5 w-5 items-center justify-center rounded-full border border-border bg-card text-primary">
                            <Icon className="h-2.5 w-2.5" />
                          </span>
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                            <UserAvatar name={it.author?.full_name} url={it.author?.avatar_url} size="xs" />
                            <span className="font-medium">{it.author?.full_name ?? "Sistema"}</span>
                            <span className="text-muted-foreground">{INTERACTION_LABEL[it.type as InteractionType].toLowerCase()}</span>
                            <span className="text-muted-foreground">·</span>
                            <span className="text-muted-foreground">{timeAgo(it.interaction_at ?? it.created_at)}</span>
                            {it.result && (
                              <ToneBadge tone={INTERACTION_RESULT_TONE[it.result as InteractionResult]} size="sm">
                                {INTERACTION_RESULT_LABEL[it.result as InteractionResult]}
                              </ToneBadge>
                            )}
                            {it.time_spent_minutes != null && (
                              <span className="text-muted-foreground">· {it.time_spent_minutes} min</span>
                            )}
                            <div className="ml-auto flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                              {canEdit && !isEditing && (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-6 w-6"
                                  title="Editar"
                                  onClick={() => {
                                    setEditingInteractionId(it.id);
                                    setEditingText(summaryText ?? "");
                                  }}
                                >
                                  <Pencil className="h-3 w-3" />
                                </Button>
                              )}
                              {canRemove && !isEditing && (
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive hover:text-destructive" title="Excluir">
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Excluir atendimento?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Esta ação não pode ser desfeita.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => deleteInteraction.mutate(it.id)}
                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                      >
                                        Excluir
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              )}
                            </div>
                          </div>
                          {isEditing ? (
                            <div className="mt-2 space-y-2">
                              <Textarea
                                rows={3}
                                value={editingText}
                                onChange={(e) => setEditingText(e.target.value)}
                                className="text-sm"
                              />
                              <div className="flex items-center gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => updateInteraction.mutate({ id: it.id, summary: editingText.trim() })}
                                  disabled={updateInteraction.isPending || !editingText.trim()}
                                >
                                  {updateInteraction.isPending && <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />}
                                  Salvar
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setEditingInteractionId(null);
                                    setEditingText("");
                                  }}
                                >
                                  Cancelar
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <>
                              {summaryText && (
                                <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{summaryText}</p>
                              )}
                              {hasLegacy && (
                                <div className="mt-1 space-y-1 text-sm">
                                  {it.problem_description && <p className="whitespace-pre-wrap"><span className="font-medium">Problema:</span> {it.problem_description}</p>}
                                  {it.solution_applied && <p className="whitespace-pre-wrap text-muted-foreground"><span className="font-medium text-foreground">Solução:</span> {it.solution_applied}</p>}
                                </div>
                              )}
                            </>
                          )}
                        </li>
                      );
                    })}
                  </ol>
                )}
              </TabsContent>

              <TabsContent value="add" className="m-0 mt-4">
                <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-shadow focus-within:shadow-md focus-within:ring-1 focus-within:ring-primary/20">
                  <div className="flex items-center gap-2 border-b border-border bg-surface-muted/40 px-4 py-2.5">
                    <UserAvatar name={myProfile?.full_name ?? user?.email} url={myProfile?.avatar_url} size="sm" />
                    <div className="min-w-0 flex-1 text-xs">
                      <div className="truncate font-medium text-foreground">{myProfile?.full_name ?? user?.email}</div>
                      <div className="text-[10px] text-muted-foreground">Registrando atendimento agora</div>
                    </div>
                  </div>

                  <Textarea
                    rows={4}
                    value={newInt.summary}
                    onChange={(e) => setNewInt({ ...newInt, summary: e.target.value })}
                    placeholder="O que aconteceu neste atendimento? Descreva o problema e a solução…"
                    className="resize-none rounded-none border-0 bg-card px-4 py-3 text-sm leading-relaxed focus-visible:ring-0"
                  />

                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-surface-muted/30 px-3 py-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Select value={newInt.type} onValueChange={(v) => setNewInt({ ...newInt, type: v as InteractionType })}>
                        <SelectTrigger className="h-8 w-[130px] border-border/60 bg-card text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(INTERACTION_LABEL).filter(([k]) => k !== "mudanca_status").map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Select value={newInt.channel} onValueChange={(v) => setNewInt({ ...newInt, channel: v as TicketChannel })}>
                        <SelectTrigger className="h-8 w-[130px] border-border/60 bg-card text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(CHANNEL_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className={cn(
                              "h-8 justify-start gap-1.5 border-border/60 bg-card px-2.5 text-xs font-normal",
                              !newInt.interaction_at && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="h-3.5 w-3.5 opacity-70" />
                            {newInt.interaction_at
                              ? format(new Date(newInt.interaction_at), "dd MMM yyyy 'às' HH:mm", { locale: ptBR })
                              : "Escolher data"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            locale={ptBR}
                            selected={newInt.interaction_at ? new Date(newInt.interaction_at) : undefined}
                            onSelect={(d) => {
                              if (!d) return;
                              const current = newInt.interaction_at ? new Date(newInt.interaction_at) : new Date();
                              d.setHours(current.getHours(), current.getMinutes(), 0, 0);
                              const yyyy = d.getFullYear();
                              const mm = String(d.getMonth() + 1).padStart(2, "0");
                              const dd = String(d.getDate()).padStart(2, "0");
                              const hh = String(d.getHours()).padStart(2, "0");
                              const mi = String(d.getMinutes()).padStart(2, "0");
                              setNewInt({ ...newInt, interaction_at: `${yyyy}-${mm}-${dd}T${hh}:${mi}` });
                            }}
                            initialFocus
                            className={cn("p-3 pointer-events-auto")}
                          />
                          <div className="flex items-center gap-2 border-t border-border p-3">
                            <span className="text-xs text-muted-foreground">Horário</span>
                            <Input
                              type="time"
                              value={newInt.interaction_at ? newInt.interaction_at.slice(11, 16) : "00:00"}
                              onChange={(e) => {
                                const time = e.target.value;
                                const datePart = newInt.interaction_at ? newInt.interaction_at.slice(0, 10) : nowBrasilia().slice(0, 10);
                                setNewInt({ ...newInt, interaction_at: `${datePart}T${time}` });
                              }}
                              className="h-8 w-[110px] text-xs"
                            />
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => addInteraction.mutate()}
                      disabled={!interactionFormReady || addInteraction.isPending}
                      className="bg-gradient-brand text-primary-foreground shadow-sm hover:opacity-90"
                    >
                      {addInteraction.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Send className="mr-1.5 h-3.5 w-3.5" />}
                      Registrar
                    </Button>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="tasks" className="m-0 mt-4">
                <TicketTasks ticketId={id!} />
              </TabsContent>
            </Tabs>
          </div>

          {/* Histórico do cliente — linha compacta */}
          {ticket.client_id && clientHistory && clientHistory.length > 0 && (
            <div className="rounded-lg border border-border bg-surface-muted/30 p-3">
              <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <History className="h-3 w-3" />
                Outros chamados deste cliente
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1.5 text-xs">
                {clientHistory.map((h: any) => (
                  <Link
                    key={h.id}
                    to={`/tickets/${h.id}`}
                    className="inline-flex items-center gap-1.5 rounded-md bg-surface px-2 py-1 text-muted-foreground transition-colors hover:bg-card hover:text-foreground hover:shadow-sm"
                  >
                    <span className="font-mono text-[11px] text-primary">#{h.ticket_number}</span>
                    <span className="max-w-[180px] truncate">{h.title}</span>
                    <span className="text-[10px]">· {timeAgo(h.created_at)}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* COLUNA DIREITA */}
        <aside className="space-y-4">
          {/* Status */}
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Status</p>
            <Select value={effectiveStatusTyped} onValueChange={(v) => updateStatus.mutate(v as TicketStatus)}>
              <SelectTrigger className="h-10 text-sm font-medium"><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUS_FLOW.map((k) => <SelectItem key={k} value={k}>{STATUS_LABEL[k]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <TicketTasksSummary ticketId={id!} />

          {/* Tempo por etapa — com barra de progresso */}
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Tempo por etapa</p>
            <div className="space-y-2.5">
              {stageDurations.map((s) => {
                const slaSec = SLA_PER_STAGE_HOURS[s.key] * 3600;
                const overSla = s.seconds > slaSec;
                const pct = Math.min(100, (s.seconds / slaSec) * 100);
                const barColor = overSla ? "bg-danger" : s.isActive ? "bg-primary" : s.seconds > 0 ? "bg-success" : "bg-muted";
                return (
                  <div key={s.key} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className={`flex items-center gap-1.5 truncate ${s.isActive ? "font-medium text-primary" : ""}`}>
                        {s.isActive && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />}
                        {s.label}
                      </span>
                      <span className={`font-mono text-[11px] ${overSla ? "text-danger font-semibold" : s.isActive ? "text-primary font-semibold" : "text-muted-foreground"}`}>
                        {s.seconds > 0 ? formatDuration(s.seconds) : "—"}
                      </span>
                    </div>
                    <div className="h-1 overflow-hidden rounded-full bg-muted">
                      <div className={`h-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Detalhes */}
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Detalhes</p>
            <InlineField label="Tipo">
              <Select
                value={(ticket as any).ticket_type ?? ""}
                onValueChange={(v) => updateField.mutate({ ticket_type: v as TicketType })}
              >
                <SelectTrigger className="h-7 text-xs border-0 px-1.5 hover:bg-surface-muted"><SelectValue placeholder="Classificar…" /></SelectTrigger>
                <SelectContent className="max-h-[320px]">
                  {TICKET_TYPE_GROUPS.map((group, idx) => (
                    <div key={group.label}>
                      {idx > 0 && <SelectSeparator />}
                      <SelectGroup>
                        <SelectLabel className="text-[10px] uppercase tracking-wider">{group.label}</SelectLabel>
                        {group.types.map((t) => (
                          <SelectItem key={t} value={t}>{TICKET_TYPE_LABEL[t]}</SelectItem>
                        ))}
                      </SelectGroup>
                    </div>
                  ))}
                </SelectContent>
              </Select>
            </InlineField>
            <InlineField label="Prioridade">
              <Select value={ticket.priority} onValueChange={(v) => updateField.mutate({ priority: v as TicketPriority })}>
                <SelectTrigger className="h-7 text-xs border-0 px-1.5 hover:bg-surface-muted"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(PRIORITY_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </InlineField>
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="text-muted-foreground">Responsável</span>
              <div className="flex min-w-0 max-w-[65%] items-center gap-1.5">
                {ticket.assignee && <UserAvatar name={(ticket as any).assignee.full_name} url={(ticket as any).assignee.avatar_url} size="xs" />}
                <Select value={ticket.assigned_to ?? "unassigned"} onValueChange={(v) => updateField.mutate({ assigned_to: v === "unassigned" ? null : v })}>
                  <SelectTrigger className="h-7 text-xs border-0 px-1.5 hover:bg-surface-muted"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Não atribuído</SelectItem>
                    {(profiles ?? []).map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name ?? "—"}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Datas — rodapé pequeno */}
          <div className="space-y-1 px-1 text-[11px] text-muted-foreground">
            <div className="flex justify-between">
              <span>Aberto</span>
              <span className="font-mono">{formatBrazilDateTime(ticket.opened_at ?? ticket.created_at)}</span>
            </div>
            <div className="flex justify-between">
              <span>Atualizado</span>
              <span className="font-mono">{formatBrazilDateTime(ticket.updated_at)}</span>
            </div>
            {ticket.first_response_at && (
              <div className="flex justify-between">
                <span>1ª resposta</span>
                <span className="font-mono">{formatBrazilDateTime(ticket.first_response_at)}</span>
              </div>
            )}
            {ticket.resolved_at && (
              <div className="flex justify-between">
                <span>Resolvido</span>
                <span className="font-mono">{formatBrazilDateTime(ticket.resolved_at)}</span>
              </div>
            )}
          </div>
        </aside>
      </div>

      <EditTicketDialog ticket={ticket} open={editOpen} onOpenChange={setEditOpen} />
    </div>
  );
}

function InlineField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <div className="min-w-0 max-w-[60%]">{children}</div>
    </div>
  );
}
