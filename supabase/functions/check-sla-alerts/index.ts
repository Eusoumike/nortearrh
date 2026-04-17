import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
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
      .in("status", ["aberto", "em_andamento", "aguardando_cliente"])
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
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
