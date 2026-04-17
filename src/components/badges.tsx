import { ToneBadge } from "@/components/ui/tone-badge";
import { STATUS_LABEL, STATUS_TONE, PRIORITY_LABEL, PRIORITY_TONE, HEALTH_LABEL, HEALTH_TONE, type TicketStatus, type TicketPriority, type ClientHealth } from "@/lib/constants";

export function StatusBadge({ status }: { status: TicketStatus }) {
  return <ToneBadge tone={STATUS_TONE[status]} dot>{STATUS_LABEL[status]}</ToneBadge>;
}

export function PriorityBadge({ priority }: { priority: TicketPriority }) {
  return <ToneBadge tone={PRIORITY_TONE[priority]}>{PRIORITY_LABEL[priority]}</ToneBadge>;
}

export function HealthBadge({ health }: { health: ClientHealth }) {
  return <ToneBadge tone={HEALTH_TONE[health]} dot>{HEALTH_LABEL[health]}</ToneBadge>;
}
