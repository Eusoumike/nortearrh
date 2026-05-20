import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { Loader2, Search, Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { TicketTitleCombobox } from "@/components/TicketTitleCombobox";
import {
  SLA_RESPONSE_HOURS,
  SLA_RESOLUTION_HOURS,
  type TicketPriority,
  type TicketChannel,
} from "@/lib/constants";
import {
  getClientPrimary,
  getClientSecondary,
  getClientLabel,
  filterAndSortClients,
} from "@/lib/clientDisplay";

interface NewTicketDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CHANNEL_OPTIONS: { value: TicketChannel; label: string }[] = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "telefone", label: "Telefone" },
  { value: "email", label: "E-mail" },
  { value: "reuniao", label: "Presencial" },
  { value: "portal", label: "Sistema" },
];

const PRIORITY_OPTIONS: { value: TicketPriority; label: string }[] = [
  { value: "baixa", label: "Baixa" },
  { value: "media", label: "Média" },
  { value: "alta", label: "Alta" },
  { value: "critica", label: "Crítica" },
];

const CATEGORY_OPTIONS = [
  "Dúvida de uso",
  "Configuração",
  "Fechamento",
  "Admissão/Demissão",
  "Bug do sistema",
  "Outro",
];

const QUEM_OPTIONS = [
  { value: "colaborador", label: "Colaborador" },
  { value: "gestor", label: "Gestor" },
  { value: "administrador", label: "Administrador" },
  { value: "rh", label: "RH" },
];

const INITIAL_FORM = {
  title: "",
  client_id: "",
  channel: "whatsapp" as TicketChannel,
  priority: "media" as TicketPriority,
  category: "",
  descricao_problema: "",
  quem_reportou: "",
  acao_tentada: "",
  ja_tentou: "",
};

