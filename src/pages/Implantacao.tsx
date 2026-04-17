import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { ToneBadge } from "@/components/ui/tone-badge";
import { toast } from "sonner";
import { Plus, Loader2, Calendar, GripVertical, Copy, MessageSquare, Trash2, Pencil, Send } from "lucide-react";
import { formatBrazilDateTime } from "@/lib/formatters";

type Etapa = "novo_cliente" | "kickoff" | "configuracao" | "treinamento" | "go_live" | "finalizado";

const ETAPAS: { key: Etapa; label: string; tone: "muted" | "info" | "warning" | "primary" | "success" | "neutral" }[] = [
  { key: "novo_cliente", label: "Novo cliente", tone: "muted" },
  { key: "kickoff", label: "Kickoff", tone: "info" },
  { key: "configuracao", label: "Configuração", tone: "warning" },
  { key: "treinamento", label: "Treinamento", tone: "primary" },
  { key: "go_live", label: "Go-live", tone: "success" },
  { key: "finalizado", label: "Finalizado", tone: "neutral" },
];

export default function Implantacao() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"kanban" | "mensagens">("kanban");
  const [openNew, setOpenNew] = useState(false);

  return (
    <div className="space-y-4 p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Implantação</h1>
          <p className="text-sm text-muted-foreground">
            Acompanhe os clientes em implantação pelas 6 etapas e envie mensagens prontas via WhatsApp.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {tab === "kanban" && (
            <Button onClick={() => setOpenNew(true)} className="bg-gradient-brand text-primary-foreground hover:opacity-90">
              <Plus className="h-4 w-4" />
              Nova implantação
            </Button>
          )}
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="kanban">Kanban</TabsTrigger>
          <TabsTrigger value="mensagens"><MessageSquare className="mr-1 h-3.5 w-3.5" />Mensagens</TabsTrigger>
        </TabsList>

        <TabsContent value="kanban" className="mt-4">
          <ImplantacaoKanban />
        </TabsContent>
        <TabsContent value="mensagens" className="mt-4">
          <MensagensTemplates />
        </TabsContent>
      </Tabs>

      <NewImplantacaoDialog open={openNew} onOpenChange={setOpenNew} userId={user?.id ?? null} qc={qc} />
    </div>
  );
}

