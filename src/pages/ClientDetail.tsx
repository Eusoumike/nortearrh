import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { HealthBadge, StatusBadge, PriorityBadge } from "@/components/badges";
import {
  ArrowLeft,
  Mail,
  Phone,
  Building2,
  Loader2,
  Pencil,
  Star,
  Send,
  Copy,
  Monitor,
  Rocket,
  MessageCircle,
  ExternalLink,
  FileText,
  Hash,
  CheckCircle2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { formatBrazilDate, timeAgo } from "@/lib/formatters";
import { EditClientDialog } from "@/components/EditClientDialog";
import { IniciarOnboardingDialog } from "@/components/IniciarOnboardingDialog";

import { PRODUCT_LABEL } from "@/lib/constants";

const ETAPA_LABEL: Record<string, string> = {
  novo_cliente: "Novo cliente",
  boas_vindas: "E-mail de Boas-vindas",
  treinamento_1: "Treinamento 1",
  treinamento_2: "Treinamento 2",
  treinamento_3: "Treinamento 3",
  finalizado: "Finalizado",
};

const ETAPA_PROGRESS: Record<string, number> = {
  novo_cliente: 5,
  boas_vindas: 20,
  treinamento_1: 40,
  treinamento_2: 60,
  treinamento_3: 80,
  finalizado: 100,
};

function brl(v: number | null | undefined) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v ?? 0);
}
function onlyDigits(s: string | null | undefined) {
  return (s ?? "").replace(/\D/g, "");
}

