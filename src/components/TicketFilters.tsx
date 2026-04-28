import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, ChevronDown, X, Filter } from "lucide-react";
import {
  STATUS_LABEL,
  STATUS_FLOW,
  PRIORITY_LABEL,
  CHANNEL_LABEL,
  ACTIVE_CHANNELS,
  type TicketStatus,
  type TicketPriority,
  type TicketChannel,
} from "@/lib/constants";
import { cn } from "@/lib/utils";

export type Period = "all" | "today" | "week" | "month" | "30d" | "90d";

export interface TicketFiltersState {
  q: string;
  client: string;
  statuses: TicketStatus[];
  priorities: TicketPriority[];
  channels: TicketChannel[];
  categories: string[];
  assignee: string; // "all" | "unassigned" | user_id
  period: Period;
}

const STORAGE_KEY = "nortear_filtros_chamados";

const PRIORITY_KEYS: TicketPriority[] = ["baixa", "media", "alta", "urgente"];

export const DEFAULT_FILTERS: TicketFiltersState = {
  q: "",
  client: "",
  statuses: STATUS_FLOW.filter((s) => s !== "resolvido") as TicketStatus[],
  priorities: PRIORITY_KEYS,
  channels: [...ACTIVE_CHANNELS],
  categories: [], // [] = todas (até saber a lista)
  assignee: "all",
  period: "all",
};

export function loadFilters(): TicketFiltersState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_FILTERS;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_FILTERS, ...parsed };
  } catch {
    return DEFAULT_FILTERS;
  }
}

export function saveFilters(f: TicketFiltersState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(f));
  } catch {
    // ignore
  }
}

interface MultiPopProps {
  label: string;
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (next: string[]) => void;
  /** Total considerado quando "tudo" está selecionado (para mostrar "Todos") */
  totalCount?: number;
}

