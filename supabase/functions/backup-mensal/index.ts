// Edge Function: gera backup completo, sobe para o Storage,
// cria link assinado (30 dias) e registra em backup_logs.
// NÃO envia e-mail — admin confere o histórico em Configurações.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const TABLES = [
  "clients","tickets","ticket_interactions","ticket_status_history","ticket_stage_times",
  "ticket_etapas","ticket_etapa_historico","ticket_categories","ticket_titles",
  "ticket_temas_frequentes","ticket_emails_n2","custom_ticket_stages",
  "implantacoes","implantacao_categorias","implantacao_tarefas","implantacao_pendencias",
  "implantacao_eventos","implantacao_stage_configs","implantacao_templates",
  "implantacao_template_categorias","implantacao_template_tarefas",
  "tasks","checklist_items",
  "contratos_rh_digital","parcelas_rh_digital","parcelas_rh_digital_historico",
  "lancamentos_vr","lancamentos_ponto","documentos_financeiros",
  "parceiros","configuracoes_parceiro","repasses_parceiro",
  "config_comissoes","historico_comissoes","sales_metas",
  "assist_artigos","assist_solutions","assist_conversations","message_templates",
  "consultas","system_settings","profiles","user_roles",
];

const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 dias

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey);

  const body = await req.json().catch(() => ({}));
  const origem = body?.origem ?? "automatico";
  const startedAt = new Date();

  const data: Record<string, unknown[]> = {};
  const counts: Record<string, number> = {};
  const errors: Record<string, string> = {};

  try {
    for (const table of TABLES) {
      const PAGE = 1000;
      let from = 0;
      const all: unknown[] = [];
      while (true) {
        const { data: rows, error } = await admin.from(table).select("*").range(from, from + PAGE - 1);
        if (error) { errors[table] = error.message; break; }
        const batch = rows ?? [];
        all.push(...batch);
        if (batch.length < PAGE) break;
        from += PAGE;
      }
      data[table] = all;
      counts[table] = all.length;
    }

    const totalLinhas = Object.values(counts).reduce((a, b) => a + b, 0);
    const backup = {
      meta: {
        app: "Nortear Connect",
        exported_at: startedAt.toISOString(),
        exported_at_local: startedAt.toLocaleString("pt-BR"),
        origem,
        total_tabelas: TABLES.length,
        row_counts: counts,
        errors: Object.keys(errors).length ? errors : undefined,
      },
      tables: data,
    };

    const yyyy = startedAt.getFullYear();
    const mm = String(startedAt.getMonth() + 1).padStart(2, "0");
    const dd = String(startedAt.getDate()).padStart(2, "0");
    const hh = String(startedAt.getHours()).padStart(2, "0");
    const mi = String(startedAt.getMinutes()).padStart(2, "0");
    const filename = `nortear-connect-backup-${yyyy}-${mm}-${dd}-${hh}${mi}.json`;
    const storagePath = `${yyyy}/${mm}/${filename}`;

    const json = JSON.stringify(backup, null, 2);
    const bytes = new TextEncoder().encode(json);

    const { error: upErr } = await admin.storage.from("backups").upload(storagePath, bytes, {
      contentType: "application/json",
      upsert: true,
    });
    if (upErr) throw new Error(`Upload falhou: ${upErr.message}`);

    const { data: signed, error: signErr } = await admin.storage
      .from("backups")
      .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);
    if (signErr) throw new Error(`Signed URL falhou: ${signErr.message}`);

    const signedUrl = signed?.signedUrl ?? null;
    const expiraEm = new Date(Date.now() + SIGNED_URL_TTL_SECONDS * 1000).toISOString();
    const status = Object.keys(errors).length ? "parcial" : "sucesso";

    await admin.from("backup_logs").insert({
      executado_em: startedAt.toISOString(),
      origem,
      status,
      total_tabelas: TABLES.length,
      total_linhas: totalLinhas,
      tamanho_bytes: bytes.byteLength,
      storage_path: storagePath,
      signed_url: signedUrl,
      signed_url_expira_em: expiraEm,
      detalhes: { row_counts: counts, tabelas_com_erro: errors },
    });

    return new Response(
      JSON.stringify({ ok: true, status, totalLinhas, storagePath, signedUrl }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const msg = (e as Error)?.message ?? "Erro inesperado";
    await admin.from("backup_logs").insert({
      executado_em: startedAt.toISOString(),
      origem,
      status: "erro",
      total_tabelas: TABLES.length,
      total_linhas: Object.values(counts).reduce((a, b) => a + b, 0),
      erro: msg,
      detalhes: { row_counts: counts, tabelas_com_erro: errors },
    });
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
