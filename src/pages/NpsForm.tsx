import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Send, AlertTriangle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Step = 1 | 2 | 3 | "done";

interface FormState {
  nome: string;
  email: string;
  empresa: string;
  tempo_cliente: string;
  frequencia_uso: string;
  nota_atendimento: number | null;
  atendimento_evolucao: string;
  tempo_resposta: string;
  confianca_informacoes: number | null;
  nps_score: number | null;
  feedback_aberto: string;
  experiencia_geral: string;
  sugestao_melhoria: string;
  comentario_adicional: string;
}

const initialState: FormState = {
  nome: "",
  email: "",
  empresa: "",
  tempo_cliente: "",
  frequencia_uso: "",
  nota_atendimento: null,
  atendimento_evolucao: "",
  tempo_resposta: "",
  confianca_informacoes: null,
  nps_score: null,
  feedback_aberto: "",
  experiencia_geral: "",
  sugestao_melhoria: "",
  comentario_adicional: "",
};

const TEMPO_CLIENTE_OPTIONS = [
  "Menos de 6 meses",
  "6 meses a 1 ano",
  "1 a 2 anos",
  "2 a 5 anos",
  "Mais de 5 anos",
];
const FREQUENCIA_OPTIONS = [
  "Raramente",
  "Mensalmente",
  "Quinzenalmente",
  "Semanalmente",
  "Diariamente",
];
const EVOLUCAO_OPTIONS = [
  "Melhorou muito",
  "Melhorou",
  "Manteve igual",
  "Piorou",
  "Piorou muito",
];
const TEMPO_RESPOSTA_OPTIONS = [
  "Muito rápido",
  "Rápido",
  "Adequado",
  "Lento",
  "Muito lento",
];

export default function NpsForm() {
  const { token } = useParams();
  const [step, setStep] = useState<Step>(1);
  const [form, setForm] = useState<FormState>(initialState);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pré-preenche se vier por token vinculado a um cliente
  useEffect(() => {
    if (!token) return;
    (async () => {
      const { data } = await supabase
        .from("clients")
        .select("name, email, company")
        .eq("nps_token", token)
        .maybeSingle();
      if (data) {
        setForm((f) => ({
          ...f,
          nome: f.nome || data.name || "",
          email: f.email || data.email || "",
          empresa: f.empresa || data.company || data.name || "",
        }));
      }
    })();
  }, [token]);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const canStep1 = form.nome.trim() && form.email.trim() && form.empresa.trim();
  const canStep2 =
    form.nota_atendimento !== null &&
    form.atendimento_evolucao &&
    form.tempo_resposta &&
    form.confianca_informacoes !== null &&
    form.nps_score !== null;

  async function submit() {
    setSubmitting(true);
    setError(null);
    const payload = {
      nome: form.nome.trim(),
      email: form.email.trim(),
      empresa: form.empresa.trim(),
      tempo_cliente: form.tempo_cliente || null,
      frequencia_uso: form.frequencia_uso || null,
      nota_atendimento: form.nota_atendimento,
      atendimento_evolucao: form.atendimento_evolucao || null,
      tempo_resposta: form.tempo_resposta || null,
      confianca_informacoes: form.confianca_informacoes,
      nps_score: form.nps_score,
      feedback_aberto: form.feedback_aberto.trim() || null,
      experiencia_geral: form.experiencia_geral.trim() || null,
      sugestao_melhoria: form.sugestao_melhoria.trim() || null,
      comentario_adicional: form.comentario_adicional.trim() || null,
      token: token || null,
      source: "formulario",
    };
    const { error: err } = await supabase.from("nps_responses").insert(payload);
    setSubmitting(false);
    if (err) {
      setError(err.message);
      return;
    }
    setStep("done");
  }

  return (
    <div className="min-h-screen bg-[#0D0D0D] text-white">
      <div className="mx-auto max-w-2xl px-4 py-10 sm:py-16">
        {step !== "done" && <ProgressBar step={step} />}

        {step !== "done" && (
          <header className="mt-8 mb-6 text-center">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Avaliação de Atendimento Nortear
            </h1>
            <p className="mx-auto mt-3 max-w-xl text-sm text-white/70">
              Avalie nosso atendimento e suporte. Esta pesquisa é sobre os serviços da
              Nortear, não sobre o sistema VR Pontomais.
            </p>
          </header>
        )}

        {step !== "done" && (
          <div className="mb-6 flex items-start gap-3 rounded-lg border border-purple-500/30 bg-purple-950/40 p-4 text-sm text-purple-100">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-purple-300" />
            <p>
              <strong>Atenção:</strong> esta pesquisa avalia o atendimento da Nortear,
              não o sistema VR Pontomais.
            </p>
          </div>
        )}

        <div className="rounded-xl border border-white/5 bg-[#1A1A2A] p-6 shadow-2xl sm:p-8">
          {step === 1 && (
            <Step1
              form={form}
              update={update}
              onNext={() => canStep1 && setStep(2)}
              canNext={!!canStep1}
            />
          )}
          {step === 2 && (
            <Step2
              form={form}
              update={update}
              onBack={() => setStep(1)}
              onNext={() => canStep2 && setStep(3)}
              canNext={!!canStep2}
            />
          )}
          {step === 3 && (
            <Step3
              form={form}
              update={update}
              onBack={() => setStep(2)}
              onSubmit={submit}
              submitting={submitting}
              error={error}
            />
          )}
          {step === "done" && <ThankYou />}
        </div>

        <p className="mt-8 text-center text-xs text-white/40">
          © Nortear · Pesquisa de Satisfação
        </p>
      </div>
    </div>
  );
}

