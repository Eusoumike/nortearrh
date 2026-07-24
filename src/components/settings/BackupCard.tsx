import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const TABLES = [
  "clients",
  "tickets",
  "ticket_interactions",
  "ticket_status_history",
  "ticket_stage_times",
  "ticket_etapas",
  "ticket_etapa_historico",
  "ticket_categories",
  "ticket_titles",
  "ticket_temas_frequentes",
  "ticket_emails_n2",
  "custom_ticket_stages",
  "implantacoes",
  "implantacao_categorias",
  "implantacao_tarefas",
  "implantacao_pendencias",
  "implantacao_eventos",
  "implantacao_stage_configs",
  "implantacao_templates",
  "implantacao_template_categorias",
  "implantacao_template_tarefas",
  "tasks",
  "checklist_items",
  "contratos_rh_digital",
  "parcelas_rh_digital",
  "parcelas_rh_digital_historico",
  "lancamentos_vr",
  "lancamentos_ponto",
  "documentos_financeiros",
  "parceiros",
  "configuracoes_parceiro",
  "repasses_parceiro",
  "config_comissoes",
  "historico_comissoes",
  "sales_metas",
  "assist_artigos",
  "assist_solutions",
  "assist_conversations",
  "message_templates",
  "consultas",
  "system_settings",
  "profiles",
  "user_roles",
] as const;

export function BackupCard() {
  const [loading, setLoading] = useState(false);

  async function handleExport() {
    setLoading(true);
    try {
      const data: Record<string, unknown[]> = {};
      const counts: Record<string, number> = {};
      const errors: Record<string, string> = {};

      for (const table of TABLES) {
        const PAGE = 1000;
        let from = 0;
        const all: unknown[] = [];
        let tableError: string | null = null;
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { data: rows, error } = await supabase
            .from(table as any)
            .select("*")
            .range(from, from + PAGE - 1);
          if (error) {
            tableError = error.message;
            break;
          }
          const batch = rows ?? [];
          all.push(...batch);
          if (batch.length < PAGE) break;
          from += PAGE;
        }
        if (tableError) {
          errors[table] = tableError;
          data[table] = [];
          counts[table] = 0;
        } else {
          data[table] = all;
          counts[table] = all.length;
        }
      }

      const now = new Date();
      const backup = {
        meta: {
          app: "Nortear Connect",
          exported_at: now.toISOString(),
          exported_at_local: now.toLocaleString("pt-BR"),
          total_tables: TABLES.length,
          row_counts: counts,
          errors: Object.keys(errors).length ? errors : undefined,
        },
        tables: data,
      };

      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, "0");
      const dd = String(now.getDate()).padStart(2, "0");
      const filename = `nortear-connect-backup-${yyyy}-${mm}-${dd}.json`;

      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);

      const totalRows = Object.values(counts).reduce((a, b) => a + b, 0);
      toast({
        title: "Backup exportado",
        description: `${totalRows.toLocaleString("pt-BR")} linhas em ${TABLES.length} tabelas${
          Object.keys(errors).length ? ` (${Object.keys(errors).length} com erro)` : ""
        }.`,
      });
    } catch (e: any) {
      toast({ title: "Erro ao exportar", description: e?.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Backup completo</CardTitle>
        <CardDescription>
          Exporta todos os dados do sistema em um único arquivo JSON, com cabeçalho contendo data,
          hora e contagem de linhas por tabela. A exportação respeita as regras de acesso do banco.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button onClick={handleExport} disabled={loading}>
          {loading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Download className="mr-2 h-4 w-4" />
          )}
          Exportar backup completo
        </Button>
      </CardContent>
    </Card>
  );
}
