import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function onlyDigits(v: string) { return (v ?? "").replace(/\D/g, ""); }
function formatCnpj(d: string) {
  return d.length === 14
    ? `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`
    : d;
}

async function pdFetch(url: string, init: RequestInit = {}) {
  const resp = await fetch(url, init);
  const text = await resp.text();
  let json: any = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* noop */ }
  if (!resp.ok || (json && json.success === false)) {
    throw new Error(`Pipedrive [${resp.status}]: ${json?.error || text || "erro"}`);
  }
  return json;
}

function buildEnderecoStr(r: any) {
  return [r.logradouro, r.numero, r.complemento, r.bairro, r.municipio, r.uf, r.cep]
    .filter(Boolean).join(", ");
}

function buildNota(receita: any, cnpjDigits: string) {
  const linhas = [
    `<b>Dados da Receita Federal — ${formatCnpj(cnpjDigits)}</b>`,
    receita.razao_social && `Razão social: ${receita.razao_social}`,
    receita.nome_fantasia && `Nome fantasia: ${receita.nome_fantasia}`,
    receita.descricao_situacao_cadastral && `Situação: ${receita.descricao_situacao_cadastral}`,
    receita.data_inicio_atividade && `Abertura: ${receita.data_inicio_atividade}`,
    receita.natureza_juridica && `Natureza jurídica: ${receita.natureza_juridica}`,
    receita.porte && `Porte: ${receita.porte}`,
    (receita.capital_social ?? receita.capital_social === 0) && `Capital social: R$ ${Number(receita.capital_social).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
    receita.cnae_fiscal && `CNAE principal: ${receita.cnae_fiscal} — ${receita.cnae_fiscal_descricao ?? ""}`,
    receita.ddd_telefone_1 && `Telefone: ${receita.ddd_telefone_1}`,
    receita.email && `E-mail: ${receita.email}`,
  ].filter(Boolean);
  return linhas.join("<br>");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
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
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;

    const PIPEDRIVE_TOKEN = Deno.env.get("PIPEDRIVE_API_TOKEN");
    const PIPEDRIVE_DOMAIN = Deno.env.get("PIPEDRIVE_DOMAIN") || "api";
    if (!PIPEDRIVE_TOKEN) {
      return new Response(JSON.stringify({ error: "PIPEDRIVE_API_TOKEN não configurado" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const {
      mode,                 // 'create' | 'update' | 'skip'
      cnpj,
      receita,
      cnpj_field_key,
      organization_id,      // obrigatório em update
      criar_deal_inicial,   // bool, apenas em create
      consulta_id,          // id do registro na tabela consultas p/ atualizar
    } = body ?? {};

    const cnpjDigits = onlyDigits(String(cnpj ?? ""));
    if (cnpjDigits.length !== 14) {
      return new Response(JSON.stringify({ error: "CNPJ inválido" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Modo "skip" → apenas registra como lead em potencial
    if (mode === "skip") {
      if (consulta_id) {
        await supabase.from("consultas")
          .update({ acao: "somente_consulta", encontrado_no_pipedrive: false })
          .eq("id", consulta_id);
      }
      return new Response(JSON.stringify({ ok: true, acao: "somente_consulta" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!receita || typeof receita !== "object") {
      return new Response(JSON.stringify({ error: "Dados da Receita ausentes" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!cnpj_field_key) {
      return new Response(JSON.stringify({ error: "cnpj_field_key ausente" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const base = `https://${PIPEDRIVE_DOMAIN}.pipedrive.com/api/v1`;
    const auth = `api_token=${encodeURIComponent(PIPEDRIVE_TOKEN)}`;

    const orgPayload: Record<string, any> = {
      name: receita.razao_social || receita.nome_fantasia || `CNPJ ${formatCnpj(cnpjDigits)}`,
      address: buildEnderecoStr(receita),
      [cnpj_field_key]: cnpjDigits,
    };

    const resumo: {
      acao: string;
      org_id: number;
      org_criada: boolean;
      pessoas_criadas: number;
      pessoas_atualizadas: number;
      deals_atualizados: number;
      deal_criado?: number | null;
      nota_id?: number | null;
    } = {
      acao: "",
      org_id: 0,
      org_criada: false,
      pessoas_criadas: 0,
      pessoas_atualizadas: 0,
      deals_atualizados: 0,
      deal_criado: null,
      nota_id: null,
    };

    // ----------- ORGANIZAÇÃO -----------
    let orgId: number;
    if (mode === "update") {
      if (!organization_id) {
        return new Response(JSON.stringify({ error: "organization_id obrigatório em update" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const upd = await pdFetch(`${base}/organizations/${organization_id}?${auth}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orgPayload),
      });
      orgId = upd?.data?.id ?? organization_id;
      resumo.acao = "atualizado";
    } else if (mode === "create") {
      const created = await pdFetch(`${base}/organizations?${auth}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orgPayload),
      });
      orgId = created?.data?.id;
      resumo.org_criada = true;
      resumo.acao = "criado";
    } else {
      return new Response(JSON.stringify({ error: "mode inválido" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    resumo.org_id = orgId;

    // ----------- NOTA COM DADOS DA RECEITA -----------
    try {
      const notaResp = await pdFetch(`${base}/notes?${auth}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: buildNota(receita, cnpjDigits), org_id: orgId }),
      });
      resumo.nota_id = notaResp?.data?.id ?? null;
    } catch { /* não fatal */ }

    // ----------- SÓCIOS (persons) -----------
    const qsa: any[] = Array.isArray(receita.qsa) ? receita.qsa : [];
    if (qsa.length > 0) {
      // Pessoas existentes na org, para casar por nome
      const existingResp = await pdFetch(`${base}/organizations/${orgId}/persons?limit=200&${auth}`).catch(() => ({ data: [] }));
      const existentes: any[] = existingResp?.data ?? [];
      const norm = (s: string) => (s ?? "").toString().trim().toLowerCase();

      for (const socio of qsa) {
        const nome = socio.nome_socio;
        if (!nome) continue;
        const qual = socio.qualificacao_socio || "Sócio";
        const match = existentes.find((p) => norm(p.name) === norm(nome));

        try {
          if (match?.id) {
            await pdFetch(`${base}/persons/${match.id}?${auth}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ name: nome, org_id: orgId }),
            });
            await pdFetch(`${base}/notes?${auth}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ content: `Qualificação (QSA): ${qual}`, person_id: match.id }),
            }).catch(() => null);
            resumo.pessoas_atualizadas++;
          } else {
            const criado = await pdFetch(`${base}/persons?${auth}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ name: nome, org_id: orgId }),
            });
            const pid = criado?.data?.id;
            if (pid) {
              await pdFetch(`${base}/notes?${auth}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ content: `Qualificação (QSA): ${qual}`, person_id: pid }),
              }).catch(() => null);
            }
            resumo.pessoas_criadas++;
          }
        } catch { /* segue */ }
      }
    }

    // ----------- DEALS VINCULADOS -----------
    if (mode === "update") {
      const dealsResp = await pdFetch(`${base}/organizations/${orgId}/deals?status=all_not_deleted&limit=100&${auth}`).catch(() => ({ data: [] }));
      const deals: any[] = dealsResp?.data ?? [];
      for (const d of deals) {
        try {
          // "toque" no deal (PUT sem alterar valores) para registrar sincronização
          await pdFetch(`${base}/deals/${d.id}?${auth}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ org_id: orgId }),
          });
          await pdFetch(`${base}/notes?${auth}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              content: `Dados cadastrais sincronizados da Receita em ${new Date().toLocaleString("pt-BR")}.`,
              deal_id: d.id,
            }),
          }).catch(() => null);
          resumo.deals_atualizados++;
        } catch { /* segue */ }
      }
    } else if (mode === "create" && criar_deal_inicial) {
      try {
        const dealCriado = await pdFetch(`${base}/deals?${auth}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: `${orgPayload.name} — Novo lead`,
            org_id: orgId,
          }),
        });
        resumo.deal_criado = dealCriado?.data?.id ?? null;
      } catch { /* não fatal */ }
    }

    // ----------- ATUALIZA REGISTRO NA TABELA consultas -----------
    if (consulta_id) {
      await supabase.from("consultas")
        .update({
          acao: mode === "create" ? "criado_no_pipedrive" : "atualizado_no_pipedrive",
          encontrado_no_pipedrive: mode === "update",
          pipedrive_org_id: orgId,
        })
        .eq("id", consulta_id);
    }

    return new Response(JSON.stringify({ ok: true, resumo }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message ?? String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
