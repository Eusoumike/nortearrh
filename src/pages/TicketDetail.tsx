import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge, PriorityBadge } from "@/components/badges";
import { SLAIndicator } from "@/components/SLAIndicator";
import { ToneBadge } from "@/components/ui/tone-badge";
import { ArrowLeft, MessageSquare, Mail, Phone, FileText, Loader2, Calendar, History, ChevronLeft, ChevronRight, CheckCircle2, Clock } from "lucide-react";
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
import { formatDate, timeAgo, formatDuration } from "@/lib/formatters";

const TYPE_ICON: Record<InteractionType, React.ComponentType<{ className?: string }>> = {
  nota: FileText,
  email: Mail,
  ligacao: Phone,
  whatsapp: MessageSquare,
  reuniao: Calendar,
  mudanca_status: FileText,
};

function toLocalInputValue(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function TicketDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [now, setNow] = useState(() => Date.now());

  // Tick a cada 30s para timers
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

  const [newInt, setNewInt] = useState({
    type: "ligacao" as InteractionType,
    channel: "telefone" as TicketChannel,
    problem_description: "",
    solution_applied: "",
    result: "resolvido" as InteractionResult,
    interaction_at: toLocalInputValue(new Date()),
    time_spent_minutes: "" as string,
    is_internal: true,
  });

  const addInteraction = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Não autenticado");
      const summary = `${newInt.problem_description.slice(0, 80)}${newInt.problem_description.length > 80 ? "…" : ""}`;
      const { error } = await supabase.from("ticket_interactions").insert({
        ticket_id: id!,
        type: newInt.type,
        channel: newInt.channel,
        problem_description: newInt.problem_description,
        solution_applied: newInt.solution_applied,
        result: newInt.result,
        interaction_at: new Date(newInt.interaction_at).toISOString(),
        time_spent_minutes: newInt.time_spent_minutes ? parseInt(newInt.time_spent_minutes, 10) : null,
        summary,
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

      // Híbrido auto: se resultado = resolvido, muda status para resolvido
      if (result === "resolvido" && ticket && !["resolvido", "fechado"].includes(ticket.status)) {
        updateStatus.mutate("resolvido");
      }

      setNewInt({
        type: "ligacao",
        channel: "telefone",
        problem_description: "",
        solution_applied: "",
        result: "resolvido",
        interaction_at: toLocalInputValue(new Date()),
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
  const interactionFormReady = newInt.problem_description.trim() && newInt.solution_applied.trim();

  // Status efetivo no fluxo (fechado → resolvido)
  const effectiveStatus: TicketStatus = ticket.status === "fechado" ? "resolvido" : ticket.status;
  const flowIndex = STATUS_FLOW.indexOf(effectiveStatus);
  const prevStatus = flowIndex > 0 ? STATUS_FLOW[flowIndex - 1] : null;
  const nextStatus = flowIndex >= 0 && flowIndex < STATUS_FLOW.length - 1 ? STATUS_FLOW[flowIndex + 1] : null;

  // Calcula tempo por etapa (acumulado + sessão atual se etapa em curso)
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

  return (
    <div className="space-y-4 p-6">
      <Link to="/tickets" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Voltar para tickets
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm text-muted-foreground">#{ticket.ticket_number}</span>
            <StatusBadge status={ticket.status} />
            <PriorityBadge priority={ticket.priority} />
            <ToneBadge tone="muted">{CHANNEL_LABEL[ticket.channel as keyof typeof CHANNEL_LABEL]}</ToneBadge>
            {(ticket as any).ticket_type && (
              <ToneBadge tone="info">{TICKET_TYPE_LABEL[(ticket as any).ticket_type as TicketType]}</ToneBadge>
            )}
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">{ticket.title}</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Criado por {(ticket as any).creator?.full_name ?? "—"} {timeAgo(ticket.created_at)}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <SLAIndicator deadline={ticket.sla_resolution_deadline} resolved={isClosed} label="Resolução" size="lg" />
          {ticket.sla_response_deadline && !ticket.first_response_at && (
            <SLAIndicator deadline={ticket.sla_response_deadline} label="1ª resp." />
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        {/* COL ESQUERDA — cliente, descrição, atendimentos, histórico */}
        <div className="space-y-4">
          {ticket.client && (
            <Card className="p-5 space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Cliente</h3>
              <Link to={`/clientes/${ticket.client.id}`} className="block hover:underline">
                <p className="font-medium">{ticket.client.name}</p>
              </Link>
              <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                {(ticket.client as any).company && <div><span className="text-[10px] uppercase tracking-wider">Empresa</span><p className="text-foreground">{(ticket.client as any).company}</p></div>}
                {(ticket.client as any).email && <div><span className="text-[10px] uppercase tracking-wider">Email</span><p className="text-foreground">{(ticket.client as any).email}</p></div>}
                {(ticket.client as any).phone && <div><span className="text-[10px] uppercase tracking-wider">Telefone</span><p className="text-foreground">{(ticket.client as any).phone}</p></div>}
              </div>
            </Card>
          )}

          {ticket.description && (
            <Card className="p-5">
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Descrição</h2>
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{ticket.description}</p>
            </Card>
          )}

          <Card className="p-5">
            <Tabs defaultValue="timeline">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-semibold">Atendimentos</h2>
                <TabsList>
                  <TabsTrigger value="timeline">Histórico</TabsTrigger>
                  <TabsTrigger value="add">Registrar atendimento</TabsTrigger>
                </TabsList>
              </div>
              <TabsContent value="timeline" className="m-0">
                {!interactions || interactions.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">Nenhum atendimento registrado ainda.</p>
                ) : (
                  <div className="space-y-3">
                    {interactions.map((it: any) => {
                      const Icon = TYPE_ICON[it.type as InteractionType] ?? FileText;
                      const hasStructured = it.problem_description || it.solution_applied;
                      return (
                        <div key={it.id} className="flex gap-3">
                          <div className="flex flex-col items-center">
                            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary">
                              <Icon className="h-3.5 w-3.5" />
                            </div>
                            <div className="mt-1 w-px flex-1 bg-border" />
                          </div>
                          <div className="flex-1 pb-3">
                            <div className="flex flex-wrap items-center gap-2 text-xs">
                              <span className="font-medium">{it.author?.full_name ?? "Sistema"}</span>
                              <ToneBadge tone="muted" size="sm">{INTERACTION_LABEL[it.type as InteractionType]}</ToneBadge>
                              {it.channel && (
                                <ToneBadge tone="muted" size="sm">{CHANNEL_LABEL[it.channel as keyof typeof CHANNEL_LABEL]}</ToneBadge>
                              )}
                              {it.result && (
                                <ToneBadge tone={INTERACTION_RESULT_TONE[it.result as InteractionResult]} size="sm">
                                  {INTERACTION_RESULT_LABEL[it.result as InteractionResult]}
                                </ToneBadge>
                              )}
                              {it.time_spent_minutes != null && (
                                <span className="text-muted-foreground">· {it.time_spent_minutes} min</span>
                              )}
                              <span className="text-muted-foreground">· {timeAgo(it.interaction_at ?? it.created_at)}</span>
                            </div>
                            {hasStructured ? (
                              <div className="mt-2 space-y-2 rounded-md border border-border bg-surface-muted/40 p-3">
                                {it.problem_description && (
                                  <div>
                                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Problema</p>
                                    <p className="mt-0.5 whitespace-pre-wrap text-sm">{it.problem_description}</p>
                                  </div>
                                )}
                                {it.solution_applied && (
                                  <div>
                                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Solução</p>
                                    <p className="mt-0.5 whitespace-pre-wrap text-sm">{it.solution_applied}</p>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <p className="mt-1 whitespace-pre-wrap text-sm">{it.summary}</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </TabsContent>
              <TabsContent value="add" className="m-0 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <p className="text-[11px] text-muted-foreground">Tipo de atendimento *</p>
                    <Select value={newInt.type} onValueChange={(v) => setNewInt({ ...newInt, type: v as InteractionType })}>
                      <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(INTERACTION_LABEL).filter(([k]) => k !== "mudanca_status").map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[11px] text-muted-foreground">Canal de contato *</p>
                    <Select value={newInt.channel} onValueChange={(v) => setNewInt({ ...newInt, channel: v as TicketChannel })}>
                      <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(CHANNEL_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-[11px] text-muted-foreground">Descrição do problema *</p>
                  <Textarea
                    rows={3}
                    value={newInt.problem_description}
                    onChange={(e) => setNewInt({ ...newInt, problem_description: e.target.value })}
                    placeholder="O que o cliente relatou — em suas palavras"
                  />
                </div>
                <div className="space-y-1">
                  <p className="text-[11px] text-muted-foreground">Solução aplicada *</p>
                  <Textarea
                    rows={3}
                    value={newInt.solution_applied}
                    onChange={(e) => setNewInt({ ...newInt, solution_applied: e.target.value })}
                    placeholder="O que foi feito para resolver — específico e consultável"
                  />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <p className="text-[11px] text-muted-foreground">Resultado *</p>
                    <Select value={newInt.result} onValueChange={(v) => setNewInt({ ...newInt, result: v as InteractionResult })}>
                      <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
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
                      className="h-9 text-xs"
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
                      className="h-9 text-xs"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <Select value={newInt.is_internal ? "internal" : "public"} onValueChange={(v) => setNewInt({ ...newInt, is_internal: v === "internal" })}>
                    <SelectTrigger className="h-8 w-[200px] text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="internal">Nota interna</SelectItem>
                      <SelectItem value="public">Visível ao cliente</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button onClick={() => addInteraction.mutate()} disabled={!interactionFormReady || addInteraction.isPending} className="bg-gradient-brand text-primary-foreground hover:opacity-90">
                    {addInteraction.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Registrar atendimento
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  💡 Se o resultado for "Resolvido", o status do chamado vira <strong>Resolvido</strong> automaticamente.
                </p>
              </TabsContent>
            </Tabs>
          </Card>

          {ticket.client_id && (
            <Card className="p-5 space-y-3">
              <div className="flex items-center gap-2">
                <History className="h-3.5 w-3.5 text-muted-foreground" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Histórico do cliente</h3>
              </div>
              {!clientHistory || clientHistory.length === 0 ? (
                <p className="text-xs text-muted-foreground">Primeiro chamado deste cliente.</p>
              ) : (
                <div className="grid gap-2 md:grid-cols-2">
                  {clientHistory.map((h: any) => (
                    <Link
                      key={h.id}
                      to={`/tickets/${h.id}`}
                      className="block rounded-md border border-border bg-surface p-2.5 transition-colors hover:bg-surface-muted"
                    >
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <span className="font-mono text-[10px] text-muted-foreground">#{h.ticket_number}</span>
                        <StatusBadge status={h.status} />
                      </div>
                      <p className="line-clamp-2 text-xs font-medium">{h.title}</p>
                      <div className="mt-1 flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
                        {h.ticket_type ? (
                          <span className="truncate">{TICKET_TYPE_LABEL[h.ticket_type as TicketType]}</span>
                        ) : <span>—</span>}
                        <span>{timeAgo(h.created_at)}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </Card>
          )}
        </div>

        {/* COL DIREITA — status + fluxo + timers + detalhes */}
        <div className="space-y-4">
          {/* Status + fluxo */}
          <Card className="p-5 space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status atual</h3>
            <div className="flex items-center justify-center py-1">
              <StatusBadge status={ticket.status} />
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 h-8 text-xs"
                disabled={!prevStatus || updateStatus.isPending}
                onClick={() => prevStatus && updateStatus.mutate(prevStatus)}
              >
                <ChevronLeft className="h-3.5 w-3.5" /> {prevStatus ? STATUS_LABEL[prevStatus] : "—"}
              </Button>
              <Button
                size="sm"
                className="flex-1 h-8 text-xs bg-gradient-brand text-primary-foreground hover:opacity-90"
                disabled={!nextStatus || updateStatus.isPending}
                onClick={() => nextStatus && updateStatus.mutate(nextStatus)}
              >
                {nextStatus ? STATUS_LABEL[nextStatus] : "—"} <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
            {!isClosed && (
              <Button
                variant="outline"
                size="sm"
                className="w-full h-8 text-xs"
                disabled={updateStatus.isPending}
                onClick={() => updateStatus.mutate("resolvido")}
              >
                <CheckCircle2 className="h-3.5 w-3.5" /> Marcar como Resolvido
              </Button>
            )}
            <div className="space-y-1 pt-1">
              <p className="text-[11px] text-muted-foreground">Mudar para…</p>
              <Select value={effectiveStatus} onValueChange={(v) => updateStatus.mutate(v as TicketStatus)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_FLOW.map((k) => <SelectItem key={k} value={k}>{STATUS_LABEL[k]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </Card>

          {/* Timers por etapa */}
          <Card className="p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tempo por etapa</h3>
            </div>
            <div className="space-y-2">
              {stageDurations.map((s) => {
                const slaSec = SLA_PER_STAGE_HOURS[s.key] * 3600;
                const overSla = s.seconds > slaSec;
                return (
                  <div
                    key={s.key}
                    className={`flex items-center justify-between rounded-md border px-3 py-2 ${
                      s.isActive ? "border-primary/40 bg-primary/5" : "border-border bg-surface"
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-medium">{s.label}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {s.isActive ? "⏱ etapa em curso" : s.seconds > 0 ? "Concluída" : "—"}
                      </p>
                    </div>
                    <span className={`font-mono text-xs ${overSla ? "text-danger font-semibold" : s.isActive ? "text-primary font-semibold" : "text-foreground"}`}>
                      {s.seconds > 0 ? formatDuration(s.seconds) : "—"}
                    </span>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Detalhes */}
          <Card className="p-5 space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Detalhes</h3>
            <Field label="Tipo de chamado">
              <Select
                value={(ticket as any).ticket_type ?? ""}
                onValueChange={(v) => updateField.mutate({ ticket_type: v as TicketType })}
              >
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Classificar…" /></SelectTrigger>
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
            </Field>
            <Field label="Prioridade">
              <Select value={ticket.priority} onValueChange={(v) => updateField.mutate({ priority: v as TicketPriority })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(PRIORITY_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Responsável">
              <Select value={ticket.assigned_to ?? "unassigned"} onValueChange={(v) => updateField.mutate({ assigned_to: v === "unassigned" ? null : v })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Não atribuído</SelectItem>
                  {(profiles ?? []).map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name ?? "—"}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
          </Card>

          {/* Datas */}
          <Card className="p-5 space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Datas</h3>
            <Detail label="Criado">{formatDate(ticket.created_at)}</Detail>
            <Detail label="Atualizado">{formatDate(ticket.updated_at)}</Detail>
            {ticket.first_response_at && <Detail label="Primeira resposta">{formatDate(ticket.first_response_at)}</Detail>}
            {ticket.resolved_at && <Detail label="Resolvido em">{formatDate(ticket.resolved_at)}</Detail>}
          </Card>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}
function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono">{children}</span>
    </div>
  );
}
