import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HealthBadge, StatusBadge, PriorityBadge } from "@/components/badges";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Mail,
  Pencil,
  Copy,
  Monitor,
  Rocket,
  MessageCircle,
  ExternalLink,
  FileText,
  Hash,
  Ticket as TicketIcon,
  LayoutDashboard,
  DollarSign,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { formatBrazilDate, timeAgo } from "@/lib/formatters";
import { EditClientDialog } from "@/components/EditClientDialog";
import { IniciarOnboardingDialog } from "@/components/IniciarOnboardingDialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { STATUS_NORTEAR_OPTIONS } from "@/lib/crmOptions";

const PRODUCT_LABEL: Record<string, string> = {
  rh_digital: "RH Digital",
  vr_beneficios: "VR Benefícios",
};

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
      const { data, error } = await supabase
        .from("clients")
        .select("id, name, company, contact_name, email, phone, whatsapp, billing_email, cnpj, contract_value, fonte_indicacao, parceiro_id, health, health_reason, notes, anydesk_id, products, status_nortear, fornecedor_beneficios, fornecedor_rh_digital, modulos_ativos, potencial_cross, segmento, estado, faixa_colaboradores")
        .eq("id", id!)
        .single();
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
        .select("id, valor_mensalidade, percentual_nortear, valor_nortear, fidelidade_meses, fidelidade_vencimento")
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
  const ticketsAbertos = (tickets ?? []).filter((t) => !["resolvido", "fechado"].includes(t.status)).length;

  const subtitleParts = [
    client.contact_name && `Contato: ${client.contact_name}`,
    client.cnpj && `CNPJ ${client.cnpj}`,
  ].filter(Boolean) as string[];

  return (
    <div className="max-w-full space-y-6 overflow-hidden p-6">
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            {client.company || client.name}
            <HealthBadge health={client.health} />
          </span>
        }
        subtitle={subtitleParts.join(" · ") || undefined}
        actions={
          <>
            {phoneDigits && (
              <Button
                asChild
                size="sm"
                className="bg-success text-success-foreground hover:opacity-90"
              >
                <a href={`https://wa.me/55${phoneDigits}`} target="_blank" rel="noopener noreferrer">
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
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
              <Pencil className="mr-1.5 h-3.5 w-3.5" /> Editar
            </Button>
          </>
        }
      />

      <EditClientDialog client={client} open={editOpen} onOpenChange={setEditOpen} />
      <IniciarOnboardingDialog client={client} open={onboardingOpen} onOpenChange={setOnboardingOpen} />

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="h-9 bg-surface-muted">
          <TabsTrigger value="overview" className="gap-1.5 text-xs">
            <LayoutDashboard className="h-3.5 w-3.5" /> Visão Geral
          </TabsTrigger>
          <TabsTrigger value="tickets" className="gap-1.5 text-xs">
            <TicketIcon className="h-3.5 w-3.5" /> Chamados
            {tickets && tickets.length > 0 && (
              <span className="ml-0.5 rounded-full bg-muted px-1.5 text-[10px] font-medium">
                {tickets.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="financeiro" className="gap-1.5 text-xs">
            <DollarSign className="h-3.5 w-3.5" /> Financeiro
          </TabsTrigger>
          <TabsTrigger value="onboarding" className="gap-1.5 text-xs">
            <Rocket className="h-3.5 w-3.5" /> Onboarding
          </TabsTrigger>
        </TabsList>

        {/* ============ VISÃO GERAL ============ */}
        <TabsContent value="overview" className="m-0 grid gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
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
                  <dt className="text-xs text-muted-foreground">Produto(s) contratado(s)</dt>
                  <dd className="mt-1 flex flex-wrap gap-1.5">
                    {products.length === 0 ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      products.map((p) => (
                        <Badge key={p} variant="secondary">{PRODUCT_LABEL[p] ?? p}</Badge>
                      ))
                    )}
                  </dd>
                </div>
                {client.contract_value != null && (
                  <div>
                    <dt className="text-xs text-muted-foreground">Valor de contrato</dt>
                    <dd className="font-medium">{brl(client.contract_value)}</dd>
                  </div>
                )}
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
            </Card>

            <Card className="p-5">
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Perfil Nortear
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <p className="mb-1 text-[11px] font-medium text-muted-foreground">Status Nortear</p>
                  <Select
                    value={client.status_nortear ?? "ativo_saudavel"}
                    onValueChange={async (v) => {
                      const { error } = await supabase.from("clients").update({ status_nortear: v }).eq("id", client.id);
                      if (error) toast.error(error.message);
                      else {
                        toast.success("Status atualizado");
                        qc.invalidateQueries({ queryKey: ["client", id] });
                      }
                    }}
                  >
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STATUS_NORTEAR_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.emoji} {o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {[
                  ["Segmento", client.segmento],
                  ["Estado (UF)", client.estado],
                  ["Faixa de colaboradores", client.faixa_colaboradores],
                ].map(([label, val]) => (
                  <div key={label as string}>
                    <p className="mb-1 text-[11px] font-medium text-muted-foreground">{label}</p>
                    <p className="text-sm">{(val as string) || "—"}</p>
                  </div>
                ))}
              </div>
              {[
                ["Módulos ativos", client.modulos_ativos],
                ["Fornecedor de benefícios", client.fornecedor_beneficios],
                ["Fornecedor de RH digital", client.fornecedor_rh_digital],
                ["Potencial cross-sell", client.potencial_cross],
              ].map(([label, arr]) => (
                <div key={label as string} className="mt-3">
                  <p className="mb-1 text-[11px] font-medium text-muted-foreground">{label}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(arr as string[] | null)?.length ? (
                      (arr as string[]).map((v) => (
                        <Badge key={v} variant="secondary" className="text-[10px]">{v}</Badge>
                      ))
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </div>
                </div>
              ))}
            </Card>

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


            <Card className="p-5">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Resumo rápido
              </h3>
              <dl className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Chamados abertos</dt>
                  <dd className="font-mono font-medium">{ticketsAbertos}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Chamados (total)</dt>
                  <dd className="font-mono font-medium">{tickets?.length ?? 0}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Onboarding</dt>
                  <dd className="font-medium">
                    {implantacao ? `${ETAPA_PROGRESS[implantacao.etapa] ?? 0}%` : "—"}
                  </dd>
                </div>
              </dl>
            </Card>
          </div>
        </TabsContent>

        {/* ============ CHAMADOS ============ */}
        <TabsContent value="tickets" className="m-0">
          <Card className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold">Chamados do cliente</h2>
              <Button asChild size="sm" variant="outline">
                <Link to={`/tickets/new?client=${client.id}`}>
                  + Novo chamado
                </Link>
              </Button>
            </div>
            {!tickets || tickets.length === 0 ? (
              <EmptyState
                icon={TicketIcon}
                title="Nenhum chamado registrado"
                description="Este cliente ainda não abriu chamados."
                action={
                  <Button asChild size="sm">
                    <Link to={`/tickets/new?client=${client.id}`}>Abrir primeiro chamado</Link>
                  </Button>
                }
              />
            ) : (
              <div className="-mx-2 divide-y divide-border">
                {tickets.map((t) => (
                  <Link
                    key={t.id}
                    to={`/tickets/${t.id}`}
                    className="block rounded-md px-2 py-3 transition-colors hover:bg-surface-muted"
                  >
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[11px] text-muted-foreground">#{t.ticket_number}</span>
                      <PriorityBadge priority={t.priority} />
                      <StatusBadge status={t.status} />
                      <span className="ml-auto text-[11px] text-muted-foreground">{timeAgo(t.created_at)}</span>
                    </div>
                    <p className="truncate text-sm">{t.title}</p>
                  </Link>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>

        {/* ============ FINANCEIRO ============ */}
        <TabsContent value="financeiro" className="m-0 space-y-4">
          {!hasRh && !hasVr ? (
            <Card className="p-5">
              <EmptyState
                icon={DollarSign}
                title="Sem produto contratado"
                description="Adicione um produto (RH Digital ou VR Benefícios) ao cliente para acompanhar o financeiro."
                action={
                  <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
                    Editar cliente
                  </Button>
                }
              />
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {hasRh && (
                <Card className="p-5">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-semibold">RH Digital</h3>
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
                      <Button asChild size="sm" variant="outline">
                        <Link to="/financeiro">+ Criar contrato RH Digital</Link>
                      </Button>
                    </div>
                  )}
                </Card>
              )}

              {hasVr && (
                <Card className="p-5">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-semibold">VR Benefícios</h3>
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
                </Card>
              )}
            </div>
          )}
        </TabsContent>

        {/* ============ ONBOARDING ============ */}
        <TabsContent value="onboarding" className="m-0">
          <Card className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-base font-semibold">
                <Rocket className="h-4 w-4" /> Onboarding
              </h2>
            </div>
            {!implantacao ? (
              <EmptyState
                icon={Rocket}
                title="Onboarding ainda não iniciado"
                description="Inicie o processo de implantação para este cliente."
                action={
                  <Button
                    onClick={() => setOnboardingOpen(true)}
                    className="bg-gradient-brand text-primary-foreground hover:opacity-90"
                  >
                    <Rocket className="mr-1.5 h-4 w-4" /> Iniciar onboarding
                  </Button>
                }
              />
            ) : (
              <div className="space-y-4">
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
                <dl className="grid grid-cols-2 gap-4 border-t border-border pt-4 text-sm">
                  <div>
                    <dt className="text-xs text-muted-foreground">Data de início</dt>
                    <dd className="font-medium">
                      {implantacao.data_inicio ? formatBrazilDate(implantacao.data_inicio) : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Go-live previsto</dt>
                    <dd className="font-medium">
                      {implantacao.data_go_live ? formatBrazilDate(implantacao.data_go_live) : "—"}
                    </dd>
                  </div>
                </dl>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button asChild variant="outline" size="sm">
                    <Link to={`/implantacao?id=${implantacao.id}`}>
                      <ExternalLink className="mr-1.5 h-3.5 w-3.5" /> Abrir implantação
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
        </TabsContent>
      </Tabs>
    </div>
  );
}
