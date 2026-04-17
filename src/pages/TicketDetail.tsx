import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge, PriorityBadge } from "@/components/badges";
import { SLAIndicator } from "@/components/SLAIndicator";
import { UserAvatar } from "@/components/UserAvatar";
import { ToneBadge } from "@/components/ui/tone-badge";
import { ArrowLeft, MessageSquare, Mail, Phone, FileText, Loader2, Calendar } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { STATUS_LABEL, PRIORITY_LABEL, CHANNEL_LABEL, INTERACTION_LABEL, type TicketStatus, type TicketPriority, type InteractionType } from "@/lib/constants";
import { formatDate, timeAgo } from "@/lib/formatters";

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
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: ticket, isLoading } = useQuery({
    queryKey: ["ticket", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tickets")
        .select("*, client:clients(id, name, email, company, health), assignee:profiles!assigned_to(id, full_name, avatar_url, email), creator:profiles!created_by(full_name, avatar_url)")
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
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ticket", id] });
      qc.invalidateQueries({ queryKey: ["tickets"] });
      toast.success("Status atualizado.");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateField = useMutation({
    mutationFn: async (patch: { priority?: TicketPriority; assigned_to?: string | null }) => {
      const { error } = await supabase.from("tickets").update(patch).eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ticket", id] });
      qc.invalidateQueries({ queryKey: ["tickets"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  // New interaction
  const [newInt, setNewInt] = useState({ type: "nota" as InteractionType, summary: "", is_internal: true });
  const addInteraction = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Não autenticado");
      const { error } = await supabase.from("ticket_interactions").insert({
        ticket_id: id!,
        type: newInt.type,
        summary: newInt.summary,
        is_internal: newInt.is_internal,
        author_id: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["interactions", id] });
      qc.invalidateQueries({ queryKey: ["ticket", id] });
      setNewInt({ type: "nota", summary: "", is_internal: true });
      toast.success("Interação registrada.");
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading || !ticket) {
    return <div className="space-y-3 p-6"><Skeleton className="h-6 w-32" /><Skeleton className="h-32" /><Skeleton className="h-64" /></div>;
  }

  const isClosed = ["resolvido", "fechado"].includes(ticket.status);

  return (
    <div className="space-y-4 p-6">
      <Link to="/tickets" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Voltar para tickets
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            <span className="font-mono text-sm text-muted-foreground">#{ticket.ticket_number}</span>
            <StatusBadge status={ticket.status} />
            <PriorityBadge priority={ticket.priority} />
            <ToneBadge tone="muted">{CHANNEL_LABEL[ticket.channel as keyof typeof CHANNEL_LABEL]}</ToneBadge>
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

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Main column */}
        <div className="lg:col-span-2 space-y-4">
          {ticket.description && (
            <Card className="p-5">
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Descrição</h2>
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{ticket.description}</p>
            </Card>
          )}

          <Card className="p-5">
            <Tabs defaultValue="timeline">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-semibold">Atividade</h2>
                <TabsList>
                  <TabsTrigger value="timeline">Timeline</TabsTrigger>
                  <TabsTrigger value="add">Adicionar</TabsTrigger>
                </TabsList>
              </div>
              <TabsContent value="timeline" className="m-0">
                {!interactions || interactions.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma interação ainda. Registre a primeira em "Adicionar".</p>
                ) : (
                  <div className="space-y-3">
                    {interactions.map((it: any) => {
                      const Icon = TYPE_ICON[it.type as InteractionType] ?? FileText;
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
                              {it.is_internal && <ToneBadge tone="warning" size="sm">interna</ToneBadge>}
                              <span className="text-muted-foreground">· {timeAgo(it.created_at)}</span>
                            </div>
                            <p className="mt-1 whitespace-pre-wrap text-sm">{it.summary}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </TabsContent>
              <TabsContent value="add" className="m-0 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <Select value={newInt.type} onValueChange={(v) => setNewInt({ ...newInt, type: v as InteractionType })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(INTERACTION_LABEL).filter(([k]) => k !== "mudanca_status").map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={newInt.is_internal ? "internal" : "public"} onValueChange={(v) => setNewInt({ ...newInt, is_internal: v === "internal" })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="internal">Nota interna</SelectItem>
                      <SelectItem value="public">Resposta ao cliente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Textarea rows={4} value={newInt.summary} onChange={(e) => setNewInt({ ...newInt, summary: e.target.value })} placeholder="O que aconteceu, próximos passos…" />
                <div className="flex justify-end">
                  <Button onClick={() => addInteraction.mutate()} disabled={!newInt.summary || addInteraction.isPending} className="bg-gradient-brand text-primary-foreground hover:opacity-90">
                    {addInteraction.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Registrar
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <Card className="p-5 space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Detalhes</h3>
            <Field label="Status">
              <Select value={ticket.status} onValueChange={(v) => updateStatus.mutate(v as TicketStatus)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
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

          {ticket.client && (
            <Card className="p-5 space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Cliente</h3>
              <Link to={`/clientes/${ticket.client.id}`} className="block hover:underline">
                <p className="font-medium">{ticket.client.name}</p>
                {(ticket.client as any).company && <p className="text-xs text-muted-foreground">{(ticket.client as any).company}</p>}
                {(ticket.client as any).email && <p className="text-xs text-muted-foreground">{(ticket.client as any).email}</p>}
              </Link>
            </Card>
          )}

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
