import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, startOfMonth } from "date-fns";
import {
  Banknote,
  CreditCard,
  FileText,
  Plus,
  ShieldCheck,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

import { LancamentoVrDialog } from "./LancamentoVrDialog";
import { ContratoRhDialog } from "./ContratoRhDialog";
import { GerenciarFidelidadesDialog } from "./GerenciarFidelidadesDialog";
import { ymdFirst } from "./financeiroUtils";

interface Props {
  onAbrirDocumentoUpload: () => void;
}

export function LancamentosTab({ onAbrirDocumentoUpload }: Props) {
  const [vrOpen, setVrOpen] = useState(false);
  const [rhOpen, setRhOpen] = useState(false);
  const [fidOpen, setFidOpen] = useState(false);

  const competencia = ymdFirst(new Date());

  const docsQuery = useQuery({
    queryKey: ["financeiro-docs-mes", competencia],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documentos_financeiros")
        .select("id, tipo, status_pagamento")
        .eq("competencia", competencia);
      if (error) throw error;
      return data ?? [];
    },
  });

  const fidQuery = useQuery({
    queryKey: ["financeiro-fid-counts"],
    queryFn: async () => {
      const today = format(new Date(), "yyyy-MM-dd");
      const limit = format(new Date(Date.now() + 30 * 86400000), "yyyy-MM-dd");
      const [vrV, vrP, rhV, rhP] = await Promise.all([
        supabase.from("lancamentos_vr").select("id", { count: "exact", head: true }).lt("fidelidade_vencimento", today),
        supabase.from("lancamentos_vr").select("id", { count: "exact", head: true }).gte("fidelidade_vencimento", today).lte("fidelidade_vencimento", limit),
        supabase.from("contratos_rh_digital").select("id", { count: "exact", head: true }).eq("ativo", true).lt("fidelidade_vencimento", today),
        supabase.from("contratos_rh_digital").select("id", { count: "exact", head: true }).eq("ativo", true).gte("fidelidade_vencimento", today).lte("fidelidade_vencimento", limit),
      ]);
      return {
        vencidas: (vrV.count ?? 0) + (rhV.count ?? 0),
        proximas: (vrP.count ?? 0) + (rhP.count ?? 0),
      };
    },
  });

  const docs = docsQuery.data ?? [];
  const totalDocs = docs.length;
  const nfPendente = docs.find((d) => d.tipo === "nota_fiscal" && d.status_pagamento === "pendente");

  const fid = fidQuery.data ?? { vencidas: 0, proximas: 0 };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <ActionCard
        accent="emerald"
        icon={<Banknote className="h-5 w-5" />}
        title="VR Benefícios"
        infos={[
          "% padrão primeira carga: 17.5%",
          "Fidelidade: 12 ou 24 meses",
        ]}
        action={
          <Button onClick={() => setVrOpen(true)} className="gap-1.5">
            <Plus className="h-4 w-4" />
            Novo lançamento VR
          </Button>
        }
      />

      <ActionCard
        accent="blue"
        icon={<CreditCard className="h-5 w-5" />}
        title="RH Digital"
        infos={[
          "% Nortear padrão: 40%",
          "Fidelidade: 6 ou 12 meses",
        ]}
        action={
          <Button onClick={() => setRhOpen(true)} className="gap-1.5">
            <Plus className="h-4 w-4" />
            Novo contrato Ponto
          </Button>
        }
      />

      <ActionCard
        accent="amber"
        icon={<FileText className="h-5 w-5" />}
        title="Documentos"
        infos={[
          nfPendente ? "NF do mês pendente" : "Sem NF pendente este mês",
          `${totalDocs} documento${totalDocs === 1 ? "" : "s"} no mês`,
        ]}
        action={
          <Button onClick={onAbrirDocumentoUpload} className="gap-1.5">
            <Plus className="h-4 w-4" />
            Anexar documento
          </Button>
        }
      />

      <ActionCard
        accent="muted"
        icon={<ShieldCheck className="h-5 w-5" />}
        title="Fidelidade e %"
        infos={[
          <span key="v" className={cn(fid.vencidas > 0 && "text-destructive font-medium")}>
            {fid.vencidas} fidelidade{fid.vencidas === 1 ? "" : "s"} vencida{fid.vencidas === 1 ? "" : "s"}
          </span>,
          <span key="p" className={cn(fid.proximas > 0 && "text-amber-600 font-medium")}>
            {fid.proximas} vencendo nos próximos 30 dias
          </span>,
        ]}
        action={
          <Button variant="outline" onClick={() => setFidOpen(true)}>
            Gerenciar fidelidades
          </Button>
        }
      />

      <LancamentoVrDialog open={vrOpen} onOpenChange={setVrOpen} defaultCompetencia={startOfMonth(new Date())} />
      <ContratoRhDialog open={rhOpen} onOpenChange={setRhOpen} />
      <GerenciarFidelidadesDialog
        open={fidOpen}
        onOpenChange={setFidOpen}
        onRenovarVR={() => { setFidOpen(false); setVrOpen(true); }}
        onRenovarPonto={() => { setFidOpen(false); setRhOpen(true); }}
      />
    </div>
  );
}

function ActionCard({
  accent,
  icon,
  title,
  infos,
  action,
}: {
  accent: "emerald" | "blue" | "amber" | "muted";
  icon: React.ReactNode;
  title: string;
  infos: React.ReactNode[];
  action: React.ReactNode;
}) {
  const map = {
    emerald: { border: "border-l-emerald-500", icon: "bg-emerald-500/10 text-emerald-600" },
    blue: { border: "border-l-blue-500", icon: "bg-blue-500/10 text-blue-600" },
    amber: { border: "border-l-amber-500", icon: "bg-amber-500/10 text-amber-600" },
    muted: { border: "border-l-muted-foreground/40", icon: "bg-muted text-muted-foreground" },
  } as const;
  const s = map[accent];
  return (
    <Card className={cn("flex flex-col gap-3 border-l-4 p-5", s.border)}>
      <div className="flex items-center gap-3">
        <div className={cn("flex h-10 w-10 items-center justify-center rounded-md", s.icon)}>
          {icon}
        </div>
        <h3 className="text-base font-semibold">{title}</h3>
      </div>
      <ul className="grid gap-1 text-sm text-muted-foreground">
        {infos.map((i, idx) => (
          <li key={idx}>{i}</li>
        ))}
      </ul>
      <div className="mt-auto pt-2">{action}</div>
    </Card>
  );
}
