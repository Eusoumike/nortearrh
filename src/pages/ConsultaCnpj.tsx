import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Copy, Check, Loader2, Building2, MapPin, Phone, Users, History } from "lucide-react";
import { toast } from "sonner";
import { formatCnpj } from "@/lib/formatters";
import { formatBrazilDateTime } from "@/lib/formatters";

function onlyDigits(v: string) {
  return (v ?? "").replace(/\D/g, "");
}

function isValidCnpj(raw: string) {
  const cnpj = onlyDigits(raw);
  if (cnpj.length !== 14) return false;
  if (/^(\d)\1+$/.test(cnpj)) return false;
  const calc = (base: string, weights: number[]) => {
    const sum = weights.reduce((acc, w, i) => acc + parseInt(base[i], 10) * w, 0);
    const mod = sum % 11;
    return mod < 2 ? 0 : 11 - mod;
  };
  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const d1 = calc(cnpj.slice(0, 12), w1);
  const d2 = calc(cnpj.slice(0, 12) + d1, w2);
  return cnpj.endsWith(`${d1}${d2}`);
}

function maskCnpjInput(v: string) {
  const d = onlyDigits(v).slice(0, 14);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

function formatCurrency(v: any) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function CopyButton({ value, label }: { value: string | number | null | undefined; label?: string }) {
  const [copied, setCopied] = useState(false);
  const disabled = value === null || value === undefined || value === "" || value === "—";
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={async (e) => {
        e.stopPropagation();
        try {
          await navigator.clipboard.writeText(String(value));
          setCopied(true);
          toast.success(`${label ?? "Valor"} copiado`);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          toast.error("Falha ao copiar");
        }
      }}
      className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent"
      aria-label={`Copiar ${label ?? "valor"}`}
    >
      {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

function Field({ label, value, copyValue }: { label: string; value: React.ReactNode; copyValue?: string | null }) {
  const displayable = value === null || value === undefined || value === "" ? "—" : value;
  return (
    <div className="flex items-start justify-between gap-2 rounded-md border border-border/60 bg-card px-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-0.5 break-words text-sm font-medium">{displayable}</p>
      </div>
      <CopyButton value={copyValue ?? (typeof value === "string" || typeof value === "number" ? value : "")} label={label} />
    </div>
  );
}

function SectionHeader({ icon: Icon, title, copyAll }: { icon: any; title: string; copyAll?: string }) {
  return (
    <div className="mb-2 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      {copyAll && <CopyButton value={copyAll} label={`${title} (tudo)`} />}
    </div>
  );
}

export default function ConsultaCnpj() {
  const [input, setInput] = useState("");
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: recentes } = useQuery({
    queryKey: ["consultas-recentes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("consultas")
        .select("id, cnpj, razao_social, consultado_em, encontrado_no_pipedrive, acao")
        .order("consultado_em", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
  });

  const registrar = useMutation({
    mutationFn: async (payload: any) => {
      const { error } = await supabase.from("consultas").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["consultas-recentes"] }),
  });

  const consultar = async (raw?: string) => {
    const value = raw ?? input;
    const cnpj = onlyDigits(value);
    if (!isValidCnpj(cnpj)) {
      toast.error("CNPJ inválido — verifique os dígitos.");
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("consultar-cnpj", { body: { cnpj } });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const receita = (data as any).data;
      setResult({ cnpj, receita });

      await registrar.mutateAsync({
        cnpj,
        razao_social: receita?.razao_social ?? null,
        nome_fantasia: receita?.nome_fantasia ?? null,
        situacao_cadastral: receita?.descricao_situacao_cadastral ?? null,
        dados_receita: receita,
        encontrado_no_pipedrive: false,
        acao: "somente_consulta",
        consultado_por: user?.id ?? null,
        consultado_por_nome: user?.user_metadata?.full_name ?? user?.email ?? null,
      });
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao consultar CNPJ");
    } finally {
      setLoading(false);
    }
  };

  const r = result?.receita;

  const endereco = r
    ? [r.logradouro, r.numero, r.complemento, r.bairro, r.municipio, r.uf, r.cep].filter(Boolean).join(", ")
    : "";

  const cnaesSecundarios: any[] = r?.cnaes_secundarios ?? [];
  const qsa: any[] = r?.qsa ?? [];

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight md:text-2xl">Consulta de CNPJ</h1>
        <p className="text-xs text-muted-foreground md:text-sm">
          Busque dados públicos da Receita Federal e registre o histórico de consultas.
        </p>
      </div>

      <Card className="p-3">
        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            consultar();
          }}
        >
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={input}
              onChange={(e) => setInput(maskCnpjInput(e.target.value))}
              placeholder="00.000.000/0000-00"
              inputMode="numeric"
              className="h-10 pl-9 font-mono"
              maxLength={18}
            />
          </div>
          <Button type="submit" disabled={loading} className="h-10 bg-gradient-brand text-primary-foreground hover:opacity-90">
            {loading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Search className="mr-1.5 h-4 w-4" />}
            Consultar
          </Button>
        </form>
      </Card>

      {loading && (
        <div className="grid gap-3 md:grid-cols-2">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-40" />)}
        </div>
      )}

      {r && (
        <div className="grid gap-3 md:grid-cols-2">
          <Card className="p-4">
            <SectionHeader
              icon={Building2}
              title="Dados cadastrais"
              copyAll={[
                `Razão social: ${r.razao_social ?? "—"}`,
                `Nome fantasia: ${r.nome_fantasia ?? "—"}`,
                `CNPJ: ${formatCnpj(result.cnpj)}`,
                `Situação: ${r.descricao_situacao_cadastral ?? "—"}`,
                `Abertura: ${r.data_inicio_atividade ?? "—"}`,
                `Natureza jurídica: ${r.natureza_juridica ?? "—"}`,
                `Porte: ${r.porte ?? "—"}`,
                `Capital social: ${formatCurrency(r.capital_social)}`,
                `CNAE principal: ${r.cnae_fiscal ?? ""} — ${r.cnae_fiscal_descricao ?? ""}`,
              ].join("\n")}
            />
            <div className="grid gap-2">
              <Field label="Razão social" value={r.razao_social} />
              <Field label="Nome fantasia" value={r.nome_fantasia} />
              <Field label="CNPJ" value={formatCnpj(result.cnpj)} copyValue={result.cnpj} />
              <div className="flex items-center justify-between gap-2 rounded-md border border-border/60 bg-card px-3 py-2">
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Situação</p>
                  <div className="mt-0.5 flex items-center gap-2">
                    <Badge variant={r.descricao_situacao_cadastral === "ATIVA" ? "default" : "destructive"}>
                      {r.descricao_situacao_cadastral ?? "—"}
                    </Badge>
                  </div>
                </div>
                <CopyButton value={r.descricao_situacao_cadastral} label="Situação" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Abertura" value={r.data_inicio_atividade} />
                <Field label="Porte" value={r.porte} />
              </div>
              <Field label="Natureza jurídica" value={r.natureza_juridica} />
              <Field label="Capital social" value={formatCurrency(r.capital_social)} copyValue={String(r.capital_social ?? "")} />
              <Field
                label="CNAE principal"
                value={r.cnae_fiscal ? `${r.cnae_fiscal} — ${r.cnae_fiscal_descricao ?? ""}` : "—"}
              />
              {cnaesSecundarios.length > 0 && (
                <div className="rounded-md border border-border/60 bg-card px-3 py-2">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">CNAEs secundários ({cnaesSecundarios.length})</p>
                  <ul className="mt-1 space-y-1 text-xs">
                    {cnaesSecundarios.map((c: any, i: number) => (
                      <li key={i} className="flex items-start justify-between gap-2">
                        <span className="min-w-0 flex-1">
                          <span className="font-mono">{c.codigo}</span> — {c.descricao}
                        </span>
                        <CopyButton value={`${c.codigo} — ${c.descricao}`} label="CNAE" />
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </Card>

          <Card className="p-4">
            <SectionHeader icon={MapPin} title="Endereço" copyAll={endereco} />
            <div className="grid gap-2">
              <Field label="Logradouro" value={[r.logradouro, r.numero].filter(Boolean).join(", ")} />
              <Field label="Complemento" value={r.complemento} />
              <Field label="Bairro" value={r.bairro} />
              <div className="grid grid-cols-2 gap-2">
                <Field label="Município" value={r.municipio} />
                <Field label="UF" value={r.uf} />
              </div>
              <Field label="CEP" value={r.cep} />
            </div>
          </Card>

          <Card className="p-4">
            <SectionHeader
              icon={Phone}
              title="Contato"
              copyAll={[
                r.ddd_telefone_1 && `Telefone: ${r.ddd_telefone_1}`,
                r.ddd_telefone_2 && `Telefone 2: ${r.ddd_telefone_2}`,
                r.email && `E-mail: ${r.email}`,
              ].filter(Boolean).join("\n")}
            />
            <div className="grid gap-2">
              <Field label="Telefone" value={r.ddd_telefone_1} />
              <Field label="Telefone 2" value={r.ddd_telefone_2} />
              <Field label="E-mail" value={r.email} />
            </div>
          </Card>

          <Card className="p-4">
            <SectionHeader
              icon={Users}
              title={`Quadro societário (${qsa.length})`}
              copyAll={qsa.map((s: any) => `${s.nome_socio} — ${s.qualificacao_socio}`).join("\n")}
            />
            {qsa.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sem sócios informados.</p>
            ) : (
              <ul className="divide-y divide-border">
                {qsa.map((s: any, i: number) => (
                  <li key={i} className="flex items-start justify-between gap-2 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{s.nome_socio}</p>
                      <p className="text-xs text-muted-foreground">
                        {s.qualificacao_socio}
                        {s.faixa_etaria ? ` · ${s.faixa_etaria}` : ""}
                      </p>
                    </div>
                    <CopyButton value={s.nome_socio} label="Sócio" />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}

      <Card className="p-4">
        <div className="mb-2 flex items-center gap-2">
          <History className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Consultas recentes</h3>
        </div>
        {(!recentes || recentes.length === 0) ? (
          <p className="text-xs text-muted-foreground">Nenhuma consulta registrada ainda.</p>
        ) : (
          <ul className="divide-y divide-border">
            {recentes.map((c: any) => (
              <li key={c.id} className="flex items-center justify-between gap-2 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{c.razao_social ?? "—"}</p>
                  <p className="font-mono text-[11px] text-muted-foreground">{formatCnpj(c.cnpj)}</p>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{formatBrazilDateTime(c.consultado_em)}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7"
                    onClick={() => {
                      setInput(formatCnpj(c.cnpj));
                      consultar(c.cnpj);
                    }}
                  >
                    Reconsultar
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
