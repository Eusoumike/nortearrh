import { useState } from "react";
import { Navigate } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Plus, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { VisaoGeralTab } from "@/components/financeiro/VisaoGeralTab";
import { VrTab } from "@/components/financeiro/VrTab";
import { RhDigitalTab } from "@/components/financeiro/RhDigitalTab";

export default function Financeiro() {
  const { user, role, loading } = useAuth();
  const [tab, setTab] = useState("visao-geral");

  // Aguarda tanto a sessão quanto a role serem resolvidas antes de decidir
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
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Financeiro</h1>
          <p className="text-sm text-muted-foreground">
            Comissões VR Benefícios, RH Digital, documentos e configurações.
          </p>
        </div>
        <Button onClick={() => setTab("vr")} className="gap-1.5">
          <Plus className="h-4 w-4" />
          Novo lançamento
        </Button>
      </header>

      <Tabs value={tab} onValueChange={setTab} className="flex flex-1 flex-col">
        <TabsList className="w-full justify-start overflow-x-auto md:w-auto">
          <TabsTrigger value="visao-geral">Visão geral</TabsTrigger>
          <TabsTrigger value="vr">VR Benefícios</TabsTrigger>
          <TabsTrigger value="ponto">RH Digital</TabsTrigger>
          <TabsTrigger value="documentos">Documentos</TabsTrigger>
          <TabsTrigger value="lancamentos">Lançamentos</TabsTrigger>
        </TabsList>

        <TabsContent value="visao-geral" className="mt-4">
          <VisaoGeralTab />
        </TabsContent>

        <TabsContent value="vr" className="mt-4">
          <VrTab />
        </TabsContent>

        <TabsContent value="ponto" className="mt-4">
          <RhDigitalTab />
        </TabsContent>

        <TabsContent value="documentos" className="mt-4">
          <PlaceholderCard
            title="Documentos"
            description="Notas fiscais e boletos do mês, com upload em storage privado."
          />
        </TabsContent>

        <TabsContent value="lancamentos" className="mt-4">
          <PlaceholderCard
            title="Lançamentos"
            description="Atalhos para registrar VR, RH Digital, documentos e configurar fidelidades."
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PlaceholderCard({ title, description }: { title: string; description: string }) {
  return (
    <Card className="flex flex-col items-start gap-1 p-6">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="text-sm text-muted-foreground">{description}</p>
      <p className="mt-3 text-xs text-muted-foreground">
        Esta aba será implementada nas próximas fases.
      </p>
    </Card>
  );
}
