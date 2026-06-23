import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Mail, Copy, ExternalLink, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

type Variante = "padrao" | "critica" | "duvida_tecnica" | string;

interface Props {
  ticketId: string;
  ticketStatus: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const VARIANTE_META: Record<string, { label: string; className: string }> = {
  padrao: { label: "Padrão", className: "bg-muted text-foreground" },
  critica: { label: "Crítica", className: "bg-destructive/15 text-destructive border-destructive/30" },
  duvida_tecnica: { label: "Dúvida técnica", className: "bg-blue-500/15 text-blue-600 border-blue-500/30 dark:text-blue-400" },
};

export function EmailN2Dialog({ ticketId, ticketStatus, open, onOpenChange }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailId, setEmailId] = useState<string | null>(null);
  const [destinatario, setDestinatario] = useState("");
  const [assunto, setAssunto] = useState("");
  const [corpo, setCorpo] = useState("");
  const [variante, setVariante] = useState<Variante>("padrao");

  useEffect(() => {
    if (!open) return;
    setError(null);
    setEmailId(null);
    setAssunto("");
    setCorpo("");
    setVariante("padrao");
    setLoading(true);

    (async () => {
      try {
        const { gerarEmailN2 } = await import("@/lib/gerar-email-n2");
        const data = await gerarEmailN2(ticketId);
        setEmailId(data.id ?? null);
        setAssunto(data.assunto || "");
        setCorpo(data.corpo || "");
        setVariante(data.variante || "padrao");
        setDestinatario((prev) => prev || data.destinatario || "");
      } catch (e: any) {
        setError(e?.message || "Falha ao gerar e-mail");
      } finally {
        setLoading(false);
      }
    })();
  }, [open, ticketId]);

  const copiar = async () => {
    const txt = `Assunto: ${assunto}\n\n${corpo}`;
    await navigator.clipboard.writeText(txt);
    toast.success("E-mail copiado");
  };

  const abrirMailto = () => {
    const url = `mailto:${encodeURIComponent(destinatario)}?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(corpo)}`;
    window.open(url, "_blank");
  };

  const salvarInteracao = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Não autenticado");
      const conteudo = `**Destinatário:** ${destinatario || "—"}\n**Assunto:** ${assunto}\n\n${corpo}`;
      const { error: iErr } = await supabase.from("ticket_interactions").insert({
        ticket_id: ticketId,
        type: "email_n2" as any,
        summary: assunto.slice(0, 200),
        content: conteudo,
        is_internal: false,
        author_id: user.id,
        channel: "email",
      });
      if (iErr) throw iErr;

      if (emailId) {
        await supabase.from("ticket_emails_n2")
          .update({ enviado_em: new Date().toISOString(), destinatario, assunto, corpo })
          .eq("id", emailId);
      }

      if (ticketStatus !== "abertura_chamado_n2") {
        await supabase.from("tickets").update({ status: "abertura_chamado_n2" }).eq("id", ticketId);
      }
    },
    onSuccess: () => {
      toast.success("E-mail registrado no timeline");
      qc.invalidateQueries({ queryKey: ["ticket"] });
      qc.invalidateQueries({ queryKey: ["interactions"] });
      qc.invalidateQueries({ queryKey: ["tickets"] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e?.message || "Falha ao registrar"),
  });

  const meta = VARIANTE_META[variante] ?? VARIANTE_META.padrao;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            E-mail para N2
            {!loading && !error && (
              <Badge variant="outline" className={meta.className}>{meta.label}</Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            Gerado pela IA com base no chamado. Edite livremente antes de copiar, enviar ou registrar.
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm">Gerando e-mail com base no chamado...</p>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        {!loading && !error && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="dest">Destinatário</Label>
              <Input id="dest" type="email" value={destinatario} onChange={(e) => setDestinatario(e.target.value)} placeholder="suporte.n2@fornecedor.com.br" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ass">Assunto</Label>
              <Input id="ass" value={assunto} onChange={(e) => setAssunto(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="corpo">Corpo</Label>
              <Textarea id="corpo" value={corpo} onChange={(e) => setCorpo(e.target.value)} rows={18} className="font-mono text-xs leading-relaxed" />
            </div>
          </div>
        )}

        <DialogFooter className="flex-wrap gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button variant="outline" onClick={copiar} disabled={loading || !!error}>
            <Copy className="mr-1.5 h-4 w-4" /> Copiar tudo
          </Button>
          <Button variant="outline" onClick={abrirMailto} disabled={loading || !!error || !assunto}>
            <ExternalLink className="mr-1.5 h-4 w-4" /> Abrir no e-mail
          </Button>
          <Button onClick={() => salvarInteracao.mutate()} disabled={loading || !!error || !assunto || salvarInteracao.isPending}>
            {salvarInteracao.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
            Salvar como interação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
