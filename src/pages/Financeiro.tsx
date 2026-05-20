import { useState } from "react";
import { Navigate } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { VisaoGeralTab } from "@/components/financeiro/VisaoGeralTab";
import { VrTab } from "@/components/financeiro/VrTab";
import { RhDigitalTab } from "@/components/financeiro/RhDigitalTab";
import { LancamentosTab } from "@/components/financeiro/LancamentosTab";
import { DocumentosTab } from "@/components/financeiro/DocumentosTab";
import { ParceirosTab } from "@/components/financeiro/ParceirosTab";
import { CalculadoraMigracao } from "@/components/financeiro/CalculadoraMigracao";

export default function Financeiro() {
  const { user, role, loading } = useAuth();
  const [tab, setTab] = useState("visao-geral");
  const [openUpload, setOpenUpload] = useState(false);

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

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Financeiro</h1>
        <p className="text-sm text-muted-foreground">
          Comissões VR Benefícios, RH Digital, documentos e configurações.
        </p>
      </header>

      <Tabs value={tab} onValueChange={setTab} className="flex flex-1 flex-col">
        <TabsList className="w-full justify-start overflow-x-auto md:w-auto">
          <TabsTrigger value="visao-geral">Visão geral</TabsTrigger>
          <TabsTrigger value="vr">VR Benefícios</TabsTrigger>
          <TabsTrigger value="calculadora">Calculadora de Migração</TabsTrigger>
          <TabsTrigger value="ponto">RH Digital</TabsTrigger>
          <TabsTrigger value="documentos">Documentos</TabsTrigger>
          <TabsTrigger value="parceiros">Parceiros</TabsTrigger>
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
