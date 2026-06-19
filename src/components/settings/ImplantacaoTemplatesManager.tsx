import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor,
  useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates,
  verticalListSortingStrategy, useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Plus, Pencil, Trash2, FolderPlus, ListTodo, Loader2, LayoutTemplate, Star, GripVertical, Save } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

type ProdutoTpl = "ambos" | "rh_digital" | "vr_beneficios";
type Template = { id: string; user_id: string; nome: string; descricao: string | null; produto: ProdutoTpl; is_default: boolean };

const PRODUTO_LABEL: Record<ProdutoTpl, string> = {
  ambos: "Ambos",
  rh_digital: "RH Digital",
  vr_beneficios: "VR Benefícios",
};
type TCat = { id: string; template_id: string; nome: string; icone: string | null; cor: string | null; ordem: number };
type TTask = { id: string; template_id: string; categoria_id: string; descricao: string; prazo_dias_offset: number | null; ordem: number };

const db = supabase as any;

export function ImplantacaoTemplatesManager() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [openTpl, setOpenTpl] = useState(false);
  const [editingTpl, setEditingTpl] = useState<Template | null>(null);
  const [removingTpl, setRemovingTpl] = useState<Template | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["impl-templates"],
    queryFn: async () => {
      const { data, error } = await db
        .from("implantacao_templates")
        .select("*")
        .order("nome", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Template[];
    },
  });

  const saveTpl = useMutation({
    mutationFn: async (payload: { id?: string; nome: string; descricao: string; produto: ProdutoTpl; is_default: boolean }) => {
      // se marcar como padrão, desmarcar outros do mesmo produto
      if (payload.is_default) {
        await db.from("implantacao_templates")
          .update({ is_default: false })
          .eq("produto", payload.produto)
          .neq("id", payload.id ?? "00000000-0000-0000-0000-000000000000");
      }
      if (payload.id) {
        const { error } = await db.from("implantacao_templates")
          .update({ nome: payload.nome, descricao: payload.descricao || null, produto: payload.produto, is_default: payload.is_default })
          .eq("id", payload.id);
        if (error) throw error;
      } else {
        const { error } = await db.from("implantacao_templates")
          .insert({ user_id: user!.id, nome: payload.nome, descricao: payload.descricao || null, produto: payload.produto, is_default: payload.is_default });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["impl-templates"] });
      setOpenTpl(false);
      setEditingTpl(null);
      toast.success("Template salvo.");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const removeTpl = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("implantacao_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["impl-templates"] });
      setRemovingTpl(null);
      toast.success("Template removido.");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 gap-3">
        <div>
          <CardTitle className="flex items-center gap-2">
            <LayoutTemplate className="h-5 w-5 text-primary" /> Templates de onboarding
          </CardTitle>
          <CardDescription>
            Modelos reutilizáveis com categorias e tarefas para acelerar novas implantações.
          </CardDescription>
        </div>
        <Button size="sm" onClick={() => { setEditingTpl(null); setOpenTpl(true); }}>
          <Plus className="h-4 w-4" /> Novo template
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="py-6 text-sm text-muted-foreground">Carregando…</div>
        ) : templates.length === 0 ? (
          <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
            Nenhum template ainda. Crie o primeiro para reutilizar checklists.
          </div>
        ) : (
          <Accordion type="single" collapsible value={expanded ?? ""} onValueChange={(v) => setExpanded(v || null)}>
            {templates.map((t) => (
              <AccordionItem key={t.id} value={t.id}>
                <div className="flex items-center gap-2">
                  <AccordionTrigger className="flex-1">
                    <div className="flex flex-col items-start text-left">
                      <span className="flex items-center gap-2 font-medium">
                        {t.nome}
                        {t.is_default && (
                          <Badge variant="secondary" className="gap-1 text-[10px]">
                            <Star className="h-3 w-3 fill-current" /> Padrão
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-[10px]">{PRODUTO_LABEL[t.produto] ?? "Ambos"}</Badge>
                      </span>
                      {t.descricao && <span className="text-xs text-muted-foreground">{t.descricao}</span>}
                    </div>
                  </AccordionTrigger>
                  <Button size="icon" variant="ghost" className="h-8 w-8"
                    onClick={(e) => { e.stopPropagation(); setEditingTpl(t); setOpenTpl(true); }}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive"
                    onClick={(e) => { e.stopPropagation(); setRemovingTpl(t); }}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <AccordionContent>
                  <TemplateBuilder templateId={t.id} />
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </CardContent>

      <TemplateDialog
        open={openTpl}
        onOpenChange={(o) => { setOpenTpl(o); if (!o) setEditingTpl(null); }}
        template={editingTpl}
        onSave={(p) => saveTpl.mutate(p)}
        saving={saveTpl.isPending}
      />

      <AlertDialog open={!!removingTpl} onOpenChange={(o) => !o && setRemovingTpl(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir template?</AlertDialogTitle>
            <AlertDialogDescription>
              "{removingTpl?.nome}" e todas as categorias/tarefas dele serão excluídos.
              Implantações já criadas não são afetadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => removingTpl && removeTpl.mutate(removingTpl.id)}
              className="bg-destructive text-destructive-foreground"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

// ============== template dialog ==============
function TemplateDialog({
  open, onOpenChange, template, onSave, saving,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  template: Template | null;
  onSave: (p: { id?: string; nome: string; descricao: string; produto: ProdutoTpl; is_default: boolean }) => void;
  saving: boolean;
}) {
  const [nome, setNome] = useState("");
  const [desc, setDesc] = useState("");
  const [produto, setProduto] = useState<ProdutoTpl>("ambos");
  const [isDefault, setIsDefault] = useState(false);
  useMemo(() => {
    setNome(template?.nome ?? "");
    setDesc(template?.descricao ?? "");
    setProduto((template?.produto as ProdutoTpl) ?? "ambos");
    setIsDefault(template?.is_default ?? false);
  }, [template, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{template ? "Editar template" : "Novo template"}</DialogTitle>
          <DialogDescription>Defina nome, produto e se é o padrão. Tarefas se adicionam depois.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Nome</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Onboarding RH Padrão" />
          </div>
          <div>
            <Label>Descrição</Label>
            <Textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={2} />
          </div>
          <div>
            <Label>Produto</Label>
            <Select value={produto} onValueChange={(v) => setProduto(v as ProdutoTpl)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ambos">Ambos</SelectItem>
                <SelectItem value="rh_digital">RH Digital</SelectItem>
                <SelectItem value="vr_beneficios">VR Benefícios</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <Label className="text-sm">Template padrão</Label>
              <p className="text-xs text-muted-foreground">Aplicado automaticamente ao iniciar onboardings deste produto.</p>
            </div>
            <Switch checked={isDefault} onCheckedChange={setIsDefault} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => onSave({ id: template?.id, nome: nome.trim(), descricao: desc.trim(), produto, is_default: isDefault })}
            disabled={saving || !nome.trim()}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============== template builder (categorias + tarefas) ==============
function TemplateBuilder({ templateId }: { templateId: string }) {
  const qc = useQueryClient();
  const [openCat, setOpenCat] = useState(false);
  const [editCat, setEditCat] = useState<TCat | null>(null);
  const [openTask, setOpenTask] = useState(false);
  const [editTask, setEditTask] = useState<TTask | null>(null);
  const [newTaskCat, setNewTaskCat] = useState<string | null>(null);

  const { data: cats = [] } = useQuery({
    queryKey: ["impl-tpl-cats", templateId],
    queryFn: async () => {
      const { data, error } = await db.from("implantacao_template_categorias")
        .select("*").eq("template_id", templateId).order("ordem", { ascending: true });
      if (error) throw error;
      return (data ?? []) as TCat[];
    },
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ["impl-tpl-tasks", templateId],
    queryFn: async () => {
      const { data, error } = await db.from("implantacao_template_tarefas")
        .select("*").eq("template_id", templateId).order("ordem", { ascending: true });
      if (error) throw error;
      return (data ?? []) as TTask[];
    },
  });

  const tasksByCat = useMemo(() => {
    const m = new Map<string, TTask[]>();
    tasks.forEach((t) => {
      if (!m.has(t.categoria_id)) m.set(t.categoria_id, []);
      m.get(t.categoria_id)!.push(t);
    });
    return m;
  }, [tasks]);

  const saveCat = useMutation({
    mutationFn: async (p: { id?: string; nome: string; cor: string }) => {
      if (p.id) {
        const { error } = await db.from("implantacao_template_categorias")
          .update({ nome: p.nome, cor: p.cor }).eq("id", p.id);
        if (error) throw error;
      } else {
        const ordem = cats.length;
        const { error } = await db.from("implantacao_template_categorias")
          .insert({ template_id: templateId, nome: p.nome, cor: p.cor, ordem });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["impl-tpl-cats", templateId] });
      setOpenCat(false); setEditCat(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const removeCat = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("implantacao_template_categorias").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["impl-tpl-cats", templateId] });
      qc.invalidateQueries({ queryKey: ["impl-tpl-tasks", templateId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const saveTask = useMutation({
    mutationFn: async (p: { id?: string; categoria_id: string; descricao: string; prazo_dias_offset: number | null }) => {
      if (p.id) {
        const { error } = await db.from("implantacao_template_tarefas")
          .update({ descricao: p.descricao, prazo_dias_offset: p.prazo_dias_offset })
          .eq("id", p.id);
        if (error) throw error;
      } else {
        const ordem = (tasksByCat.get(p.categoria_id)?.length) ?? 0;
        const { error } = await db.from("implantacao_template_tarefas")
          .insert({ template_id: templateId, categoria_id: p.categoria_id, descricao: p.descricao, prazo_dias_offset: p.prazo_dias_offset, ordem });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["impl-tpl-tasks", templateId] });
      setOpenTask(false); setEditTask(null); setNewTaskCat(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const removeTask = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("implantacao_template_tarefas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["impl-tpl-tasks", templateId] }),
    onError: (e: any) => toast.error(e.message),
  });

  // Troca a ordem de duas categorias (ou duas tarefas) usando uma ordem temporária para
  // evitar conflito com unique constraints, caso existam.
  async function swapOrdem(table: string, a: { id: string; ordem: number }, b: { id: string; ordem: number }) {
    const tmp = -1 - Date.now() % 100000;
    const { error: e1 } = await db.from(table).update({ ordem: tmp }).eq("id", a.id);
    if (e1) throw e1;
    const { error: e2 } = await db.from(table).update({ ordem: a.ordem }).eq("id", b.id);
    if (e2) throw e2;
    const { error: e3 } = await db.from(table).update({ ordem: b.ordem }).eq("id", a.id);
    if (e3) throw e3;
  }

  const moveCat = useMutation({
    mutationFn: async ({ cat, dir }: { cat: TCat; dir: "up" | "down" }) => {
      const sorted = [...cats].sort((x, y) => x.ordem - y.ordem);
      const idx = sorted.findIndex((c) => c.id === cat.id);
      const newIdx = dir === "up" ? idx - 1 : idx + 1;
      if (newIdx < 0 || newIdx >= sorted.length) return;
      await swapOrdem("implantacao_template_categorias", cat, sorted[newIdx]);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["impl-tpl-cats", templateId] });
      toast.success("Ordem atualizada");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const moveTask = useMutation({
    mutationFn: async ({ task, dir }: { task: TTask; dir: "up" | "down" }) => {
      const sib = (tasksByCat.get(task.categoria_id) ?? []).slice().sort((a, b) => a.ordem - b.ordem);
      const idx = sib.findIndex((t) => t.id === task.id);
      const newIdx = dir === "up" ? idx - 1 : idx + 1;
      if (newIdx < 0 || newIdx >= sib.length) return;
      await swapOrdem("implantacao_template_tarefas", task, sib[newIdx]);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["impl-tpl-tasks", templateId] });
      toast.success("Ordem atualizada");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-3 pt-2">
      <div className="flex justify-end">
        <Button size="sm" variant="outline" onClick={() => { setEditCat(null); setOpenCat(true); }}>
          <FolderPlus className="h-3.5 w-3.5" /> Categoria
        </Button>
      </div>

      {cats.length === 0 ? (
        <div className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
          Nenhuma categoria. Crie uma para começar a adicionar tarefas.
        </div>
      ) : (
        cats.map((c, ci) => {
          const its = tasksByCat.get(c.id) ?? [];
          const isFirstCat = ci === 0;
          const isLastCat = ci === cats.length - 1;
          return (
            <div key={c.id} className="rounded-md border transition-all duration-200">
              <div className="flex items-center gap-2 p-2 bg-muted/30">
                <div className="flex flex-col">
                  <Button size="icon" variant="ghost" className="h-4 w-5 p-0 text-muted-foreground hover:text-primary disabled:opacity-30 disabled:cursor-not-allowed"
                    disabled={isFirstCat || moveCat.isPending}
                    onClick={() => moveCat.mutate({ cat: c, dir: "up" })}>
                    <ArrowUp className="h-3 w-3" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-4 w-5 p-0 text-muted-foreground hover:text-primary disabled:opacity-30 disabled:cursor-not-allowed"
                    disabled={isLastCat || moveCat.isPending}
                    onClick={() => moveCat.mutate({ cat: c, dir: "down" })}>
                    <ArrowDown className="h-3 w-3" />
                  </Button>
                </div>
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: c.cor ?? "#3B82F6" }}
                />
                <span className="text-sm font-medium">{c.nome}</span>
                <span className="text-xs text-muted-foreground">({its.length})</span>
                <div className="ml-auto flex gap-1">
                  <Button size="sm" variant="ghost" className="h-7 px-2 text-xs"
                    onClick={() => { setEditTask(null); setNewTaskCat(c.id); setOpenTask(true); }}>
                    <Plus className="h-3.5 w-3.5" /> Tarefa
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7"
                    onClick={() => { setEditCat(c); setOpenCat(true); }}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive"
                    onClick={() => removeCat.mutate(c.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <div className="divide-y">
                {its.length === 0 ? (
                  <div className="p-3 text-center text-xs text-muted-foreground">
                    Sem tarefas. <button className="text-primary hover:underline"
                      onClick={() => { setEditTask(null); setNewTaskCat(c.id); setOpenTask(true); }}>+ Adicionar</button>
                  </div>
                ) : its.map((t, ti) => {
                  const isFirstTask = ti === 0;
                  const isLastTask = ti === its.length - 1;
                  return (
                  <div key={t.id} className="flex items-center gap-2 p-2 text-sm transition-all duration-200">
                    <div className="flex flex-col">
                      <Button size="icon" variant="ghost" className="h-4 w-5 p-0 text-muted-foreground hover:text-primary disabled:opacity-30 disabled:cursor-not-allowed"
                        disabled={isFirstTask || moveTask.isPending}
                        onClick={() => moveTask.mutate({ task: t, dir: "up" })}>
                        <ArrowUp className="h-3 w-3" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-4 w-5 p-0 text-muted-foreground hover:text-primary disabled:opacity-30 disabled:cursor-not-allowed"
                        disabled={isLastTask || moveTask.isPending}
                        onClick={() => moveTask.mutate({ task: t, dir: "down" })}>
                        <ArrowDown className="h-3 w-3" />
                      </Button>
                    </div>
                    <ListTodo className="h-4 w-4 text-muted-foreground" />
                    <span className="flex-1 truncate">{t.descricao}</span>
                    {t.prazo_dias_offset != null && (
                      <span className="text-[10px] rounded bg-muted px-1.5 py-0.5 text-muted-foreground">
                        +{t.prazo_dias_offset}d
                      </span>
                    )}
                    <Button size="icon" variant="ghost" className="h-7 w-7"
                      onClick={() => { setEditTask(t); setNewTaskCat(c.id); setOpenTask(true); }}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive"
                      onClick={() => removeTask.mutate(t.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  );
                })}
              </div>
            </div>
          );
        })
      )}

      <CatDialog
        open={openCat}
        onOpenChange={(o) => { setOpenCat(o); if (!o) setEditCat(null); }}
        cat={editCat}
        onSave={(p) => saveCat.mutate(p)}
      />
      <TaskDialog
        open={openTask}
        onOpenChange={(o) => { setOpenTask(o); if (!o) { setEditTask(null); setNewTaskCat(null); } }}
        task={editTask}
        categoriaId={newTaskCat}
        onSave={(p) => saveTask.mutate(p)}
      />
    </div>
  );
}

function CatDialog({ open, onOpenChange, cat, onSave }: {
  open: boolean; onOpenChange: (o: boolean) => void; cat: TCat | null;
  onSave: (p: { id?: string; nome: string; cor: string }) => void;
}) {
  const [nome, setNome] = useState("");
  const [cor, setCor] = useState("#3B82F6");
  useMemo(() => { setNome(cat?.nome ?? ""); setCor(cat?.cor ?? "#3B82F6"); }, [cat, open]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{cat ? "Editar categoria" : "Nova categoria"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Nome</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} /></div>
          <div><Label>Cor</Label><Input type="color" value={cor} onChange={(e) => setCor(e.target.value)} className="h-10 w-20" /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button disabled={!nome.trim()} onClick={() => onSave({ id: cat?.id, nome: nome.trim(), cor })}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TaskDialog({ open, onOpenChange, task, categoriaId, onSave }: {
  open: boolean; onOpenChange: (o: boolean) => void; task: TTask | null; categoriaId: string | null;
  onSave: (p: { id?: string; categoria_id: string; descricao: string; prazo_dias_offset: number | null }) => void;
}) {
  const [desc, setDesc] = useState("");
  const [prazo, setPrazo] = useState<string>("");
  useMemo(() => {
    setDesc(task?.descricao ?? "");
    setPrazo(task?.prazo_dias_offset != null ? String(task.prazo_dias_offset) : "");
  }, [task, open]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{task ? "Editar tarefa" : "Nova tarefa"}</DialogTitle>
          <DialogDescription>
            Prazo é calculado em dias após o início da implantação ao aplicar o template.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div><Label>Descrição</Label><Input value={desc} onChange={(e) => setDesc(e.target.value)} /></div>
          <div>
            <Label>Prazo (dias após início)</Label>
            <Input type="number" min="0" value={prazo} onChange={(e) => setPrazo(e.target.value)} placeholder="opcional" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            disabled={!desc.trim() || (!task && !categoriaId)}
            onClick={() => onSave({
              id: task?.id,
              categoria_id: task?.categoria_id ?? categoriaId!,
              descricao: desc.trim(),
              prazo_dias_offset: prazo === "" ? null : Number(prazo),
            })}
          >Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
