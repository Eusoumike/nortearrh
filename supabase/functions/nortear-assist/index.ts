import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const HELP_LINKS = [
  "Reconhecimento facial: materiais.vr.com.br/central-de-ajuda/reconhecimento-facial/",
  "Fechamento de ponto: materiais.vr.com.br/central-de-ajuda/fechamento-ponto-novo/",
  "Banco de horas: materiais.vr.com.br/central-de-ajuda/configuracao-do-banco-de-horas/",
  "Solicitações de ajuste: materiais.vr.com.br/central-de-ajuda/solicitacoes-de-ajuste/",
  "SuperApp registro: materiais.vr.com.br/central-de-ajuda/superapp-como-registrar-o-ponto/",
  "Configurando turnos: materiais.vr.com.br/central-de-ajuda/configurando-turnos/",
  "Ponto por exceção: materiais.vr.com.br/central-de-ajuda/o-que-e-ponto-por-excecao-como-configurar-e-mais/",
  "Redefinir senha: materiais.vr.com.br/central-de-ajuda/redefinir-senha/",
  "Exportação folha: materiais.vr.com.br/central-de-ajuda/exportacao-para-folha-de-pagamento/",
  "Férias e folgas: materiais.vr.com.br/central-de-ajuda/modulo-de-ferias-e-folgas/",
  "Módulo de escala: materiais.vr.com.br/central-de-ajuda/modulo-de-escala/",
  "Requisitos do app: materiais.vr.com.br/central-de-ajuda/requisitos-minimos-de-aparelho/",
  "Assinatura eletrônica: materiais.vr.com.br/central-de-ajuda/assinatura-eletronica-do-espelho-ponto-no-superapp/",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY ausente" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUser = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await supabaseUser.auth.getUser();
    if (!userData?.user) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const body = await req.json();
    const {
      ticket_id, ticket_title, ticket_description = "",
      categoria = "", client_name = "", products = [],
      descricao_problema = "", quem_reportou = "",
      acao_tentada = "", ja_tentou = "",
      messages = [], action = "suggest",
    } = body;

    if (!ticket_id || !ticket_title) {
      return new Response(JSON.stringify({ error: "ticket_id e ticket_title são obrigatórios" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Contexto
    const [{ data: similarTickets }, { data: clientHistory }, { data: solutions }] = await Promise.all([
      admin.from("tickets")
        .select("id, title, category, status, ticket_interactions(content, type, created_at)")
        .eq("category", categoria)
        .eq("status", "resolvido")
        .order("created_at", { ascending: false })
        .limit(20),
      admin.from("tickets")
        .select("id, title, status, category, created_at")
        .ilike("client_name", `%${client_name}%`)
        .order("created_at", { ascending: false })
        .limit(5),
      admin.from("assist_solutions")
        .select("problema, solucao, links")
        .eq("categoria", categoria)
        .not("confirmado_em", "is", null)
        .limit(10),
    ]);

    const systemPrompt = `Você é o Nortear Assist, copiloto de suporte do sistema Nortear Connect. Você ajuda o atendente a resolver chamados de suporte do sistema RH Digital Pontomais (controle de ponto e gestão de jornada da VR Benefícios).

CONTEXTO DO CHAMADO ATUAL:
- Título: ${ticket_title}
- Descrição: ${ticket_description || "Não informada"}
- Categoria: ${categoria || "Não classificada"}
- Cliente: ${client_name || "—"}
- Produtos: ${products?.join(", ") || "RH Digital"}

CHAMADOS SIMILARES RESOLVIDOS:
${(similarTickets ?? []).slice(0, 5).map((t: any) =>
  `- "${t.title}"\n  Solução: ${t.ticket_interactions?.[0]?.content?.slice(0, 200) || "Sem registro"}`
).join("\n") || "Nenhum similar encontrado"}

SOLUÇÕES CONFIRMADAS PARA ESTA CATEGORIA:
${(solutions ?? []).map((s: any) =>
  `- Problema: ${s.problema}\n  Solução: ${s.solucao}\n  Links: ${s.links?.join(", ") || ""}`
).join("\n") || "Nenhuma solução confirmada ainda"}

HISTÓRICO DO CLIENTE:
${(clientHistory ?? []).map((t: any) =>
  `- ${t.title} (${t.status}) — ${new Date(t.created_at).toLocaleDateString("pt-BR")}`
).join("\n") || "Primeiro chamado deste cliente"}

BASE DE CONHECIMENTO VR (links relevantes):
${HELP_LINKS.map((l) => `- ${l}`).join("\n")}

INSTRUÇÕES:
- Seja direto e objetivo. O atendente está com o cliente esperando.
- Sempre que citar um passo técnico, seja específico com o caminho no sistema.
- Se sugerir escalar para N1 ou N2, diga claramente quando fazer isso.
- Use linguagem informal e profissional — como um colega experiente.
- Máximo 250 palavras na sugestão inicial.

FORMATO DE RESPOSTA OBRIGATÓRIO:

Sempre responda nesta estrutura exata (máximo 250 palavras):

**🔍 Diagnóstico mais provável**

[1-2 linhas sobre a causa mais comum]

**❓ Pergunta para o cliente**

[A UMA pergunta mais importante para confirmar o diagnóstico]

**📋 Passo a passo**

1. [passo]

2. [passo]

3. [passo]

**🔗 Links úteis**

- [nome do artigo](url)

**⚠ Se não resolver**

[Uma linha sobre próximo passo — N1, N2 ou o que verificar]

**📌 Sugestão de etapa**

Mover para: [etapa recomendada do kanban]

NUNCA escreva mais que 250 palavras.

NUNCA use parágrafos longos.

SEJA direto — o atendente está com o cliente esperando.`;

    const chatMessages = action === "suggest"
      ? [{ role: "user", content: `Analise este chamado e sugira a solução: "${ticket_title}"` }]
      : messages;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [{ role: "system", content: systemPrompt }, ...chatMessages],
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      if (aiRes.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de uso temporário atingido. Tente em alguns instantes." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiRes.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados. Adicione créditos no workspace." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: `Falha na IA: ${errText}` }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiRes.json();
    const assistMessage = aiData.choices?.[0]?.message?.content ?? "Não consegui gerar uma resposta agora.";

    const updatedMessages = [
      ...chatMessages,
      { role: "assistant", content: assistMessage, timestamp: new Date().toISOString() },
    ];

    await admin.from("assist_conversations").upsert({
      ticket_id,
      messages: updatedMessages,
      updated_at: new Date().toISOString(),
    }, { onConflict: "ticket_id" });

    return new Response(JSON.stringify({ message: assistMessage, conversation: updatedMessages }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message ?? "Erro interno" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
