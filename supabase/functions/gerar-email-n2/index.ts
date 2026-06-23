// Edge function: gera e-mail N2 via Google Gemini Flash
// Lê a chave do secret GEMINI_API_KEY (configurado em Lovable Cloud).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return json(500, {
        error: "LOVABLE_API_KEY não configurada no projeto.",
      });
    }

    const { ticket_id } = await req.json().catch(() => ({}));
    if (!ticket_id) return json(400, { error: "ticket_id é obrigatório" });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization") ?? "";

    // Cliente com a sessão do usuário (para identificar quem gerou)
    const supabaseUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await supabaseUser.auth.getUser();
    const userId = userData.user?.id ?? null;

    // Cliente admin (bypass RLS) para ler tudo do ticket
    const admin = createClient(supabaseUrl, serviceKey);

    const { data: ticket, error: tErr } = await admin
      .from("tickets")
      .select(
        `*, clients!fk_tickets_client (razao_social, company, name, cnpj, contact_name, contact_email, contact_phone, phone, email), ticket_interactions!fk_interactions_ticket (type, summary, content, created_at)`,
      )
      .eq("id", ticket_id)
      .single();

    if (tErr || !ticket) return json(404, { error: "Chamado não encontrado: " + (tErr?.message ?? "") });

    // Variante
    let variante: "padrao" | "critica" | "duvida_tecnica" = "padrao";
    const prioridade = (ticket.priority || "").toString().toLowerCase();
    const impacto = (ticket.impacto || "").toString().toLowerCase();
    const titulo = (ticket.title || "").toString().toLowerCase();
    if (["critica", "urgente", "alta"].includes(prioridade) && impacto.includes("bloque")) {
      variante = "critica";
    } else if (
      ticket.category === "duvida" ||
      titulo.startsWith("dúvida") ||
      titulo.startsWith("duvida") ||
      titulo.startsWith("como ")
    ) {
      variante = "duvida_tecnica";
    }

    const interacoes = (ticket.ticket_interactions || [])
      .slice()
      .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 5)
      .map((i: any) => `[${i.type}] ${i.summary ?? ""}\n${(i.content ?? "").slice(0, 600)}`)
      .join("\n---\n");

    const cli: any = ticket.clients || {};
    const clienteNome =
      cli.razao_social || cli.organization || cli.company || cli.name || ticket.client_name;

    const prompt = `Você gera e-mails para o time N2 do fornecedor do sistema RH Digital, em nome da Nortear (canal oficial VR Benefícios e RH Digital).

REGRAS DE TOM:
- Técnico, direto, sem corporativês.
- Proibido: "venho por meio deste", "tratativa", "alinhamento", "fica a critério", "à disposição", "prezados".
- Refira-se ao produto como "o sistema" ou "RH Digital" — NUNCA pelo nome do fabricante.
- Português brasileiro natural, frases curtas.

ESTRUTURA OBRIGATÓRIA (use ═══ como separador entre blocos):
1. IDENTIFICAÇÃO (empresa, CNPJ, contato no cliente)
2. DESCRIÇÃO (o que está acontecendo, desde quando)
3. REPRODUÇÃO (passos numerados)
4. TENTATIVAS N1 (o que a Nortear já testou)
5. EVIDÊNCIAS (prints, logs — listar)
6. URGÊNCIA (impacto + prazo)
7. FECHAMENTO (contato Nortear pra retorno)

VARIANTE: ${variante}
${variante === "critica" ? "⚠ CRÍTICA: assunto começa com [URGENTE]. URGÊNCIA sobe pro topo, logo após IDENTIFICAÇÃO." : ""}
${variante === "duvida_tecnica" ? "📌 DÚVIDA: omitir REPRODUÇÃO e TENTATIVAS N1. É pergunta, não problema." : ""}

DADOS DO CHAMADO:
- Número: #${ticket.ticket_number || ticket.id.slice(0, 8)}
- Cliente: ${clienteNome || "não informado"}
- CNPJ: ${cli.cnpj || "não informado"}
- Contato cliente: ${ticket.contato_nome || cli.contact_name || "não informado"} (${ticket.contato_cargo || "cargo não informado"}) — ${ticket.contato_telefone || cli.contact_phone || cli.phone || ticket.client_phone || "sem telefone"}
- Título: ${ticket.title}
- Descrição: ${ticket.descricao_problema || ticket.description || "não informada"}
- Módulo afetado: ${ticket.modulo || "não especificado"}
- Impacto: ${ticket.impacto || "não especificado"}
- Resultado esperado: ${ticket.resultado_esperado || "não informado"}
- Resultado obtido: ${ticket.resultado_obtido || "não informado"}
- O que já foi tentado: ${ticket.ja_tentou || ticket.acao_tentada || "nada registrado"}
- Prioridade: ${ticket.priority}

ÚLTIMAS INTERAÇÕES:
${interacoes || "sem interações registradas"}

Retorne APENAS JSON puro (sem markdown, sem texto antes ou depois):
{ "assunto": "...", "corpo": "...", "variante": "${variante}" }`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30_000);
    let resp: Response;
    try {
      resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 2048,
              responseMimeType: "application/json",
            },
          }),
        },
      );
    } catch (e: any) {
      clearTimeout(timer);
      if (e?.name === "AbortError") return json(504, { error: "Tempo limite (30s) ao chamar Gemini" });
      return json(502, { error: "Falha de rede ao chamar Gemini: " + (e?.message ?? "") });
    }
    clearTimeout(timer);

    if (!resp.ok) {
      const errText = await resp.text();
      return json(resp.status, { error: `Gemini ${resp.status}: ${errText.slice(0, 600)}` });
    }

    const data = await resp.json();
    const responseText: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!responseText) return json(502, { error: "Gemini retornou estrutura inválida" });

    const cleaned = responseText.replace(/```json\n?/gi, "").replace(/```\n?/g, "").trim();
    let parsed: { assunto: string; corpo: string; variante: string };
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      return json(502, { error: `Resposta não é JSON válido: ${cleaned.slice(0, 200)}` });
    }

    const { data: settings } = await admin
      .from("system_settings")
      .select("email_n2_fornecedor")
      .limit(1)
      .maybeSingle();
    const destinatario = (settings as any)?.email_n2_fornecedor ?? null;

    const { data: salvo, error: salvoErr } = await admin
      .from("ticket_emails_n2")
      .insert({
        ticket_id,
        assunto: parsed.assunto,
        corpo: parsed.corpo,
        variante: parsed.variante,
        destinatario,
        gerado_por: userId,
      })
      .select()
      .single();

    if (salvoErr) console.warn("Erro ao salvar e-mail N2:", salvoErr);

    return json(200, {
      id: salvo?.id,
      assunto: parsed.assunto,
      corpo: parsed.corpo,
      variante: parsed.variante,
      destinatario,
    });
  } catch (e: any) {
    return json(500, { error: e?.message ?? "Erro inesperado" });
  }
});
