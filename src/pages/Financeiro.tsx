import { useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ChevronRight, Download, Loader2, Plus } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { VisaoGeralTab } from "@/components/financeiro/VisaoGeralTab";
import { VrTab } from "@/components/financeiro/VrTab";
import { RhDigitalTab } from "@/components/financeiro/RhDigitalTab";
import { LancamentosTab } from "@/components/financeiro/LancamentosTab";
import { DocumentosTab } from "@/components/financeiro/DocumentosTab";
import { ParceirosTab } from "@/components/financeiro/ParceirosTab";
import { CalculadoraMigracao } from "@/components/financeiro/CalculadoraMigracao";
import { ymdFirst } from "@/components/financeiro/financeiroUtils";

const TAB_LABELS: Record<string, string> = {
  "visao-geral": "Visão Geral",
  vr: "VR Benefícios",
  calculadora: "Calculadora de Migração",
  ponto: "RH Digital",
  documentos: "Documentos",
  parceiros: "Parceiros",
  lancamentos: "Lançamentos",
};

export default function Financeiro() {
  const { user, role, loading } = useAuth();
  const [tab, setTab] = useState("visao-geral");
  const [openUpload, setOpenUpload] = useState(false);

  const breadcrumb = useMemo(() => TAB_LABELS[tab] ?? "Visão Geral", [tab]);

  const competencia = ymdFirst(new Date());

  const pendingQuery = useQuery({
    queryKey: ["financeiro-tab-pendentes", competencia],
    enabled: role === "admin",
    queryFn: async () => {
      const [vrRes, rhRes, repRes] = await Promise.all([
        supabase
          .from("lancamentos_vr")
          .select("id", { count: "exact", head: true })
          .eq("competencia", competencia)
          .is("valor_base", null),
        supabase
          .from("parcelas_rh_digital")
          .select("id", { count: "exact", head: true })
          .eq("competencia", competencia)
          .eq("status", "pendente"),
        supabase
          .from("repasses_parceiro")
          .select("id", { count: "exact", head: true })
          .eq("status", "pendente"),
      ]);
      return {
        vr: vrRes.count ?? 0,
        rh: rhRes.count ?? 0,
        parceiros: repRes.count ?? 0,
      };
    },
  });

  if (loading || (user && role === null)) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (role !== "admin") {
    return <Navigate to="/" replace />;
  }

  const pend = pendingQuery.data ?? { vr: 0, rh: 0, parceiros: 0 };

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-5 p-4 md:p-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span>Financeiro</span>
        <ChevronRight className="h-3 w-3" />
        <span className="font-medium text-foreground">{breadcrumb}</span>
      </nav>

      {/* Header */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Financeiro</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gerencie contratos, recebimentos e comissões de parceiros.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5">
            <Download className="h-4 w-4" />
            Exportar Relatório
          </Button>
          <Button size="sm" className="gap-1.5" onClick={() => setTab("lancamentos")}>
            <Plus className="h-4 w-4" />
            Novo Lançamento
          </Button>
        </div>
      </header>

      <Tabs value={tab} onValueChange={setTab} className="flex flex-1 flex-col">
        <TabsList className="w-full justify-start overflow-x-auto md:w-auto">
          <TabsTrigger value="visao-geral">Visão geral</TabsTrigger>
          <TabsTrigger value="vr" className="gap-1.5">
            VR Benefícios
            {pend.vr > 0 && <PendBadge count={pend.vr} />}
          </TabsTrigger>
          <TabsTrigger value="calculadora">Calculadora de Migração</TabsTrigger>
          <TabsTrigger value="ponto" className="gap-1.5">
            RH Digital
            {pend.rh > 0 && <PendBadge count={pend.rh} />}
          </TabsTrigger>
          <TabsTrigger value="documentos">Documentos</TabsTrigger>
          <TabsTrigger value="parceiros" className="gap-1.5">
            Parceiros
            {pend.parceiros > 0 && <PendBadge count={pend.parceiros} />}
          </TabsTrigger>
          <TabsTrigger value="lancamentos">Lançamentos</TabsTrigger>
        </TabsList>

        <TabsContent value="visao-geral" className="mt-4">
          <VisaoGeralTab />
        </TabsContent>

        <TabsContent value="vr" className="mt-4">
          <VrTab />
        </TabsContent>

        <TabsContent value="calculadora" className="mt-4">
          <CalculadoraMigracao />
        </TabsContent>

        <TabsContent value="ponto" className="mt-4">
          <RhDigitalTab />
        </TabsContent>

        <TabsContent value="documentos" className="mt-4">
          <DocumentosTab
            openUploadOnMount={openUpload}
            onConsumeOpenUpload={() => setOpenUpload(false)}
          />
        </TabsContent>

        <TabsContent value="parceiros" className="mt-4">
          <ParceirosTab />
        </TabsContent>

        <TabsContent value="lancamentos" className="mt-4">
          <LancamentosTab
            onAbrirDocumentoUpload={() => {
              setOpenUpload(true);
              setTab("documentos");
            }}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PendBadge({ count }: { count: number }) {
  return (
    <span
      className="ml-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-semibold leading-none text-destructive-foreground"
      title={`${count} pendente${count === 1 ? "" : "s"}`}
    >
      {count}
    </span>
  );
}
