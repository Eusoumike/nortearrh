import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge, PriorityBadge } from "@/components/badges";
import { SLAIndicator } from "@/components/SLAIndicator";
import { ToneBadge } from "@/components/ui/tone-badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
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
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ChevronRight as ChevronRightIcon,
  MessageSquare,
  Mail,
  Phone,
  FileText,
  Loader2,
  Calendar as CalendarIcon,
  Trash2,
  Pencil,
  Send,
  Monitor,
  Copy,
  Plus,
  Mic,
  Building2,
  User as UserIcon,
  CheckCircle2,
  ArrowUpRight,
  PauseCircle,
  Paperclip,
  Lock,
  Sparkles,
  Clock,
  RefreshCw,
  Settings,
} from "lucide-react";
import { AudioTranscription } from "@/components/tickets/AudioTranscription";
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
import { AssistPanel } from "@/components/tickets/AssistPanel";
import { EmailN2Dialog } from "@/components/tickets/EmailN2Dialog";
import { useEtapasKanban } from "@/hooks/useEtapasKanban";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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
import {
  timeAgo,
  formatDuration,
  nowBrasilia,
  brazilInputToISO,
  formatBrazilDateTime,
} from "@/lib/formatters";

const TYPE_ICON: Record<InteractionType, React.ComponentType<{ className?: string }>> = {
  nota: FileText,
  anotacao: FileText,
  email: Mail,
  ligacao: Phone,
  whatsapp: MessageSquare,
  reuniao: CalendarIcon,
  remoto: Monitor,
  mudanca_status: RefreshCw,
  email_n2: Mail,
};

const CHANNEL_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  whatsapp: MessageSquare,
  telefone: Phone,
  email: Mail,
  reuniao: CalendarIcon,
  anydesk: Monitor,
  chat: MessageSquare,
  portal: Monitor,
  pipedrive: Monitor,
  outro: FileText,
};

const QUEM_REPORTOU_LABEL: Record<string, string> = {
  colaborador: "Colaborador",
  gestor: "Gestor",
  administrador: "Administrador",
  rh: "RH",
};

const PRODUCT_LABEL: Record<string, string> = {
  rh_digital: "RH Digital",
  vr_beneficios: "VR Benefícios",
};

