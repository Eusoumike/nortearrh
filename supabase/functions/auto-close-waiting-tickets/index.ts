// Auto-fecha tickets em "aguardando_cliente" há mais de 24h sem nenhuma
// interação posterior à entrada nesse estágio.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const AUTO_CLOSE_AFTER_MS = 24 * 60 * 60 * 1000;
const AUTO_CLOSE_NOTE =
  "Chamado encerrado automaticamente — sem retorno do cliente em 24 horas.";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Aceita cron secret OU JWT autenticado (mesmo padrão de check-sla-alerts)
  const cronSecret = Deno.env.get("SLA_CRON_SECRET");
  const providedSecret = req.headers.get("x-cron-secret");
  const authHeader = req.headers.get("Authorization");

  let authorized = false;
  if (cronSecret && providedSecret && providedSecret === cronSecret) {
    authorized = true;
  } else if (authHeader?.startsWith("Bearer ")) {
    try {
      const userClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } },
      );
      const token = authHeader.replace("Bearer ", "");
      const { data, error } = await userClient.auth.getClaims(token);
      if (!error && data?.claims?.sub) authorized = true;
    } catch (_) {
      // unauthorized
    }
  }

  if (!authorized) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const nowMs = Date.now();
    const cutoffIso = new Date(nowMs - AUTO_CLOSE_AFTER_MS).toISOString();

    // Candidatos: aguardando_cliente, entrou no estágio antes do cutoff
    const { data: candidates, error: listErr } = await supabase
      .from("tickets")
      .select("id, ticket_number, entered_aguardando_cliente_at")
      .eq("status", "aguardando_cliente")
      .not("entered_aguardando_cliente_at", "is", null)
      .lt("entered_aguardando_cliente_at", cutoffIso);

    if (listErr) throw listErr;

    const closed: string[] = [];
    const skipped: string[] = [];

    for (const t of candidates ?? []) {
      const enteredAt = t.entered_aguardando_cliente_at as string;

      // Verifica se houve qualquer interação após a entrada no estágio
      const { count, error: intErr } = await supabase
        .from("ticket_interactions")
        .select("id", { count: "exact", head: true })
        .eq("ticket_id", t.id)
        .gt("interaction_at", enteredAt);

      if (intErr) {
        console.error("interactions check failed", t.id, intErr);
        continue;
      }

      if ((count ?? 0) > 0) {
        skipped.push(t.id);
        continue;
      }

      // Cria nota interna de auditoria (autor null = sistema)
      const { error: noteErr } = await supabase
        .from("ticket_interactions")
        .insert({
          ticket_id: t.id,
          type: "nota",
          is_internal: true,
          summary: AUTO_CLOSE_NOTE,
          content: AUTO_CLOSE_NOTE,
          metadata: {
            auto_closed: true,
            reason: "sem_retorno_cliente_24h",
            action: "Fechamento automático",
            closed_at: new Date(nowMs).toISOString(),
          },
        });

      if (noteErr) {
        console.error("note insert failed", t.id, noteErr);
        continue;
      }

      // Atualiza status -> resolvido (trigger handle_ticket_status_change cuida
      // de status_changed_at, totals e resolved_at)
      const { error: updErr } = await supabase
        .from("tickets")
        .update({ status: "resolvido" })
        .eq("id", t.id);

      if (updErr) {
        console.error("ticket update failed", t.id, updErr);
        continue;
      }

      closed.push(t.id);
    }

    return new Response(
      JSON.stringify({
        ok: true,
        scanned: candidates?.length ?? 0,
        closed: closed.length,
        skipped: skipped.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("auto-close-waiting-tickets error", e);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
