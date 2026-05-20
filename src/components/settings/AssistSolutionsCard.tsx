import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export function AssistSolutionsCard() {
  const qc = useQueryClient();
  const { role } = useAuth();
  const isAdmin = role === "admin";

  const { data: solutions, isLoading } = useQuery({
    queryKey: ["assist-solutions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assist_solutions" as any)
        .select("id, categoria, problema, solucao, confirmado_em, created_at")
        .not("confirmado_em", "is", null)
        .order("confirmado_em", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as any[];
    },
  });

  const deleteOne = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("assist_solutions" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["assist-solutions"] });
      toast.success("Solução removida");
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao remover"),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-accent" /> Nortear Assist — soluções confirmadas
        </CardTitle>
        <CardDescription>
          Base de conhecimento alimentada pelos atendentes a cada solução confirmada como funcional.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
          </div>
        ) : !solutions || solutions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma solução confirmada ainda. Use o botão "Essa solução funcionou" em um chamado para começar.
          </p>
        ) : (
          <ul className="space-y-3">
            {solutions.map((s) => (
              <li key={s.id} className="rounded-lg border border-border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center gap-2">
                      {s.categoria && <Badge variant="secondary" className="text-[10px]">{s.categoria}</Badge>}
                      <span className="text-[10px] text-muted-foreground">
                        {s.confirmado_em && format(new Date(s.confirmado_em), "dd MMM yyyy", { locale: ptBR })}
                      </span>
                    </div>
                    <p className="text-sm font-medium">{s.problema}</p>
                    <p className="mt-1 text-xs text-muted-foreground line-clamp-3 whitespace-pre-wrap">{s.solucao}</p>
                  </div>
                  {isAdmin && (
                    <Button
                      size="icon" variant="ghost"
                      className="h-7 w-7 text-destructive hover:bg-destructive/10"
                      onClick={() => deleteOne.mutate(s.id)}
                      title="Excluir"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
