import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Loader2, Plus, Pencil, Power, Trash2, ChevronDown, ChevronRight, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { formatPercent } from "@/lib/formatters";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ClientCombobox, type ClientOption } from "./ClientCombobox";
import { BRL, formatBRDate } from "./financeiroUtils";

type Parceiro = {
  id: string;
  nome: string;
  contato: string | null;
  ativo: boolean;
  observacoes: string | null;
  percentual_vr: number;
  percentual_rh_tipo: "primeira_mensalidade" | "recorrencia";
  percentual_rh: number;
};
type Config = {
  id: string;
  parceiro_id: string;
  client_id: string;
  produto: "rh_digital" | "vr_beneficios";
  tipo_repasse: "primeira_mensalidade" | "recorrencia" | "primeira_carga_vr";
  percentual: number;
  ativo: boolean;
};
type Repasse = {
  id: string;
  parceiro_id: string;
  parceiro_nome: string;
  client_id: string | null;
  cliente_nome: string;
  produto: "rh_digital" | "vr_beneficios";
  tipo_repasse: Config["tipo_repasse"];
  percentual: number;
  valor_base: number;
  valor_repasse: number;
  competencia: string;
  status: "pendente" | "pago";
  data_pagamento: string | null;
};

const TIPO_LABEL: Record<string, string> = {
  primeira_mensalidade: "Primeira mensalidade",
  recorrencia: "Recorrente",
  primeira_carga_vr: "Primeira carga",
};
const PRODUTO_LABEL: Record<string, string> = {
  rh_digital: "RH Digital",
  vr_beneficios: "VR Benefícios",
};

