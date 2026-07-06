import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Search, Pencil, Send, Trash2, MoreHorizontal, ThumbsUp,
  ThumbsDown, Eye, FileText, CheckCircle2,
} from "lucide-react";
import { ModuloBadge } from "@/components/tickets/ModuloBadge";
import { EditarArtigoAssistDialog } from "@/components/assist/EditarArtigoAssistDialog";
import { MODULO_AFETADO_OPTIONS } from "@/lib/constants";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type StatusFilter = "todos" | "rascunho" | "publicado";

export default function Assist() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("todos");
  const [moduloFilter, setModuloFilter] = useState<string>("all");
  const [editing, setEditing] = useState<any | null>(null);
  const [deleting, setDeleting] = useState<any | null>(null);

  const { data: artigos = [], isLoading } = useQuery({
    queryKey: ["assist-artigos", statusFilter, moduloFilter],
    queryFn: async () => {
      let query = supabase
        .from("assist_artigos")
        .select("*")
        .order("updated_at", { ascending: false });
      if (statusFilter === "rascunho") query = query.eq("publicado", false);
      else if (statusFilter === "publicado") query = query.eq("publicado", true);
      if (moduloFilter !== "all") query = query.eq("modulo_afetado", moduloFilter);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return artigos;
    const q = search.trim().toLowerCase();
    return artigos.filter((a: any) =>
      (a.titulo ?? "").toLowerCase().includes(q) ||
      (a.tema_relacionado ?? "").toLowerCase().includes(q) ||
      (a.tags ?? []).some((t: string) => t.toLowerCase().includes(q))
    );
  }, [artigos, search]);

  const rascunhos = artigos.filter((a: any) => !a.publicado).length;
  const publicados = artigos.filter((a: any) => a.publicado).length;

  const togglePublicar = useMutation({
    mutationFn: async (a: any) => {
      const { error } = await supabase
        .from("assist_artigos")
        .update({ publicado: !a.publicado } as any)
        .eq("id", a.id);
      if (error) throw error;
      return !a.publicado;
    },
    onSuccess: (nowPublished) => {
      qc.invalidateQueries({ queryKey: ["assist-artigos"] });
      toast.success(nowPublished ? "Artigo publicado." : "Artigo despublicado.");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const excluir = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("assist_artigos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["assist-artigos"] });
      toast.success("Artigo excluído.");
      setDeleting(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 p-4 md:p-6">
      {/* Header */}
      <div className="flex shrink-0 flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <nav className="mb-1 text-[11px] text-muted-foreground">
            <span className="font-medium text-foreground/80">Base de conhecimento</span>
          </nav>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-[28px]">
            Nortear Assist
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {publicados} publicado{publicados === 1 ? "" : "s"} · {rascunhos} rascunho{rascunhos === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {rascunhos > 0 && (
            <Button
              variant="outline" size="sm"
              onClick={() => setStatusFilter("rascunho")}
              className="h-9 gap-1.5 rounded-xl text-xs"
            >
              <FileText className="h-3.5 w-3.5" />
              Revisar rascunhos ({rascunhos})
            </Button>
          )}
        </div>
      </div>

      {/* Filtros */}
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar título, tema, tag..."
            className="h-9 w-[240px] rounded-xl pl-8 text-xs"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
          <SelectTrigger className="h-9 w-[140px] rounded-xl text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="rascunho">Só rascunhos</SelectItem>
            <SelectItem value="publicado">Só publicados</SelectItem>
          </SelectContent>
        </Select>
        <Select value={moduloFilter} onValueChange={setModuloFilter}>
          <SelectTrigger className="h-9 w-[160px] rounded-xl text-xs">
            <SelectValue placeholder="Módulo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos módulos</SelectItem>
            {MODULO_AFETADO_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Lista */}
      <div className="min-h-0 flex-1">
        {isLoading ? (
          <Skeleton className="h-64 w-full rounded-xl" />
        ) : filtered.length === 0 ? (
          <Card className="flex h-full items-center justify-center border-dashed">
            <div className="p-8 text-center">
              <FileText className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Nenhum artigo encontrado.
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Marque "Este chamado vira artigo do Assist" ao encerrar um chamado para criar um rascunho.
              </p>
            </div>
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <div className="grid grid-cols-[minmax(240px,2fr)_130px_140px_130px_100px_60px] gap-3 border-b border-border bg-muted/40 px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <span>Título</span>
              <span>Módulo</span>
              <span>Tema</span>
              <span>Status</span>
              <span>Métricas</span>
              <span></span>
            </div>
            <div className="divide-y divide-border/60">
              {filtered.map((a: any) => (
                <div
                  key={a.id}
                  className="grid grid-cols-[minmax(240px,2fr)_130px_140px_130px_100px_60px] items-center gap-3 px-5 py-3 text-sm hover:bg-muted/40"
                >
                  <button
                    type="button"
                    onClick={() => setEditing(a)}
                    className="min-w-0 text-left"
                  >
                    <p className="truncate font-medium text-foreground">{a.titulo}</p>
                    {a.tags?.length ? (
                      <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
                        {a.tags.join(" · ")}
                      </p>
                    ) : null}
                  </button>
                  <div><ModuloBadge modulo={a.modulo_afetado} size="sm" /></div>
                  <span className="truncate text-xs text-muted-foreground">
                    {a.tema_relacionado ?? "—"}
                  </span>
                  <div>
                    <span className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                      a.publicado
                        ? "bg-success/10 text-success"
                        : "bg-muted text-muted-foreground",
                    )}>
                      {a.publicado ? <CheckCircle2 className="h-3 w-3" /> : <FileText className="h-3 w-3" />}
                      {a.publicado ? "Publicado" : "Rascunho"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <span className="inline-flex items-center gap-0.5" title="Visualizações">
                      <Eye className="h-3 w-3" /> {a.visualizacoes ?? 0}
                    </span>
                    <span className="inline-flex items-center gap-0.5 text-success" title="Útil">
                      <ThumbsUp className="h-3 w-3" /> {a.util_positivo ?? 0}
                    </span>
                    <span className="inline-flex items-center gap-0.5 text-danger" title="Não útil">
                      <ThumbsDown className="h-3 w-3" /> {a.util_negativo ?? 0}
                    </span>
                  </div>
                  <div className="flex justify-end">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                          aria-label="Ações"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setEditing(a)}>
                          <Pencil className="mr-2 h-3.5 w-3.5" /> Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => togglePublicar.mutate(a)}>
                          <Send className="mr-2 h-3.5 w-3.5" />
                          {a.publicado ? "Despublicar" : "Publicar"}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setDeleting(a)}
                          className="text-danger focus:text-danger"
                        >
                          <Trash2 className="mr-2 h-3.5 w-3.5" /> Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>

      <EditarArtigoAssistDialog
        open={!!editing}
        onClose={() => setEditing(null)}
        artigo={editing}
      />

      <AlertDialog open={!!deleting} onOpenChange={(v) => !v && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir artigo?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é permanente. O artigo "{deleting?.titulo}" será removido da base.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleting && excluir.mutate(deleting.id)}
              className="bg-danger text-danger-foreground hover:bg-danger/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