/* ----------------- subcomponentes ----------------- */

function ProgressBar({ step }: { step: 1 | 2 | 3 }) {
  const labels = ["Dados", "Avaliação", "Feedbacks"];
  return (
    <div className="flex items-center gap-2">
      {labels.map((label, idx) => {
        const n = (idx + 1) as 1 | 2 | 3;
        const active = n <= step;
        return (
          <div key={label} className="flex flex-1 flex-col items-center gap-2">
            <div
              className={cn(
                "h-1 w-full rounded-full transition-all",
                active ? "bg-gradient-to-r from-purple-500 to-blue-500" : "bg-white/10",
              )}
            />
            <span
              className={cn(
                "text-[11px] uppercase tracking-wider",
                active ? "text-white" : "text-white/40",
              )}
            >
              {n}. {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function DarkInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <Input
      {...props}
      className={cn(
        "border-white/10 bg-[#0D0D0D] text-white placeholder:text-white/30 focus-visible:ring-purple-500",
        props.className,
      )}
    />
  );
}

function DarkTextarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <Textarea
      {...props}
      className={cn(
        "border-white/10 bg-[#0D0D0D] text-white placeholder:text-white/30 focus-visible:ring-purple-500",
        props.className,
      )}
    />
  );
}

function DarkSelect({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="flex h-10 w-full rounded-md border border-white/10 bg-[#0D0D0D] px-3 py-2 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
    >
      <option value="" className="bg-[#1A1A2A]">
        {placeholder ?? "Selecione..."}
      </option>
      {options.map((opt) => (
        <option key={opt} value={opt} className="bg-[#1A1A2A]">
          {opt}
        </option>
      ))}
    </select>
  );
}

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <Label className="text-sm font-medium text-white/90">
      {children}
      {required && <span className="ml-1 text-purple-400">*</span>}
    </Label>
  );
}

function ScoreButtons({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (n: number) => void;
}) {
  return (
    <div className="grid grid-cols-11 gap-1.5">
      {Array.from({ length: 11 }, (_, n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          className={cn(
            "h-11 rounded-md border text-sm font-semibold transition-all",
            value === n
              ? "border-transparent bg-gradient-to-br from-purple-500 to-blue-500 text-white shadow-lg shadow-purple-500/40 scale-105"
              : "border-white/10 bg-[#0D0D0D] text-white/70 hover:border-purple-500/40 hover:text-white",
          )}
        >
          {n}
        </button>
      ))}
    </div>
  );
}

function PrimaryBtn({
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <Button
      {...props}
      className={cn(
        "bg-gradient-to-r from-purple-500 to-blue-500 text-white hover:opacity-90 disabled:opacity-40",
        props.className,
      )}
    >
      {children}
    </Button>
  );
}

function GhostBtn({
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <Button
      variant="ghost"
      {...props}
      className={cn("text-white/70 hover:bg-white/5 hover:text-white", props.className)}
    >
      {children}
    </Button>
  );
}

/* ----------------- etapas ----------------- */

function Step1({
  form,
  update,
  onNext,
  canNext,
}: {
  form: FormState;
  update: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
  onNext: () => void;
  canNext: boolean;
}) {
  return (
    <div className="space-y-5">
      <h2 className="text-lg font-semibold">Dados pessoais</h2>

      <div className="space-y-2">
        <FieldLabel required>Nome completo</FieldLabel>
        <DarkInput
          value={form.nome}
          onChange={(e) => update("nome", e.target.value)}
          maxLength={120}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <FieldLabel required>Email</FieldLabel>
          <DarkInput
            type="email"
            value={form.email}
            onChange={(e) => update("email", e.target.value)}
            maxLength={255}
          />
        </div>
        <div className="space-y-2">
          <FieldLabel required>Empresa</FieldLabel>
          <DarkInput
            value={form.empresa}
            onChange={(e) => update("empresa", e.target.value)}
            maxLength={150}
          />
        </div>
      </div>

      <div className="space-y-2">
        <FieldLabel>Tempo como cliente</FieldLabel>
        <DarkSelect
          value={form.tempo_cliente}
          onChange={(v) => update("tempo_cliente", v)}
          options={TEMPO_CLIENTE_OPTIONS}
        />
      </div>

      <div className="space-y-2">
        <FieldLabel>Frequência de uso do canal de atendimento Nortear</FieldLabel>
        <DarkSelect
          value={form.frequencia_uso}
          onChange={(v) => update("frequencia_uso", v)}
          options={FREQUENCIA_OPTIONS}
        />
      </div>

      <div className="flex justify-end pt-2">
        <PrimaryBtn onClick={onNext} disabled={!canNext}>
          Próximo →
        </PrimaryBtn>
      </div>
    </div>
  );
}

function Step2({
  form,
  update,
  onBack,
  onNext,
  canNext,
}: {
  form: FormState;
  update: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
  onBack: () => void;
  onNext: () => void;
  canNext: boolean;
}) {
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Avaliação do atendimento Nortear</h2>

      <div className="space-y-3">
        <FieldLabel required>Nota do atendimento Nortear ao longo do tempo (0-10)</FieldLabel>
        <ScoreButtons
          value={form.nota_atendimento}
          onChange={(n) => update("nota_atendimento", n)}
        />
      </div>

      <div className="space-y-2">
        <FieldLabel required>O atendimento Nortear...</FieldLabel>
        <DarkSelect
          value={form.atendimento_evolucao}
          onChange={(v) => update("atendimento_evolucao", v)}
          options={EVOLUCAO_OPTIONS}
        />
      </div>

      <div className="space-y-2">
        <FieldLabel required>Tempo de resposta</FieldLabel>
        <DarkSelect
          value={form.tempo_resposta}
          onChange={(v) => update("tempo_resposta", v)}
          options={TEMPO_RESPOSTA_OPTIONS}
        />
      </div>

      <div className="space-y-3">
        <FieldLabel required>Confiança nas informações recebidas (0-10)</FieldLabel>
        <ScoreButtons
          value={form.confianca_informacoes}
          onChange={(n) => update("confianca_informacoes", n)}
        />
      </div>

      <div className="space-y-3">
        <FieldLabel required>
          NPS — De 0 a 10, o quanto recomendaria o atendimento Nortear?
        </FieldLabel>
        <ScoreButtons value={form.nps_score} onChange={(n) => update("nps_score", n)} />
      </div>

      <div className="flex items-center justify-between pt-2">
        <GhostBtn onClick={onBack}>← Voltar</GhostBtn>
        <PrimaryBtn onClick={onNext} disabled={!canNext}>
          Próximo →
        </PrimaryBtn>
      </div>
    </div>
  );
}

