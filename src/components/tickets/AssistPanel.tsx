import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Sparkles, ChevronDown, ChevronUp, Send, Check, RefreshCw, X, Loader2, User } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";

interface Msg { role: "user" | "assistant"; content: string; timestamp?: string }

interface Props {
  ticket: {
    id: string;
    title: string;
    description?: string | null;
    category?: string | null;
    client_name?: string | null;
    client?: { name?: string; products?: string[] } | null;
  };
}

export function AssistPanel({ ticket }: Props) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmForm, setConfirmForm] = useState({ problema: "", solucao: "" });

  const { data: conversation, isLoading } = useQuery({
    queryKey: ["assist-conversation", ticket.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assist_conversations" as any)
        .select("messages")
        .eq("ticket_id", ticket.id)
        .maybeSingle();
      if (error && error.code !== "PGRST116") throw error;
      return (data as any)?.messages as Msg[] | undefined;
    },
  });

  const messages: Msg[] = useMemo(() => (Array.isArray(conversation) ? conversation : []), [conversation]);
  const hasConversation = messages.length > 0;
  const lastAssistant = useMemo(
    () => [...messages].reverse().find((m) => m.role === "assistant"),
    [messages],
  );

  const callAssist = useMutation({
    mutationFn: async (payload: { action: "suggest" | "chat"; newMessages?: Msg[] }) => {
      const { data, error } = await supabase.functions.invoke("nortear-assist", {
        body: {
          ticket_id: ticket.id,
          ticket_title: ticket.title,
          ticket_description: ticket.description ?? "",
          categoria: ticket.category ?? "",
          client_name: ticket.client_name ?? ticket.client?.name ?? "",
          products: ticket.client?.products ?? [],
          messages: payload.newMessages ?? [],
          action: payload.action,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data as { message: string; conversation: Msg[] };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["assist-conversation", ticket.id] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao consultar o Assist"),
  });

  // Auto-trigger first suggestion when opening if nothing exists yet
  useEffect(() => {
    if (open && !isLoading && !hasConversation && !callAssist.isPending) {
      callAssist.mutate({ action: "suggest" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isLoading, hasConversation]);

  const handleSendChat = () => {
    const text = chatInput.trim();
    if (!text) return;
    const newMessages: Msg[] = [...messages, { role: "user", content: text }];
    setChatInput("");
    callAssist.mutate({ action: "chat", newMessages });
  };

  const handleRefine = () => {
    const newMessages: Msg[] = [
      ...messages,
      { role: "user", content: "Refine a sugestão acima com mais detalhe técnico e passos numerados." },
    ];
    callAssist.mutate({ action: "chat", newMessages });
  };

  const handleNotHelpful = () => {
    const newMessages: Msg[] = [
      ...messages,
      { role: "user", content: "Essa sugestão não ajudou. Proponha uma abordagem alternativa para o problema." },
    ];
    callAssist.mutate({ action: "chat", newMessages });
  };

  const openConfirm = () => {
    setConfirmForm({
      problema: ticket.title,
      solucao: lastAssistant?.content ?? "",
    });
    setConfirmOpen(true);
  };

  const saveSolution = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("assist_solutions" as any).insert({
        ticket_id: ticket.id,
        categoria: ticket.category ?? null,
        problema: confirmForm.problema,
        solucao: confirmForm.solucao,
        confirmado_em: new Date().toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Solução salva! Vai ajudar nos próximos chamados similares.");
      setConfirmOpen(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "Não foi possível salvar"),
  });

  return (
    <>
      <div className="rounded-xl border border-border bg-gradient-to-br from-accent/5 to-transparent shadow-sm">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-accent/5 rounded-xl"
        >
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-accent">
              <Sparkles className="h-3.5 w-3.5 text-accent-foreground" />
            </div>
            <span className="text-sm font-semibold">Nortear Assist</span>
            <Badge variant="secondary" className="bg-accent/15 text-accent-foreground text-[10px] h-5">IA</Badge>
            {hasConversation && (
              <Badge variant="outline" className="text-[10px] h-5">conversa salva</Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {!open && (
              <span className="text-xs text-muted-foreground">
                {hasConversation ? "Ver sugestão" : "Consultar"}
              </span>
            )}
            {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </div>
        </button>

        {open && (
          <div className="border-t border-border px-4 py-4 space-y-4">
            {isLoading || (callAssist.isPending && !hasConversation) ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Analisando chamado e consultando histórico...
                </div>
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            ) : !hasConversation ? (
              <div className="text-center py-4">
                <Button size="sm" onClick={() => callAssist.mutate({ action: "suggest" })} disabled={callAssist.isPending}>
                  <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                  Gerar sugestão
                </Button>
              </div>
            ) : (
              <>
                {/* Conversation thread */}
                <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1 scrollbar-thin">
                  {messages.map((m, i) => (
                    <div
                      key={i}
                      className={cn(
                        "flex gap-2",
                        m.role === "user" ? "justify-end" : "justify-start",
                      )}
                    >
                      {m.role === "assistant" && (
                        <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-gradient-accent">
                          <Sparkles className="h-3 w-3 text-accent-foreground" />
                        </div>
                      )}
                      <div
                        className={cn(
                          "rounded-lg px-3 py-2 text-sm max-w-[85%]",
                          m.role === "user"
                            ? "bg-primary text-primary-foreground"
                            : "bg-card border border-border",
                        )}
                      >
                        {m.role === "assistant" ? (
                          <div className="prose prose-sm max-w-none dark:prose-invert prose-p:my-1.5 prose-headings:my-2 prose-ul:my-1.5 prose-li:my-0.5 prose-a:text-primary">
                            <ReactMarkdown>{m.content}</ReactMarkdown>
                          </div>
                        ) : (
                          <p className="whitespace-pre-wrap">{m.content}</p>
                        )}
                      </div>
                      {m.role === "user" && (
                        <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-muted">
                          <User className="h-3 w-3 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                  ))}
                  {callAssist.isPending && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground pl-8">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Pensando...
                    </div>
                  )}
                </div>

                {/* Action buttons */}
                {lastAssistant && (
                  <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
                    <Button size="sm" variant="default" onClick={openConfirm} className="h-7 text-xs">
                      <Check className="h-3 w-3 mr-1" /> Essa solução funcionou
                    </Button>
                    <Button size="sm" variant="outline" onClick={handleRefine} disabled={callAssist.isPending} className="h-7 text-xs">
                      <RefreshCw className="h-3 w-3 mr-1" /> Refinar
                    </Button>
                    <Button size="sm" variant="outline" onClick={handleNotHelpful} disabled={callAssist.isPending} className="h-7 text-xs">
                      <X className="h-3 w-3 mr-1" /> Não ajudou
                    </Button>
                  </div>
                )}

                {/* Chat input */}
                <div className="flex gap-2 border-t border-border pt-3">
                  <Input
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSendChat();
                      }
                    }}
                    placeholder="Pergunte algo mais específico..."
                    className="h-8 text-sm"
                    disabled={callAssist.isPending}
                  />
                  <Button size="sm" onClick={handleSendChat} disabled={!chatInput.trim() || callAssist.isPending} className="h-8">
                    <Send className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Salvar solução confirmada</DialogTitle>
            <DialogDescription>
              Salve esta solução na base do Nortear Assist para ajudar em chamados similares.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium mb-1 block">Resumo do problema</label>
              <Input
                value={confirmForm.problema}
                onChange={(e) => setConfirmForm((f) => ({ ...f, problema: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block">Resumo da solução</label>
              <Textarea
                value={confirmForm.solucao}
                onChange={(e) => setConfirmForm((f) => ({ ...f, solucao: e.target.value }))}
                rows={6}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancelar</Button>
            <Button onClick={() => saveSolution.mutate()} disabled={saveSolution.isPending || !confirmForm.problema.trim() || !confirmForm.solucao.trim()}>
              {saveSolution.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              Salvar solução
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
