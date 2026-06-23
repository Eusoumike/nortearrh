/**
 * AVISO DE SEGURANÇA:
 * A chave VITE_GEMINI_API_KEY fica exposta no JavaScript do frontend.
 * Para uso interno (Nortear, usuários autorizados) o risco é aceitável.
 *
 * Mitigações recomendadas:
 * 1. Restringir a chave por domínio no Google Cloud Console:
 *    Application restrictions → HTTP referrers → *.lovable.app/*
 * 2. API restrictions → apenas Generative Language API
 * 3. Definir cota baixa (ex.: 500 req/dia)
 * 4. A chave pode ser revogada a qualquer momento
 *
 * Se a plataforma virar pública/multi-tenant, migrar de volta
 * para edge function com chave server-side.
 */

import { supabase } from "@/integrations/supabase/client";

export interface EmailN2Result {
  id?: string;
  assunto: string;
  corpo: string;
  variante: string;
  destinatario?: string | null;
}

export const gerarEmailN2 = async (ticketId: string): Promise<EmailN2Result> => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
  if (!apiKey) {
    throw new Error(
      "VITE_GEMINI_API_KEY não configurada. Adicione em Project Settings > Environment Variables (com prefixo VITE_)."
    );
  }

  // 1. Buscar ticket + cliente + interações
  const { data: ticket, error: ticketErr } = await supabase
    .from("tickets")
    .select(
      `*, clients!client_id (organization, razao_social, company, name, cnpj, contact_name, contact_email, contact_phone, phone, email), ticket_interactions (type, summary, content, created_at)`
    )
    .eq("id", ticketId)
    .single();

  if (ticketErr || !ticket) {
    throw new Error("Chamado não encontrado: " + (ticketErr?.message ?? ""));
  }

  // 2. Determinar variante
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

  // 3. Últimas 5 interações
  const interacoes = (ticket.ticket_interactions || [])
    .slice()
    .sort(
      (a: any, b: any) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
    .slice(0, 5)
    .map((i: any) => `[${i.type}] ${i.summary ?? ""}\n${(i.content ?? "").slice(0, 600)}`)
    .join("\n---\n");

  const cli: any = ticket.clients || {};
  const clienteNome = cli.razao_social || cli.organization || cli.company || cli.name || ticket.client_name;

  // 4. Prompt
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

  // 5. Chamar Gemini
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);

  let response: Response;
  try {
    response = await fetch(
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
      }
    );
  } catch (e: any) {
    clearTimeout(timer);
    if (e?.name === "AbortError") throw new Error("Tempo limite excedido (30s) ao chamar Gemini");
    throw new Error("Falha de rede ao chamar Gemini: " + (e?.message ?? ""));
  }
  clearTimeout(timer);

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini ${response.status}: ${errText.slice(0, 400)}`);
  }

  const data = await response.json();
  const responseText: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!responseText) {
    console.error("Resposta inesperada do Gemini:", data);
    throw new Error("Gemini retornou estrutura inválida");
  }

  const cleaned = responseText
    .replace(/```json\n?/gi, "")
    .replace(/```\n?/g, "")
    .trim();

  let parsed: { assunto: string; corpo: string; variante: string };
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(`Resposta não é JSON válido. Início: ${cleaned.slice(0, 200)}`);
  }

  // 6. Destinatário padrão das configurações
  const { data: settings } = await supabase
    .from("system_settings")
    .select("email_n2_fornecedor")
    .limit(1)
    .maybeSingle();
  const destinatario = (settings as any)?.email_n2_fornecedor ?? null;

  // 7. Salvar
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: salvo, error: salvoErr } = await supabase
    .from("ticket_emails_n2")
    .insert({
      ticket_id: ticketId,
      assunto: parsed.assunto,
      corpo: parsed.corpo,
      variante: parsed.variante,
      destinatario,
      gerado_por: user?.id,
    })
    .select()
    .single();

  if (salvoErr) {
    console.warn("Erro ao salvar e-mail N2 (continuando):", salvoErr);
  }

  return {
    id: salvo?.id,
    assunto: parsed.assunto,
    corpo: parsed.corpo,
    variante: parsed.variante,
    destinatario,
  };
};
