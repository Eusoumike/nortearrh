import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getClientPrimary,
  getClientSecondary,
  getClientLabel,
  filterAndSortClients,
} from "@/lib/clientDisplay";
import { toast } from "sonner";
import { TemaAutocomplete } from "@/components/tickets/TemaAutocomplete";
import {
  STATUS_LABEL,
  STATUS_FLOW,
  PRIORITY_LABEL,
  CHANNEL_LABEL,
  MODULO_AFETADO_OPTIONS,
  ORIGEM_PROBLEMA_OPTIONS,
  QUEM_REPORTOU_OPTIONS,
  type TicketStatus,
  type TicketPriority,
  type TicketChannel,
} from "@/lib/constants";
import { brazilInputToISO, formatBrazilDateTime } from "@/lib/formatters";

interface EditTicketDialogProps {
  ticket: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function isoToBrasiliaInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Sao_Paulo",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)?.value || "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

function ClientPickerPopover({
  clients,
  value,
  onSelect,
}: {
  clients: any[];
  value: string;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const selected = clients.find((c) => c.id === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          className={cn("w-full justify-between font-normal", !selected && "text-muted-foreground")}
        >
          <span className="truncate">{selected ? getClientLabel(selected) : "Selecione um cliente"}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Buscar por empresa ou contato…"
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="__none__"
                onSelect={() => { onSelect(""); setOpen(false); }}
              >
                <Check className={cn("mr-2 h-4 w-4", !value ? "opacity-100" : "opacity-0")} />
                <span className="text-sm text-muted-foreground">— Nenhum —</span>
              </CommandItem>
              {filterAndSortClients(clients, search).map((c) => (
                <CommandItem
                  key={c.id}
                  value={c.id}
                  onSelect={() => { onSelect(c.id); setOpen(false); }}
                >
                  <Check className={cn("mr-2 h-4 w-4", value === c.id ? "opacity-100" : "opacity-0")} />
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{getClientPrimary(c)}</span>
                    {getClientSecondary(c) && (
                      <span className="text-xs text-muted-foreground">{getClientSecondary(c)}</span>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function EditTicketDialog({ ticket, open, onOpenChange }: EditTicketDialogProps) {
  const qc = useQueryClient();

  const { data: clients } = useQuery({
    queryKey: ["clients-min"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name, company, razao_social, nome_fantasia, contact_name, cnpj")
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const { data: profiles } = useQuery({
    queryKey: ["profiles-min"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, full_name");
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const [form, setForm] = useState({
    ticket_number: "",
    tema: "",
    modulo_afetado: "",
    quem_reportou: "",
    origem_problema: "",
    solucao_curta: "",
    vira_artigo_assist: false,
    client_id: "" as string,
    organization: "",
    client_email: "",
    client_phone: "",
    channel: "portal" as TicketChannel,
    status: "novo" as TicketStatus,
    priority: "media" as TicketPriority,
    assigned_to: "unassigned" as string,
    opened_at: "",
    anydesk_id: "",
  });

  useEffect(() => {
    if (!open || !ticket) return;
    setForm({
      ticket_number: String(ticket.ticket_number ?? ""),
      tema: ticket.tema ?? ticket.title ?? "",
      modulo_afetado: ticket.modulo_afetado ?? "",
      quem_reportou: ticket.quem_reportou ?? "",
      origem_problema: ticket.origem_problema ?? "",
      solucao_curta: ticket.solucao_curta ?? "",
      vira_artigo_assist: Boolean(ticket.vira_artigo_assist),
      client_id: ticket.client_id ?? "",
      organization: ticket.organization ?? "",
      client_email: ticket.client_email ?? "",
      client_phone: ticket.client_phone ?? "",
      channel: ticket.channel ?? "portal",
      status: ticket.status ?? "novo",
      priority: ticket.priority ?? "media",
      assigned_to: ticket.assigned_to ?? "unassigned",
      opened_at: isoToBrasiliaInput(ticket.opened_at ?? ticket.created_at),
      anydesk_id: ticket.anydesk_id ?? "",
    });
  }, [open, ticket]);

  const isResolvido = form.status === "resolvido";

  const save = useMutation({
    mutationFn: async () => {
      const numberTrim = form.ticket_number.trim();
      if (!numberTrim) throw new Error("Número do chamado é obrigatório.");
      if (!form.tema.trim()) throw new Error("Tema é obrigatório.");
      if (!form.modulo_afetado) throw new Error("Módulo afetado é obrigatório.");
      if (isResolvido && !form.solucao_curta.trim()) {
        throw new Error("Solução curta é obrigatória para chamados resolvidos.");
      }

      const patch: Record<string, any> = {
        ticket_number: numberTrim,
        // mantém title sincronizado com tema para compat
        title: form.tema.trim(),
        tema: form.tema.trim(),
        modulo_afetado: form.modulo_afetado,
        quem_reportou: form.quem_reportou || null,
        origem_problema: form.origem_problema || null,
        solucao_curta: form.solucao_curta.trim() || null,
        vira_artigo_assist: form.vira_artigo_assist,
        client_id: form.client_id || null,
        organization: form.organization.trim() || null,
        client_email: form.client_email.trim() || null,
        client_phone: form.client_phone.trim() || null,
        channel: form.channel,
        status: form.status,
        priority: form.priority,
        assigned_to: form.assigned_to === "unassigned" ? null : form.assigned_to,
        opened_at: brazilInputToISO(form.opened_at) ?? ticket.opened_at,
        anydesk_id: form.anydesk_id.trim() || null,
      };

      const { error } = await supabase.from("tickets").update(patch as any).eq("id", ticket.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ticket", ticket.id] });
      qc.invalidateQueries({ queryKey: ["tickets"] });
      qc.invalidateQueries({ queryKey: ["dashboard-tickets"] });
      qc.invalidateQueries({ queryKey: ["temas-frequentes"] });
      toast.success("Chamado atualizado.");
      onOpenChange(false);
    },
    onError: (e: any) => {
      const msg = String(e.message ?? "");
      if (msg.includes("unique") || msg.includes("duplicate")) {
        toast.error("Já existe um chamado com esse número.");
      } else {
        toast.error(msg || "Erro ao atualizar.");
      }
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl p-0 shadow-2xl">
        <DialogHeader className="sticky top-0 z-10 border-b border-border bg-muted/30 px-6 py-4">
          <DialogTitle className="text-lg font-semibold tracking-tight">
            Editar Chamado {ticket?.ticket_number ? `#${ticket.ticket_number}` : ""}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Atualize os campos do chamado.
          </DialogDescription>
        </DialogHeader>
        <div className="px-6 py-5">
          <div className="grid gap-4 py-2">
            {/* Nº e Tema */}
            <div className="grid grid-cols-[140px_1fr] gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ticket_number">Número *</Label>
                <Input
                  id="ticket_number"
                  value={form.ticket_number}
                  onChange={(e) => setForm({ ...form, ticket_number: e.target.value })}
                  placeholder="VR-2024-001"
                  maxLength={50}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Tema *</Label>
                <TemaAutocomplete
                  value={form.tema}
                  onChange={(tema, moduloSugerido) =>
                    setForm((f) => ({
                      ...f,
                      tema,
                      modulo_afetado: f.modulo_afetado || moduloSugerido || f.modulo_afetado,
                    }))
                  }
                />
              </div>
            </div>

            {/* Módulo | Quem reportou */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Módulo afetado *</Label>
                <Select
                  value={form.modulo_afetado || undefined}
                  onValueChange={(v) => setForm({ ...form, modulo_afetado: v })}
                >
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {MODULO_AFETADO_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Quem reportou</Label>
                <Select
                  value={form.quem_reportou || undefined}
                  onValueChange={(v) => setForm({ ...form, quem_reportou: v })}
                >
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {QUEM_REPORTOU_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Cliente | Organização */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Cliente</Label>
                <ClientPickerPopover
                  clients={(clients ?? []) as any[]}
                  value={form.client_id}
                  onSelect={(id) => setForm({ ...form, client_id: id })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="organization">Organização</Label>
                <Input
                  id="organization"
                  value={form.organization}
                  onChange={(e) => setForm({ ...form, organization: e.target.value })}
                  maxLength={200}
                />
              </div>
            </div>

            {/* Contato */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="client_email">Email</Label>
                <Input
                  id="client_email"
                  type="email"
                  value={form.client_email}
                  onChange={(e) => setForm({ ...form, client_email: e.target.value })}
                  maxLength={255}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="client_phone">Telefone</Label>
                <Input
                  id="client_phone"
                  value={form.client_phone}
                  onChange={(e) => setForm({ ...form, client_phone: e.target.value })}
                  maxLength={30}
                  placeholder="(11) 99999-9999"
                />
              </div>
            </div>

            {/* Canal | Status | Prioridade */}
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Canal</Label>
                <Select value={form.channel} onValueChange={(v) => setForm({ ...form, channel: v as TicketChannel })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(CHANNEL_LABEL).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as TicketStatus })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_FLOW.map((k) => (
                      <SelectItem key={k} value={k}>{STATUS_LABEL[k]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Prioridade</Label>
                <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v as TicketPriority })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(PRIORITY_LABEL).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Origem do problema */}
            <div className="space-y-1.5">
              <Label>Origem do problema</Label>
              <Select
                value={form.origem_problema || undefined}
                onValueChange={(v) => setForm({ ...form, origem_problema: v })}
              >
                <SelectTrigger><SelectValue placeholder="Selecione a causa raiz" /></SelectTrigger>
                <SelectContent>
                  {ORIGEM_PROBLEMA_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Solução curta */}
            <div className="space-y-1.5">
              <Label htmlFor="solucao_curta">
                Solução curta {isResolvido && <span className="text-destructive">*</span>}
              </Label>
              <Textarea
                id="solucao_curta"
                value={form.solucao_curta}
                onChange={(e) => setForm({ ...form, solucao_curta: e.target.value })}
                placeholder="Resumo em 1 linha do que resolveu"
                rows={2}
                maxLength={300}
              />
              {isResolvido && (
                <p className="text-[11px] text-muted-foreground">
                  Obrigatório para chamados marcados como resolvidos.
                </p>
              )}
            </div>

            {/* Vira artigo Assist */}
            <label className="flex items-start gap-2 rounded-md border border-border bg-muted/30 p-3 cursor-pointer">
              <Checkbox
                checked={form.vira_artigo_assist}
                onCheckedChange={(v) => setForm({ ...form, vira_artigo_assist: Boolean(v) })}
                className="mt-0.5"
              />
              <div className="text-xs">
                <div className="font-medium">Virar artigo da base (Nortear Assist)</div>
                <div className="text-muted-foreground">
                  Marque quando a solução deste chamado for útil para outros clientes.
                </div>
              </div>
            </label>

            {/* Atendente | Data */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Atendente responsável</Label>
                <Select value={form.assigned_to} onValueChange={(v) => setForm({ ...form, assigned_to: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Não atribuído</SelectItem>
                    {(profiles ?? []).map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>{p.full_name ?? p.id}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="opened_at">
                  Data de abertura <span className="text-[10px] text-muted-foreground">(Brasília)</span>
                </Label>
                <Input
                  id="opened_at"
                  type="datetime-local"
                  value={form.opened_at}
                  onChange={(e) => setForm({ ...form, opened_at: e.target.value })}
                />
                <p className="text-[10px] text-muted-foreground">
                  Atual: {formatBrazilDateTime(ticket?.opened_at ?? ticket?.created_at)}
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="anydesk_id">AnyDesk ID</Label>
              <Input
                id="anydesk_id"
                value={form.anydesk_id}
                onChange={(e) => setForm({ ...form, anydesk_id: e.target.value })}
                maxLength={50}
                placeholder="123 456 789"
              />
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={save.isPending}>
              Cancelar
            </Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar alterações
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
