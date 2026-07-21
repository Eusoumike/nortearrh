import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function onlyDigits(v: string) {
  return (v ?? "").replace(/\D/g, "");
}

function formatCnpj(digits: string) {
  if (digits.length !== 14) return digits;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

async function pdFetch(url: string, init: RequestInit = {}) {
  const resp = await fetch(url, init);
  const text = await resp.text();
  let json: any = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = null; }
  if (!resp.ok || (json && json.success === false)) {
    throw new Error(`Pipedrive [${resp.status}]: ${json?.error || text || "erro desconhecido"}`);
  }
  return json;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const PIPEDRIVE_TOKEN = Deno.env.get("PIPEDRIVE_API_TOKEN");
    const PIPEDRIVE_DOMAIN = Deno.env.get("PIPEDRIVE_DOMAIN") || "api";
    if (!PIPEDRIVE_TOKEN) {
      return new Response(JSON.stringify({ error: "PIPEDRIVE_API_TOKEN não configurado" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const cnpjDigits = onlyDigits(String(body?.cnpj ?? ""));
    if (cnpjDigits.length !== 14) {
      return new Response(JSON.stringify({ error: "CNPJ inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const cnpjFormatted = formatCnpj(cnpjDigits);
    const base = `https://${PIPEDRIVE_DOMAIN}.pipedrive.com/api/v1`;
    const auth = `api_token=${encodeURIComponent(PIPEDRIVE_TOKEN)}`;

    // 1) Descobrir a chave do campo customizado CNPJ
    const fieldsJson = await pdFetch(`${base}/organizationFields?${auth}&limit=500`);
    const cnpjField = (fieldsJson?.data ?? []).find((f: any) => {
      const n = String(f?.name ?? "").toLowerCase().trim();
      return n === "cnpj" || n.includes("cnpj");
    });

    if (!cnpjField) {
      return new Response(JSON.stringify({
        ok: false,
        cnpj_field_missing: true,
        error: "Campo customizado 'CNPJ' não encontrado nas organizações do Pipedrive. Crie um campo do tipo texto chamado 'CNPJ' em Configurações → Campos de dados → Organizações.",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 2) Buscar por termo (aceita tanto dígitos quanto formatado)
    const searchOne = async (term: string) => {
      const url = `${base}/organizations/search?term=${encodeURIComponent(term)}&fields=custom_fields&exact_match=false&limit=10&${auth}`;
      const j = await pdFetch(url);
      return (j?.data?.items ?? []).map((it: any) => it.item);
    };

    const seen = new Set<number>();
    const orgs: any[] = [];
    for (const term of [cnpjDigits, cnpjFormatted]) {
      try {
        const items = await searchOne(term);
        for (const it of items) {
          if (it?.id && !seen.has(it.id)) {
            seen.add(it.id);
            orgs.push(it);
          }
        }
      } catch { /* ignora e tenta próximo termo */ }
    }

    // 3) Confirmar que o CNPJ do campo customizado bate
    let matchedOrg: any = null;
    for (const it of orgs) {
      const detail = await pdFetch(`${base}/organizations/${it.id}?${auth}`).catch(() => null);
      const org = detail?.data;
      if (!org) continue;
      const raw = String(org[cnpjField.key] ?? "").trim();
      if (onlyDigits(raw) === cnpjDigits) {
        matchedOrg = org;
        break;
      }
    }

    if (!matchedOrg) {
      return new Response(JSON.stringify({
        ok: true,
        found: false,
        cnpj_field_key: cnpjField.key,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 4) Buscar deals vinculados
    const dealsJson = await pdFetch(`${base}/organizations/${matchedOrg.id}/deals?status=all_not_deleted&limit=50&${auth}`).catch(() => ({ data: [] }));
    const personsJson = await pdFetch(`${base}/organizations/${matchedOrg.id}/persons?limit=100&${auth}`).catch(() => ({ data: [] }));

    return new Response(JSON.stringify({
      ok: true,
      found: true,
      cnpj_field_key: cnpjField.key,
      organization: {
        id: matchedOrg.id,
        name: matchedOrg.name,
        address: matchedOrg.address,
        owner_name: matchedOrg.owner_id?.name ?? null,
        update_time: matchedOrg.update_time,
      },
      deals: (dealsJson?.data ?? []).map((d: any) => ({
        id: d.id, title: d.title, status: d.status, value: d.value, currency: d.currency,
      })),
      persons: (personsJson?.data ?? []).map((p: any) => ({
        id: p.id, name: p.name,
      })),
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message ?? String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