function MultiSelectPopover({ label, options, selected, onChange, totalCount }: MultiPopProps) {
  const allCount = totalCount ?? options.length;
  const isAll = selected.length === 0 || selected.length === allCount;
  const display = isAll ? `${label}: Todos` : `${label} (${selected.length})`;

  const toggle = (v: string) => {
    if (selected.includes(v)) onChange(selected.filter((x) => x !== v));
    else onChange([...selected, v]);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className={cn("h-9 gap-1.5", !isAll && "border-primary/50 bg-primary/5 text-primary")}>
          {display}
          <ChevronDown className="h-3.5 w-3.5 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 p-2">
        <div className="mb-2 flex items-center justify-between gap-2 px-1">
          <button type="button" className="text-[11px] text-muted-foreground hover:text-foreground" onClick={() => onChange(options.map((o) => o.value))}>
            Selecionar tudo
          </button>
          <button type="button" className="text-[11px] text-muted-foreground hover:text-foreground" onClick={() => onChange([])}>
            Limpar
          </button>
        </div>
        <div className="max-h-72 space-y-1 overflow-y-auto">
          {options.length === 0 ? (
            <p className="px-2 py-1.5 text-xs text-muted-foreground">Nenhuma opção</p>
          ) : (
            options.map((opt) => {
              const checked = selected.includes(opt.value);
              return (
                <label
                  key={opt.value}
                  className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                >
                  <Checkbox checked={checked} onCheckedChange={() => toggle(opt.value)} />
                  <span className="truncate">{opt.label}</span>
                </label>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface Props {
  value: TicketFiltersState;
  onChange: (next: TicketFiltersState) => void;
  resultCount: number;
  /** Quando true, esconde o filtro de Status (kanban já agrupa por status) */
  hideStatus?: boolean;
}

export function TicketFilters({ value, onChange, resultCount, hideStatus }: Props) {
  const [qLocal, setQLocal] = useState(value.q);
  const [clientLocal, setClientLocal] = useState(value.client);

  // Debounce dos campos de texto
  useEffect(() => {
    const t = setTimeout(() => {
      if (qLocal !== value.q) onChange({ ...value, q: qLocal });
    }, 300);
    return () => clearTimeout(t);
  }, [qLocal]); // eslint-disable-line

  useEffect(() => {
    const t = setTimeout(() => {
      if (clientLocal !== value.client) onChange({ ...value, client: clientLocal });
    }, 300);
    return () => clearTimeout(t);
  }, [clientLocal]); // eslint-disable-line

  // Sincroniza quando o valor externo muda (ex.: limpar filtros)
  useEffect(() => { setQLocal(value.q); }, [value.q]);
  useEffect(() => { setClientLocal(value.client); }, [value.client]);

  const { data: profiles } = useQuery({
    queryKey: ["profiles-for-filters"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, full_name").order("full_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: categories } = useQuery({
    queryKey: ["ticket-categories-for-filters"],
    queryFn: async () => {
      const { data, error } = await supabase.from("ticket_categories").select("id, name").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const statusOptions = useMemo(
    () => STATUS_FLOW.map((s) => ({ value: s, label: STATUS_LABEL[s] })),
    [],
  );
  const priorityOptions = useMemo(
    () => PRIORITY_KEYS.map((p) => ({ value: p, label: PRIORITY_LABEL[p] })),
    [],
  );
  const channelOptions = useMemo(
    () => ACTIVE_CHANNELS.map((c) => ({ value: c, label: CHANNEL_LABEL[c] })),
    [],
  );
  const categoryOptions = useMemo(
    () => (categories ?? []).map((c) => ({ value: c.name, label: c.name })),
    [categories],
  );

  const isDefault =
    value.q === "" &&
    value.client === "" &&
    value.assignee === "all" &&
    value.period === "all" &&
    arraysEqual(value.statuses.slice().sort(), DEFAULT_FILTERS.statuses.slice().sort()) &&
    arraysEqual(value.priorities.slice().sort(), DEFAULT_FILTERS.priorities.slice().sort()) &&
    arraysEqual(value.channels.slice().sort(), DEFAULT_FILTERS.channels.slice().sort()) &&
    value.categories.length === 0;

  const reset = () => {
    onChange(DEFAULT_FILTERS);
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-center">
        {/* Busca geral */}
        <div className="relative w-full lg:w-72">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={qLocal}
            onChange={(e) => setQLocal(e.target.value)}
            placeholder="Buscar título, número, cliente…"
            className="h-9 pl-8"
          />
        </div>

        {/* Cliente (texto) */}
        <div className="relative w-full lg:w-56">
          <Input
            value={clientLocal}
            onChange={(e) => setClientLocal(e.target.value)}
            placeholder="Cliente / organização"
            className="h-9"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Filter className="hidden h-3.5 w-3.5 text-muted-foreground lg:inline" />

          {!hideStatus && (
            <MultiSelectPopover
              label="Status"
              options={statusOptions}
              selected={value.statuses}
              onChange={(s) => onChange({ ...value, statuses: s as TicketStatus[] })}
              totalCount={statusOptions.length}
            />
          )}

          <MultiSelectPopover
            label="Prioridade"
            options={priorityOptions}
            selected={value.priorities}
            onChange={(s) => onChange({ ...value, priorities: s as TicketPriority[] })}
            totalCount={priorityOptions.length}
          />

          <MultiSelectPopover
            label="Canal"
            options={channelOptions}
            selected={value.channels}
            onChange={(s) => onChange({ ...value, channels: s as TicketChannel[] })}
            totalCount={channelOptions.length}
          />

          <MultiSelectPopover
            label="Categoria"
            options={categoryOptions}
            selected={value.categories}
            onChange={(s) => onChange({ ...value, categories: s })}
            totalCount={categoryOptions.length}
          />

          {/* Atendente */}
          <Select value={value.assignee} onValueChange={(v) => onChange({ ...value, assignee: v })}>
            <SelectTrigger className={cn("h-9 w-[180px]", value.assignee !== "all" && "border-primary/50 bg-primary/5 text-primary")}>
              <SelectValue placeholder="Atendente" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Atendente: Todos</SelectItem>
              <SelectItem value="unassigned">Sem atendente</SelectItem>
              {(profiles ?? []).map((p: any) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.full_name ?? "Sem nome"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Período */}
          <Select value={value.period} onValueChange={(v) => onChange({ ...value, period: v as Period })}>
            <SelectTrigger className={cn("h-9 w-[170px]", value.period !== "all" && "border-primary/50 bg-primary/5 text-primary")}>
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Período: Todos</SelectItem>
              <SelectItem value="today">Hoje</SelectItem>
              <SelectItem value="week">Esta semana</SelectItem>
              <SelectItem value="month">Este mês</SelectItem>
              <SelectItem value="30d">Últimos 30 dias</SelectItem>
              <SelectItem value="90d">Últimos 90 dias</SelectItem>
            </SelectContent>
          </Select>

          {!isDefault && (
            <Button variant="ghost" size="sm" className="h-9 gap-1 text-muted-foreground hover:text-foreground" onClick={reset}>
              <X className="h-3.5 w-3.5" /> Limpar filtros
            </Button>
          )}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {resultCount} chamado{resultCount === 1 ? "" : "s"} encontrado{resultCount === 1 ? "" : "s"}
      </p>
    </div>
  );
}

function arraysEqual(a: string[], b: string[]) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/** Aplica os filtros sobre um array de tickets carregado. */
export function applyTicketFilters(tickets: any[], f: TicketFiltersState, opts?: { ignoreStatus?: boolean }): any[] {
  if (!tickets) return [];
  const now = Date.now();
  let from: number | null = null;
  if (f.period !== "all") {
    const d = new Date();
    if (f.period === "today") {
      d.setHours(0, 0, 0, 0);
      from = d.getTime();
    } else if (f.period === "week") {
      const day = d.getDay(); // 0 = domingo
      d.setDate(d.getDate() - day);
      d.setHours(0, 0, 0, 0);
      from = d.getTime();
    } else if (f.period === "month") {
      d.setDate(1);
      d.setHours(0, 0, 0, 0);
      from = d.getTime();
    } else if (f.period === "30d") {
      from = now - 30 * 86400000;
    } else if (f.period === "90d") {
      from = now - 90 * 86400000;
    }
  }

  const qNeedle = f.q.trim().toLowerCase();
  const cNeedle = f.client.trim().toLowerCase();

  return tickets.filter((t: any) => {
    // Status
    if (!opts?.ignoreStatus && f.statuses.length > 0) {
      const eff = t.status === "fechado" ? "resolvido" : t.status;
      if (!f.statuses.includes(eff)) return false;
    }
    // Prioridade
    if (f.priorities.length > 0) {
      const eff = t.priority === "critica" ? "urgente" : t.priority;
      if (!f.priorities.includes(eff)) return false;
    }
    // Canal
    if (f.channels.length > 0 && !f.channels.includes(t.channel)) return false;
    // Categoria
    if (f.categories.length > 0 && !f.categories.includes(t.category)) return false;
    // Atendente
    if (f.assignee !== "all") {
      if (f.assignee === "unassigned") {
        if (t.assigned_to) return false;
      } else if (t.assigned_to !== f.assignee) return false;
    }
    // Período (created_at)
    if (from !== null && new Date(t.created_at).getTime() < from) return false;
    // Cliente
    if (cNeedle) {
      const name = `${t.client_name ?? ""} ${t.organization ?? ""} ${t.client?.name ?? ""}`.toLowerCase();
      if (!name.includes(cNeedle)) return false;
    }
    // Busca geral
    if (qNeedle) {
      const hay = `${t.title ?? ""} ${t.ticket_number ?? ""} ${t.client_name ?? ""} ${t.organization ?? ""} ${t.client?.name ?? ""}`.toLowerCase();
      if (!hay.includes(qNeedle)) return false;
    }
    return true;
  });
}
