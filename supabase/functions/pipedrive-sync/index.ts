// supabase/functions/pipedrive-sync/index.ts
// Importa deals ganhos do Pipedrive para a tabela `clients`,
// fazendo dedup por organização (ou nome de pessoa quando não houver org).
// Também busca CNPJ do campo customizado da organização.
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
  org_name?: string | null;
  person_name?: string | null;
  org_id: { name?: string; value?: number } | null;
  person_id: { name?: string; value?: number; email?: { value: string }[]; phone?: { value: string }[] } | null;
}

interface PipedriveOrgField {
  key: string;
  name: string;
  field_type?: string;
}

function formatCnpj(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = String(raw).replace(/\D/g, "");
  if (digits.length !== 14) return String(raw).trim() || null;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12, 14)}`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const PIPEDRIVE_API_TOKEN = Deno.env.get("PIPEDRIVE_API_TOKEN");
    const PIPEDRIVE_DOMAIN_RAW = Deno.env.get("PIPEDRIVE_DOMAIN");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!PIPEDRIVE_API_TOKEN) {
      return json({ error: "PIPEDRIVE_API_TOKEN não configurado" }, 500);
    }
    if (!PIPEDRIVE_DOMAIN_RAW) {
      return json({ error: "PIPEDRIVE_DOMAIN não configurado (use só o subdomínio, ex: 'nortear')" }, 500);
    }

    const PIPEDRIVE_DOMAIN = PIPEDRIVE_DOMAIN_RAW
      .trim()
      .replace(/^https?:\/\//i, "")
      .replace(/\/.*$/, "")
      .replace(/\.pipedrive\.com$/i, "");

    const baseUrl = `https://${PIPEDRIVE_DOMAIN}.pipedrive.com/api/v1`;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Não autenticado" }, 401);

    const supabaseAuth = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await supabaseAuth.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Sessão inválida" }, 401);

    // Server-side admin enforcement (UI-only gate is not enough)
    const { data: roles } = await supabaseAuth
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id);
    const isAdmin = (roles ?? []).some((r: { role: string }) => r.role === "admin");
    if (!isAdmin) return json({ error: "Apenas administradores podem sincronizar" }, 403);

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // 1) Descobre a key do campo CNPJ (uma vez)
    let cnpjKey: string | null = null;
    try {
      const fieldsResp = await fetch(`${baseUrl}/organizationFields?api_token=${PIPEDRIVE_API_TOKEN}`);
      if (fieldsResp.ok) {
        const fieldsPayload = await fieldsResp.json();
        const fields: PipedriveOrgField[] = fieldsPayload.data ?? [];
        const match = fields.find((f) => f.name?.toLowerCase().includes("cnpj"));
        cnpjKey = match?.key ?? null;
        console.log(`[pipedrive-sync] cnpjKey resolved: ${cnpjKey ?? "(none)"}`);
      } else {
        console.warn(`[pipedrive-sync] organizationFields ${fieldsResp.status}`);
      }
    } catch (e) {
      console.warn("[pipedrive-sync] erro ao buscar organizationFields:", e);
    }

    // 2) Busca deals ganhos paginando
    const collected: PipedriveDeal[] = [];
    let start = 0;
    const limit = 100;
    let hasMore = true;
    while (hasMore && start < 2000) {
      const url = `${baseUrl}/deals?status=won&start=${start}&limit=${limit}&api_token=${PIPEDRIVE_API_TOKEN}`;
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

    // 3) Dedup por chave de organização normalizada (ou nome de pessoa)
    interface ClientRow {
      name: string;
      company: string | null;
      cnpj: string | null;
      email: string | null;
      phone: string | null;
      pipedrive_person_id: string | null;
      orgId: number | null;
    }
    const seen = new Map<string, ClientRow>();
    for (const d of collected) {
      const orgName = (d.org_id?.name || d.org_name || "").trim() || null;
      const personName = (d.person_id?.name || d.person_name || "").trim() || null;
      const dealTitle = d.title?.trim() || null;
      // Razão Social: org_name → person_name → deal.title
      const razaoSocial = orgName || personName || dealTitle;
      const baseName = razaoSocial;
      if (!baseName) continue;
      const key = baseName.toLowerCase();
      if (seen.has(key)) continue;
      seen.set(key, {
        name: baseName,
        company: razaoSocial,
        cnpj: null,
        email: d.person_id?.email?.[0]?.value ?? null,
        phone: d.person_id?.phone?.[0]?.value ?? null,
        pipedrive_person_id: d.person_id?.value ? String(d.person_id.value) : null,
        orgId: d.org_id?.value ?? null,
      });
    }

    // 4) Para cada cliente único com orgId, busca a organização e extrai CNPJ
    //    (cache por orgId para não repetir chamadas)
    const orgCache = new Map<number, Record<string, unknown> | null>();
    for (const row of seen.values()) {
      if (!row.orgId) continue;
      let org = orgCache.get(row.orgId);
      if (org === undefined) {
        try {
          const orgResp = await fetch(`${baseUrl}/organizations/${row.orgId}?api_token=${PIPEDRIVE_API_TOKEN}`);
          if (orgResp.ok) {
            const orgPayload = await orgResp.json();
            org = orgPayload.data ?? null;
          } else {
            org = null;
          }
        } catch {
          org = null;
        }
        orgCache.set(row.orgId, org);
      }
      if (org) {
        // Razão Social vem de org.name (override)
        const orgFullName = typeof org.name === "string" ? org.name.trim() : null;
        if (orgFullName) {
          row.company = orgFullName;
        }
        if (cnpjKey) {
          const rawCnpj = (org as Record<string, unknown>)[cnpjKey];
          row.cnpj = formatCnpj(rawCnpj as string | null | undefined);
        }
      }
    }

    // 5) Pega os clientes existentes e cruza por nome lower
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
        cnpj: v.cnpj,
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
      cnpj_key: cnpjKey,
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