export function NewTicketDialog({ open, onOpenChange }: NewTicketDialogProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();

  const [form, setForm] = useState(INITIAL_FORM);
  const [clientPickerOpen, setClientPickerOpen] = useState(false);
  const [clientSearch, setClientSearch] = useState("");

  useEffect(() => {
    if (open) {
      setForm(INITIAL_FORM);
      setClientSearch("");
    }
  }, [open]);

  const { data: clients } = useQuery({
    queryKey: ["clients-min"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name, company, contact_name, cnpj, email, phone")
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const selectedClient = clients?.find((c) => c.id === form.client_id);

  const create = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Não autenticado");
      const openedISO = new Date().toISOString();
      const openedDate = new Date(openedISO);
      const respDeadline = new Date(openedDate.getTime() + SLA_RESPONSE_HOURS[form.priority] * 3600_000);
      const resDeadline = new Date(openedDate.getTime() + SLA_RESOLUTION_HOURS[form.priority] * 3600_000);

      const { data, error } = await supabase
        .from("tickets")
        .insert({
          title: form.title.trim(),
          description: form.descricao_problema.trim() || null,
          descricao_problema: form.descricao_problema.trim() || null,
          quem_reportou: form.quem_reportou || null,
          acao_tentada: form.acao_tentada.trim() || null,
          ja_tentou: form.ja_tentou.trim() || null,
          priority: form.priority,
          channel: form.channel,
          category: form.category || null,
          client_id: form.client_id || null,
          client_email: (selectedClient as any)?.email ?? null,
          client_phone: (selectedClient as any)?.phone ?? null,
          organization: (selectedClient as any)?.company ?? null,
          created_by: user.id,
          created_at: openedISO,
          opened_at: openedISO,
          sla_response_deadline: respDeadline.toISOString(),
          sla_resolution_deadline: resDeadline.toISOString(),
        } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["tickets"] });
      qc.invalidateQueries({ queryKey: ["dashboard-tickets"] });
      toast.success("Chamado criado com sucesso!");
      onOpenChange(false);
      navigate(`/tickets/${data.id}`);
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao salvar. Tente novamente."),
  });

  const requiredOk = form.client_id && form.title.trim() && form.channel && form.priority;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!requiredOk) {
      toast.error("Preencha todos os campos obrigatórios.");
      return;
    }
    create.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl p-0 gap-0 overflow-hidden max-h-[85vh] flex flex-col">
        <DialogHeader className="border-b border-border px-5 py-3">
          <DialogTitle className="text-base">Novo Chamado</DialogTitle>
          <DialogDescription className="text-xs">
            Preencha os dados do chamado
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="px-5 py-4 overflow-y-auto space-y-3">
          {/* Cliente */}
          <div className="space-y-1">
            <Label className="text-xs">
              Cliente <span className="text-destructive">*</span>
            </Label>
            <Popover open={clientPickerOpen} onOpenChange={setClientPickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  role="combobox"
                  className={cn(
                    "h-9 w-full justify-between font-normal",
                    !selectedClient && "text-muted-foreground",
                  )}
                >
                  <span className="flex items-center gap-2 truncate">
                    <Search className="h-3.5 w-3.5 shrink-0" />
                    {selectedClient ? getClientLabel(selectedClient as any) : "Selecione um cliente"}
                  </span>
                  <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command shouldFilter={false}>
                  <CommandInput
                    placeholder="Buscar por empresa, CNPJ ou contato…"
                    className="h-9"
                    value={clientSearch}
                    onValueChange={setClientSearch}
                  />
                  <CommandList>
                    <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
                    <CommandGroup>
                      {filterAndSortClients((clients ?? []) as any[], clientSearch).map((c) => (
                        <CommandItem
                          key={c.id}
                          value={c.id}
                          onSelect={() => {
                            setForm((prev) => ({ ...prev, client_id: c.id }));
                            setClientPickerOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-3.5 w-3.5",
                              form.client_id === c.id ? "opacity-100" : "opacity-0",
                            )}
                          />
                          <div className="flex flex-col">
                            <span className="text-sm font-semibold">{getClientPrimary(c)}</span>
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
          </div>

          {/* Título */}
          <div className="space-y-1">
            <Label htmlFor="title" className="text-xs">
              Título do chamado <span className="text-destructive">*</span>
            </Label>
            <TicketTitleCombobox
              id="title"
              required
              compact
              value={form.title}
              onChange={(v) => setForm((f) => ({ ...f, title: v }))}
              placeholder="Selecione ou digite o título…"
            />
          </div>

          {/* Canal | Prioridade */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">
                Canal de entrada <span className="text-destructive">*</span>
              </Label>
              <Select
                value={form.channel}
                onValueChange={(v) => setForm({ ...form, channel: v as TicketChannel })}
              >
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CHANNEL_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">
                Prioridade <span className="text-destructive">*</span>
              </Label>
              <Select
                value={form.priority}
                onValueChange={(v) => setForm({ ...form, priority: v as TicketPriority })}
              >
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRIORITY_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Quem reportou | Categoria */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Quem está com o problema</Label>
              <Select
                value={form.quem_reportou || undefined}
                onValueChange={(v) => setForm({ ...form, quem_reportou: v })}
              >
                <SelectTrigger className="h-9"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {QUEM_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Categoria</Label>
              <Select
                value={form.category || undefined}
                onValueChange={(v) => setForm({ ...form, category: v })}
              >
                <SelectTrigger className="h-9"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {CATEGORY_OPTIONS.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Descrição */}
          <div className="space-y-1">
            <Label htmlFor="descricao_problema" className="text-xs">Descrição do problema</Label>
            <Textarea
              id="descricao_problema"
              value={form.descricao_problema}
              onChange={(e) => setForm({ ...form, descricao_problema: e.target.value })}
              placeholder="Descreva o problema com mais detalhes..."
              rows={3}
              maxLength={2000}
            />
          </div>

          {/* O que estava tentando fazer */}
          <div className="space-y-1">
            <Label htmlFor="acao_tentada" className="text-xs">O que estava tentando fazer</Label>
            <Input
              id="acao_tentada"
              value={form.acao_tentada}
              onChange={(e) => setForm({ ...form, acao_tentada: e.target.value })}
              placeholder="Ex: Registrar ponto, fazer fechamento..."
              className="h-9"
              maxLength={300}
            />
          </div>

          {/* O que já foi tentado */}
          <div className="space-y-1">
            <Label htmlFor="ja_tentou" className="text-xs">O que já foi tentado (opcional)</Label>
            <Textarea
              id="ja_tentou"
              value={form.ja_tentou}
              onChange={(e) => setForm({ ...form, ja_tentou: e.target.value })}
              placeholder="Ex: Limpou cache, testou outro navegador..."
              rows={2}
              maxLength={1000}
            />
          </div>

          <div className="mt-2 flex justify-end gap-2 border-t border-border pt-3 -mx-5 px-5">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={create.isPending || !requiredOk}
              className="bg-gradient-brand text-primary-foreground hover:opacity-90"
            >
              {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Criar Chamado
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
