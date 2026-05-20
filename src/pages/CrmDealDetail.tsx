import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus, Pencil, Trash2, MessageCircle, Mail, Phone, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { fmtBRL, ATIVIDADE_TIPOS, ETIQUETA_OPTIONS, STAGE_LABELS, PAPEL_OPTIONS } from "@/lib/crmOptions";
import { ActivityDialog } from "@/components/crm/ActivityDialog";
import { ContactDialog } from "@/components/crm/ContactDialog";
import { DealDialog } from "@/components/crm/DealDialog";
import { formatBrazilDate, timeAgo } from "@/lib/formatters";

export default function CrmDealDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [activityOpen, setActivityOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<any>(null);
  const [contactOpen, setContactOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<any>(null);
  const [dealDialogOpen, setDealDialogOpen] = useState(false);

  const { data: deal, isLoading } = useQuery({
    queryKey: ["deal", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("deals").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: activities = [] } = useQuery({
    queryKey: ["deal-activities", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("deal_activities").select("*").eq("deal_id", id).order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!id,
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ["deal-contacts", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("deal_contacts").select("*").eq("deal_id", id).order("created_at");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!id,
  });

  const { data: history = [] } = useQuery({
    queryKey: ["deal-history", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("deal_history").select("*").eq("deal_id", id).order("changed_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!id,
  });

  const markDone = useMutation({
    mutationFn: async ({ actId, resultado }: { actId: string; resultado: string }) => {
      const { error } = await supabase.from("deal_activities").update({ status: "realizada", realizado_em: new Date().toISOString(), resultado }).eq("id", actId);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["deal-activities", id] }); toast.success("Atividade marcada como realizada"); },
  });

  const deleteActivity = useMutation({
    mutationFn: async (actId: string) => {
      const { error } = await supabase.from("deal_activities").delete().eq("id", actId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["deal-activities", id] }),
  });

  const deleteContact = useMutation({
    mutationFn: async (cId: string) => {
      const { error } = await supabase.from("deal_contacts").delete().eq("id", cId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["deal-contacts", id] }),
  });

  if (isLoading) return <div className="p-6">Carregando...</div>;
  if (!deal) return <div className="p-6">Negócio não encontrado.</div>;

  const etiq = ETIQUETA_OPTIONS.find((e) => e.value === deal.etiqueta);
  const proximaAtividade = activities.filter((a: any) => a.status === "pendente" && a.agendado_para).sort((a: any, b: any) => new Date(a.agendado_para).getTime() - new Date(b.agendado_para).getTime())[0];

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b bg-background px-6 py-3">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="icon" onClick={() => navigate("/crm/pipeline")}><ArrowLeft className="h-4 w-4" /></Button>
          <div className="min-w-0">
            <h1 className="text-lg font-semibold truncate">{deal.company_name}</h1>
            <p className="text-xs text-muted-foreground truncate">{deal.title}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge>{STAGE_LABELS[deal.stage]}</Badge>
          <Button size="sm" variant="outline" onClick={() => setDealDialogOpen(true)}><Pencil className="h-3.5 w-3.5" /> Editar</Button>
        </div>
      </div>

      <Tabs defaultValue="overview" className="flex-1 overflow-hidden flex flex-col">
        <TabsList className="mx-6 mt-3 self-start">
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="data">Dados do Deal</TabsTrigger>
          <TabsTrigger value="contacts">Contatos</TabsTrigger>
          <TabsTrigger value="history">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="flex-1 overflow-y-auto p-6">
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold">Timeline de atividades</h2>
                <Button size="sm" onClick={() => { setEditingActivity(null); setActivityOpen(true); }}><Plus className="h-3.5 w-3.5" /> Nova atividade</Button>
              </div>
              {activities.length === 0 ? (
                <Card className="p-6 text-center text-sm text-muted-foreground">Nenhuma atividade ainda</Card>
              ) : (
                activities.map((a: any) => {
                  const tipo = ATIVIDADE_TIPOS.find((t) => t.value === a.tipo);
                  return (
                    <Card key={a.id} className="p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2 min-w-0">
                          <span className="text-xl">{tipo?.emoji}</span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-sm">{a.titulo}</span>
                              <Badge variant={a.status === "realizada" ? "default" : a.status === "pendente" ? "outline" : "secondary"} className="text-[10px]">{a.status}</Badge>
                              {a.prioridade === "alta" && <Badge variant="destructive" className="text-[10px]">Alta</Badge>}
                            </div>
                            {a.agendado_para && <div className="text-xs text-muted-foreground">📅 {new Date(a.agendado_para).toLocaleString("pt-BR")}</div>}
                            {a.descricao && <div className="text-xs text-muted-foreground mt-1">{a.descricao}</div>}
                            {a.resultado && <div className="text-xs mt-1 p-2 bg-muted rounded"><strong>Resultado:</strong> {a.resultado}</div>}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          {a.status === "pendente" && (
                            <Button size="sm" variant="ghost" onClick={() => {
                              const r = window.prompt("Resultado da atividade:");
                              if (r !== null) markDone.mutate({ actId: a.id, resultado: r });
                            }} title="Marcar realizada"><CheckCircle2 className="h-4 w-4" /></Button>
                          )}
                          <Button size="sm" variant="ghost" onClick={() => { setEditingActivity(a); setActivityOpen(true); }}><Pencil className="h-3.5 w-3.5" /></Button>
                          <Button size="sm" variant="ghost" onClick={() => confirm("Excluir?") && deleteActivity.mutate(a.id)} className="text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
                        </div>
                      </div>
                    </Card>
                  );
                })
              )}
            </div>

            <div className="space-y-3">
              {proximaAtividade && (
                <Card className="p-3 border-primary/40 bg-primary/5">
                  <div className="text-xs font-semibold text-primary uppercase tracking-wide">Próxima atividade</div>
                  <div className="text-sm font-medium mt-1">{proximaAtividade.titulo}</div>
                  <div className="text-xs text-muted-foreground">{new Date(proximaAtividade.agendado_para).toLocaleString("pt-BR")}</div>
                </Card>
              )}
              <Card className="p-3 space-y-2 text-sm">
                <Row label="Valor" value={fmtBRL(deal.value)} />
                <Row label="Produto" value={deal.product || "—"} />
                <Row label="Plano" value={deal.plano_contratado || "—"} />
                <Row label="Etapa" value={STAGE_LABELS[deal.stage]} />
                <Row label="Probabilidade" value={deal.probabilidade || "—"} />
                <Row label="Etiqueta" value={etiq ? `${etiq.emoji} ${etiq.label}` : "—"} />
                {deal.expected_close_date && <Row label="Fecha em" value={formatBrazilDate(deal.expected_close_date)} />}
              </Card>
              {deal.notes && (
                <Card className="p-3 text-sm">
                  <div className="text-xs font-semibold text-muted-foreground uppercase mb-1">Notas</div>
                  <p className="whitespace-pre-wrap">{deal.notes}</p>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="data" className="flex-1 overflow-y-auto p-6">
          <div className="grid gap-4 md:grid-cols-2 max-w-4xl">
            <Section title="Produto e contrato">
              <Row label="Produto" value={deal.product || "—"} />
              <Row label="Plano" value={deal.plano_contratado || "—"} />
              <Row label="Extensões" value={(deal.extensoes || []).join(", ") || "—"} />
              <Row label="Faixa colaboradores" value={deal.faixa_colaboradores || "—"} />
              <Row label="Quem implanta" value={deal.quem_implanta || "—"} />
            </Section>
            <Section title="Origem">
              <Row label="Canal de origem" value={deal.canal_origem || "—"} />
              <Row label="Origem do lead" value={deal.origem_lead || "—"} />
              <Row label="Fonte indicação" value={deal.fonte_indicacao || "—"} />
              <Row label="Estado" value={deal.estado || "—"} />
              <Row label="Segmento" value={deal.segmento || "—"} />
            </Section>
            <Section title="Gerais">
              <Row label="Valor" value={fmtBRL(deal.value)} />
              <Row label="Criado em" value={formatBrazilDate(deal.created_at)} />
              <Row label="Fechamento previsto" value={deal.expected_close_date ? formatBrazilDate(deal.expected_close_date) : "—"} />
              {deal.won_at && <Row label="Ganho em" value={formatBrazilDate(deal.won_at)} />}
              {deal.lost_at && <Row label="Perdido em" value={formatBrazilDate(deal.lost_at)} />}
              {deal.motivo_perda && <Row label="Motivo perda" value={deal.motivo_perda} />}
            </Section>
          </div>
          <Button className="mt-4" onClick={() => setDealDialogOpen(true)}><Pencil className="h-3.5 w-3.5" /> Editar dados</Button>
        </TabsContent>

        <TabsContent value="contacts" className="flex-1 overflow-y-auto p-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold">Contatos vinculados</h2>
            <Button size="sm" onClick={() => { setEditingContact(null); setContactOpen(true); }}><Plus className="h-3.5 w-3.5" /> Adicionar contato</Button>
          </div>
          {contacts.length === 0 ? (
            <Card className="p-6 text-center text-sm text-muted-foreground">Nenhum contato</Card>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {contacts.map((c: any) => {
                const papel = PAPEL_OPTIONS.find((p) => p.value === c.papel);
                return (
                  <Card key={c.id} className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-medium text-sm">{c.nome}</div>
                        {c.cargo && <div className="text-xs text-muted-foreground">{c.cargo}</div>}
                        {papel && <Badge variant="outline" className="text-[10px] mt-1">{papel.label}</Badge>}
                        <div className="mt-2 space-y-1 text-xs">
                          {c.email && <a href={`mailto:${c.email}`} className="flex items-center gap-1 text-muted-foreground hover:text-primary"><Mail className="h-3 w-3" /> {c.email}</a>}
                          {c.telefone && <div className="flex items-center gap-1 text-muted-foreground"><Phone className="h-3 w-3" /> {c.telefone}</div>}
                          {c.whatsapp && (
                            <a href={`https://wa.me/${c.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-emerald-600 hover:underline">
                              <MessageCircle className="h-3 w-3" /> WhatsApp
                            </a>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col gap-1">
                        <Button size="sm" variant="ghost" onClick={() => { setEditingContact(c); setContactOpen(true); }}><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => confirm("Excluir?") && deleteContact.mutate(c.id)} className="text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="history" className="flex-1 overflow-y-auto p-6">
          <h2 className="text-sm font-semibold mb-3">Histórico de alterações</h2>
          {history.length === 0 ? (
            <Card className="p-6 text-center text-sm text-muted-foreground">Sem registros</Card>
          ) : (
            <div className="space-y-2">
              {history.map((h: any) => (
                <Card key={h.id} className="p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <strong>{h.campo}</strong>: <span className="text-muted-foreground">{h.valor_antigo || "—"}</span> → <span>{h.valor_novo || "—"}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{timeAgo(h.changed_at)}</span>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <ActivityDialog open={activityOpen} onOpenChange={setActivityOpen} dealId={id} clientId={deal.client_id} activity={editingActivity} onSaved={() => qc.invalidateQueries({ queryKey: ["deal-activities", id] })} />
      <ContactDialog open={contactOpen} onOpenChange={setContactOpen} dealId={id} clientId={deal.client_id} contact={editingContact} onSaved={() => qc.invalidateQueries({ queryKey: ["deal-contacts", id] })} />
      <DealDialog open={dealDialogOpen} onOpenChange={setDealDialogOpen} deal={deal as any} onSaved={() => qc.invalidateQueries({ queryKey: ["deal", id] })} />
    </div>
  );
}

function Row({ label, value }: { label: string; value: any }) {
  return <div className="flex justify-between gap-2 text-sm"><span className="text-muted-foreground">{label}</span><span className="font-medium text-right">{value}</span></div>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">{title}</h3>
      <div className="space-y-2">{children}</div>
    </Card>
  );
}