export default function TicketDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const qc = useQueryClient();
  const [now, setNow] = useState(() => Date.now());
  const [editOpen, setEditOpen] = useState(false);
  const [emailN2Open, setEmailN2Open] = useState(false);
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
        .select(
          "*, client:clients!fk_tickets_client(id, name, email, company, phone, health, anydesk_id, anydesk_senha, razao_social, cnpj, contact_name, contact_email, contact_phone, contact_whatsapp, products, status_nortear), assignee:profiles!assigned_to(id, full_name, avatar_url, email), creator:profiles!created_by(full_name, avatar_url)"
        )
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
        .order("interaction_at", { ascending: true });
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

  // Ativos vinculados — implantação, contrato rh, lançamento vr
  const { data: ativos } = useQuery({
    queryKey: ["ticket-ativos", ticket?.client_id],
    enabled: !!ticket?.client_id,
    queryFn: async () => {
      const [impl, contrato, vr] = await Promise.all([
        supabase
          .from("implantacoes")
          .select("id, etapa, health_status, client_name")
          .eq("client_id", ticket!.client_id!)
          .neq("etapa", "finalizado")
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("contratos_rh_digital")
          .select("id, valor_mensalidade, fidelidade_vencimento, ativo")
          .eq("client_id", ticket!.client_id!)
          .eq("ativo", true)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("lancamentos_vr")
          .select("id, competencia, tipo")
          .eq("client_id", ticket!.client_id!)
          .order("competencia", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      return {
        implantacao: impl.data,
        contrato: contrato.data,
        vr: vr.data,
      };
    },
  });

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
    mutationFn: async (patch: {
      priority?: TicketPriority;
      assigned_to?: string | null;
      ticket_type?: TicketType | null;
    }) => {
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

  const [replyMode, setReplyMode] = useState<"resposta" | "nota">("resposta");
  const [newInt, setNewInt] = useState({
    type: "ligacao" as InteractionType,
    channel: "telefone" as TicketChannel,
    summary: "",
    result: "resolvido" as InteractionResult,
    interaction_at: nowBrasilia(),
    time_spent_minutes: "" as string,
  });
  const [audioOpen, setAudioOpen] = useState(false);

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
        is_internal: replyMode === "nota",
        author_id: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["interactions", id] });
      qc.invalidateQueries({ queryKey: ["ticket", id] });
      toast.success(replyMode === "nota" ? "Nota interna registrada." : "Resposta enviada!");
      setNewInt({
        type: "ligacao",
        channel: "telefone",
        summary: "",
        result: "resolvido",
        interaction_at: nowBrasilia(),
        time_spent_minutes: "",
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
      if (idDigits.length < 6 || idDigits.length > 12)
        throw new Error("ID do AnyDesk inválido: deve ter entre 6 e 12 dígitos.");
      const { error } = await supabase
        .from("clients")
        .update({ anydesk_id: idDigits, anydesk_senha: null } as any)
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
    return interactions.map((i: any) => i.interaction_at as string).sort().at(-1) ?? null;
  }, [interactions]);

  if (isLoading || !ticket) {
    return (
      <div className="space-y-3 p-6">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-32" />
        <Skeleton className="h-64" />
      </div>
    );
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

  const client = ticket.client as any;
  const organization =
    client?.organization || client?.razao_social || client?.company || client?.name || "—";
  const contactName = client?.contact_name || client?.name;
  const contactPhone = client?.contact_phone || client?.phone;
  const contactEmail = client?.contact_email || client?.email;
  const contactWhatsapp = client?.contact_whatsapp;
  const products: string[] = client?.products ?? [];
  const anydeskId = client?.anydesk_id ?? (ticket as any).anydesk_id ?? "";
  const hasAnydesk = Boolean(anydeskId);
  const initial = (organization || "?").trim().charAt(0).toUpperCase();

  const ChannelIcon = CHANNEL_ICON[ticket.channel as string] ?? FileText;

  return (
    <div className="space-y-6 p-6 pb-24">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        <Link to="/tickets" className="hover:text-foreground transition-colors">
          Central de Chamados
        </Link>
        <ChevronRightIcon className="h-3 w-3" />
        <span className="text-foreground">Detalhes do Chamado</span>
      </nav>

      {/* Header */}
      <header className="space-y-3">
        <div className="flex flex-wrap items-baseline gap-3">
          <span className="font-mono text-2xl font-semibold tracking-tight text-muted-foreground">
            #{ticket.ticket_number}
          </span>
          <span className="text-muted-foreground/40">|</span>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{ticket.title}</h1>
          <div className="ml-auto flex items-center gap-1.5">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={!prevTicketId}
              onClick={() => prevTicketId && navigate(`/tickets/${prevTicketId}`)}
              title="Anterior (Alt + ←)"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={!nextTicketId}
              onClick={() => nextTicketId && navigate(`/tickets/${nextTicketId}`)}
              title="Próximo (Alt + →)"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusBadge status={ticket.status} />
          <PriorityBadge priority={ticket.priority} />
          <ToneBadge tone="muted">
            <ChannelIcon className="mr-1 h-3 w-3" />
            {CHANNEL_LABEL[ticket.channel as keyof typeof CHANNEL_LABEL]}
          </ToneBadge>
          {(ticket as any).ticket_type && (
            <ToneBadge tone="info">{TICKET_TYPE_LABEL[(ticket as any).ticket_type as TicketType]}</ToneBadge>
          )}
          <SLAIndicator
            deadline={ticket.sla_resolution_deadline}
            resolved={isClosed}
            label="Resolução"
            size="sm"
          />
          {ticket.sla_response_deadline && !ticket.first_response_at && (
            <SLAIndicator deadline={ticket.sla_response_deadline} label="1ª resp." size="sm" />
          )}
        </div>
        <AutoCloseWarning
          status={ticket.status}
          enteredAt={(ticket as any).entered_aguardando_cliente_at}
          lastInteractionAt={lastInteractionAt}
        />
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        {/* ========== COLUNA ESQUERDA ========== */}
        <div className="space-y-6 min-w-0">
          {/* Card do cliente */}
          {client && (
            <div className="glass-card p-6 flex items-center gap-6">
              <div className="h-16 w-16 rounded-xl bg-surface-muted flex items-center justify-center text-2xl font-bold text-primary shrink-0">
                {initial}
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <h2 className="text-lg font-semibold tracking-tight truncate">{organization}</h2>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  {contactName && (
                    <span className="inline-flex items-center gap-1.5">
                      <UserIcon className="h-3 w-3" />
                      {contactName}
                    </span>
                  )}
                  {contactPhone && (
                    <a href={`tel:${contactPhone}`} className="inline-flex items-center gap-1.5 hover:text-primary">
                      <Phone className="h-3 w-3" />
                      {contactPhone}
                    </a>
                  )}
                  {contactWhatsapp && contactWhatsapp !== contactPhone && (
                    <a
                      href={`https://wa.me/55${contactWhatsapp.replace(/\D/g, "")}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 hover:text-primary"
                    >
                      <MessageSquare className="h-3 w-3" />
                      {contactWhatsapp}
                    </a>
                  )}
                  {contactEmail && (
                    <a href={`mailto:${contactEmail}`} className="inline-flex items-center gap-1.5 hover:text-primary">
                      <Mail className="h-3 w-3" />
                      {contactEmail}
                    </a>
                  )}
                </div>
              </div>
              <Button
                variant="outline"
                onClick={() => client.id && navigate(`/clientes/${client.id}`)}
                className="shrink-0"
              >
                Ver Perfil
              </Button>
            </div>
          )}

          {/* Detalhes do problema */}
          {((ticket as any).descricao_problema ||
            (ticket as any).quem_reportou ||
            (ticket as any).acao_tentada ||
            (ticket as any).ja_tentou ||
            ticket.description) && (
            <div className="glass-card p-6 space-y-4">
              <h3 className="text-base font-semibold tracking-tight">Detalhes do problema</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                {(ticket as any).quem_reportou && (
                  <Field label="Quem reportou">
                    <ToneBadge tone="info" size="sm">
                      <UserIcon className="mr-1 h-3 w-3" />
                      {QUEM_REPORTOU_LABEL[(ticket as any).quem_reportou] ?? (ticket as any).quem_reportou}
                    </ToneBadge>
                  </Field>
                )}
                {(ticket as any).acao_tentada && (
                  <Field label="Estava tentando fazer">
                    <p className="text-sm leading-relaxed">{(ticket as any).acao_tentada}</p>
                  </Field>
                )}
                {(ticket as any).descricao_problema && (
                  <Field label="Descrição do problema" className="md:col-span-2">
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">
                      {(ticket as any).descricao_problema}
                    </p>
                  </Field>
                )}
                {(ticket as any).ja_tentou && (
                  <Field label="O que já tentou" className="md:col-span-2">
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">{(ticket as any).ja_tentou}</p>
                  </Field>
                )}
                {!((ticket as any).descricao_problema) && ticket.description && (
                  <Field label="Descrição" className="md:col-span-2">
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">{ticket.description}</p>
                  </Field>
                )}
                {(ticket as any).solucao_aplicada && (
                  <Field label="✅ Solução aplicada" className="md:col-span-2">
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">
                      {(ticket as any).solucao_aplicada}
                    </p>
                  </Field>
                )}
              </div>
            </div>
          )}

          {/* Histórico de Interação */}
          <section className="space-y-3">
            <h3 className="px-1 text-base font-semibold tracking-tight">
              Histórico de Interação
              {interactions && interactions.length > 0 && (
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  ({interactions.length})
                </span>
              )}
            </h3>
            {!interactions || interactions.length === 0 ? (
              <div className="glass-card p-10 flex flex-col items-center gap-2 text-center">
                <MessageSquare className="h-5 w-5 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">
                  Nenhum atendimento registrado ainda. Use a caixa abaixo para começar.
                </p>
              </div>
            ) : (
              <ol className="space-y-3">
                {interactions.map((it: any) => {
                  const Icon = TYPE_ICON[it.type as InteractionType] ?? FileText;
                  const summaryText = it.summary || it.content;
                  const hasLegacy = !summaryText && (it.problem_description || it.solution_applied);
                  const isAuthor = user?.id === it.author_id;
                  const isAgent = !!it.author_id;
                  const canEdit = isAuthor;
                  const canRemove = isAuthor || role === "admin" || role === "manager";
                  const isEditing = editingInteractionId === it.id;
                  const isInternal = it.is_internal;

                  return (
                    <li key={it.id} className="flex gap-3 group">
                      <div className="shrink-0">
                        <UserAvatar
                          name={it.author?.full_name ?? "Cliente"}
                          url={it.author?.avatar_url}
                          size="md"
                        />
                      </div>
                      <div
                        className={cn(
                          "glass-card flex-1 p-4 space-y-2",
                          isAgent && "bg-surface-muted/40",
                          isInternal && "ring-1 ring-accent/40 bg-accent/5"
                        )}
                      >
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                          <span className={cn("font-semibold", isAgent && "text-primary")}>
                            {it.author?.full_name ?? "Sistema"}
                          </span>
                          <span className="text-muted-foreground">·</span>
                          <Icon className="h-3 w-3 text-muted-foreground" />
                          <span className="text-muted-foreground">
                            {INTERACTION_LABEL[it.type as InteractionType].toLowerCase()}
                          </span>
                          <span className="text-muted-foreground">·</span>
                          <span className="text-muted-foreground">
                            {timeAgo(it.interaction_at ?? it.created_at)}
                          </span>
                          {isInternal && (
                            <ToneBadge tone="warning" size="sm">
                              <Lock className="mr-1 h-2.5 w-2.5" />
                              Nota interna
                            </ToneBadge>
                          )}
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
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-6 w-6 text-destructive hover:text-destructive"
                                    title="Excluir"
                                  >
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
                          <div className="space-y-2">
                            <Textarea
                              rows={3}
                              value={editingText}
                              onChange={(e) => setEditingText(e.target.value)}
                              className="text-sm"
                            />
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                onClick={() =>
                                  updateInteraction.mutate({ id: it.id, summary: editingText.trim() })
                                }
                                disabled={updateInteraction.isPending || !editingText.trim()}
                              >
                                {updateInteraction.isPending && (
                                  <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                                )}
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
                              <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                                {summaryText}
                              </p>
                            )}
                            {hasLegacy && (
                              <div className="space-y-1 text-sm">
                                {it.problem_description && (
                                  <p className="whitespace-pre-wrap">
                                    <span className="font-medium">Problema:</span> {it.problem_description}
                                  </p>
                                )}
                                {it.solution_applied && (
                                  <p className="whitespace-pre-wrap text-muted-foreground">
                                    <span className="font-medium text-foreground">Solução:</span>{" "}
                                    {it.solution_applied}
                                  </p>
                                )}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>

          {/* Reply Box */}
          <div className="glass-card overflow-hidden shadow-lg ring-1 ring-primary/5">
            {/* Header com tabs */}
            <div className="bg-surface-muted/60 px-6 py-2 border-b flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setReplyMode("resposta")}
                  className={cn(
                    "text-sm font-medium pb-1.5 -mb-[9px] border-b-2 transition-colors",
                    replyMode === "resposta"
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  )}
                >
                  Responder Cliente
                </button>
                <button
                  onClick={() => setReplyMode("nota")}
                  className={cn(
                    "text-sm font-medium pb-1.5 -mb-[9px] border-b-2 transition-colors",
                    replyMode === "nota"
                      ? "border-accent text-accent-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Lock className="inline h-3 w-3 mr-1" />
                  Nota Interna
                </button>
              </div>
              <UserAvatar
                name={myProfile?.full_name ?? user?.email}
                url={myProfile?.avatar_url}
                size="sm"
              />
            </div>

            {/* Textarea */}
            <Textarea
              rows={5}
              value={newInt.summary}
              onChange={(e) => setNewInt({ ...newInt, summary: e.target.value })}
              placeholder={
                replyMode === "nota"
                  ? "Anotação interna — não será enviada ao cliente…"
                  : "Digite sua resposta aqui…"
              }
              className={cn(
                "resize-none rounded-none border-0 px-6 py-4 text-sm leading-relaxed focus-visible:ring-0",
                replyMode === "nota" ? "bg-accent/5" : "bg-card"
              )}
            />

            {audioOpen && (
              <div className="border-t bg-surface-muted/30 px-4 py-2">
                <AudioTranscription
                  onCancel={() => setAudioOpen(false)}
                  onConfirm={(text) => {
                    setNewInt((n) => ({
                      ...n,
                      summary: n.summary ? `${n.summary}\n${text}` : text,
                    }));
                    setAudioOpen(false);
                  }}
                />
              </div>
            )}

            {/* Toolbar inferior */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t bg-surface-muted/30 px-4 py-2.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <Select
                  value={newInt.type}
                  onValueChange={(v) => setNewInt({ ...newInt, type: v as InteractionType })}
                >
                  <SelectTrigger className="h-8 w-[130px] text-xs bg-card">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(INTERACTION_LABEL)
                      .filter(([k]) => k !== "mudanca_status")
                      .map(([k, v]) => (
                        <SelectItem key={k} value={k}>
                          {v}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <Select
                  value={newInt.channel}
                  onValueChange={(v) => setNewInt({ ...newInt, channel: v as TicketChannel })}
                >
                  <SelectTrigger className="h-8 w-[130px] text-xs bg-card">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CHANNEL_LABEL).map(([k, v]) => (
                      <SelectItem key={k} value={k}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 justify-start gap-1.5 bg-card px-2.5 text-xs font-normal"
                    >
                      <CalendarIcon className="h-3.5 w-3.5 opacity-70" />
                      {newInt.interaction_at
                        ? format(new Date(newInt.interaction_at), "dd MMM 'às' HH:mm", { locale: ptBR })
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
                        const current = newInt.interaction_at
                          ? new Date(newInt.interaction_at)
                          : new Date();
                        d.setHours(current.getHours(), current.getMinutes(), 0, 0);
                        const yyyy = d.getFullYear();
                        const mm = String(d.getMonth() + 1).padStart(2, "0");
                        const dd = String(d.getDate()).padStart(2, "0");
                        const hh = String(d.getHours()).padStart(2, "0");
                        const mi = String(d.getMinutes()).padStart(2, "0");
                        setNewInt({ ...newInt, interaction_at: `${yyyy}-${mm}-${dd}T${hh}:${mi}` });
                      }}
                      initialFocus
                      className="p-3 pointer-events-auto"
                    />
                    <div className="flex items-center gap-2 border-t p-3">
                      <span className="text-xs text-muted-foreground">Horário</span>
                      <Input
                        type="time"
                        value={newInt.interaction_at ? newInt.interaction_at.slice(11, 16) : "00:00"}
                        onChange={(e) => {
                          const time = e.target.value;
                          const datePart = newInt.interaction_at
                            ? newInt.interaction_at.slice(0, 10)
                            : nowBrasilia().slice(0, 10);
                          setNewInt({ ...newInt, interaction_at: `${datePart}T${time}` });
                        }}
                        className="h-8 w-[110px] text-xs"
                      />
                    </div>
                  </PopoverContent>
                </Popover>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-8 px-2 text-muted-foreground"
                  title="Anexar arquivo (em breve)"
                  disabled
                >
                  <Paperclip className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setAudioOpen((o) => !o)}
                  className="h-8 px-2 text-muted-foreground"
                  title="Gravar áudio"
                >
                  <Mic className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex items-center gap-1.5">
                <Button
                  size="sm"
                  onClick={() => addInteraction.mutate()}
                  disabled={!interactionFormReady || addInteraction.isPending}
                  className="bg-gradient-brand text-primary-foreground shadow-sm hover:opacity-90"
                >
                  {addInteraction.isPending ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Send className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  {replyMode === "nota" ? "Salvar Nota" : "Enviar Resposta"}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* ========== COLUNA DIREITA ========== */}
        <aside className="space-y-4">
          {/* Metadados */}
          <div className="glass-card p-5 space-y-4">
            <h3 className="text-sm font-semibold tracking-tight border-b pb-2">Metadados</h3>

            <SidebarField label="Responsável">
              <div className="flex items-center gap-2">
                {ticket.assignee && (
                  <UserAvatar
                    name={(ticket as any).assignee.full_name}
                    url={(ticket as any).assignee.avatar_url}
                    size="xs"
                  />
                )}
                <Select
                  value={ticket.assigned_to ?? "unassigned"}
                  onValueChange={(v) =>
                    updateField.mutate({ assigned_to: v === "unassigned" ? null : v })
                  }
                >
                  <SelectTrigger className="h-7 text-xs border-0 px-1.5 hover:bg-surface-muted">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Não atribuído</SelectItem>
                    {(profiles ?? []).map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.full_name ?? "—"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </SidebarField>

            <SidebarField label="Categoria">
              <Select
                value={(ticket as any).ticket_type ?? ""}
                onValueChange={(v) => updateField.mutate({ ticket_type: v as TicketType })}
              >
                <SelectTrigger className="h-7 text-xs border-0 px-1.5 hover:bg-surface-muted">
                  <SelectValue placeholder="Classificar…" />
                </SelectTrigger>
                <SelectContent className="max-h-[320px]">
                  {TICKET_TYPE_GROUPS.map((group, idx) => (
                    <div key={group.label}>
                      {idx > 0 && <SelectSeparator />}
                      <SelectGroup>
                        <SelectLabel className="text-[10px] uppercase tracking-wider">
                          {group.label}
                        </SelectLabel>
                        {group.types.map((t) => (
                          <SelectItem key={t} value={t}>
                            {TICKET_TYPE_LABEL[t]}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </div>
                  ))}
                </SelectContent>
              </Select>
            </SidebarField>

            <SidebarField label="Prioridade">
              <Select
                value={ticket.priority}
                onValueChange={(v) => updateField.mutate({ priority: v as TicketPriority })}
              >
                <SelectTrigger className="h-7 text-xs border-0 px-1.5 hover:bg-surface-muted">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PRIORITY_LABEL).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </SidebarField>

            <SidebarField label="Tempo de SLA">
              <SLAIndicator
                deadline={ticket.sla_resolution_deadline}
                resolved={isClosed}
                size="sm"
              />
            </SidebarField>

            <SidebarField label="Canal de entrada">
              <span className="inline-flex items-center gap-1.5 text-xs">
                <ChannelIcon className="h-3 w-3 text-muted-foreground" />
                {CHANNEL_LABEL[ticket.channel as keyof typeof CHANNEL_LABEL]}
              </span>
            </SidebarField>

            <SidebarField label="Aberto em">
              <span className="text-xs font-mono">
                {formatBrazilDateTime(ticket.opened_at ?? ticket.created_at)}
              </span>
            </SidebarField>

            <SidebarField label="Última atualização">
              <span className="text-xs">{timeAgo(ticket.updated_at)}</span>
            </SidebarField>

            {products.length > 0 && (
              <SidebarField label="Produto relacionado">
                <div className="flex flex-wrap gap-1">
                  {products.map((p) => (
                    <ToneBadge key={p} tone="primary" size="sm">
                      {PRODUCT_LABEL[p] ?? p}
                    </ToneBadge>
                  ))}
                </div>
              </SidebarField>
            )}
          </div>

          {/* Ações */}
          <div className="glass-card p-5 space-y-3">
            <h3 className="text-sm font-semibold tracking-tight border-b pb-2">Ações</h3>

            {!isClosed && (
              <Button
                variant="outline"
                className="w-full justify-start font-semibold"
                onClick={() => updateStatus.mutate("resolvido")}
                disabled={updateStatus.isPending}
              >
                <CheckCircle2 className="mr-2 h-4 w-4 text-success" />
                Encerrar Chamado
              </Button>
            )}

            <Select
              value=""
              onValueChange={(v) => updateStatus.mutate(v as TicketStatus)}
            >
              <SelectTrigger className="w-full justify-start">
                <ArrowUpRight className="mr-2 h-4 w-4 text-muted-foreground" />
                <SelectValue placeholder="Escalar / mudar status" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_FLOW.filter((s) => s !== effectiveStatusTyped).map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {ticket.status !== "aguardando_cliente" && !isClosed && (
              <Button
                variant="ghost"
                className="w-full justify-start text-muted-foreground"
                onClick={() => updateStatus.mutate("aguardando_cliente")}
              >
                <PauseCircle className="mr-2 h-4 w-4" />
                Pausar Atendimento
              </Button>
            )}

            {(() => {
              const camposOk = !!ticket.client_id && !!ticket.title?.trim() && !!(ticket.description?.trim() || (ticket as any).descricao_problema?.trim());
              const btn = (
                <Button
                  variant="default"
                  className="w-full justify-start"
                  disabled={!camposOk}
                  onClick={() => setEmailN2Open(true)}
                >
                  <Mail className="mr-2 h-4 w-4" />
                  Gerar e-mail N2
                </Button>
              );
              return camposOk ? btn : (
                <Tooltip>
                  <TooltipTrigger asChild><span className="w-full">{btn}</span></TooltipTrigger>
                  <TooltipContent>Preencha cliente, título e descrição antes</TooltipContent>
                </Tooltip>
              );
            })()}

            <Button
              variant="ghost"
              className="w-full justify-start text-muted-foreground"
              onClick={() => setEditOpen(true)}
            >
              <Pencil className="mr-2 h-4 w-4" />
              Editar Detalhes
            </Button>

            {canDelete && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" className="w-full justify-start text-destructive hover:text-destructive">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Excluir Chamado
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Excluir chamado #{ticket.ticket_number}?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta ação é permanente. Todos os atendimentos e o histórico de status deste chamado
                      também serão removidos.
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

          {/* Nortear Assist */}
          <div className="rounded-xl border bg-gradient-to-br from-primary/5 to-card p-1">
            <div className="px-4 pt-3 pb-1 flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-primary">
                Nortear Assist
              </span>
            </div>
            <AssistPanel ticket={ticket as any} />
          </div>

          {/* Ativos Vinculados */}
          {(ativos?.implantacao || ativos?.contrato || ativos?.vr) && (
            <div className="glass-card p-5 space-y-3">
              <h3 className="text-sm font-semibold tracking-tight border-b pb-2">Ativos Vinculados</h3>

              {ativos.implantacao && (
                <Link
                  to="/implantacao"
                  className="block p-3 rounded-lg bg-surface-muted/50 border border-dashed hover:border-primary/50 transition-colors"
                >
                  <div className="flex items-center gap-1.5 text-xs font-medium">
                    📋 Implantação
                    <ChevronRight className="h-3 w-3 ml-auto text-muted-foreground" />
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Etapa: {String(ativos.implantacao.etapa ?? "—").replace(/_/g, " ")}
                  </p>
                </Link>
              )}

              {ativos.contrato && (
                <Link
                  to="/financeiro"
                  className="block p-3 rounded-lg bg-surface-muted/50 border border-dashed hover:border-primary/50 transition-colors"
                >
                  <div className="flex items-center gap-1.5 text-xs font-medium">
                    💰 Contrato RH Digital
                    <ChevronRight className="h-3 w-3 ml-auto text-muted-foreground" />
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    R$ {Number(ativos.contrato.valor_mensalidade ?? 0).toLocaleString("pt-BR", {
                      minimumFractionDigits: 2,
                    })}
                    /mês
                    {ativos.contrato.fidelidade_vencimento &&
                      ` · Fidelidade até ${format(
                        new Date(ativos.contrato.fidelidade_vencimento),
                        "dd/MM/yyyy"
                      )}`}
                  </p>
                </Link>
              )}

              {ativos.vr && (
                <Link
                  to="/financeiro"
                  className="block p-3 rounded-lg bg-surface-muted/50 border border-dashed hover:border-primary/50 transition-colors"
                >
                  <div className="flex items-center gap-1.5 text-xs font-medium">
                    🟢 VR Benefícios
                    <ChevronRight className="h-3 w-3 ml-auto text-muted-foreground" />
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Última {ativos.vr.tipo}: {format(new Date(ativos.vr.competencia), "MM/yyyy")}
                  </p>
                </Link>
              )}
            </div>
          )}

          {/* Resumo de tarefas */}
          <TicketTasksSummary ticketId={id!} />
        </aside>
      </div>

      {/* Mais ações (accordion) */}
      <Accordion type="single" collapsible className="glass-card px-5">
        <AccordionItem value="extras" className="border-0">
          <AccordionTrigger className="text-sm font-semibold">
            <span className="flex items-center gap-2">
              <Settings className="h-4 w-4 text-muted-foreground" />
              Mais ações · Tarefas, cronômetros, AnyDesk e histórico do cliente
            </span>
          </AccordionTrigger>
          <AccordionContent className="space-y-6 pb-6">
            {/* Tempo por etapa */}
            <div>
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <Clock className="inline h-3 w-3 mr-1" />
                Tempo por etapa
              </p>
              <div className="space-y-2.5">
                {stageDurations.map((s) => {
                  const slaSec = SLA_PER_STAGE_HOURS[s.key] * 3600;
                  const overSla = s.seconds > slaSec;
                  const pct = Math.min(100, (s.seconds / slaSec) * 100);
                  const barColor = overSla
                    ? "bg-danger"
                    : s.isActive
                    ? "bg-primary"
                    : s.seconds > 0
                    ? "bg-success"
                    : "bg-muted";
                  return (
                    <div key={s.key} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className={`flex items-center gap-1.5 ${s.isActive ? "font-medium text-primary" : ""}`}>
                          {s.isActive && (
                            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
                          )}
                          {s.label}
                        </span>
                        <span
                          className={`font-mono text-[11px] ${
                            overSla
                              ? "text-danger font-semibold"
                              : s.isActive
                              ? "text-primary font-semibold"
                              : "text-muted-foreground"
                          }`}
                        >
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

            {/* Tarefas */}
            <div>
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Tarefas do chamado
              </p>
              <TicketTasks ticketId={id!} />
            </div>

            {/* AnyDesk */}
            {ticket.client_id && (
              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <Monitor className="inline h-3 w-3 mr-1" />
                  Acesso Remoto (AnyDesk)
                </p>
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
                        variant="ghost"
                        size="sm"
                        onClick={() => setAnydeskEditOpen(false)}
                      >
                        Cancelar
                      </Button>
                      <Button
                        size="sm"
                        disabled={saveClientAnydesk.isPending || !anydeskDraft.id.trim()}
                        onClick={() => saveClientAnydesk.mutate()}
                      >
                        {saveClientAnydesk.isPending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                        Salvar
                      </Button>
                    </div>
                  </div>
                ) : hasAnydesk ? (
                  <div className="flex items-center justify-between gap-2 rounded border bg-background px-2 py-1.5">
                    <div className="min-w-0">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">ID</div>
                      <div className="truncate font-mono text-xs">{anydeskId}</div>
                    </div>
                    <div className="flex items-center gap-0.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => copyToClipboard(anydeskId, "ID")}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => {
                          setAnydeskDraft({ id: anydeskId });
                          setAnydeskEditOpen(true);
                        }}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setAnydeskDraft({ id: "" });
                      setAnydeskEditOpen(true);
                    }}
                  >
                    <Plus className="mr-1 h-3 w-3" /> Cadastrar AnyDesk
                  </Button>
                )}
              </div>
            )}

            {/* Histórico do cliente */}
            {clientHistory && clientHistory.length > 0 && (
              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Outros chamados deste cliente
                </p>
                <div className="flex flex-wrap gap-x-3 gap-y-1.5 text-xs">
                  {clientHistory.map((h: any) => (
                    <Link
                      key={h.id}
                      to={`/tickets/${h.id}`}
                      className="inline-flex items-center gap-1.5 rounded-md bg-surface-muted px-2 py-1 text-muted-foreground hover:text-foreground hover:shadow-sm"
                    >
                      <span className="font-mono text-[11px] text-primary">#{h.ticket_number}</span>
                      <span className="max-w-[200px] truncate">{h.title}</span>
                      <span className="text-[10px]">· {timeAgo(h.created_at)}</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Datas */}
            <div className="space-y-1 text-[11px] text-muted-foreground border-t pt-3">
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
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* Footer sticky */}
      <div className="sticky bottom-0 -mx-6 mt-6 border-t bg-card/95 backdrop-blur px-6 py-3 flex items-center justify-between">
        <Link
          to="/tickets"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Voltar para Central de Chamados
        </Link>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!prevTicketId}
            onClick={() => prevTicketId && navigate(`/tickets/${prevTicketId}`)}
          >
            <ChevronLeft className="mr-1 h-3.5 w-3.5" />
            Anterior
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!nextTicketId}
            onClick={() => nextTicketId && navigate(`/tickets/${nextTicketId}`)}
          >
            Próximo
            <ChevronRight className="ml-1 h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <EditTicketDialog ticket={ticket} open={editOpen} onOpenChange={setEditOpen} />
      <EmailN2Dialog ticketId={ticket.id} ticketStatus={ticket.status} open={emailN2Open} onOpenChange={setEmailN2Open} />
    </div>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      {children}
    </div>
  );
}

function SidebarField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <div>{children}</div>
    </div>
  );
}
