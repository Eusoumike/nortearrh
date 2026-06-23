import { supabase } from "@/integrations/supabase/client";

export interface EmailN2Result {
  id?: string;
  assunto: string;
  corpo: string;
  variante: string;
  destinatario?: string | null;
}

export const gerarEmailN2 = async (ticketId: string): Promise<EmailN2Result> => {
  const { data, error } = await supabase.functions.invoke("gerar-email-n2", {
    body: { ticket_id: ticketId },
  });

  // Tenta extrair mensagem detalhada quando a edge function retornou non-2xx
  if (error) {
    let detalhe = error.message || "Falha ao gerar e-mail";
    try {
      const ctx: any = (error as any).context;
      if (ctx && typeof ctx.json === "function") {
        const body = await ctx.json();
        if (body?.error) detalhe = body.error;
      } else if (ctx && typeof ctx.text === "function") {
        const txt = await ctx.text();
        if (txt) detalhe = txt;
      }
    } catch {
      /* noop */
    }
    throw new Error(detalhe);
  }

  if (!data) throw new Error("Resposta vazia da edge function");
  if ((data as any).error) throw new Error((data as any).error);

  return data as EmailN2Result;
};
