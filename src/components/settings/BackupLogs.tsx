import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Play, Loader2, ExternalLink, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface BackupLog {
  id: string;
  executado_em: string;
  origem: string;
  status: string;
  total_tabelas: number | null;
  total_linhas: number | null;
  tamanho_bytes: number | null;
  storage_path: string | null;
  signed_url: string | null;
  signed_url_expira_em: string | null;
  erro: string | null;
}

function formatBytes(bytes: number | null) {
  if (!bytes) return "—";
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(2)} MB`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function statusBadge(status: string) {
  if (status === "sucesso") return <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">Sucesso</Badge>;
  if (status === "parcial") return <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30">Parcial</Badge>;
  return <Badge variant="destructive">Erro</Badge>;
}

export function BackupLogs() {
  const qc = useQueryClient();
  const [running, setRunning] = useState(false);

  const { data: logs, isLoading, refetch } = useQuery({
    queryKey: ["backup_logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("backup_logs" as any)
        .select("*")
        .order("executado_em", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as unknown as BackupLog[];
    },
  });

  const gerarLink = useMutation({
    mutationFn: async (path: string) => {
      const { data, error } = await supabase.storage
        .from("backups")
        .createSignedUrl(path, 60 * 60 * 24 * 7);
      if (error) throw error;
      return data.signedUrl;
    },
    onSuccess: (url) => {
      window.open(url, "_blank");
    },
    onError: (e: any) => {
      toast({ title: "Não foi possível gerar o link", description: e?.message, variant: "destructive" });
    },
  });

  async function executarAgora() {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("backup-mensal", {
        body: { origem: "manual" },
      });
      if (error) throw error;
      if ((data as any)?.ok === false) throw new Error((data as any).error);
      toast({
        title: "Backup gerado",
        description: `${(data as any)?.totalLinhas?.toLocaleString("pt-BR") ?? "?"} linhas salvas no Storage.`,
      });
      qc.invalidateQueries({ queryKey: ["backup_logs"] });
    } catch (e: any) {
      toast({ title: "Falha no backup", description: e?.message, variant: "destructive" });
    } finally {
      setRunning(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle>Histórico de backups</CardTitle>
          <CardDescription>
            Backup automático mensal (dia 1º, 00h Brasília). Arquivos ficam no Storage privado e o link
            assinado é válido por 30 dias. Você pode disparar um backup manual a qualquer momento.
          </CardDescription>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className={`mr-1.5 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
          <Button size="sm" onClick={executarAgora} disabled={running}>
            {running ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Play className="mr-1.5 h-4 w-4" />}
            Executar backup agora
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando…
          </div>
        ) : !logs?.length ? (
          <p className="text-sm text-muted-foreground py-4">Nenhum backup registrado ainda.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Linhas</TableHead>
                <TableHead className="text-right">Tamanho</TableHead>
                <TableHead>Arquivo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => {
                const expirou = log.signed_url_expira_em
                  ? new Date(log.signed_url_expira_em).getTime() < Date.now()
                  : true;
                return (
                  <TableRow key={log.id}>
                    <TableCell className="whitespace-nowrap text-sm">
                      {new Date(log.executado_em).toLocaleString("pt-BR")}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">{log.origem}</Badge>
                    </TableCell>
                    <TableCell>
                      {statusBadge(log.status)}
                      {log.erro && (
                        <p className="text-xs text-destructive mt-1 max-w-xs truncate" title={log.erro}>
                          {log.erro}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums">
                      {log.total_linhas?.toLocaleString("pt-BR") ?? "—"}
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums">
                      {formatBytes(log.tamanho_bytes)}
                    </TableCell>
                    <TableCell>
                      {log.storage_path ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => gerarLink.mutate(log.storage_path!)}
                          disabled={gerarLink.isPending}
                        >
                          <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                          {expirou ? "Gerar novo link" : "Baixar"}
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
