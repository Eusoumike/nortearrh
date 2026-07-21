import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Search, History, LayoutDashboard } from "lucide-react";
import ConsultaTab from "@/components/consultas/ConsultaTab";
import HistoricoTab from "@/components/consultas/HistoricoTab";
import DashboardLeadsTab from "@/components/consultas/DashboardLeadsTab";

export default function ConsultaCnpj() {
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") ?? "consulta";
  const cnpjParam = params.get("cnpj") ?? undefined;
  const autoRun = params.get("auto") === "1";
  // Reset key força remount da aba consulta quando o CNPJ muda via URL
  const [seed, setSeed] = useState(0);

  const goToConsulta = (cnpj: string) => {
    setSeed((s) => s + 1);
    setParams({ tab: "consulta", cnpj, auto: "1" });
  };

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight md:text-2xl">Consulta de CNPJ</h1>
        <p className="text-xs text-muted-foreground md:text-sm">
          Busque dados públicos da Receita Federal, acompanhe o histórico e trabalhe leads em potencial.
        </p>
      </div>

      <Tabs
        value={tab}
        onValueChange={(v) => {
          const next = new URLSearchParams(params);
          next.set("tab", v);
          next.delete("cnpj");
          next.delete("auto");
          setParams(next);
        }}
      >
        <TabsList className="grid w-full max-w-xl grid-cols-3">
          <TabsTrigger value="consulta"><Search className="mr-1.5 h-4 w-4" />Consulta</TabsTrigger>
          <TabsTrigger value="historico"><History className="mr-1.5 h-4 w-4" />Histórico</TabsTrigger>
          <TabsTrigger value="leads"><LayoutDashboard className="mr-1.5 h-4 w-4" />Leads</TabsTrigger>
        </TabsList>

        <TabsContent value="consulta" className="mt-4">
          <ConsultaTab key={`${cnpjParam ?? ""}-${seed}`} initialCnpj={cnpjParam} autoRun={autoRun} />
        </TabsContent>
        <TabsContent value="historico" className="mt-4">
          <HistoricoTab onReabrir={goToConsulta} />
        </TabsContent>
        <TabsContent value="leads" className="mt-4">
          <DashboardLeadsTab onCadastrar={goToConsulta} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
