import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SYSTEM_PROMPT = `Você é especialista em redigir e-mails técnicos da Nortear (canal oficial VR Benefícios e RH Digital) para o time N2 do fornecedor.

REGRAS DE TOM:
- Técnico, direto, objetivo. Linguagem de profissional para profissional.
- PROIBIDO corporativês: "venho por meio deste", "tratativa", "alinhamento", "prezados", "cordialmente extenso".
- Refira-se ao produto SEMPRE como "RH Digital" ou "o sistema". NUNCA cite o nome do fabricante.
- Sem floreios. Sem repetições. Frases curtas.

ESTRUTURA OBRIGATÓRIA DO CORPO (use ═══ como separador entre blocos):

1. IDENTIFICAÇÃO — cliente, CNPJ, módulo afetado, contato (nome, cargo, telefone se houver).
2. DESCRIÇÃO DO PROBLEMA — o que está acontecendo, desde quando, impacto operacional.
3. PASSOS PARA REPRODUZIR — passo a passo numerado, claro e replicável.
4. TENTATIVAS DO N1 — o que já foi tentado e o resultado.
5. EVIDÊNCIAS — print, log, IDs, horário do erro (mencione anexar se aplicável).
6. URGÊNCIA — prioridade e por quê (quantos usuários impactados, processo bloqueado, etc.).
7. FECHAMENTO — pedido de retorno objetivo e identificação do operador Nortear.

VARIANTES (você decide com base nos dados):
- "critica": prioridade urgente/alta + impacto bloqueante. Assunto começa com [URGENTE]. URGÊNCIA sobe pro topo (logo após IDENTIFICAÇÃO).
- "duvida_tecnica": tipo dúvida ou descrição sem erro reportado. REMOVA os blocos PASSOS PARA REPRODUZIR e TENTATIVAS DO N1.
- "padrao": demais casos. Use a estrutura completa.

SAÍDA: responda EXCLUSIVAMENTE com JSON puro (sem markdown, sem cercas \`\`\`), no formato:
{ "assunto": "...", "corpo": "...", "variante": "padrao" | "critica" | "duvida_tecnica" }`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    if (!ANTHROPIC_API_KEY) {
      return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY ausente" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    if (!userData?.user) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { ticket_id } = await req.json();
    if (!ticket_id) {
      return new Response(JSON.stringify({ error: "ticket_id obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { data: ticket, error: tErr } = await admin
      .from("tickets")
      .select("*")
      .eq("id", ticket_id)
      .maybeSingle();
    if (tErr || !ticket) {
      return new Response(JSON.stringify({ error: "Chamado não encontrado" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let cliente: any = null;
    if (ticket.client_id) {
      const { data } = await admin.from("clients").select("*").eq("id", ticket.client_id).maybeSingle();
      cliente = data;
    }

    const { data: interacoes } = await admin
      .from("ticket_interactions")
      .select("type, summary, content, result, channel, interaction_at, created_at")
      .eq("ticket_id", ticket_id)
      .order("created_at", { ascending: false })
      .limit(5);

    const ctx = {
      chamado: {
        numero: ticket.ticket_number,
        titulo: ticket.title,
        descricao: ticket.description,
        descricao_problema: ticket.descricao_problema,
        modulo: ticket.modulo,
        impacto: ticket.impacto,
        prioridade: ticket.priority,
        tipo: ticket.ticket_type,
        categoria: ticket.category,
        resultado_esperado: ticket.resultado_esperado,
        resultado_obtido: ticket.resultado_obtido,
        quem_reportou: ticket.quem_reportou,
        acao_tentada: ticket.acao_tentada,
        ja_tentou: ticket.ja_tentou,
        anydesk_id: ticket.anydesk_id,
        contato_nome: ticket.contato_nome,
        contato_cargo: ticket.contato_cargo,
        contato_telefone: ticket.contato_telefone || ticket.client_phone,
      },
      cliente: cliente && {
        nome: cliente.razao_social || cliente.company || cliente.name,
        cnpj: cliente.cnpj,
        contato_principal: cliente.contact_name,
        telefone: cliente.contact_phone || cliente.phone,
        email: cliente.contact_email || cliente.email,
      },
      operador_nortear: userData.user.user_metadata?.full_name || userData.user.email,
      ultimas_interacoes: (interacoes ?? []).map((i: any) => ({
        tipo: i.type,
        canal: i.channel,
        resultado: i.result,
        resumo: i.summary,
        conteudo: i.content?.slice(0, 800),
        em: i.interaction_at || i.created_at,
      })),
    };

    const userMsg = `Gere o e-mail N2 baseado neste chamado. Dados:\n\n${JSON.stringify(ctx, null, 2)}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);

    let aiRes: Response;
    try {
      aiRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: "claude-sonnet-4-5-20250929",
          max_tokens: 1500,
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: userMsg }],
        }),
      });
    } catch (e: any) {
      clearTimeout(timeout);
      return new Response(JSON.stringify({ error: e?.name === "AbortError" ? "Tempo limite excedido (30s)" : "Falha de rede ao chamar IA" }), {
        status: 504, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    clearTimeout(timeout);

    if (!aiRes.ok) {
      const t = await aiRes.text();
      return new Response(JSON.stringify({ error: `Falha na IA: ${t.slice(0, 400)}` }), {
        status: aiRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiRes.json();
    const raw = aiData?.content?.[0]?.text ?? "";
    let parsed: { assunto: string; corpo: string; variante: string };
    try {
      const cleaned = raw.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      return new Response(JSON.stringify({ error: "Resposta da IA fora do formato esperado", raw }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: settings } = await admin.from("system_settings").select("email_n2_fornecedor").limit(1).maybeSingle();
    const destinatario = settings?.email_n2_fornecedor ?? null;

    const { data: saved, error: saveErr } = await admin
      .from("ticket_emails_n2")
      .insert({
        ticket_id,
        assunto: parsed.assunto,
        corpo: parsed.corpo,
        variante: parsed.variante,
        destinatario,
        gerado_por: userData.user.id,
      })
      .select()
      .single();

    if (saveErr) {
      return new Response(JSON.stringify({ error: `Falha ao salvar: ${saveErr.message}` }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      id: saved.id,
      assunto: parsed.assunto,
      corpo: parsed.corpo,
      variante: parsed.variante,
      destinatario,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message ?? "Erro interno" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
