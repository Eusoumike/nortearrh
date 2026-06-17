import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ToneBadge } from "@/components/ui/tone-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";
import {
  ArrowLeft, Plus, Search, CheckCircle2, Circle, Loader2, Ban, MoreVertical,
  Pencil, Trash2, FolderPlus, ListTodo, LayoutTemplate, Save,
} from "lucide-react";
import { formatBrazilDate, initials } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { applyTemplateToImplantacao, saveImplantacaoAsTemplate } from "@/lib/implantacao-templates";
import { useAuth } from "@/hooks/useAuth";

// ---------- types ----------
type Categoria = {
  id: string;
  implantacao_id: string;
  nome: string;
  icone: string | null;
  cor: string | null;
  ordem: number;
};

type Tarefa = {
  id: string;
  categoria_id: string;
  implantacao_id: string;
  titulo: string;
  descricao: string | null;
  status: "pendente" | "em_progresso" | "concluido" | "bloqueado";
  responsavel_email: string | null;
  responsavel_nome: string | null;
  prazo: string | null;
  concluido_em: string | null;
  ordem: number;
};

const STATUS_LABEL: Record<Tarefa["status"], string> = {
  pendente: "Pendente",
  em_progresso: "Em progresso",
  concluido: "Concluído",
  bloqueado: "Bloqueado",
};
const STATUS_TONE: Record<Tarefa["status"], "muted" | "info" | "success" | "danger"> = {
  pendente: "muted",
  em_progresso: "info",
  concluido: "success",
  bloqueado: "danger",
};
const NEXT_STATUS: Record<Tarefa["status"], Tarefa["status"]> = {
  pendente: "em_progresso",
  em_progresso: "concluido",
  concluido: "pendente",
  bloqueado: "pendente",
};

function StatusIcon({ status }: { status: Tarefa["status"] }) {
  if (status === "concluido")
    return <CheckCircle2 className="h-5 w-5 text-success fill-success/20" />;
  if (status === "em_progresso")
    return <Loader2 className="h-5 w-5 text-primary animate-spin" />;
  if (status === "bloqueado")
    return <Ban className="h-5 w-5 text-destructive" />;
  return <Circle className="h-5 w-5 text-muted-foreground/60" />;
}