export function ParceirosTab() {
  const qc = useQueryClient();
  const [openNovo, setOpenNovo] = useState(false);
  const [editingParceiro, setEditingParceiro] = useState<Parceiro | null>(null);
  const [vincularFor, setVincularFor] = useState<Parceiro | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  // filters for repasses
  const [fParceiro, setFParceiro] = useState<string>("all");
  const [fProduto, setFProduto] = useState<string>("all");
  const [fStatus, setFStatus] = useState<string>("all");

  const { data: parceiros = [] } = useQuery({
    queryKey: ["parceiros"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("parceiros")
        .select("id, nome, contato, ativo, observacoes, percentual_vr, percentual_rh_tipo, percentual_rh")
        .order("nome");
      if (error) throw error;
      return (data ?? []) as Parceiro[];
    },
  });

  const { data: configs = [] } = useQuery({
    queryKey: ["configuracoes_parceiro"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("configuracoes_parceiro")
        .select("id, parceiro_id, client_id, produto, tipo_repasse, percentual, ativo");
      if (error) throw error;
      return (data ?? []) as Config[];
    },
  });

  const { data: repasses = [] } = useQuery({
    queryKey: ["repasses_parceiro"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("repasses_parceiro")
        .select("id, parceiro_id, parceiro_nome, client_id, cliente_nome, produto, tipo_repasse, percentual, valor_base, valor_repasse, competencia, status, data_pagamento")
        .order("competencia", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Repasse[];
    },
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["clients-min"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("id, name").order("name");
      if (error) throw error;
      return (data ?? []) as { id: string; name: string }[];
    },
  });
  const clientName = (id: string | null) => clients.find((c) => c.id === id)?.name ?? "—";

  const totalsByParceiro = useMemo(() => {
    const map: Record<string, { pendente: number; pago: number; clientes: Set<string> }> = {};
    for (const r of repasses) {
      if (!map[r.parceiro_id]) map[r.parceiro_id] = { pendente: 0, pago: 0, clientes: new Set() };
      if (r.client_id) map[r.parceiro_id].clientes.add(r.client_id);
      if (r.status === "pago") map[r.parceiro_id].pago += Number(r.valor_repasse);
      else map[r.parceiro_id].pendente += Number(r.valor_repasse);
    }
    for (const c of configs) {
      if (!map[c.parceiro_id]) map[c.parceiro_id] = { pendente: 0, pago: 0, clientes: new Set() };
      map[c.parceiro_id].clientes.add(c.client_id);
    }
    return map;
  }, [repasses, configs]);

  const totalPendenteGeral = useMemo(
    () => repasses.filter((r) => r.status === "pendente").reduce((a, b) => a + Number(b.valor_repasse), 0),
    [repasses],
  );
  const ativos = parceiros.filter((p) => p.ativo).length;

  const filteredRepasses = useMemo(
    () =>
      repasses.filter(
        (r) =>
          (fParceiro === "all" || r.parceiro_id === fParceiro) &&
          (fProduto === "all" || r.produto === fProduto) &&
          (fStatus === "all" || r.status === fStatus),
      ),
    [repasses, fParceiro, fProduto, fStatus],
  );
  const totFiltradoPend = filteredRepasses.filter((r) => r.status === "pendente").reduce((a, b) => a + Number(b.valor_repasse), 0);
  const totFiltradoPago = filteredRepasses.filter((r) => r.status === "pago").reduce((a, b) => a + Number(b.valor_repasse), 0);

  const toggleAtivo = useMutation({
    mutationFn: async (p: Parceiro) => {
      const { error } = await supabase.from("parceiros").update({ ativo: !p.ativo }).eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Parceiro atualizado.");
      qc.invalidateQueries({ queryKey: ["parceiros"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const removerConfig = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("configuracoes_parceiro").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Vínculo removido.");
      qc.invalidateQueries({ queryKey: ["configuracoes_parceiro"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const removerRepasse = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("repasses_parceiro").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Repasse removido.");
      qc.invalidateQueries({ queryKey: ["repasses_parceiro"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const [confirmingPay, setConfirmingPay] = useState<Repasse | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{ativos}</span> parceiros ativos •{" "}
          <span className="font-medium text-foreground">{BRL.format(totalPendenteGeral)}</span> em repasses pendentes
        </div>
        <Button onClick={() => { setEditingParceiro(null); setOpenNovo(true); }}>
          <Plus className="mr-2 h-4 w-4" /> Novo parceiro
        </Button>
      </div>

      <div className="grid gap-3">
        {parceiros.length === 0 && (
          <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">Nenhum parceiro cadastrado ainda.</CardContent></Card>
        )}
        {parceiros.map((p) => {
          const t = totalsByParceiro[p.id] ?? { pendente: 0, pago: 0, clientes: new Set() };
          const isOpen = !!expanded[p.id];
          const parceiroConfigs = configs.filter((c) => c.parceiro_id === p.id);
          const ultimoRepasse = (clientId: string) =>
            repasses.find((r) => r.parceiro_id === p.id && r.client_id === clientId);

          return (
            <Card key={p.id}>
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex flex-col gap-1">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      {p.nome}
                      <Badge variant={p.ativo ? "default" : "secondary"}>{p.ativo ? "Ativo" : "Inativo"}</Badge>
                    </CardTitle>
                    {p.contato && <div className="text-xs text-muted-foreground">{p.contato}</div>}
                    <div className="text-xs text-muted-foreground">
                      VR: {formatPercent(p.percentual_vr)} ·{" "}
                      RH: {p.percentual_rh_tipo === "primeira_mensalidade"
                        ? "Primeira mensalidade (100%)"
                        : `${formatPercent(p.percentual_rh)} recorrência`}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => setVincularFor(p)}>
                      <UserPlus className="mr-2 h-3.5 w-3.5" /> Vincular cliente
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => { setEditingParceiro(p); setOpenNovo(true); }}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => toggleAtivo.mutate(p)}>
                      <Power className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div className="rounded-md border bg-muted/30 p-2 text-center">
                    <div className="text-xs text-muted-foreground">Clientes</div>
                    <div className="font-semibold">{t.clientes.size}</div>
                  </div>
                  <div className="rounded-md border bg-muted/30 p-2 text-center">
                    <div className="text-xs text-muted-foreground">Repasses pagos</div>
                    <div className="font-semibold tabular-nums">{BRL.format(t.pago)}</div>
                  </div>
                  <div className="rounded-md border bg-muted/30 p-2 text-center">
                    <div className="text-xs text-muted-foreground">Repasses pendentes</div>
                    <div className="font-semibold tabular-nums">{BRL.format(t.pendente)}</div>
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8"
                  onClick={() => setExpanded((s) => ({ ...s, [p.id]: !s[p.id] }))}
                >
                  {isOpen ? <ChevronDown className="mr-1 h-4 w-4" /> : <ChevronRight className="mr-1 h-4 w-4" />}
                  {isOpen ? "Ocultar detalhes" : "Ver detalhes"}
                </Button>

                {isOpen && (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Cliente</TableHead>
                          <TableHead>Produto</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead className="text-right">%</TableHead>
                          <TableHead>Último repasse</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {parceiroConfigs.length === 0 && (
                          <TableRow><TableCell colSpan={6} className="text-center text-xs text-muted-foreground">Nenhum cliente vinculado.</TableCell></TableRow>
                        )}
                        {parceiroConfigs.map((c) => {
                          const ult = ultimoRepasse(c.client_id);
                          return (
                            <TableRow key={c.id}>
                              <TableCell>{clientName(c.client_id)}</TableCell>
                              <TableCell>{PRODUTO_LABEL[c.produto]}</TableCell>
                              <TableCell>{TIPO_LABEL[c.tipo_repasse]}</TableCell>
                              <TableCell className="text-right tabular-nums">{formatPercent(c.percentual)}</TableCell>
                              <TableCell>
                                {ult ? (
                                  <Badge variant={ult.status === "pago" ? "default" : "secondary"}>
                                    {ult.status === "pago" ? "Pago" : "Pendente"} • {formatBRDate(ult.competencia)}
                                  </Badge>
                                ) : (
                                  <span className="text-xs text-muted-foreground">—</span>
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                <Button size="icon" variant="ghost" onClick={() => removerConfig.mutate(c.id)}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* REPASSES */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Repasses</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Select value={fParceiro} onValueChange={setFParceiro}>
              <SelectTrigger className="w-[200px]"><SelectValue placeholder="Parceiro" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos parceiros</SelectItem>
                {parceiros.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={fProduto} onValueChange={setFProduto}>
              <SelectTrigger className="w-[170px]"><SelectValue placeholder="Produto" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos produtos</SelectItem>
                <SelectItem value="rh_digital">RH Digital</SelectItem>
                <SelectItem value="vr_beneficios">VR Benefícios</SelectItem>
              </SelectContent>
            </Select>
            <Select value={fStatus} onValueChange={setFStatus}>
              <SelectTrigger className="w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos status</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="pago">Pago</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Parceiro</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">%</TableHead>
                  <TableHead className="text-right">Base</TableHead>
                  <TableHead className="text-right">Repasse</TableHead>
                  <TableHead>Competência</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRepasses.length === 0 && (
                  <TableRow><TableCell colSpan={10} className="text-center text-xs text-muted-foreground">Nenhum repasse.</TableCell></TableRow>
                )}
                {filteredRepasses.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.parceiro_nome}</TableCell>
                    <TableCell>{r.cliente_nome}</TableCell>
                    <TableCell>{PRODUTO_LABEL[r.produto]}</TableCell>
                    <TableCell>{TIPO_LABEL[r.tipo_repasse]}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatPercent(r.percentual)}</TableCell>
                    <TableCell className="text-right tabular-nums">{BRL.format(Number(r.valor_base))}</TableCell>
                    <TableCell className="text-right tabular-nums font-medium">{BRL.format(Number(r.valor_repasse))}</TableCell>
                    <TableCell>{formatBRDate(r.competencia)}</TableCell>
                    <TableCell>
                      <Badge
                        className={r.status === "pago" ? "bg-emerald-600 text-white hover:bg-emerald-600/90" : "bg-amber-500 text-white hover:bg-amber-500/90"}
                      >
                        {r.status === "pago" ? "Pago" : "Pendente"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {r.status === "pendente" && (
                          <Button size="sm" variant="outline" onClick={() => setConfirmingPay(r)}>
                            Confirmar pagamento
                          </Button>
                        )}
                        <Button size="icon" variant="ghost" onClick={() => {
                          if (confirm("Excluir este repasse?")) removerRepasse.mutate(r.id);
                        }}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-4 text-sm">
            <div>Pendente: <span className="font-semibold tabular-nums">{BRL.format(totFiltradoPend)}</span></div>
            <div>Pago: <span className="font-semibold tabular-nums">{BRL.format(totFiltradoPago)}</span></div>
            <div>Total: <span className="font-semibold tabular-nums">{BRL.format(totFiltradoPend + totFiltradoPago)}</span></div>
          </div>
        </CardContent>
      </Card>

      <ParceiroDialog
        open={openNovo}
        onOpenChange={setOpenNovo}
        parceiro={editingParceiro}
      />
      <VincularClienteDialog
        open={!!vincularFor}
        onOpenChange={(v) => !v && setVincularFor(null)}
        parceiro={vincularFor}
      />
      <ConfirmarRepasseDialog
        repasse={confirmingPay}
        onOpenChange={(v) => !v && setConfirmingPay(null)}
      />
    </div>
  );
}

/* ---------- Sub-dialogs ---------- */

function ParceiroDialog({
  open, onOpenChange, parceiro,
}: { open: boolean; onOpenChange: (v: boolean) => void; parceiro: Parceiro | null }) {
  const qc = useQueryClient();
  const [nome, setNome] = useState("");
  const [contato, setContato] = useState("");
  const [obs, setObs] = useState("");
  const [pctVr, setPctVr] = useState<string>("0");
  const [rhTipo, setRhTipo] = useState<"primeira_mensalidade" | "recorrencia">("primeira_mensalidade");
  const [pctRh, setPctRh] = useState<string>("0");

  useMemo(() => {
    if (open) {
      setNome(parceiro?.nome ?? "");
      setContato(parceiro?.contato ?? "");
      setObs(parceiro?.observacoes ?? "");
      setPctVr(parceiro ? String(parceiro.percentual_vr ?? 0) : "0");
      setRhTipo(parceiro?.percentual_rh_tipo ?? "primeira_mensalidade");
      setPctRh(parceiro ? String(parceiro.percentual_rh ?? 0) : "0");
    }
  }, [open, parceiro]);

  const vrNum = Number(pctVr || 0);
  const rhNum = Number(pctRh || 0);
  const vrInvalid = isNaN(vrNum) || vrNum < 0 || vrNum > 50;
  const rhInvalid = rhTipo === "recorrencia" && (isNaN(rhNum) || rhNum < 0 || rhNum > 10);

  const save = useMutation({
    mutationFn: async () => {
      if (!nome.trim()) throw new Error("Nome é obrigatório");
      if (vrInvalid) throw new Error("% VR Benefícios deve estar entre 0 e 50.");
      if (rhInvalid) throw new Error("% RH Digital recorrência deve estar entre 0 e 10.");
      const payload = {
        nome: nome.trim(),
        contato: contato.trim() || null,
        observacoes: obs.trim() || null,
        percentual_vr: vrNum,
        percentual_rh_tipo: rhTipo,
        percentual_rh: rhTipo === "recorrencia" ? rhNum : 0,
      };
      if (parceiro) {
        const { error } = await supabase.from("parceiros").update(payload).eq("id", parceiro.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("parceiros").insert({ ...payload, ativo: true });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(parceiro ? "Parceiro atualizado." : "Parceiro criado.");
      qc.invalidateQueries({ queryKey: ["parceiros"] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{parceiro ? "Editar parceiro" : "Novo parceiro"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="grid gap-1.5">
            <Label>Nome *</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label>Contato</Label>
            <Input placeholder="Telefone ou e-mail" value={contato} onChange={(e) => setContato(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label>Observações</Label>
            <Textarea rows={2} value={obs} onChange={(e) => setObs(e.target.value)} />
          </div>

          <div className="rounded-md border p-3 space-y-3">
            <div className="text-sm font-medium">Comissões do parceiro</div>

            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground">RH Digital</div>
              <div className="grid gap-1.5">
                <Label>Tipo de repasse</Label>
                <Select value={rhTipo} onValueChange={(v) => setRhTipo(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="primeira_mensalidade">Primeira mensalidade — repasse único de 100%</SelectItem>
                    <SelectItem value="recorrencia">Recorrência — % mensal (máx. 10%)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {rhTipo === "recorrencia" ? (
                <div className="grid gap-1.5">
                  <Label>% recorrência RH Digital</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min={0}
                    max={10}
                    placeholder="Ex: 5"
                    value={pctRh}
                    onChange={(e) => setPctRh(e.target.value)}
                  />
                  {rhInvalid && (
                    <p className="text-xs text-destructive">Valor deve estar entre 0 e 10%.</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Repasse mensal enquanto o cliente estiver ativo.
                  </p>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  100% da primeira mensalidade — pagamento único.
                </p>
              )}
            </div>

            <div className="space-y-2 pt-2 border-t">
              <div className="text-xs font-medium text-muted-foreground">VR Benefícios</div>
              <div className="grid gap-1.5">
                <Label>% sobre primeira carga</Label>
                <Input
                  type="number"
                  step="0.01"
                  min={0}
                  max={50}
                  placeholder="Ex: 17.5"
                  value={pctVr}
                  onChange={(e) => setPctVr(e.target.value)}
                />
                {vrInvalid && (
                  <p className="text-xs text-destructive">Valor deve estar entre 0 e 50%.</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Repasse único sobre a comissão da primeira carga.
                </p>
              </div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || !nome.trim() || vrInvalid || rhInvalid}>
            {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function VincularClienteDialog({
  open, onOpenChange, parceiro, defaultClient,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  parceiro: Parceiro | null;
  defaultClient?: ClientOption | null;
}) {
  const qc = useQueryClient();
  const [client, setClient] = useState<ClientOption | null>(defaultClient ?? null);
  const [produto, setProduto] = useState<"rh_digital" | "vr_beneficios">("rh_digital");
  const [tipo, setTipo] = useState<"primeira_mensalidade" | "recorrencia" | "primeira_carga_vr">("primeira_mensalidade");
  const [percentual, setPercentual] = useState<string>("100");
  const [usouPadrao, setUsouPadrao] = useState(true);

  const applyPadrao = (
    p: "rh_digital" | "vr_beneficios",
    t: "primeira_mensalidade" | "recorrencia" | "primeira_carga_vr",
  ) => {
    if (!parceiro) return;
    if (p === "vr_beneficios") {
      setPercentual(String(parceiro.percentual_vr ?? 0));
    } else if (t === "recorrencia") {
      setPercentual(String(parceiro.percentual_rh ?? 0));
    } else {
      setPercentual("100");
    }
    setUsouPadrao(true);
  };

  useMemo(() => {
    if (open && parceiro) {
      setClient(defaultClient ?? null);
      setProduto("rh_digital");
      const t = parceiro.percentual_rh_tipo ?? "primeira_mensalidade";
      setTipo(t);
      setPercentual(t === "recorrencia" ? String(parceiro.percentual_rh ?? 0) : "100");
      setUsouPadrao(true);
    }
  }, [open, parceiro, defaultClient]);

  const handleProduto = (p: "rh_digital" | "vr_beneficios") => {
    setProduto(p);
    if (p === "vr_beneficios") {
      setTipo("primeira_carga_vr");
      applyPadrao(p, "primeira_carga_vr");
    } else {
      const t = parceiro?.percentual_rh_tipo ?? "primeira_mensalidade";
      setTipo(t);
      applyPadrao(p, t);
    }
  };
  const handleTipo = (t: typeof tipo) => {
    setTipo(t);
    applyPadrao(produto, t);
  };

  // preview valor
  const { data: previewBase = 0 } = useQuery({
    queryKey: ["preview-base", client?.id, produto],
    enabled: !!client?.id,
    queryFn: async () => {
      if (!client?.id) return 0;
      if (produto === "rh_digital") {
        const { data } = await supabase
          .from("parcelas_rh_digital")
          .select("valor_nortear")
          .eq("client_id", client.id)
          .order("competencia", { ascending: true })
          .limit(1)
          .maybeSingle();
        return Number((data as any)?.valor_nortear ?? 0);
      } else {
        const { data } = await supabase
          .from("lancamentos_vr")
          .select("valor_comissao")
          .eq("client_id", client.id)
          .eq("tipo", "primeira_carga")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        return Number((data as any)?.valor_comissao ?? 0);
      }
    },
  });
  const preview = previewBase * (Number(percentual || 0) / 100);
  const semBase = previewBase === 0;

  // limites por tipo
  const maxPct = tipo === "primeira_carga_vr" ? 50 : tipo === "recorrencia" ? 10 : 100;
  const isFixoPrimeiraMensalidade = produto === "rh_digital" && tipo === "primeira_mensalidade";

  const save = useMutation({
    mutationFn: async () => {
      if (!parceiro || !client) throw new Error("Selecione cliente e parceiro");
      const pct = isFixoPrimeiraMensalidade ? 100 : Number(percentual);
      if (isNaN(pct) || pct < 0) throw new Error("Percentual inválido");
      if (pct > maxPct) {
        throw new Error(
          tipo === "primeira_carga_vr"
            ? "Percentual máximo para VR Benefícios é 50%."
            : tipo === "recorrencia"
            ? "Percentual máximo para recorrência RH Digital é 10%."
            : "Percentual inválido.",
        );
      }
      const { error } = await supabase.from("configuracoes_parceiro").upsert({
        parceiro_id: parceiro.id,
        client_id: client.id,
        produto,
        tipo_repasse: tipo,
        percentual: pct,
        ativo: true,
      }, { onConflict: "parceiro_id,client_id,produto,tipo_repasse" });
      if (error) throw error;
      await supabase.from("clients").update({ parceiro_id: parceiro.id }).eq("id", client.id);
    },
    onSuccess: () => {
      toast.success("Cliente vinculado ao parceiro.");
      qc.invalidateQueries({ queryKey: ["configuracoes_parceiro"] });
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["client", client?.id] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const pctNum = isFixoPrimeiraMensalidade ? 100 : Number(percentual || 0);
  const pctInvalid = !isFixoPrimeiraMensalidade && (isNaN(pctNum) || pctNum < 0 || pctNum > maxPct);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Vincular cliente ao parceiro</DialogTitle>
          {parceiro && <DialogDescription>{parceiro.nome}</DialogDescription>}
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="grid gap-1.5">
            <Label>Cliente *</Label>
            {defaultClient ? (
              <Input value={defaultClient.name} disabled />
            ) : (
              <ClientCombobox value={client?.id ?? null} onSelect={(c) => setClient(c)} />
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Produto *</Label>
              <Select value={produto} onValueChange={(v) => handleProduto(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="rh_digital">RH Digital</SelectItem>
                  <SelectItem value="vr_beneficios">VR Benefícios</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Tipo de repasse *</Label>
              <Select
                value={tipo}
                onValueChange={(v) => handleTipo(v as any)}
                disabled={produto === "vr_beneficios"}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {produto === "rh_digital" ? (
                    <>
                      <SelectItem value="primeira_mensalidade">Primeira mensalidade (100% — único)</SelectItem>
                      <SelectItem value="recorrencia">Recorrência mensal (máx. 10%)</SelectItem>
                    </>
                  ) : (
                    <SelectItem value="primeira_carga_vr">Primeira carga (máx. 50%)</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          {isFixoPrimeiraMensalidade ? (
            <div className="grid gap-1.5">
              <Label>Percentual</Label>
              <Input type="number" value={100} disabled />
              <p className="text-xs text-muted-foreground">
                100% da primeira mensalidade — repasse único, não editável.
              </p>
            </div>
          ) : (
            <div className="grid gap-1.5">
              <Label>
                {tipo === "primeira_carga_vr"
                  ? "% sobre primeira carga (máx. 50%) *"
                  : "% mensal de recorrência (máx. 10%) *"}
              </Label>
              <Input
                type="number"
                step="0.01"
                min={0}
                max={maxPct}
                value={percentual}
                onChange={(e) => { setPercentual(e.target.value); setUsouPadrao(false); }}
              />
              {usouPadrao && parceiro && (
                <p className="text-xs text-primary">
                  Padrão do parceiro — editável para este cliente.
                </p>
              )}
              {pctInvalid && (
                <p className="text-xs text-destructive">
                  Valor deve estar entre 0 e {maxPct}%.
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                {tipo === "primeira_carga_vr"
                  ? "O repasse ao parceiro é sobre a comissão da primeira carga recebida pela Nortear."
                  : "Repasse mensal enquanto o cliente estiver ativo."}
              </p>
            </div>
          )}

          <div className="rounded-md border bg-muted/40 p-3 text-sm">
            <div className="text-xs text-muted-foreground">
              {isFixoPrimeiraMensalidade
                ? "Repasse único"
                : tipo === "primeira_carga_vr"
                ? "Repasse estimado (primeira carga)"
                : "Repasse mensal estimado"}
            </div>
            <div className="text-lg font-semibold tabular-nums">{BRL.format(preview)}</div>
            <div className="text-xs text-muted-foreground">Base estimada: {BRL.format(previewBase)}</div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            onClick={() => save.mutate()}
            disabled={save.isPending || !client || !parceiro || pctInvalid}
          >
            {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar vínculo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


function ConfirmarRepasseDialog({
  repasse, onOpenChange,
}: { repasse: Repasse | null; onOpenChange: (v: boolean) => void }) {
  const qc = useQueryClient();
  const [data, setData] = useState(format(new Date(), "yyyy-MM-dd"));

  useMemo(() => { if (repasse) setData(format(new Date(), "yyyy-MM-dd")); }, [repasse]);

  const save = useMutation({
    mutationFn: async () => {
      if (!repasse) return;
      const { error } = await supabase.from("repasses_parceiro").update({
        status: "pago", data_pagamento: data,
      }).eq("id", repasse.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Repasse confirmado.");
      qc.invalidateQueries({ queryKey: ["repasses_parceiro"] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={!!repasse} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Confirmar pagamento de repasse</DialogTitle>
          {repasse && (
            <DialogDescription>
              {repasse.parceiro_nome} • {repasse.cliente_nome} • {BRL.format(Number(repasse.valor_repasse))}
            </DialogDescription>
          )}
        </DialogHeader>
        <div className="grid gap-1.5 py-2">
          <Label>Data de pagamento</Label>
          <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
