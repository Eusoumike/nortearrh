import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { X, Loader2 } from "lucide-react";
import { MODULO_AFETADO_OPTIONS, ORIGEM_PROBLEMA_OPTIONS } from "@/lib/constants";
import { toast } from "sonner";

interface Artigo {
  id: string;
  titulo: string;
  problema_relatado: string | null;
  causa_raiz: string | null;
  passos_solucao: string | null;
  modulo_afetado: string | null;
  tema_relacionado: string | null;
  tags: string[] | null;
  publicado: boolean | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  artigo: Artigo | null;
}

export function EditarArtigoAssistDialog({ open, onClose, artigo }: Props) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    titulo: "",
    problema_relatado: "",
    causa_raiz: "",
    passos_solucao: "",
    modulo_afetado: "",
    tags: [] as string[],
  });
  const [tagInput, setTagInput] = useState("");

  useEffect(() => {
    if (!open || !artigo) return;
    setForm({
      titulo: artigo.titulo ?? "",
      problema_relatado: artigo.problema_relatado ?? "",
      causa_raiz: artigo.causa_raiz ?? "",
      passos_solucao: artigo.passos_solucao ?? "",
      modulo_afetado: artigo.modulo_afetado ?? "",
      tags: artigo.tags ?? [],
    });
    setTagInput("");
  }, [open, artigo]);

  const salvar = useMutation({
    mutationFn: async ({ publicar }: { publicar: boolean }) => {
      if (!artigo) throw new Error("Artigo inválido");
      if (!form.titulo.trim()) throw new Error("Título é obrigatório");
      if (publicar && !form.passos_solucao.trim())
        throw new Error("Passos de solução são obrigatórios para publicar");

      const patch = {
        titulo: form.titulo.trim(),
        problema_relatado: form.problema_relatado.trim() || null,
        causa_raiz: form.causa_raiz || null,
        passos_solucao: form.passos_solucao.trim() || null,
        modulo_afetado: form.modulo_afetado || null,
        tags: form.tags.length ? form.tags : null,
        publicado: publicar,
      };
      const { error } = await supabase
        .from("assist_artigos")
        .update(patch as any)
        .eq("id", artigo.id);
      if (error) throw error;
      return publicar;
    },
    onSuccess: (publicado) => {
      qc.invalidateQueries({ queryKey: ["assist-artigos"] });
      toast.success(publicado ? "Artigo publicado." : "Rascunho salvo.");
      onClose();
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao salvar"),
  });

  const addTag = () => {
    const v = tagInput.trim();
    if (!v) return;
    if (!form.tags.includes(v)) setForm((f) => ({ ...f, tags: [...f.tags, v] }));
    setTagInput("");
  };

  const removeTag = (t: string) =>
    setForm((f) => ({ ...f, tags: f.tags.filter((x) => x !== t) }));

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar artigo do Assist</DialogTitle>
          <DialogDescription>
            Ajuste o conteúdo antes de publicar na base de conhecimento.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Título *</Label>
            <Input
              value={form.titulo}
              onChange={(e) => setForm({ ...form, titulo: e.target.value })}
              maxLength={200}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Problema relatado (o que o cliente descreve)</Label>
            <Textarea
              value={form.problema_relatado}
              onChange={(e) => setForm({ ...form, problema_relatado: e.target.value })}
              rows={3}
              maxLength={1000}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Causa raiz</Label>
              <Select
                value={form.causa_raiz || undefined}
                onValueChange={(v) => setForm({ ...form, causa_raiz: v })}
              >
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {ORIGEM_PROBLEMA_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Módulo</Label>
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
          </div>

          <div className="space-y-1.5">
            <Label>Como resolver (passo a passo) *</Label>
            <Textarea
              value={form.passos_solucao}
              onChange={(e) => setForm({ ...form, passos_solucao: e.target.value })}
              rows={8}
              placeholder="1. Acesse o cadastro do colaborador&#10;2. Ajuste o campo X&#10;3. Sincronize..."
              className="font-mono text-sm"
            />
            <p className="text-[11px] text-muted-foreground">
              Formatação de linhas é preservada. Obrigatório para publicar.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>Tags</Label>
            <div className="flex flex-wrap gap-1.5">
              {form.tags.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs"
                >
                  {t}
                  <button
                    type="button"
                    onClick={() => removeTag(t)}
                    className="hover:text-danger"
                    aria-label={`Remover ${t}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); addTag(); }
                }}
                placeholder="Adicione uma tag e Enter"
                className="h-9"
              />
              <Button type="button" variant="outline" size="sm" onClick={addTag}>
                Adicionar
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onClose} disabled={salvar.isPending}>
            Cancelar
          </Button>
          <Button
            variant="outline"
            onClick={() => salvar.mutate({ publicar: false })}
            disabled={salvar.isPending}
          >
            {salvar.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar rascunho
          </Button>
          <Button
            onClick={() => salvar.mutate({ publicar: true })}
            disabled={salvar.isPending}
          >
            {salvar.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Publicar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
