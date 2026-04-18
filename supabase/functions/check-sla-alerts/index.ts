import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Require either a shared cron secret OR a valid authenticated user JWT
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
      if (!error && data?.claims?.sub) {
        authorized = true;
      }
    } catch (_) {
      // fall through to unauthorized
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

    // Find open tickets approaching SLA (>= 80% of window consumed) without an alert yet
    const { data: tickets, error } = await supabase
      .from("tickets")
      .select("id, ticket_number, title, created_at, sla_resolution_deadline, status, sla_alert_sent")
      .in("status", ["novo", "em_atendimento", "aguardando_cliente", "suporte_vera_n1", "abertura_chamado_n2"])
      .eq("sla_alert_sent", false)
      .not("sla_resolution_deadline", "is", null);

    if (error) throw error;

    const now = Date.now();
    const toAlert: string[] = [];

    for (const t of tickets ?? []) {
      const created = new Date(t.created_at).getTime();
      const deadline = new Date(t.sla_resolution_deadline as string).getTime();
      const total = deadline - created;
      if (total <= 0) continue;
      const consumed = now - created;
      const ratio = consumed / total;
      // Alert when 80%+ consumed and not yet overdue (overdue is shown separately)
      if (ratio >= 0.8 && now < deadline) {
        toAlert.push(t.id);
      }
    }

    if (toAlert.length > 0) {
      const { error: updErr } = await supabase
        .from("tickets")
        .update({ sla_alert_sent: true })
        .in("id", toAlert);
      if (updErr) throw updErr;
    }

    return new Response(
      JSON.stringify({ ok: true, alerted: toAlert.length, scanned: tickets?.length ?? 0 }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("check-sla-alerts error", e);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
