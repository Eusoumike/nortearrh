import { Database } from "@/integrations/supabase/types";

export type TicketStatus = Database["public"]["Enums"]["ticket_status"];
export type TicketPriority = Database["public"]["Enums"]["ticket_priority"];
export type TicketChannel = Database["public"]["Enums"]["ticket_channel"];
export type ClientHealth = Database["public"]["Enums"]["client_health"];
export type InteractionType = Database["public"]["Enums"]["interaction_type"];
export type AppRole = Database["public"]["Enums"]["app_role"];

export const STATUS_LABEL: Record<TicketStatus, string> = {
  aberto: "Aberto",
  em_andamento: "Em andamento",
  aguardando_cliente: "Aguardando cliente",
  resolvido: "Resolvido",
  fechado: "Fechado",
};

export const STATUS_TONE: Record<TicketStatus, "info" | "warning" | "muted" | "success" | "neutral"> = {
  aberto: "info",
  em_andamento: "warning",
  aguardando_cliente: "muted",
  resolvido: "success",
  fechado: "neutral",
};

export const PRIORITY_LABEL: Record<TicketPriority, string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
  critica: "Crítica",
};

export const PRIORITY_TONE: Record<TicketPriority, "muted" | "info" | "warning" | "danger"> = {
  baixa: "muted",
  media: "info",
  alta: "warning",
  critica: "danger",
};

export const CHANNEL_LABEL: Record<TicketChannel, string> = {
  email: "E-mail",
  whatsapp: "WhatsApp",
  telefone: "Telefone",
  chat: "Chat",
  portal: "Portal",
  pipedrive: "Pipedrive",
  outro: "Outro",
};

export const HEALTH_LABEL: Record<ClientHealth, string> = {
  saudavel: "Saudável",
  em_atencao: "Em atenção",
  critico: "Crítico",
};

export const HEALTH_TONE: Record<ClientHealth, "success" | "warning" | "danger"> = {
  saudavel: "success",
  em_atencao: "warning",
  critico: "danger",
};

export const INTERACTION_LABEL: Record<InteractionType, string> = {
  nota: "Nota interna",
  email: "E-mail",
  ligacao: "Ligação",
  whatsapp: "WhatsApp",
  reuniao: "Reunião",
  mudanca_status: "Mudança de status",
};

// Defaults SLA (em horas) por prioridade
export const SLA_RESPONSE_HOURS: Record<TicketPriority, number> = {
  critica: 1,
  alta: 4,
  media: 8,
  baixa: 24,
};

export const SLA_RESOLUTION_HOURS: Record<TicketPriority, number> = {
  critica: 4,
  alta: 24,
  media: 72,
  baixa: 168,
};
