// supabase/functions/pipedrive-sync/index.ts
// Importa deals ganhos do Pipedrive para a tabela `clients`,
// fazendo dedup por organização (ou nome de pessoa quando não houver org).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface PipedriveDeal {
  id: number;
  title: string;
  status: string;
  won_time: string | null;
  org_id: { name?: string; value?: number } | null;
  person_id: { name?: string; value?: number; email?: { value: string }[]; phone?: { value: string }[] } | null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const PIPEDRIVE_API_TOKEN = Deno.env.get("PIPEDRIVE_API_TOKEN");
    const PIPEDRIVE_DOMAIN_RAW = Deno.env.get("PIPEDRIVE_DOMAIN"); // ex: nortear (sem .pipedrive.com)
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!PIPEDRIVE_API_TOKEN) {
      return json({ error: "PIPEDRIVE_API_TOKEN não configurado" }, 500);
    }
    if (!PIPEDRIVE_DOMAIN_RAW) {
      return json({ error: "PIPEDRIVE_DOMAIN não configurado (use só o subdomínio, ex: 'nortear')" }, 500);
    }

    // Normaliza: aceita "nortear", "nortear.pipedrive.com" ou "https://nortear.pipedrive.com"
    const PIPEDRIVE_DOMAIN = PIPEDRIVE_DOMAIN_RAW
      .trim()
      .replace(/^https?:\/\//i, "")
      .replace(/\/.*$/, "")
      .replace(/\.pipedrive\.com$/i, "");

    // Validar usuário autenticado pelo Authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Não autenticado" }, 401);

    const supabaseAuth = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await supabaseAuth.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Sessão inválida" }, 401);

    // Cliente com service role para escrita
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // Busca deals ganhos paginando
    const collected: PipedriveDeal[] = [];
    let start = 0;
    const limit = 100;
    let hasMore = true;
    while (hasMore && start < 2000) {
      const url = `https://${PIPEDRIVE_DOMAIN}.pipedrive.com/api/v1/deals?status=won&start=${start}&limit=${limit}&api_token=${PIPEDRIVE_API_TOKEN}`;
      const resp = await fetch(url);
      if (!resp.ok) {
        const txt = await resp.text();
        return json({ error: `Pipedrive API ${resp.status}: ${txt.slice(0, 300)}` }, 502);
      }
      const payload = await resp.json();
      const items: PipedriveDeal[] = payload.data ?? [];
      collected.push(...items);
      hasMore = payload.additional_data?.pagination?.more_items_in_collection === true;
      start += limit;
    }

    // Dedup por chave de organização normalizada (ou nome de pessoa)
    const seen = new Map<string, { name: string; company: string | null; email: string | null; phone: string | null; pipedrive_person_id: string | null }>();
    for (const d of collected) {
      const orgName = d.org_id?.name?.trim() || null;
      const personName = d.person_id?.name?.trim() || null;
      const baseName = orgName || personName;
      if (!baseName) continue;
      const key = baseName.toLowerCase();
      if (seen.has(key)) continue;
      seen.set(key, {
        name: baseName,
        company: orgName,
        email: d.person_id?.email?.[0]?.value ?? null,
        phone: d.person_id?.phone?.[0]?.value ?? null,
        pipedrive_person_id: d.person_id?.value ? String(d.person_id.value) : null,
      });
    }

    // Pega os clientes existentes (1 ida só) e cruza por nome lower
    const { data: existing, error: exErr } = await supabase
      .from("clients")
      .select("id, name");
    if (exErr) return json({ error: exErr.message }, 500);

    const existingKeys = new Set(
      (existing ?? []).map((c) => (c.name ?? "").trim().toLowerCase()),
    );

    const toInsert = [...seen.entries()]
      .filter(([key]) => !existingKeys.has(key))
      .map(([, v]) => ({
        name: v.name,
        company: v.company,
        email: v.email,
        phone: v.phone,
        pipedrive_person_id: v.pipedrive_person_id,
        created_by: userData.user.id,
      }));

    let inserted = 0;
    if (toInsert.length > 0) {
      const { error: insErr, count } = await supabase
        .from("clients")
        .insert(toInsert, { count: "exact" });
      if (insErr) return json({ error: insErr.message }, 500);
      inserted = count ?? toInsert.length;
    }

    return json({
      ok: true,
      pipedrive_deals: collected.length,
      unique_clients: seen.size,
      inserted,
      skipped_existing: seen.size - toInsert.length,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return json({ error: msg }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
