import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Calculator, Calendar, DollarSign, Info, ArrowUpRight, ArrowDownRight, RotateCcw, CheckCircle } from "lucide-react";

interface Resultado {
  diasCiclo: number;
  divisor: number;
  diaria: number;
  valorNovo: number;
  regra: string;
  vencimento: string;
  credito: number;
  diasNaoUtilizados: number;
  proximoBoleto: number;
}

interface CenarioExemplo {
  id: string;
  titulo: string;
  descricao: string;
  icone: React.ReactNode;
  badge: string;
  badgeVariant: "default" | "secondary" | "outline" | "destructive";
  inicioAnterior: string;
  fimAnterior: string;
  dataMigracao: string;
  valorAnterior: string;
  valorNovo: string;
  resultadoEsperado: {
    diasCiclo: number;
    diaria: number;
    diasNaoUtilizados: number;
    credito: number;
    proximoBoleto: number;
  };
}

export function CalculadoraMigracao() {
  const [inicioAnterior, setInicioAnterior] = useState("");
  const [fimAnterior, setFimAnterior] = useState("");
  const [dataMigracao, setDataMigracao] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [valorAnterior, setValorAnterior] = useState("");
  const [valorNovo, setValorNovo] = useState("");
  const [resultado, setResultado] = useState<Resultado | null>(null);

  const calcularDiasUteis = (dataInicial: Date, diasUteis: number): Date => {
    const data = new Date(dataInicial);
    let diasContados = 0;

    while (diasContados < diasUteis) {
      data.setDate(data.getDate() + 1);
      const diaSemana = data.getDay();
      if (diaSemana !== 0 && diaSemana !== 6) {
        diasContados++;
      }
    }
    return data;
  };

  const formatarData = (data: Date): string => {
    const dia = String(data.getDate()).padStart(2, "0");
    const mes = String(data.getMonth() + 1).padStart(2, "0");
    const ano = data.getFullYear();
    return `${dia}/${mes}/${ano}`;
  };

  const formatarMoeda = (valor: number): string => {
    return `R$ ${valor.toFixed(2).replace(".", ",")}`;
  };

  const calcularComParametros = (
    pInicio: string,
    pFim: string,
    pMigracao: string,
    pVlrAnterior: string,
    pVlrNovo: string
  ): Resultado | null => {
    const inicio = new Date(pInicio + "T00:00:00");
    const fim = new Date(pFim + "T00:00:00");
    const migracao = new Date(pMigracao + "T00:00:00");
    const vlrAnterior = parseFloat(pVlrAnterior);
    const vlrNovo = parseFloat(pVlrNovo);

    if (
      isNaN(inicio.getTime()) ||
      isNaN(fim.getTime()) ||
      isNaN(migracao.getTime())
    ) {
      return null;
    }

    if (isNaN(vlrAnterior) || isNaN(vlrNovo)) {
      return null;
    }

    if (migracao < inicio || migracao > fim) {
      return null;
    }

    const diasCiclo =
      Math.round((fim.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const divisor = diasCiclo;
    const diaria = Math.round((vlrAnterior / divisor) * 100) / 100;
    const diasUtilizados = Math.round(
      (migracao.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24)
    );
    const diasNaoUtilizados = diasCiclo - diasUtilizados;
    const credito = Math.round(diaria * diasNaoUtilizados * 100) / 100;

    let regra = "padrão";
    if (diasNaoUtilizados === 0) {
      regra = "sem crédito (ciclo completo)";
    } else if (diasNaoUtilizados < 0) {
      regra = "data inválida";
    }

    const proximoBoleto = Math.round((vlrNovo - credito) * 100) / 100;
    const vencimento = calcularDiasUteis(migracao, 7);

    return {
      diasCiclo,
      divisor,
      diaria,
      valorNovo: vlrNovo,
      regra,
      vencimento: formatarData(vencimento),
      credito,
      diasNaoUtilizados,
      proximoBoleto,
    };
  };

  const calcular = () => {
    const res = calcularComParametros(
      inicioAnterior,
      fimAnterior,
      dataMigracao,
      valorAnterior,
      valorNovo
    );

    if (!res) {
      alert("Por favor, preencha todos os campos corretamente.");
      return;
    }

    setResultado(res);
  };

  const aplicarCenario = (cenario: CenarioExemplo) => {
    setInicioAnterior(cenario.inicioAnterior);
    setFimAnterior(cenario.fimAnterior);
    setDataMigracao(cenario.dataMigracao);
    setValorAnterior(cenario.valorAnterior);
    setValorNovo(cenario.valorNovo);

    const res = calcularComParametros(
      cenario.inicioAnterior,
      cenario.fimAnterior,
      cenario.dataMigracao,
      cenario.valorAnterior,
      cenario.valorNovo
    );

    if (res) {
      setResultado(res);
    }
  };

  const hoje = new Date();
  const primeiroDiaMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1)
    .toISOString()
    .split("T")[0];
  const ultimoDiaMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0)
    .toISOString()
    .split("T")[0];
  const meioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 15)
    .toISOString()
    .split("T")[0];
  const ultimoDia = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0)
    .toISOString()
    .split("T")[0];

  const cenarios: CenarioExemplo[] = [
    {
      id: "upgrade",
      titulo: "Upgrade de Plano",
      descricao:
        "Cliente migra para um plano mais caro no meio do ciclo. Recebe crédito pelos dias não utilizados do plano anterior.",
      icone: <ArrowUpRight className="h-5 w-5 text-emerald-500" />,
      badge: "Upgrade",
      badgeVariant: "default",
      inicioAnterior: primeiroDiaMes,
      fimAnterior: ultimoDiaMes,
      dataMigracao: meioMes,
      valorAnterior: "500",
      valorNovo: "800",
      resultadoEsperado: {
        diasCiclo: 30,
        diaria: 16.67,
        diasNaoUtilizados: 16,
        credito: 266.72,
        proximoBoleto: 533.28,
      },
    },
    {
      id: "downgrade",
      titulo: "Downgrade de Plano",
      descricao:
        "Cliente migra para um plano mais barato no meio do ciclo. O crédito dos dias não utilizados reduz o valor do próximo boleto.",
      icone: <ArrowDownRight className="h-5 w-5 text-amber-500" />,
      badge: "Downgrade",
      badgeVariant: "secondary",
      inicioAnterior: primeiroDiaMes,
      fimAnterior: ultimoDiaMes,
      dataMigracao: meioMes,
      valorAnterior: "800",
      valorNovo: "500",
      resultadoEsperado: {
        diasCiclo: 30,
        diaria: 26.67,
        diasNaoUtilizados: 16,
        credito: 426.72,
        proximoBoleto: 73.28,
      },
    },
    {
      id: "ciclo-completo",
      titulo: "Migração no Final do Ciclo",
      descricao:
        "Cliente migra no último dia do ciclo. Não há dias não utilizados, portanto não gera crédito.",
      icone: <CheckCircle className="h-5 w-5 text-sky-500" />,
      badge: "Ciclo Completo",
      badgeVariant: "outline",
      inicioAnterior: primeiroDiaMes,
      fimAnterior: ultimoDiaMes,
      dataMigracao: ultimoDia,
      valorAnterior: "500",
      valorNovo: "800",
      resultadoEsperado: {
        diasCiclo: 30,
        diaria: 16.67,
        diasNaoUtilizados: 0,
        credito: 0,
        proximoBoleto: 800,
      },
    },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Calculadora de Migração de Planos
          </CardTitle>
          <CardDescription>
            Calcule o valor proporcional de upgrade ou downgrade entre planos
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="inicio-anterior" className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                Início do ciclo anterior
              </Label>
              <Input
                id="inicio-anterior"
                type="date"
                value={inicioAnterior}
                onChange={(e) => setInicioAnterior(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="fim-anterior" className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                Fim do ciclo anterior
              </Label>
              <Input
                id="fim-anterior"
                type="date"
                value={fimAnterior}
                onChange={(e) => setFimAnterior(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="data-migracao" className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                Data de migração
              </Label>
              <Input
                id="data-migracao"
                type="date"
                value={dataMigracao}
                onChange={(e) => setDataMigracao(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="valor-anterior" className="flex items-center gap-1.5">
                <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                Valor do último plano (R$)
              </Label>
              <Input
                id="valor-anterior"
                type="number"
                step="0.01"
                min="0"
                placeholder="0,00"
                value={valorAnterior}
                onChange={(e) => setValorAnterior(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="valor-novo" className="flex items-center gap-1.5">
                <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                Valor do novo plano (R$)
              </Label>
              <Input
                id="valor-novo"
                type="number"
                step="0.01"
                min="0"
                placeholder="0,00"
                value={valorNovo}
                onChange={(e) => setValorNovo(e.target.value)}
              />
            </div>
          </div>

          <Button onClick={calcular} className="w-full sm:w-auto">
            <Calculator className="mr-2 h-4 w-4" />
            Calcular
          </Button>

          {resultado && (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-lg border bg-card p-3">
                  <div className="text-xs text-muted-foreground">Dias no ciclo</div>
                  <div className="text-lg font-semibold tabular-nums">{resultado.diasCiclo}</div>
                </div>

                <div className="rounded-lg border bg-card p-3">
                  <div className="text-xs text-muted-foreground">Divisor usado</div>
                  <div className="text-lg font-semibold tabular-nums">{resultado.divisor} dia(s)</div>
                </div>

                <div className="rounded-lg border bg-card p-3">
                  <div className="text-xs text-muted-foreground">Diária (arredondada)</div>
                  <div className="text-lg font-semibold tabular-nums">{formatarMoeda(resultado.diaria)}</div>
                </div>

                <div className="rounded-lg border bg-card p-3">
                  <div className="text-xs text-muted-foreground">Novo plano</div>
                  <div className="text-lg font-semibold tabular-nums">{formatarMoeda(resultado.valorNovo)}</div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg border bg-card p-3">
                  <div className="text-xs text-muted-foreground">Regra aplicada</div>
                  <div className="text-base font-medium">{resultado.regra}</div>
                </div>

                <div className="rounded-lg border bg-card p-3">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    Vencimento estimado (07 dias úteis):
                  </div>
                  <div className="text-base font-medium">{resultado.vencimento}</div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg border border-amber-500/20 bg-amber-50/50 p-3 dark:bg-amber-950/20">
                  <div className="text-xs text-muted-foreground">
                    Crédito (dias não utilizados):
                  </div>
                  <div className="text-lg font-semibold tabular-nums text-amber-700 dark:text-amber-400">
                    {formatarMoeda(resultado.credito)} (dias: {resultado.diasNaoUtilizados})
                  </div>
                </div>

                <div className="rounded-lg border border-emerald-500/20 bg-emerald-50/50 p-3 dark:bg-emerald-950/20">
                  <div className="text-xs text-muted-foreground">
                    Valor do próximo boleto:
                  </div>
                  <div className="text-lg font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
                    {formatarMoeda(resultado.proximoBoleto)}
                  </div>
                </div>
              </div>

              <Alert variant="default" className="bg-muted/50">
                <Info className="h-4 w-4" />
                <AlertDescription className="text-xs leading-relaxed">
                  Conforme consta em nosso Termo de Uso, em caso de Upgrade ou Downgrade
                  (Migração), o sistema automaticamente gera um boleto com vencimento para 07
                  dias úteis após a data da migração. Caso o pagamento do Plano anterior já
                  tenha sido efetuado, é calculada a diferença com o valor total do novo Plano,
                  baseado nos dias já utilizados, considerando o desconto ou débito equivalente.
                </AlertDescription>
              </Alert>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