function ImplantacaoKanban() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<any | null>(null);

  const { data: items, isLoading } = useQuery({
    queryKey: ["implantacoes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("implantacoes")
        .select("*, responsavel:profiles!responsavel_id(full_name, avatar_url), client:clients!client_id(phone, email)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const moveEtapa = useMutation({
    mutationFn: async ({ id, etapa }: { id: string; etapa: Etapa }) => {
      const { error } = await supabase.from("implantacoes").update({ etapa }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["implantacoes"] }),
    onError: (e: any) => toast.error(e.message),
  });

  const removeImpl = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("implantacoes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["implantacoes"] });
      toast.success("Implantação removida.");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const grouped = useMemo(() => {
    const map: Record<Etapa, any[]> = {
      novo_cliente: [], kickoff: [], configuracao: [], treinamento: [], go_live: [], finalizado: [],
    };
    (items ?? []).forEach((i: any) => map[i.etapa as Etapa]?.push(i));
    return map;
  }, [items]);

  const handleDrop = (e: React.DragEvent, etapa: Etapa) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain");
    if (id) moveEtapa.mutate({ id, etapa });
  };

  if (isLoading) {
    return <p className="py-12 text-center text-sm text-muted-foreground">Carregando…</p>;
  }

  return (
    <>
      <div className="grid gap-3 lg:grid-cols-6">
        {ETAPAS.map((stage) => (
          <div
            key={stage.key}
            className="flex min-h-[400px] flex-col rounded-lg border border-border bg-surface-muted/30 p-2"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => handleDrop(e, stage.key)}
          >
            <div className="mb-2 flex items-center justify-between px-1">
              <ToneBadge tone={stage.tone} size="sm">{stage.label}</ToneBadge>
              <span className="text-[10px] text-muted-foreground">{grouped[stage.key].length}</span>
            </div>
            <div className="flex flex-1 flex-col gap-2">
              {grouped[stage.key].length === 0 && (
                <p className="px-2 py-4 text-center text-[11px] text-muted-foreground">vazio</p>
              )}
              {grouped[stage.key].map((it: any) => (
                <ImplantacaoCard
                  key={it.id}
                  item={it}
                  onEdit={() => setEditing(it)}
                  onDelete={() => removeImpl.mutate(it.id)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
      <EditImplantacaoDialog item={editing} onClose={() => setEditing(null)} qc={qc} />
    </>
  );
}

function ImplantacaoCard({ item, onEdit, onDelete }: { item: any; onEdit: () => void; onDelete: () => void }) {
  return (
    <div
      draggable
      onDragStart={(e) => e.dataTransfer.setData("text/plain", item.id)}
      onClick={onEdit}
      className="group cursor-grab rounded-md border border-border bg-card p-2.5 shadow-sm transition-shadow hover:shadow-md hover:border-primary/40 active:cursor-grabbing"
    >
      <div className="flex items-start gap-2">
        <GripVertical className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{item.client_name}</p>
          {item.produto && <p className="truncate text-[11px] text-muted-foreground">{item.produto}</p>}
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
            {item.data_go_live && (
              <span className="inline-flex items-center gap-0.5">
                <Calendar className="h-3 w-3" />
                {formatBrazilDateTime(item.data_go_live + "T12:00:00-03:00").split(" ")[0]}
              </span>
            )}
            {item.responsavel?.full_name && (
              <span className="truncate">· {item.responsavel.full_name}</span>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6 text-muted-foreground hover:text-primary"
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
          >
            <Pencil className="h-3 w-3" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6 text-muted-foreground hover:text-destructive"
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function NewImplantacaoDialog({
  open, onOpenChange, userId, qc,
}: { open: boolean; onOpenChange: (v: boolean) => void; userId: string | null; qc: any }) {
  const [form, setForm] = useState({
    client_id: "",
    client_name: "",
    produto: "",
    etapa: "novo_cliente" as Etapa,
    data_inicio: "",
    data_go_live: "",
    observacoes: "",
  });

  const { data: clients } = useQuery({
    queryKey: ["clients-min"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("id, name, company").order("name");
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("Não autenticado");
      const { error } = await supabase.from("implantacoes").insert({
        client_id: form.client_id || null,
        client_name: form.client_name.trim(),
        produto: form.produto || null,
        etapa: form.etapa,
        data_inicio: form.data_inicio || null,
        data_go_live: form.data_go_live || null,
        observacoes: form.observacoes || null,
        created_by: userId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["implantacoes"] });
      toast.success("Implantação criada.");
      onOpenChange(false);
      setForm({ client_id: "", client_name: "", produto: "", etapa: "novo_cliente", data_inicio: "", data_go_live: "", observacoes: "" });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova implantação</DialogTitle>
          <DialogDescription>Comece o acompanhamento de uma nova implantação.</DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); if (!form.client_name.trim()) return toast.error("Informe o cliente."); create.mutate(); }} className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Cliente cadastrado</Label>
            <Select
              value={form.client_id || "none"}
              onValueChange={(v) => {
                const c = clients?.find((c) => c.id === v);
                setForm({ ...form, client_id: v === "none" ? "" : v, client_name: c?.name ?? form.client_name });
              }}
            >
              <SelectTrigger className="h-9"><SelectValue placeholder="Selecione…" /></SelectTrigger>
              <SelectContent className="max-h-[300px]">
                <SelectItem value="none">— Não vincular —</SelectItem>
                {(clients ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name} {c.company && <span className="text-muted-foreground">· {c.company}</span>}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="client_name" className="text-xs">Nome do cliente *</Label>
            <Input
              id="client_name"
              required
              value={form.client_name}
              onChange={(e) => setForm({ ...form, client_name: e.target.value })}
              placeholder="Razão social ou nome fantasia"
              className="h-9"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Produto</Label>
              <Select value={form.produto || "none"} onValueChange={(v) => setForm({ ...form, produto: v === "none" ? "" : v })}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Produto…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  <SelectItem value="VR Benefícios">VR Benefícios</SelectItem>
                  <SelectItem value="RH Digital Pontomais">RH Digital Pontomais</SelectItem>
                  <SelectItem value="VR + Pontomais">VR + Pontomais</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Etapa inicial</Label>
              <Select value={form.etapa} onValueChange={(v) => setForm({ ...form, etapa: v as Etapa })}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ETAPAS.map((e) => <SelectItem key={e.key} value={e.key}>{e.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Início</Label>
              <Input type="date" value={form.data_inicio} onChange={(e) => setForm({ ...form, data_inicio: e.target.value })} className="h-9" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Previsão de go-live</Label>
              <Input type="date" value={form.data_go_live} onChange={(e) => setForm({ ...form, data_go_live: e.target.value })} className="h-9" />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Observações</Label>
            <Textarea rows={3} value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} placeholder="Contexto, particularidades, contatos…" />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={create.isPending} className="bg-gradient-brand text-primary-foreground hover:opacity-90">
              {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Criar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function MensagensTemplates() {
  const [selectedImplId, setSelectedImplId] = useState<string>("none");

  const { data: templates, isLoading } = useQuery({
    queryKey: ["message-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("message_templates")
        .select("*")
        .order("title");
      if (error) throw error;
      return data;
    },
  });

  const { data: implantacoes } = useQuery({
    queryKey: ["implantacoes-min"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("implantacoes")
        .select("id, client_name, produto, data_go_live, client:clients!client_id(phone, name), responsavel:profiles!responsavel_id(full_name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const selected = useMemo(
    () => implantacoes?.find((i: any) => i.id === selectedImplId),
    [implantacoes, selectedImplId],
  );

  const renderBody = (body: string) => {
    if (!selected) return body;
    const data: Record<string, string> = {
      cliente: selected.client_name ?? "",
      produto: selected.produto ?? "",
      responsavel: (selected as any).responsavel?.full_name ?? "",
      data_go_live: selected.data_go_live
        ? formatBrazilDateTime(selected.data_go_live + "T12:00:00-03:00").split(" ")[0]
        : "",
    };
    return body.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => data[k] ?? `{{${k}}}`);
  };

  const phoneDigits = (selected as any)?.client?.phone?.replace(/\D/g, "") ?? "";

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Mensagem copiada.");
  };

  const sendWhats = (text: string) => {
    if (!phoneDigits) {
      toast.error("Implantação selecionada não tem cliente vinculado com telefone.");
      return;
    }
    const number = phoneDigits.startsWith("55") ? phoneDigits : `55${phoneDigits}`;
    window.open(`https://wa.me/${number}?text=${encodeURIComponent(text)}`, "_blank");
  };

  if (isLoading) return <p className="py-12 text-center text-sm text-muted-foreground">Carregando…</p>;

  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-2">
        <Label className="text-xs">Implantação para personalizar mensagens</Label>
        <Select value={selectedImplId} onValueChange={setSelectedImplId}>
          <SelectTrigger className="h-9">
            <SelectValue placeholder="Selecione uma implantação para preencher as variáveis…" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">— Mostrar template bruto —</SelectItem>
            {(implantacoes ?? []).map((i: any) => (
              <SelectItem key={i.id} value={i.id}>
                {i.client_name}{i.produto ? ` · ${i.produto}` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selected && !phoneDigits && (
          <p className="text-[11px] text-warning">
            ⚠ Cliente vinculado não possui telefone — botão WhatsApp ficará desativado.
          </p>
        )}
      </Card>

      <div className="grid gap-3 md:grid-cols-2">
        {(templates ?? []).map((t: any) => {
          const finalBody = renderBody(t.body);
          return (
            <Card key={t.id} className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold">{t.title}</h3>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{t.channel}</p>
                </div>
                <div className="flex gap-1.5">
                  <Button size="sm" variant="outline" onClick={() => copy(finalBody)} className="h-8">
                    <Copy className="h-3.5 w-3.5" />
                    Copiar
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => sendWhats(finalBody)}
                    disabled={!selected || !phoneDigits}
                    className="h-8 bg-success text-success-foreground hover:bg-success/90 disabled:opacity-50"
                  >
                    <Send className="h-3.5 w-3.5" />
                    WhatsApp
                  </Button>
                </div>
              </div>
              <p className="whitespace-pre-wrap rounded-md border border-border bg-surface-muted/40 p-3 text-sm">
                {finalBody}
              </p>
              {t.variables?.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {t.variables.map((v: string) => (
                    <ToneBadge key={v} tone="muted" size="sm">{`{{${v}}}`}</ToneBadge>
                  ))}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function EditImplantacaoDialog({
  item, onClose, qc,
}: { item: any | null; onClose: () => void; qc: any }) {
  const [form, setForm] = useState({
    client_name: "", produto: "", etapa: "novo_cliente" as Etapa,
    data_inicio: "", data_go_live: "", observacoes: "", responsavel_id: "",
  });

  const { data: profiles } = useQuery({
    queryKey: ["profiles-min"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, full_name, email").order("full_name");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!item,
  });

  // Sincroniza form ao abrir
  useMemo(() => {
    if (item) {
      setForm({
        client_name: item.client_name ?? "",
        produto: item.produto ?? "",
        etapa: item.etapa,
        data_inicio: item.data_inicio ?? "",
        data_go_live: item.data_go_live ?? "",
        observacoes: item.observacoes ?? "",
        responsavel_id: item.responsavel_id ?? "",
      });
    }
  }, [item]);

  const update = useMutation({
    mutationFn: async () => {
      if (!item) return;
      const { error } = await supabase.from("implantacoes").update({
        client_name: form.client_name.trim(),
        produto: form.produto || null,
        etapa: form.etapa,
        data_inicio: form.data_inicio || null,
        data_go_live: form.data_go_live || null,
        observacoes: form.observacoes || null,
        responsavel_id: form.responsavel_id || null,
      }).eq("id", item.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["implantacoes"] });
      qc.invalidateQueries({ queryKey: ["implantacoes-min"] });
      toast.success("Implantação atualizada.");
      onClose();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={!!item} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar implantação</DialogTitle>
          <DialogDescription>Atualize os detalhes do acompanhamento.</DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); if (!form.client_name.trim()) return toast.error("Informe o cliente."); update.mutate(); }} className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Cliente *</Label>
            <Input value={form.client_name} onChange={(e) => setForm({ ...form, client_name: e.target.value })} className="h-9" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Produto</Label>
              <Select value={form.produto || "none"} onValueChange={(v) => setForm({ ...form, produto: v === "none" ? "" : v })}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Produto…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  <SelectItem value="VR Benefícios">VR Benefícios</SelectItem>
                  <SelectItem value="RH Digital Pontomais">RH Digital Pontomais</SelectItem>
                  <SelectItem value="VR + Pontomais">VR + Pontomais</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Etapa</Label>
              <Select value={form.etapa} onValueChange={(v) => setForm({ ...form, etapa: v as Etapa })}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ETAPAS.map((e) => <SelectItem key={e.key} value={e.key}>{e.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Responsável</Label>
            <Select value={form.responsavel_id || "none"} onValueChange={(v) => setForm({ ...form, responsavel_id: v === "none" ? "" : v })}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Selecione…" /></SelectTrigger>
              <SelectContent className="max-h-[300px]">
                <SelectItem value="none">— Não atribuído —</SelectItem>
                {(profiles ?? []).map((p: any) => (
                  <SelectItem key={p.id} value={p.id}>{p.full_name ?? p.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Início</Label>
              <Input type="date" value={form.data_inicio} onChange={(e) => setForm({ ...form, data_inicio: e.target.value })} className="h-9" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Go-live</Label>
              <Input type="date" value={form.data_go_live} onChange={(e) => setForm({ ...form, data_go_live: e.target.value })} className="h-9" />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Observações</Label>
            <Textarea rows={4} value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={update.isPending} className="bg-gradient-brand text-primary-foreground hover:opacity-90">
              {update.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
