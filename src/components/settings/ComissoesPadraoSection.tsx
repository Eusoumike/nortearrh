import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export function ComissoesPadraoSection() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [primeira, setPrimeira] = useState("17.5");
  const [recorrencia, setRecorrencia] = useState("17.5");
  const [ponto, setPonto] = useState("40");

  const { data, isLoading } = useQuery({
    queryKey: ["system-settings-comissoes"],
    queryFn: async () => {
      const { data } = await supabase
        .from("system_settings")
        .select("id, percentual_vr_primeira_carga, percentual_vr_recorrencia, percentual_ponto")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    if (data) {
      setPrimeira(String(data.percentual_vr_primeira_carga ?? 17.5));
      setRecorrencia(String(data.percentual_vr_recorrencia ?? 17.5));
      setPonto(String(data.percentual_ponto ?? 40));
    }
  }, [data]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        ...(data?.id ? { id: data.id } : {}),
        percentual_vr_primeira_carga: Number(primeira),
        percentual_vr_recorrencia: Number(recorrencia),
        percentual_ponto: Number(ponto),
        updated_by: user?.id,
      };
      const { error } = await supabase.from("system_settings").upsert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Comissões padrão salvas!");
      qc.invalidateQueries({ queryKey: ["system-settings-comissoes"] });
      qc.invalidateQueries({ queryKey: ["system-settings"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao salvar"),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Comissões padrão</CardTitle>
        <CardDescription>
          Percentuais aplicados por padrão a novos lançamentos. Pode ser sobrescrito por cliente.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            <div className="grid gap-1.5">
              <Label htmlFor="pct-vr-primeira">% VR Primeira Carga</Label>
              <Input
                id="pct-vr-primeira"
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={primeira}
                onChange={(e) => setPrimeira(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="pct-vr-rec">% VR Recorrência</Label>
              <Input
                id="pct-vr-rec"
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={recorrencia}
                onChange={(e) => setRecorrencia(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="pct-ponto">% RH Digital</Label>
              <Input
                id="pct-ponto"
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={ponto}
                onChange={(e) => setPonto(e.target.value)}
              />
            </div>
            <div className="md:col-span-3">
              <Button onClick={() => save.mutate()} disabled={save.isPending}>
                {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar comissões
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
