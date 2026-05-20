import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

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

    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // Tickets aguardando cliente há mais de 24h sem nova interação
    const { data: candidates, error: fetchErr } = await supabase
      .from("tickets")
      .select("id, ticket_number, updated_at")
      .eq("status", "aguardando_cliente")
      .lt("updated_at", cutoff);

    if (fetchErr) throw fetchErr;

    const results: Array<{ id: string; ok: boolean; error?: string }> = [];

    for (const t of candidates ?? []) {
      // Confirma que não houve interação nas últimas 24h
      const { data: lastInter } = await supabase
        .from("ticket_interactions")
        .select("interaction_at")
        .eq("ticket_id", t.id)
        .gte("interaction_at", cutoff)
        .limit(1);

      if (lastInter && lastInter.length > 0) {
        results.push({ id: t.id, ok: false, error: "interaction_recent" });
        continue;
      }

      const { error: updErr } = await supabase
        .from("tickets")
        .update({ status: "resolvido", resolved_at: new Date().toISOString() })
        .eq("id", t.id);

      if (updErr) {
        results.push({ id: t.id, ok: false, error: updErr.message });
        continue;
      }

      const { error: intErr } = await supabase
        .from("ticket_interactions")
        .insert({
          ticket_id: t.id,
          type: "anotacao",
          summary:
            "Chamado encerrado automaticamente — sem retorno do cliente em 24 horas.",
          is_internal: true,
          author_id: null,
        });

      results.push({
        id: t.id,
        ok: !intErr,
        error: intErr?.message,
      });
    }

    return new Response(
      JSON.stringify({
        checked: candidates?.length ?? 0,
        closed: results.filter((r) => r.ok).length,
        results,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      },
    );
  }
});