function Step3({
  form,
  update,
  onBack,
  onSubmit,
  submitting,
  error,
}: {
  form: FormState;
  update: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
  onBack: () => void;
  onSubmit: () => void;
  submitting: boolean;
  error: string | null;
}) {
  return (
    <div className="space-y-5">
      <h2 className="text-lg font-semibold">Feedbacks</h2>

      <div className="space-y-2">
        <FieldLabel>Conte-nos sobre sua experiência</FieldLabel>
        <DarkTextarea
          rows={3}
          value={form.feedback_aberto}
          onChange={(e) => update("feedback_aberto", e.target.value)}
          placeholder="Conte-nos sobre sua experiência..."
          maxLength={2000}
        />
      </div>

      <div className="space-y-2">
        <FieldLabel>Experiência geral</FieldLabel>
        <DarkTextarea
          rows={3}
          value={form.experiencia_geral}
          onChange={(e) => update("experiencia_geral", e.target.value)}
          placeholder="Como foi sua experiência geral?"
          maxLength={2000}
        />
      </div>

      <div className="space-y-2">
        <FieldLabel>Sugestão de melhoria</FieldLabel>
        <DarkTextarea
          rows={3}
          value={form.sugestao_melhoria}
          onChange={(e) => update("sugestao_melhoria", e.target.value)}
          placeholder="O que podemos melhorar?"
          maxLength={2000}
        />
      </div>

      <div className="space-y-2">
        <FieldLabel>Comentário adicional</FieldLabel>
        <DarkTextarea
          rows={3}
          value={form.comentario_adicional}
          onChange={(e) => update("comentario_adicional", e.target.value)}
          placeholder="Algo mais que gostaria de compartilhar?"
          maxLength={2000}
        />
      </div>

      {error && (
        <div className="rounded-md border border-red-500/30 bg-red-950/40 p-3 text-sm text-red-200">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between pt-2">
        <GhostBtn onClick={onBack} disabled={submitting}>
          ← Voltar
        </GhostBtn>
        <PrimaryBtn onClick={onSubmit} disabled={submitting}>
          {submitting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Send className="mr-2 h-4 w-4" />
          )}
          Enviar avaliação
        </PrimaryBtn>
      </div>
    </div>
  );
}

function ThankYou() {
  return (
    <div className="py-8 text-center">
      <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-blue-500">
        <CheckCircle2 className="h-9 w-9 text-white" />
      </div>
      <h2 className="text-2xl font-semibold">Obrigado pelo seu feedback! 🎉</h2>
      <p className="mx-auto mt-3 max-w-sm text-sm text-white/70">
        Sua avaliação é muito importante para continuarmos melhorando.
      </p>
    </div>
  );
}