// ============================================================
export default function ImplantacaoDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();

  const [search, setSearch] = useState("");
  const [activeCat, setActiveCat] = useState<string>("todas");

  const [openCat, setOpenCat] = useState(false);
  const [editingCat, setEditingCat] = useState<Categoria | null>(null);
  const [deletingCat, setDeletingCat] = useState<Categoria | null>(null);

  const [openTask, setOpenTask] = useState(false);
  const [editingTask, setEditingTask] = useState<Tarefa | null>(null);
  const [newTaskCatId, setNewTaskCatId] = useState<string | null>(null);

  const [openApplyTpl, setOpenApplyTpl] = useState(false);
  const [openSaveTpl, setOpenSaveTpl] = useState(false);

  // ---- queries ----
  const { data: impl, isLoading: loadingImpl } = useQuery({
    queryKey: ["implantacao", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("implantacoes")
        .select("*, responsavel:profiles!responsavel_id(full_name, avatar_url)")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: categorias = [], isLoading: loadingCats } = useQuery({
    queryKey: ["impl-categorias", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("implantacao_categorias")
        .select("*")
        .eq("implantacao_id", id!)
        .order("ordem", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Categoria[];
    },
  });

  const { data: tarefas = [] } = useQuery({
    queryKey: ["impl-tarefas", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("implantacao_tarefas")
        .select("*")
        .eq("implantacao_id", id!)
        .order("ordem", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Tarefa[];
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .order("full_name", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  // ---- derived ----
  const tarefasByCat = useMemo(() => {
    const m = new Map<string, Tarefa[]>();
    categorias.forEach((c) => m.set(c.id, []));
    tarefas.forEach((t) => {
      if (!m.has(t.categoria_id)) m.set(t.categoria_id, []);
      m.get(t.categoria_id)!.push(t);
    });
    return m;
  }, [categorias, tarefas]);

  const total = tarefas.length;
  const concluidas = tarefas.filter((t) => t.status === "concluido").length;
  const progresso = total > 0 ? Math.round((concluidas / total) * 100) : 0;

  const visibleCats = useMemo(
    () => (activeCat === "todas" ? categorias : categorias.filter((c) => c.id === activeCat)),
    [categorias, activeCat],
  );

  const matchSearch = (t: Tarefa) =>
    !search.trim() ||
    t.titulo.toLowerCase().includes(search.toLowerCase()) ||
    (t.descricao ?? "").toLowerCase().includes(search.toLowerCase());

  // ---- mutations ----
  const toggleStatus = useMutation({
    mutationFn: async (t: Tarefa) => {
      const next = NEXT_STATUS[t.status];
      const { error } = await (supabase as any)
        .from("implantacao_tarefas")
        .update({
          status: next,
          concluido_em: next === "concluido" ? new Date().toISOString() : null,
        })
        .eq("id", t.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["impl-tarefas", id] }),
    onError: (e: any) => toast.error(e.message),
  });

  const removeCategoria = useMutation({
    mutationFn: async (catId: string) => {
      const { error } = await (supabase as any)
        .from("implantacao_categorias")
        .delete()
        .eq("id", catId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["impl-categorias", id] });
      qc.invalidateQueries({ queryKey: ["impl-tarefas", id] });
      setDeletingCat(null);
      toast.success("Categoria removida.");
    },
    onError: (e: any) => toast.error(e.message),
  });

  // ---- render ----
  if (loadingImpl || loadingCats) {
    return (
      <div className="flex items-center justify-center py-24 text-sm text-muted-foreground">
        Carregando…
      </div>
    );
  }
  if (!impl) {
    return (
      <div className="p-6">
        <Button variant="ghost" onClick={() => navigate("/implantacao")}>
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Button>
        <p className="mt-6 text-sm text-muted-foreground">Implantação não encontrada.</p>
      </div>
    );
  }

  const respUnicos = Array.from(
    new Set(tarefas.map((t) => t.responsavel_nome).filter(Boolean) as string[]),
  );

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <button onClick={() => navigate("/implantacao")} className="hover:text-foreground inline-flex items-center gap-1">
          <ArrowLeft className="h-3.5 w-3.5" /> Onboarding
        </button>
        <span>/</span>
        <span className="text-foreground font-medium truncate">{impl.client_name}</span>
      </div>

      {/* HERO */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-8 rounded-xl border border-border bg-card/60 backdrop-blur p-6 min-h-[180px]">
          <div className="flex items-center gap-2 mb-3">
            <ToneBadge tone="success" size="sm">ATIVO</ToneBadge>
            {impl.data_inicio && (
              <span className="text-xs text-muted-foreground">
                Iniciado em {formatBrazilDate(impl.data_inicio)}
              </span>
            )}
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight uppercase">
            {impl.client_name}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {impl.produto ?? "—"}
            {impl.metodo_registro ? ` · ${impl.metodo_registro}` : ""}
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Button
              size="sm"
              className="bg-gradient-brand text-primary-foreground hover:opacity-90"
              onClick={() => {
                setEditingTask(null);
                setNewTaskCatId(categorias[0]?.id ?? null);
                setOpenTask(true);
              }}
            >
              <Plus className="h-4 w-4" /> Nova tarefa
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setEditingCat(null);
                setOpenCat(true);
              }}
            >
              <FolderPlus className="h-4 w-4" /> Nova categoria
            </Button>
          </div>
        </div>

        <div className="lg:col-span-4 relative overflow-hidden rounded-xl border border-border bg-card/60 backdrop-blur p-6 flex flex-col items-center justify-center min-h-[180px]">
          <ListTodo className="absolute right-4 top-4 h-24 w-24 text-primary opacity-[0.06]" />
          <div className="text-5xl font-bold text-primary tabular-nums">{progresso}%</div>
          <div className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Progresso total
          </div>
          <div className="mt-2 text-xs text-muted-foreground">
            {concluidas} de {total} {total === 1 ? "tarefa" : "tarefas"}
          </div>
          <div className="absolute bottom-0 left-0 h-2 w-full bg-muted">
            <div
              className="h-full bg-gradient-brand transition-all"
              style={{ width: `${progresso}%` }}
            />
          </div>
        </div>
      </div>

      {/* FILTROS + BUSCA */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          <CatChip active={activeCat === "todas"} onClick={() => setActiveCat("todas")}>
            Todas ({tarefas.length})
          </CatChip>
          {categorias.map((c) => {
            const count = tarefasByCat.get(c.id)?.length ?? 0;
            return (
              <CatChip
                key={c.id}
                active={activeCat === c.id}
                onClick={() => setActiveCat(c.id)}
                color={c.cor ?? undefined}
              >
                {c.nome} ({count})
              </CatChip>
            );
          })}
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar tarefas..."
            className="pl-8 h-9 text-sm"
          />
        </div>
      </div>

      {/* CATEGORIAS */}
      {categorias.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
          <FolderPlus className="mx-auto h-10 w-10 opacity-30 mb-3" />
          Nenhuma categoria criada ainda.
          <div className="mt-3">
            <Button size="sm" onClick={() => { setEditingCat(null); setOpenCat(true); }}>
              <Plus className="h-4 w-4" /> Criar primeira categoria
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {visibleCats.map((cat) => {
            const items = (tarefasByCat.get(cat.id) ?? []).filter(matchSearch);
            const total = tarefasByCat.get(cat.id)?.length ?? 0;
            const done = (tarefasByCat.get(cat.id) ?? []).filter((t) => t.status === "concluido").length;
            return (
              <section key={cat.id} className="space-y-2">
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-md"
                    style={{ backgroundColor: `${cat.cor ?? "#0F7173"}1a`, color: cat.cor ?? "#0F7173" }}
                  >
                    <ListTodo className="h-4 w-4" />
                  </div>
                  <h3 className="text-base font-semibold">{cat.nome}</h3>
                  <span className="text-xs text-muted-foreground">({done}/{total} concluído)</span>
                  <div className="ml-auto flex gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs"
                      onClick={() => {
                        setEditingTask(null);
                        setNewTaskCatId(cat.id);
                        setOpenTask(true);
                      }}
                    >
                      <Plus className="h-3.5 w-3.5" /> Tarefa
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => { setEditingCat(cat); setOpenCat(true); }}
                      title="Editar categoria"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive hover:bg-destructive/10"
                      onClick={() => setDeletingCat(cat)}
                      title="Excluir categoria"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-card/60 backdrop-blur divide-y divide-border">
                  {items.length === 0 ? (
                    <div className="p-8 text-center opacity-50 text-sm">
                      <ListTodo className="mx-auto h-8 w-8 opacity-40 mb-2" />
                      Nenhuma tarefa nesta categoria
                      <div className="mt-2">
                        <button
                          onClick={() => {
                            setEditingTask(null);
                            setNewTaskCatId(cat.id);
                            setOpenTask(true);
                          }}
                          className="text-xs text-primary hover:underline"
                        >
                          + Adicionar tarefa
                        </button>
                      </div>
                    </div>
                  ) : (
                    items.map((t) => (
                      <TaskRow
                        key={t.id}
                        task={t}
                        onToggle={() => toggleStatus.mutate(t)}
                        onEdit={() => { setEditingTask(t); setOpenTask(true); }}
                      />
                    ))
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {/* FOOTER */}
      <div className="mt-6 rounded-xl bg-[#1A1A2E] text-white p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex -space-x-2">
            {respUnicos.slice(0, 3).map((n) => (
              <Avatar key={n} className="h-8 w-8 border-2 border-[#1A1A2E]">
                <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                  {initials(n)}
                </AvatarFallback>
              </Avatar>
            ))}
            {respUnicos.length > 3 && (
              <div className="h-8 w-8 rounded-full bg-muted-foreground/30 border-2 border-[#1A1A2E] flex items-center justify-center text-xs">
                +{respUnicos.length - 3}
              </div>
            )}
            {respUnicos.length === 0 && (
              <div className="h-8 w-8 rounded-full bg-muted-foreground/20 border-2 border-[#1A1A2E]" />
            )}
          </div>
          <div>
            <div className="text-sm font-semibold">Equipe alocada</div>
            <div className="text-xs text-white/60">
              {respUnicos.length} {respUnicos.length === 1 ? "responsável" : "responsáveis"} nas tarefas
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm font-semibold">
            Go-Live previsto: {impl.data_go_live ? formatBrazilDate(impl.data_go_live) : "—"}
          </div>
          <div className="text-xs text-white/60">
            Última atualização: {impl.updated_at ? formatBrazilDate(impl.updated_at) : "—"}
          </div>
        </div>
      </div>

      {/* DIALOGS */}
      <CategoriaDialog
        open={openCat}
        onOpenChange={setOpenCat}
        implantacaoId={id!}
        categoria={editingCat}
        nextOrdem={categorias.length}
      />
      <TarefaDialog
        open={openTask}
        onOpenChange={setOpenTask}
        implantacaoId={id!}
        categorias={categorias}
        initialCategoriaId={newTaskCatId}
        tarefa={editingTask}
        profiles={profiles as any[]}
      />
      <AlertDialog open={!!deletingCat} onOpenChange={(v) => !v && setDeletingCat(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir categoria?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso vai excluir “{deletingCat?.nome}” e todas as {tarefasByCat.get(deletingCat?.id ?? "")?.length ?? 0} tarefas dela. Esta ação é permanente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingCat && removeCategoria.mutate(deletingCat.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ============================================================
function CatChip({
  active, onClick, children, color,
}: { active: boolean; onClick: () => void; children: React.ReactNode; color?: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        active
          ? "bg-primary text-primary-foreground border-primary"
          : "border-border text-muted-foreground hover:border-primary hover:text-foreground",
      )}
      style={active && color ? { backgroundColor: color, borderColor: color } : undefined}
    >
      {children}
    </button>
  );
}

function TaskRow({
  task, onToggle, onEdit,
}: { task: Tarefa; onToggle: () => void; onEdit: () => void }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const prazoDate = task.prazo ? new Date(task.prazo + "T12:00:00-03:00") : null;
  const isOverdue = prazoDate && task.status !== "concluido" && prazoDate < today;
  const isToday = prazoDate && prazoDate.toDateString() === today.toDateString();

  return (
    <div
      className="grid grid-cols-12 gap-3 p-3 hover:bg-muted/30 transition-colors cursor-pointer items-center"
      onClick={onEdit}
    >
      <div className="col-span-12 md:col-span-6 flex items-start gap-3">
        <button
          onClick={(e) => { e.stopPropagation(); onToggle(); }}
          className="shrink-0 mt-0.5"
          title="Alterar status"
        >
          <StatusIcon status={task.status} />
        </button>
        <div className="min-w-0 flex-1">
          <p className={cn(
            "text-sm font-medium leading-snug",
            task.status === "concluido" && "line-through text-muted-foreground",
          )}>
            {task.titulo}
          </p>
          {task.descricao && (
            <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{task.descricao}</p>
          )}
        </div>
      </div>
      <div className="col-span-4 md:col-span-2">
        <ToneBadge tone={STATUS_TONE[task.status]} size="sm">
          {STATUS_LABEL[task.status]}
        </ToneBadge>
      </div>
      <div className="col-span-4 md:col-span-2 flex items-center gap-2 min-w-0">
        {task.responsavel_nome ? (
          <>
            <Avatar className="h-6 w-6">
              <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                {initials(task.responsavel_nome)}
              </AvatarFallback>
            </Avatar>
            <span className="text-xs text-muted-foreground truncate">{task.responsavel_nome}</span>
          </>
        ) : (
          <span className="text-xs text-muted-foreground/50">—</span>
        )}
      </div>
      <div className="col-span-4 md:col-span-2 text-right">
        {task.prazo ? (
          <span className={cn(
            "text-xs",
            isOverdue ? "text-destructive font-semibold"
            : isToday ? "text-primary font-semibold"
            : "text-muted-foreground",
          )}>
            {formatBrazilDate(task.prazo)}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground/50">—</span>
        )}
      </div>
    </div>
  );
}

// ============================================================
function CategoriaDialog({
  open, onOpenChange, implantacaoId, categoria, nextOrdem,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  implantacaoId: string;
  categoria: Categoria | null;
  nextOrdem: number;
}) {
  const qc = useQueryClient();
  const [nome, setNome] = useState(categoria?.nome ?? "");
  const [cor, setCor] = useState(categoria?.cor ?? "#0F7173");

  // reset when (re)opens
  useMemo(() => {
    if (open) {
      setNome(categoria?.nome ?? "");
      setCor(categoria?.cor ?? "#0F7173");
    }
  }, [open, categoria]);

  const save = useMutation({
    mutationFn: async () => {
      if (!nome.trim()) throw new Error("Informe o nome");
      if (categoria) {
        const { error } = await (supabase as any)
          .from("implantacao_categorias")
          .update({ nome: nome.trim(), cor })
          .eq("id", categoria.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any)
          .from("implantacao_categorias")
          .insert({
            implantacao_id: implantacaoId,
            nome: nome.trim(),
            cor,
            ordem: nextOrdem,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["impl-categorias", implantacaoId] });
      onOpenChange(false);
      toast.success(categoria ? "Categoria atualizada." : "Categoria criada.");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{categoria ? "Editar categoria" : "Nova categoria"}</DialogTitle>
          <DialogDescription>Organize as tarefas em grupos.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Nome *</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Parametrização" />
          </div>
          <div>
            <Label className="text-xs">Cor</Label>
            <div className="flex items-center gap-2 mt-1">
              <input
                type="color"
                value={cor}
                onChange={(e) => setCor(e.target.value)}
                className="h-9 w-12 rounded cursor-pointer bg-transparent"
              />
              <Input value={cor} onChange={(e) => setCor(e.target.value)} className="h-9 text-xs font-mono" />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || !nome.trim()}>
            {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
function TarefaDialog({
  open, onOpenChange, implantacaoId, categorias, initialCategoriaId, tarefa, profiles,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  implantacaoId: string;
  categorias: Categoria[];
  initialCategoriaId: string | null;
  tarefa: Tarefa | null;
  profiles: { id: string; full_name: string | null; email: string | null }[];
}) {
  const qc = useQueryClient();
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [catId, setCatId] = useState<string>("");
  const [status, setStatus] = useState<Tarefa["status"]>("pendente");
  const [respMode, setRespMode] = useState<"profile" | "manual" | "none">("none");
  const [respProfileId, setRespProfileId] = useState<string>("");
  const [respManual, setRespManual] = useState("");
  const [prazo, setPrazo] = useState("");

  useMemo(() => {
    if (!open) return;
    if (tarefa) {
      setTitulo(tarefa.titulo);
      setDescricao(tarefa.descricao ?? "");
      setCatId(tarefa.categoria_id);
      setStatus(tarefa.status);
      setPrazo(tarefa.prazo ?? "");
      const match = profiles.find((p) => p.email === tarefa.responsavel_email);
      if (match) {
        setRespMode("profile");
        setRespProfileId(match.id);
      } else if (tarefa.responsavel_nome) {
        setRespMode("manual");
        setRespManual(tarefa.responsavel_nome);
      } else {
        setRespMode("none");
      }
    } else {
      setTitulo("");
      setDescricao("");
      setCatId(initialCategoriaId ?? categorias[0]?.id ?? "");
      setStatus("pendente");
      setPrazo("");
      setRespMode("none");
      setRespProfileId("");
      setRespManual("");
    }
  }, [open, tarefa, initialCategoriaId]);

  const save = useMutation({
    mutationFn: async () => {
      if (!titulo.trim()) throw new Error("Informe o título");
      if (!catId) throw new Error("Selecione uma categoria");

      let resp_email: string | null = null;
      let resp_nome: string | null = null;
      if (respMode === "profile" && respProfileId) {
        const p = profiles.find((x) => x.id === respProfileId);
        resp_email = p?.email ?? null;
        resp_nome = p?.full_name ?? p?.email ?? null;
      } else if (respMode === "manual" && respManual.trim()) {
        resp_nome = respManual.trim();
      }

      const payload: any = {
        implantacao_id: implantacaoId,
        categoria_id: catId,
        titulo: titulo.trim(),
        descricao: descricao.trim() || null,
        status,
        prazo: prazo || null,
        responsavel_email: resp_email,
        responsavel_nome: resp_nome,
        concluido_em: status === "concluido" ? new Date().toISOString() : null,
      };

      if (tarefa) {
        const { error } = await (supabase as any)
          .from("implantacao_tarefas")
          .update(payload)
          .eq("id", tarefa.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any)
          .from("implantacao_tarefas")
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["impl-tarefas", implantacaoId] });
      onOpenChange(false);
      toast.success(tarefa ? "Tarefa atualizada." : "Tarefa criada.");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async () => {
      if (!tarefa) return;
      const { error } = await (supabase as any)
        .from("implantacao_tarefas").delete().eq("id", tarefa.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["impl-tarefas", implantacaoId] });
      onOpenChange(false);
      toast.success("Tarefa excluída.");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{tarefa ? "Editar tarefa" : "Nova tarefa"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Categoria *</Label>
            <Select value={catId} onValueChange={setCatId}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {categorias.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Título *</Label>
            <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Descrição</Label>
            <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as Tarefa["status"])}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="em_progresso">Em progresso</SelectItem>
                  <SelectItem value="concluido">Concluído</SelectItem>
                  <SelectItem value="bloqueado">Bloqueado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Prazo</Label>
              <Input type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} className="h-9 text-sm" />
            </div>
          </div>
          <div>
            <Label className="text-xs">Responsável</Label>
            <div className="flex gap-1 mb-1">
              {(["none", "profile", "manual"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setRespMode(m)}
                  className={cn(
                    "text-[11px] px-2 py-1 rounded-md border",
                    respMode === m ? "bg-primary text-primary-foreground border-primary" : "border-border",
                  )}
                >
                  {m === "none" ? "Nenhum" : m === "profile" ? "Usuário" : "Externo"}
                </button>
              ))}
            </div>
            {respMode === "profile" && (
              <Select value={respProfileId} onValueChange={setRespProfileId}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Escolha um usuário" /></SelectTrigger>
                <SelectContent>
                  {profiles.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.full_name ?? p.email ?? "—"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {respMode === "manual" && (
              <Input
                value={respManual}
                onChange={(e) => setRespManual(e.target.value)}
                placeholder="Nome do responsável externo"
                className="h-9 text-sm"
              />
            )}
          </div>
        </div>
        <DialogFooter className="flex-col-reverse sm:flex-row sm:justify-between gap-2">
          {tarefa ? (
            <Button
              variant="ghost"
              className="text-destructive hover:bg-destructive/10"
              onClick={() => remove.mutate()}
              disabled={remove.isPending}
            >
              <Trash2 className="h-4 w-4" /> Excluir
            </Button>
          ) : <span />}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
