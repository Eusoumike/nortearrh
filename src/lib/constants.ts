import { Database } from "@/integrations/supabase/types";

export type TicketStatus = Database["public"]["Enums"]["ticket_status"];
export type TicketPriority = Database["public"]["Enums"]["ticket_priority"];
export type TicketChannel = Database["public"]["Enums"]["ticket_channel"];
export type ClientHealth = Database["public"]["Enums"]["client_health"];
export type InteractionType = Database["public"]["Enums"]["interaction_type"];
export type AppRole = Database["public"]["Enums"]["app_role"];
export type TicketType = Database["public"]["Enums"]["ticket_type"];
export type InteractionResult = Database["public"]["Enums"]["interaction_result"];

export const TICKET_TYPE_LABEL: Record<TicketType, string> = {
  duvida_uso: "Dúvida de uso",
  configuracao: "Configuração",
  fechamento: "Fechamento",
  admissao_demissao: "Admissão / demissão",
  bug_sistema: "Bug / Erro no sistema",
  produto_rh_digital: "Produto RH Digital",
  beneficios_vr: "Benefícios VR",
  upgrade: "Upgrade",
  downgrade: "Downgrade",
  financeiro: "Financeiro",
};

export const TICKET_TYPE_GROUPS: { label: string; hint: string; types: TicketType[] }[] = [
  { label: "Operacional", hint: "Você resolve", types: ["duvida_uso", "configuracao", "fechamento", "admissao_demissao"] },
  { label: "Escalonamento", hint: "Você encaminha", types: ["bug_sistema", "produto_rh_digital", "beneficios_vr"] },
  { label: "Comercial", hint: "Ação específica", types: ["upgrade", "downgrade", "financeiro"] },
];

export const INTERACTION_RESULT_LABEL: Record<InteractionResult, string> = {
  resolvido: "Resolvido",
  parcialmente_resolvido: "Parcialmente resolvido",
  escalado: "Escalado",
  aguardando: "Aguardando",
};

export const INTERACTION_RESULT_TONE: Record<InteractionResult, "success" | "warning" | "info" | "muted"> = {
  resolvido: "success",
  parcialmente_resolvido: "warning",
  escalado: "info",
  aguardando: "muted",
};

export const STATUS_LABEL: Record<TicketStatus, string> = {
  novo: "Novo",
  em_atendimento: "Em atendimento",
  aguardando_cliente: "Aguardando cliente",
  suporte_vera_n1: "Suporte Vera N1",
  abertura_chamado_n2: "Abertura chamado N2",
  resolvido: "Resolvido",
  // 'fechado' é legado: tratado como Resolvido na UI
  fechado: "Resolvido",
};

export const STATUS_TONE: Record<TicketStatus, "info" | "warning" | "muted" | "success" | "neutral" | "primary" | "accent"> = {
  novo: "info",
  em_atendimento: "warning",
  aguardando_cliente: "muted",
  suporte_vera_n1: "accent",
  abertura_chamado_n2: "primary",
  resolvido: "success",
  fechado: "success",
};

// Fluxo ordenado (sem 'fechado', que é sinônimo legado de resolvido)
export const STATUS_FLOW: TicketStatus[] = [
  "novo",
  "em_atendimento",
  "aguardando_cliente",
  "suporte_vera_n1",
  "abertura_chamado_n2",
  "resolvido",
];

// Etapas que possuem cronômetro próprio (campos total_<x>_seconds)
export const TIMED_STAGES = [
  { key: "em_atendimento" as const, label: "Em atendimento", totalCol: "total_em_atendimento_seconds" as const, enteredCol: "entered_em_atendimento_at" as const },
  { key: "aguardando_cliente" as const, label: "Aguardando cliente", totalCol: "total_aguardando_cliente_seconds" as const, enteredCol: "entered_aguardando_cliente_at" as const },
  { key: "suporte_vera_n1" as const, label: "Suporte Vera N1", totalCol: "total_vera_n1_seconds" as const, enteredCol: "entered_vera_n1_at" as const },
  { key: "abertura_chamado_n2" as const, label: "Abertura N2", totalCol: "total_n2_seconds" as const, enteredCol: "entered_n2_at" as const },
];

// Alvo de SLA por etapa (em horas) — referência
export const SLA_PER_STAGE_HOURS: Record<typeof TIMED_STAGES[number]["key"], number> = {
  em_atendimento: 4,
  aguardando_cliente: 24,
  suporte_vera_n1: 8,
  abertura_chamado_n2: 24,
};

export const PRIORITY_LABEL: Record<TicketPriority, string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
  urgente: "Urgente",
  critica: "Urgente", // legado: tratado como urgente na UI
};

export const PRIORITY_TONE: Record<TicketPriority, "muted" | "info" | "warning" | "danger"> = {
  baixa: "muted",
  media: "info",
  alta: "warning",
  urgente: "danger",
  critica: "danger",
};

export const CHANNEL_LABEL: Record<TicketChannel, string> = {
  whatsapp: "WhatsApp",
  telefone: "Telefone",
  reuniao: "Reunião",
  anydesk: "AnyDesk",
  email: "E-mail",
  // canais legados (mantidos só para compatibilidade com tickets antigos)
  chat: "Chat",
  portal: "Portal",
  
  outro: "Outro",
};

// Canais oferecidos no UI ao criar/editar (os legados ficam escondidos)
export const ACTIVE_CHANNELS: TicketChannel[] = ["whatsapp", "telefone", "reuniao", "anydesk", "email"];

export const HEALTH_LABEL: Record<ClientHealth, string> = {
  saudavel: "Ativo",
  em_atencao: "Em risco",
  critico: "Inativo",
};

export const HEALTH_TONE: Record<ClientHealth, "success" | "warning" | "danger"> = {
  saudavel: "success",
  em_atencao: "warning",
  critico: "danger",
};

export const INTERACTION_LABEL: Record<InteractionType, string> = {
  nota: "Nota interna",
  anotacao: "Anotação",
  email: "E-mail",
  ligacao: "Ligação",
  whatsapp: "WhatsApp",
  reuniao: "Reunião",
  remoto: "Atendimento remoto",
  mudanca_status: "Mudança de status",
};

// Defaults SLA (em horas) por prioridade — alinhado com trigger compute_ticket_sla_deadline
export const SLA_RESPONSE_HOURS: Record<TicketPriority, number> = {
  urgente: 1,
  critica: 1,
  alta: 4,
  media: 8,
  baixa: 24,
};

export const SLA_RESOLUTION_HOURS: Record<TicketPriority, number> = {
  urgente: 2,
  critica: 2,
  alta: 6,
  media: 24,
  baixa: 72,
};

