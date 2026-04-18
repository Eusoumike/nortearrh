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
import { Separator } from "@/components/ui/separator";
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
import { ArrowLeft, MessageSquare, Mail, Phone, FileText, Loader2, Calendar, Trash2, Pencil, ListChecks, Building2, History, Send, User as UserIcon } from "lucide-react";
import { TicketTasks } from "@/components/TicketTasks";
import { TicketTasksSummary } from "@/components/TicketTasksSummary";
import { EditTicketDialog } from "@/components/EditTicketDialog";
import { UserAvatar } from "@/components/UserAvatar";
import { useEffect, useState } from "react";
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
  email: Mail,
  ligacao: Phone,
  whatsapp: MessageSquare,
  reuniao: Calendar,
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
        .select("*, client:clients(id, name, email, company, phone, health), assignee:profiles!assigned_to(id, full_name, avatar_url, email), creator:profiles!created_by(full_name, avatar_url)")
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

  const { data: profiles } = useQuery({
    queryKey: ["profiles-min"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, full_name, avatar_url");
      if (error) throw error;
      return data;
    },
  });

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
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ["interactions", id] });
      qc.invalidateQueries({ queryKey: ["ticket", id] });
      toast.success("Atendimento registrado.");

      if (result === "resolvido" && ticket && !["resolvido", "fechado"].includes(ticket.status)) {
        updateStatus.mutate("resolvido");
      }

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

  if (isLoading || !ticket) {
    return <div className="space-y-3 p-6"><Skeleton className="h-6 w-32" /><Skeleton className="h-32" /><Skeleton className="h-64" /></div>;
  }

  const isClosed = ["resolvido", "fechado"].includes(ticket.status);
  const interactionFormReady = newInt.summary.trim().length > 0;
  const effectiveStatus: TicketStatus = ticket.status === "fechado" ? "resolvido" : ticket.status;

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

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* COLUNA ESQUERDA */}
        <div className="space-y-5 min-w-0">
          {/* Header compacto */}
          <div className="space-y-2">
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-sm text-muted-foreground">#{ticket.ticket_number}</span>
              <h1 className="text-2xl font-semibold tracking-tight leading-tight">{ticket.title}</h1>
            </div>
            <p className="text-xs text-muted-foreground">
              Aberto em {formatBrazilDateTime(ticket.opened_at ?? ticket.created_at)} · por {(ticket as any).creator?.full_name ?? "—"}
            </p>
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
            {ticket.description && (
              <p className="whitespace-pre-wrap pt-2 text-sm leading-relaxed text-muted-foreground">{ticket.description}</p>
            )}
          </div>

          {/* Cliente — sem card */}
          {ticket.client && (
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <Link to={`/clientes/${ticket.client.id}`} className="text-sm font-semibold hover:underline">
                  {ticket.client.name}
                </Link>
                {clientCompany && (
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <Building2 className="h-3 w-3" />
                    {clientCompany}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                {clientEmail && (
                  <a href={`mailto:${clientEmail}`} className="inline-flex items-center gap-1 text-muted-foreground hover:text-primary">
                    <Mail className="h-3 w-3" />
                    {clientEmail}
                  </a>
                )}
                {clientPhone && (
                  <a href={`tel:${clientPhone}`} className="inline-flex items-center gap-1 text-muted-foreground hover:text-primary">
                    <Phone className="h-3 w-3" />
                    {clientPhone}
                  </a>
                )}
              </div>
            </div>
          )}

          <Separator />

          {/* Atendimentos */}
          <div>
            <Tabs defaultValue="timeline">
              <TabsList className="h-9">
                <TabsTrigger value="timeline" className="text-xs">Histórico</TabsTrigger>
                <TabsTrigger value="add" className="text-xs">Registrar</TabsTrigger>
                <TabsTrigger value="tasks" className="text-xs gap-1"><ListChecks className="h-3 w-3" />Tarefas</TabsTrigger>
              </TabsList>

              <TabsContent value="timeline" className="m-0 mt-3">
                {!interactions || interactions.length === 0 ? (
                  <p className="py-6 text-center text-xs text-muted-foreground">Nenhum atendimento registrado ainda.</p>
                ) : (
                  <ul className="divide-y divide-border">
                    {interactions.map((it: any) => {
                      const Icon = TYPE_ICON[it.type as InteractionType] ?? FileText;
                      const summaryText = it.summary || it.content;
                      const hasLegacy = !summaryText && (it.problem_description || it.solution_applied);
                      return (
                        <li key={it.id} className="flex gap-3 py-2.5">
                          <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                              <span className="font-medium">{INTERACTION_LABEL[it.type as InteractionType]}</span>
                              {summaryText && <span className="text-foreground">— {summaryText}</span>}
                              {hasLegacy && it.problem_description && (
                                <span className="text-foreground">— {it.problem_description}</span>
                              )}
                            </div>
                            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground">
                              <span>{it.author?.full_name ?? "Sistema"}</span>
                              <span>·</span>
                              <span>{timeAgo(it.interaction_at ?? it.created_at)}</span>
                              {it.result && (
                                <>
                                  <span>·</span>
                                  <ToneBadge tone={INTERACTION_RESULT_TONE[it.result as InteractionResult]} size="sm">
                                    {INTERACTION_RESULT_LABEL[it.result as InteractionResult]}
                                  </ToneBadge>
                                </>
                              )}
                              {it.time_spent_minutes != null && (
                                <>
                                  <span>·</span>
                                  <span>{it.time_spent_minutes} min</span>
                                </>
                              )}
                            </div>
                            {hasLegacy && it.solution_applied && (
                              <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">
                                <span className="font-medium text-foreground">Solução:</span> {it.solution_applied}
                              </p>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </TabsContent>

              <TabsContent value="add" className="m-0 mt-3 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <p className="text-[11px] text-muted-foreground">Tipo *</p>
                    <Select value={newInt.type} onValueChange={(v) => setNewInt({ ...newInt, type: v as InteractionType })}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(INTERACTION_LABEL).filter(([k]) => k !== "mudanca_status").map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[11px] text-muted-foreground">Canal *</p>
                    <Select value={newInt.channel} onValueChange={(v) => setNewInt({ ...newInt, channel: v as TicketChannel })}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(CHANNEL_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-[11px] text-muted-foreground">Resumo *</p>
                  <Textarea
                    rows={4}
                    value={newInt.summary}
                    onChange={(e) => setNewInt({ ...newInt, summary: e.target.value })}
                    placeholder="O que aconteceu — problema relatado e solução aplicada"
                    className="text-sm"
                  />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <p className="text-[11px] text-muted-foreground">Resultado *</p>
                    <Select value={newInt.result} onValueChange={(v) => setNewInt({ ...newInt, result: v as InteractionResult })}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(INTERACTION_RESULT_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[11px] text-muted-foreground">Hora *</p>
                    <Input
                      type="datetime-local"
                      value={newInt.interaction_at}
                      onChange={(e) => setNewInt({ ...newInt, interaction_at: e.target.value })}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <p className="text-[11px] text-muted-foreground">Tempo (min)</p>
                    <Input
                      type="number"
                      min={0}
                      value={newInt.time_spent_minutes}
                      onChange={(e) => setNewInt({ ...newInt, time_spent_minutes: e.target.value })}
                      placeholder="—"
                      className="h-8 text-xs"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <Select value={newInt.is_internal ? "internal" : "public"} onValueChange={(v) => setNewInt({ ...newInt, is_internal: v === "internal" })}>
                    <SelectTrigger className="h-8 w-[180px] text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="internal">Nota interna</SelectItem>
                      <SelectItem value="public">Visível ao cliente</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button size="sm" onClick={() => addInteraction.mutate()} disabled={!interactionFormReady || addInteraction.isPending} className="bg-gradient-brand text-primary-foreground hover:opacity-90">
                    {addInteraction.isPending && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                    Registrar
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  💡 Se o resultado for "Resolvido", o status vira <strong>Resolvido</strong> automaticamente.
                </p>
              </TabsContent>

              <TabsContent value="tasks" className="m-0 mt-3">
                <TicketTasks ticketId={id!} />
              </TabsContent>
            </Tabs>
          </div>

          {/* Histórico do cliente — linha compacta */}
          {ticket.client_id && clientHistory && clientHistory.length > 0 && (
            <>
              <Separator />
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <History className="h-3 w-3" />
                  Histórico do cliente
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
                  {clientHistory.map((h: any) => (
                    <Link
                      key={h.id}
                      to={`/tickets/${h.id}`}
                      className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
                    >
                      <span className="font-mono text-[11px]">#{h.ticket_number}</span>
                      <span className="max-w-[200px] truncate">{h.title}</span>
                      <span className="text-[10px]">· {timeAgo(h.created_at)}</span>
                    </Link>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* COLUNA DIREITA */}
        <aside className="space-y-5">
          {/* Status */}
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Status</p>
            <Select value={effectiveStatus} onValueChange={(v) => updateStatus.mutate(v as TicketStatus)}>
              <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUS_FLOW.map((k) => <SelectItem key={k} value={k}>{STATUS_LABEL[k]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <TicketTasksSummary ticketId={id!} />

          {/* Tempo por etapa */}
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Tempo por etapa</p>
            <ul className="divide-y divide-border rounded-md border border-border">
              {stageDurations.map((s) => {
                const slaSec = SLA_PER_STAGE_HOURS[s.key] * 3600;
                const overSla = s.seconds > slaSec;
                return (
                  <li
                    key={s.key}
                    className={`flex items-center justify-between px-2.5 py-1.5 text-xs ${s.isActive ? "bg-primary/5" : ""}`}
                  >
                    <span className={`truncate ${s.isActive ? "font-medium text-primary" : ""}`}>
                      {s.label}
                    </span>
                    <span className={`font-mono ${overSla ? "text-danger font-semibold" : s.isActive ? "text-primary font-semibold" : "text-muted-foreground"}`}>
                      {s.seconds > 0 ? formatDuration(s.seconds) : "—"}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Detalhes */}
          <div className="space-y-2">
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
            <InlineField label="Responsável">
              <Select value={ticket.assigned_to ?? "unassigned"} onValueChange={(v) => updateField.mutate({ assigned_to: v === "unassigned" ? null : v })}>
                <SelectTrigger className="h-7 text-xs border-0 px-1.5 hover:bg-surface-muted"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Não atribuído</SelectItem>
                  {(profiles ?? []).map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name ?? "—"}</SelectItem>)}
                </SelectContent>
              </Select>
            </InlineField>
          </div>

          {/* Datas — rodapé pequeno */}
          <div className="space-y-1 pt-2 text-[11px] text-muted-foreground">
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
