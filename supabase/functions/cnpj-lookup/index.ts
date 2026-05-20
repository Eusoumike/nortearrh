import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { cnpj } = await req.json();
    const clean = String(cnpj || "").replace(/\D/g, "");
    if (clean.length !== 14) {
      return new Response(JSON.stringify({ error: "CNPJ inválido. Informe os 14 dígitos." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1) BrasilAPI (sem rate limit agressivo)
    try {
      const r = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${clean}`);
      if (r.ok) {
        const data = await r.json();
        return new Response(JSON.stringify({ source: "brasilapi", data: normalizeBrasilApi(data) }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (r.status === 404) {
        return new Response(JSON.stringify({ error: "CNPJ não encontrado na Receita Federal." }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } catch (_) { /* tenta fallback */ }

    // 2) Fallback ReceitaWS
    try {
      const r2 = await fetch(`https://receitaws.com.br/v1/cnpj/${clean}`, {
        headers: { Accept: "application/json" },
      });
      if (r2.ok) {
        const data = await r2.json();
        if (data.status === "ERROR") {
          return new Response(JSON.stringify({ error: data.message || "CNPJ não encontrado." }), {
            status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ source: "receitaws", data: normalizeReceitaWs(data) }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } catch (_) {}

    return new Response(JSON.stringify({ error: "Serviço da Receita Federal indisponível no momento." }), {
      status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message || "Erro interno" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function normalizeBrasilApi(d: any) {
  return {
    cnpj: d.cnpj,
    razao_social: d.razao_social,
    nome_fantasia: d.nome_fantasia,
    situacao: d.descricao_situacao_cadastral,
    data_abertura: d.data_inicio_atividade,
    porte: d.porte,
    atividade_principal: d.cnae_fiscal_descricao,
    cnae_codigo: d.cnae_fiscal,
    capital_social: d.capital_social,
    email: d.email,
    telefone: d.ddd_telefone_1,
    logradouro: d.logradouro,
    numero: d.numero,
    bairro: d.bairro,
    municipio: d.municipio,
    uf: d.uf,
    cep: d.cep,
    qsa: (d.qsa || []).map((s: any) => ({
      nome: s.nome_socio, qualificacao: s.qualificacao_socio,
    })),
  };
}

function normalizeReceitaWs(d: any) {
  return {
    cnpj: d.cnpj,
    razao_social: d.nome,
    nome_fantasia: d.fantasia,
    situacao: d.situacao,
    data_abertura: d.abertura,
    porte: d.porte,
    atividade_principal: d.atividade_principal?.[0]?.text,
    cnae_codigo: d.atividade_principal?.[0]?.code,
    capital_social: d.capital_social,
    email: d.email,
    telefone: d.telefone,
    logradouro: d.logradouro,
    numero: d.numero,
    bairro: d.bairro,
    municipio: d.municipio,
    uf: d.uf,
    cep: d.cep,
    qsa: (d.qsa || []).map((s: any) => ({
      nome: s.nome, qualificacao: s.qual,
    })),
  };
}
