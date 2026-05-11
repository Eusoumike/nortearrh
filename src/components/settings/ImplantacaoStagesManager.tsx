import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ArrowDown, ArrowUp, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

const DEFAULT_STAGES: { key: string; label: string }[] = [
  { key: "novo_cliente",  label: "Novo Cliente" },
  { key: "boas_vindas",   label: "E-mail de Boas-vindas" },
  { key: "treinamento_1", label: "Treinamento 1 — Parametrização" },
  { key: "treinamento_2", label: "Treinamento 2 — Menus" },
  { key: "treinamento_3", label: "Treinamento 3 — Fechamento" },
  { key: "finalizado",    label: "Finalizado" },
];
const DEFAULT_KEYS = new Set(DEFAULT_STAGES.map((s) => s.key));

type Draft = {
  key: string;
  label: string;
  hidden: boolean;
  isCustom: boolean;
  ordem: number;
};

export function ImplantacaoStagesManager() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const userId = user?.id ?? null;
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [newLabel, setNewLabel] = useState("");
  const [dirty, setDirty] = useState(false);

  const { data: configs, isLoading } = useQuery({
    queryKey: ["impl-stage-configs", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("implantacao_stage_configs")
        .select("stage_key, label, hidden, is_custom, ordem")
        .eq("user_id", userId!)
        .order("ordem", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const merged = useMemo<Draft[]>(() => {
    const cfgByKey = new Map<string, any>();
    (configs ?? []).forEach((c: any) => cfgByKey.set(c.stage_key, c));
    const list: Draft[] = [];
    DEFAULT_STAGES.forEach((s, idx) => {
      const c = cfgByKey.get(s.key);
      list.push({
        key: s.key,
        label: c?.label ?? s.label,
        hidden: c?.hidden ?? false,
        isCustom: false,
        ordem: c?.ordem ?? idx,
      });
    });
    (configs ?? [])
      .filter((c: any) => c.is_custom)
      .forEach((c: any) =>
        list.push({
          key: c.stage_key,
          label: c.label,
          hidden: c.hidden,
          isCustom: true,
          ordem: c.ordem ?? 999,
        }),
      );
    list.sort((a, b) => a.ordem - b.ordem);
    return list;
  }, [configs]);

  useEffect(() => {
    setDrafts(merged);
    setDirty(false);
  }, [merged]);

  const update = (idx: number, patch: Partial<Draft>) => {
    setDrafts((d) => d.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
    setDirty(true);
  };

  const move = (idx: number, dir: -1 | 1) => {
    const next = [...drafts];
    const swap = idx + dir;
    if (swap < 0 || swap >= next.length) return;
    [next[idx], next[swap]] = [next[swap], next[idx]];
    next.forEach((s, i) => (s.ordem = i));
    setDrafts(next);
    setDirty(true);
  };

  const addCustom = () => {
    const label = newLabel.trim();
    if (!label) return;
    setDrafts((d) => [
      ...d,
      {
        key: `custom_${Date.now()}`,
        label,
        hidden: false,
        isCustom: true,
        ordem: d.length,
      },
    ]);
    setNewLabel("");
    setDirty(true);
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("Não autenticado");
      const rows = drafts.map((d, i) => ({
        user_id: userId,
        stage_key: d.key,
        label: d.label,
        hidden: d.hidden,
        is_custom: d.isCustom,
        ordem: i,
      }));
      const { error } = await supabase
        .from("implantacao_stage_configs")
        .upsert(rows, { onConflict: "user_id,stage_key" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["impl-stage-configs", userId] });
      toast.success("Etapas atualizadas.");
      setDirty(false);
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao salvar."),
  });

  const removeCustom = useMutation({
    mutationFn: async (stageKey: string) => {
      if (!userId) throw new Error("Não autenticado");
      const { error } = await supabase
        .from("implantacao_stage_configs")
        .delete()
        .eq("user_id", userId)
        .eq("stage_key", stageKey);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["impl-stage-configs", userId] });
      toast.success("Etapa removida.");
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao remover."),
  });

  const handleRemoveCustom = (key: string) => {
    setDrafts((d) => d.filter((s) => s.key !== key));
    if (configs?.some((c: any) => c.stage_key === key)) {
      removeCustom.mutate(key);
    }
  };

  const visiveis = drafts.filter((s) => !s.hidden).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Etapas da Implantação</CardTitle>
        <CardDescription>
          Personalize, oculte, renomeie e reordene as etapas do seu kanban de implantação.
          As preferências são salvas por usuário.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Accordion type="single" collapsible>
          <AccordionItem value="stages" className="border-none">
            <AccordionTrigger className="rounded-md border px-3 py-2 hover:no-underline">
              <span className="flex items-center gap-2 text-sm">
                Gerenciar etapas
                <Badge variant="secondary" className="font-normal">
                  {visiveis} visíveis · {drafts.length} no total
                </Badge>
              </span>
            </AccordionTrigger>
            <AccordionContent className="pt-4">
              {isLoading ? (
                <div className="flex h-24 items-center justify-center">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="space-y-2">
                  {drafts.map((s, idx) => (
                    <div
                      key={s.key}
                      className="flex flex-wrap items-center gap-2 rounded-md border p-2"
                    >
                      <div className="flex flex-col gap-0.5">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6"
                          onClick={() => move(idx, -1)}
                          disabled={idx === 0}
                          title="Mover para cima"
                        >
                          <ArrowUp className="h-3 w-3" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6"
                          onClick={() => move(idx, 1)}
                          disabled={idx === drafts.length - 1}
                          title="Mover para baixo"
                        >
                          <ArrowDown className="h-3 w-3" />
                        </Button>
                      </div>

                      <Input
                        value={s.label}
                        onChange={(e) => update(idx, { label: e.target.value })}
                        className="h-9 flex-1 min-w-[180px]"
                        maxLength={120}
                      />

                      {s.isCustom ? (
                        <Badge className="border-transparent bg-purple-500/15 text-purple-600">
                          Personalizada
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Padrão</Badge>
                      )}

                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>Visível</span>
                        <Switch
                          checked={!s.hidden}
                          onCheckedChange={(v) => update(idx, { hidden: !v })}
                        />
                      </div>

                      {s.isCustom && (
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleRemoveCustom(s.key)}
                          title="Excluir etapa"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  ))}

                  <div className="mt-3 flex items-center gap-2 rounded-md border border-dashed p-2">
                    <Input
                      value={newLabel}
                      onChange={(e) => setNewLabel(e.target.value)}
                      placeholder="Nome de uma nova etapa personalizada"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addCustom();
                        }
                      }}
                      maxLength={120}
                    />
                    <Button
                      type="button"
                      onClick={addCustom}
                      disabled={!newLabel.trim()}
                      size="sm"
                    >
                      <Plus className="mr-1 h-4 w-4" />
                      Adicionar
                    </Button>
                  </div>

                  <div className="flex justify-end gap-2 pt-3">
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setDrafts(merged);
                        setDirty(false);
                      }}
                      disabled={!dirty || save.isPending}
                    >
                      Descartar
                    </Button>
                    <Button
                      onClick={() => save.mutate()}
                      disabled={!dirty || save.isPending}
                    >
                      {save.isPending && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      Salvar alterações
                    </Button>
                  </div>
                </div>
              )}
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  );
}