export default function ClientDetail() {
  const { id } = useParams();
  const qc = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(false);

  const { data: client, isLoading } = useQuery({
    queryKey: ["client", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("*").eq("id", id!).single();
      if (error) throw error;
      return data as any;
    },
    enabled: !!id,
  });

  const { data: implantacao } = useQuery({
    queryKey: ["client-implantacao", id],
    enabled: !!id,
    queryFn: async () => {
      const { data } = await supabase
        .from("implantacoes")
        .select("id, etapa, data_inicio, data_go_live")
        .eq("client_id", id!)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  const { data: contratoRh } = useQuery({
    queryKey: ["client-contrato-rh", id],
    enabled: !!id,
    queryFn: async () => {
      const { data } = await supabase
        .from("contratos_rh_digital")
        .select("*")
        .eq("client_id", id!)
        .eq("ativo", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  const { data: parcelas } = useQuery({
    queryKey: ["client-parcelas-rh", contratoRh?.id],
    enabled: !!contratoRh?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("parcelas_rh_digital")
        .select("status")
        .eq("contrato_id", contratoRh!.id);
      return data ?? [];
    },
  });

  const { data: lancamentosVr } = useQuery({
    queryKey: ["client-lancamentos-vr", id],
    enabled: !!id,
    queryFn: async () => {
      const { data } = await supabase
        .from("lancamentos_vr")
        .select("competencia, valor_comissao")
        .eq("client_id", id!)
        .order("competencia", { ascending: false });
      return data ?? [];
    },
  });

  const { data: tickets } = useQuery({
    queryKey: ["client-tickets", id],
    enabled: !!id,
    queryFn: async () => {
      const { data } = await supabase
        .from("tickets")
        .select("id, ticket_number, title, status, priority, created_at")
        .eq("client_id", id!)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: npsLatest } = useQuery({
    queryKey: ["client-nps", id],
    enabled: !!id,
    queryFn: async () => {
      const { data } = await supabase
        .from("nps_responses")
        .select("*")
        .eq("client_id", id!)
        .order("created_at", { ascending: false })
        .limit(1);
      return data?.[0] ?? null;
    },
  });

  const sendSurvey = useMutation({
    mutationFn: async () => {
      if (!client) throw new Error("Cliente não carregado");
      let token = client.nps_token;
      if (!token) {
        token = (crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)).replace(/-/g, "");
        const { error } = await supabase.from("clients").update({ nps_token: token }).eq("id", id!);
        if (error) throw error;
      }
      const url = `${window.location.origin}/pesquisa/${token}`;
      await navigator.clipboard.writeText(url);
      return url;
    },
    onSuccess: (url) => {
      qc.invalidateQueries({ queryKey: ["client", id] });
      toast.success("Link copiado: " + url);
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading || !client) {
    return (
      <div className="space-y-3 p-6">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const products: string[] = client.products ?? [];
  const hasRh = products.includes("rh_digital");
  const hasVr = products.includes("vr_beneficios");
  const phoneDigits = onlyDigits(client.whatsapp || client.phone);
  const parcelasPagas = (parcelas ?? []).filter((p) => p.status === "pago").length;
  const parcelasTotal = parcelas?.length ?? 0;
  const vrTotal = (lancamentosVr ?? []).reduce((s, l) => s + Number(l.valor_comissao || 0), 0);
  const vrUltimo = lancamentosVr?.[0];

  return (
    <div className="space-y-4 p-6">
      <Link to="/clientes" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Voltar para clientes
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{client.company || client.name}</h1>
            <HealthBadge health={client.health} />
          </div>
          {client.contact_name && <p className="text-sm text-muted-foreground">Contato: {client.contact_name}</p>}
        </div>
        <Button variant="outline" onClick={() => setEditOpen(true)}>
          <Pencil className="mr-1.5 h-4 w-4" /> Editar
        </Button>
      </div>

      <EditClientDialog client={client} open={editOpen} onOpenChange={setEditOpen} />
      <IniciarOnboardingDialog client={client} open={onboardingOpen} onOpenChange={setOnboardingOpen} />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {/* Dados da empresa */}
          <Card className="p-5">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Dados da empresa
            </h2>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">Razão social</dt>
                <dd className="font-medium">{client.company || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">CNPJ</dt>
                <dd className="font-mono">{client.cnpj || "—"}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-xs text-muted-foreground">Produto contratado</dt>
                <dd className="mt-1">
                  {client.product ? (
                    <Badge variant="secondary">{PRODUCT_LABEL[client.product] ?? client.product}</Badge>
                  ) : products.length ? (
                    <div className="flex flex-wrap gap-1.5">
                      {products.map((p) => (
                        <Badge key={p} variant="secondary">{PRODUCT_LABEL[p] ?? p}</Badge>
                      ))}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Valor cheio</dt>
                <dd className="font-medium">{client.valor_contratado != null ? brl(client.valor_contratado) : "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Desconto</dt>
                <dd className="font-medium">{Number(client.desconto_percentual ?? 0) > 0 ? `${client.desconto_percentual}%` : "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Valor final</dt>
                <dd className="font-semibold text-primary">{client.valor_com_desconto != null ? brl(client.valor_com_desconto) : (client.contract_value != null ? brl(client.contract_value) : "—")}</dd>
              </div>
              {client.fonte_indicacao && (
                <div>
                  <dt className="text-xs text-muted-foreground">Fonte de indicação</dt>
                  <dd>{client.fonte_indicacao}</dd>
                </div>
              )}
              {client.parceiro_id && (
                <div className="col-span-2">
                  <dt className="text-xs text-muted-foreground">Parceiro</dt>
                  <dd><Badge variant="secondary">Indicado por parceiro</Badge></dd>
                </div>
              )}
            </dl>
          </Card>

          {/* Contato */}
          <Card className="p-5">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Contato
            </h2>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">Nome do contato</dt>
                <dd className="font-medium">{client.contact_name || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">E-mail</dt>
                <dd>
                  {client.email ? (
                    <a href={`mailto:${client.email}`} className="hover:underline">{client.email}</a>
                  ) : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Telefone</dt>
                <dd>{client.phone || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">WhatsApp</dt>
                <dd>{client.whatsapp || "—"}</dd>
              </div>
            </dl>
            <div className="mt-4 flex flex-wrap gap-2">
              {phoneDigits && (
                <Button
                  asChild
                  size="sm"
                  className="bg-success text-success-foreground hover:opacity-90"
                >
                  <a
                    href={`https://wa.me/55${phoneDigits}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <MessageCircle className="mr-1.5 h-3.5 w-3.5" /> WhatsApp
                  </a>
                </Button>
              )}
              {client.email && (
                <Button asChild size="sm" variant="outline">
                  <a href={`mailto:${client.email}`}>
                    <Mail className="mr-1.5 h-3.5 w-3.5" /> E-mail
                  </a>
                </Button>
              )}
            </div>
          </Card>

          {/* Onboarding */}
          <Card className="p-5">
            <h2 className="mb-3 flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <span>Onboarding</span>
              <Rocket className="h-3.5 w-3.5" />
            </h2>
            {!implantacao ? (
              <div className="flex flex-col items-start gap-3">
                <p className="text-sm text-muted-foreground">
                  Onboarding ainda não iniciado para este cliente.
                </p>
                <Button
                  onClick={() => setOnboardingOpen(true)}
                  className="bg-gradient-brand text-primary-foreground hover:opacity-90"
                >
                  <Rocket className="mr-1.5 h-4 w-4" /> Iniciar onboarding
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span>
                    Etapa atual:{" "}
                    <strong>{ETAPA_LABEL[implantacao.etapa] ?? implantacao.etapa}</strong>
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {ETAPA_PROGRESS[implantacao.etapa] ?? 0}%
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-surface-muted">
                  <div
                    className="h-full bg-gradient-brand transition-all"
                    style={{ width: `${ETAPA_PROGRESS[implantacao.etapa] ?? 0}%` }}
                  />
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button asChild variant="outline" size="sm">
                    <Link to={`/implantacao?id=${implantacao.id}`}>
                      <ExternalLink className="mr-1.5 h-3.5 w-3.5" /> Ver implantação
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="sm">
                    <Link to="/financeiro">
                      <FileText className="mr-1.5 h-3.5 w-3.5" /> Ver financeiro
                    </Link>
                  </Button>
                </div>
              </div>
            )}
          </Card>

          {/* Financeiro */}
          {(hasRh || hasVr) && (
            <Card className="p-5">
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Financeiro
              </h2>
              <div className="grid gap-3 md:grid-cols-2">
                {hasRh && (
                  <div className="rounded-lg border border-border bg-surface-muted/30 p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-sm font-medium">RH Digital</span>
                      <Badge variant="secondary">Ponto</Badge>
                    </div>
                    {contratoRh ? (
                      <div className="space-y-1.5 text-sm">
                        <div>
                          Mensalidade: <strong>{brl(contratoRh.valor_mensalidade)}</strong>
                        </div>
                        <div className="text-muted-foreground">
                          {contratoRh.percentual_nortear}% Nortear ={" "}
                          <span className="text-foreground font-medium">
                            {brl(contratoRh.valor_nortear)}/mês
                          </span>
                        </div>
                        <div className="text-muted-foreground">
                          Fidelidade: {contratoRh.fidelidade_meses} meses
                          {contratoRh.fidelidade_vencimento && (
                            <> — vence em {formatBrazilDate(contratoRh.fidelidade_vencimento)}</>
                          )}
                        </div>
                        <div className="text-muted-foreground">
                          Parcelas:{" "}
                          <span className="text-foreground font-medium">
                            {parcelasPagas} pagas / {parcelasTotal} total
                          </span>
                        </div>
                        <Button asChild size="sm" variant="outline" className="mt-2">
                          <Link to="/financeiro">
                            Ver no financeiro <ExternalLink className="ml-1.5 h-3 w-3" />
                          </Link>
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-2 text-sm">
                        <p className="text-muted-foreground">Sem contrato ativo.</p>
                        <Button
                          asChild
                          size="sm"
                          variant="outline"
                        >
                          <Link to="/financeiro">+ Criar contrato RH Digital</Link>
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {hasVr && (
                  <div className="rounded-lg border border-border bg-surface-muted/30 p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-sm font-medium">VR Benefícios</span>
                      <Badge variant="secondary">VR</Badge>
                    </div>
                    {vrUltimo ? (
                      <div className="space-y-1.5 text-sm">
                        <div>
                          Última comissão: <strong>{brl(vrUltimo.valor_comissao)}</strong>
                        </div>
                        <div className="text-muted-foreground">
                          Competência: {formatBrazilDate(vrUltimo.competencia)}
                        </div>
                        <div className="text-muted-foreground">
                          Total acumulado:{" "}
                          <span className="text-foreground font-medium">{brl(vrTotal)}</span>
                        </div>
                        <Button asChild size="sm" variant="outline" className="mt-2">
                          <Link to="/financeiro">
                            Ver no financeiro <ExternalLink className="ml-1.5 h-3 w-3" />
                          </Link>
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-2 text-sm">
                        <p className="text-muted-foreground">Lançamento manual necessário.</p>
                        <Button asChild size="sm" variant="outline">
                          <Link to="/financeiro">+ Registrar comissão VR</Link>
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </Card>
          )}

          {client.notes && (
            <Card className="p-5">
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Observações
              </h2>
              <p className="whitespace-pre-wrap text-sm">{client.notes}</p>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          {/* AnyDesk */}
          {client.anydesk_id && (
            <Card className="p-5">
              <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <Monitor className="h-3.5 w-3.5" /> AnyDesk
              </h3>
              <div className="flex items-center gap-2">
                <Hash className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-mono text-sm">{client.anydesk_id}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => {
                    navigator.clipboard.writeText(client.anydesk_id!);
                    toast.success("ID copiado");
                  }}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </Card>
          )}

          {/* NPS */}
          <Card className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">NPS</h3>
              <Star className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            {npsLatest ? (
              <div className="space-y-2">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-semibold tabular-nums">{npsLatest.nps_score ?? "—"}</span>
                  {npsLatest.nps_score != null && (
                    <Badge
                      className={
                        npsLatest.nps_score >= 9
                          ? "bg-success/15 text-success hover:bg-success/15"
                          : npsLatest.nps_score >= 7
                            ? "bg-warning/15 text-warning hover:bg-warning/15"
                            : "bg-destructive/15 text-destructive hover:bg-destructive/15"
                      }
                    >
                      {npsLatest.nps_score >= 9 ? "Promotor" : npsLatest.nps_score >= 7 ? "Neutro" : "Detrator"}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {npsLatest.nome} · {formatBrazilDate(npsLatest.created_at)}
                </p>
                {npsLatest.feedback_aberto && (
                  <p className="line-clamp-3 rounded-md bg-surface-muted/50 p-2 text-xs italic">
                    "{npsLatest.feedback_aberto}"
                  </p>
                )}
              </div>
            ) : (
              <p className="py-2 text-center text-xs text-muted-foreground">Sem respostas ainda.</p>
            )}
            <Button
              variant="outline"
              size="sm"
              className="mt-3 w-full"
              onClick={() => sendSurvey.mutate()}
              disabled={sendSurvey.isPending}
            >
              {sendSurvey.isPending ? (
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="mr-2 h-3.5 w-3.5" />
              )}
              Enviar pesquisa NPS
            </Button>
          </Card>

          {/* Tickets */}
          <Card className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tickets</h3>
              <span className="font-mono text-xs text-muted-foreground">{tickets?.length ?? 0}</span>
            </div>
            {!tickets || tickets.length === 0 ? (
              <p className="py-4 text-center text-xs text-muted-foreground">Nenhum ticket.</p>
            ) : (
              <div className="-mx-2 max-h-80 space-y-1 overflow-y-auto">
                {tickets.map((t) => (
                  <Link
                    key={t.id}
                    to={`/tickets/${t.id}`}
                    className="block rounded-md px-2 py-2 transition-colors hover:bg-surface-muted"
                  >
                    <div className="mb-1 flex items-center gap-2">
                      <span className="font-mono text-[11px] text-muted-foreground">#{t.ticket_number}</span>
                      <PriorityBadge priority={t.priority} />
                      <StatusBadge status={t.status} />
                    </div>
                    <p className="truncate text-sm">{t.title}</p>
                    <p className="text-[11px] text-muted-foreground">{timeAgo(t.created_at)}</p>
                  </Link>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
