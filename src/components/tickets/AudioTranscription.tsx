import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Mic, Square, RotateCcw, Check, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Props {
  onConfirm: (text: string) => void;
  onCancel?: () => void;
  className?: string;
}

type State = "idle" | "recording" | "done";

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export function AudioTranscription({ onConfirm, onCancel, className }: Props) {
  const SR: any =
    typeof window !== "undefined"
      ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      : null;
  const supported = Boolean(SR);

  const [state, setState] = useState<State>("idle");
  const [transcript, setTranscript] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const recognitionRef = useRef<any>(null);
  const timerRef = useRef<number | null>(null);
  const finalRef = useRef<string>("");

  useEffect(() => {
    return () => {
      try {
        recognitionRef.current?.stop?.();
      } catch {}
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, []);

  if (!supported) {
    return (
      <div className={cn("rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground", className)}>
        Transcrição de áudio não disponível neste navegador. Use o Chrome para esta funcionalidade.
      </div>
    );
  }

  const start = () => {
    try {
      const recognition = new SR();
      recognition.lang = "pt-BR";
      recognition.continuous = true;
      recognition.interimResults = true;

      finalRef.current = "";
      setTranscript("");
      setElapsed(0);

      recognition.onresult = (event: any) => {
        let interim = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const res = event.results[i];
          if (res.isFinal) finalRef.current += res[0].transcript;
          else interim += res[0].transcript;
        }
        setTranscript((finalRef.current + " " + interim).trim());
      };
      recognition.onerror = (e: any) => {
        if (e.error !== "no-speech" && e.error !== "aborted") {
          toast.error("Erro na gravação: " + e.error);
        }
      };
      recognition.onend = () => {
        if (timerRef.current) {
          window.clearInterval(timerRef.current);
          timerRef.current = null;
        }
        setState((s) => (s === "recording" ? "done" : s));
      };

      recognition.start();
      recognitionRef.current = recognition;
      setState("recording");
      timerRef.current = window.setInterval(() => setElapsed((e) => e + 1), 1000);
    } catch (e: any) {
      toast.error("Não foi possível iniciar a gravação: " + (e?.message ?? e));
    }
  };

  const stop = () => {
    try {
      recognitionRef.current?.stop?.();
    } catch {}
  };

  const reset = () => {
    finalRef.current = "";
    setTranscript("");
    setElapsed(0);
    setState("idle");
  };

  return (
    <div className={cn("rounded-md border border-border bg-card p-3 space-y-2", className)}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-medium">
          <Mic className="h-3.5 w-3.5 text-primary" />
          <span>Transcrição de áudio</span>
          {state === "recording" && (
            <span className="flex items-center gap-1 text-destructive">
              <span className="h-2 w-2 animate-pulse rounded-full bg-destructive" />
              Gravando {formatTime(elapsed)}
            </span>
          )}
        </div>
        {onCancel && state === "idle" && (
          <Button type="button" size="icon" variant="ghost" className="h-6 w-6" onClick={onCancel}>
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {state === "idle" && (
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] text-muted-foreground">Grave sua explicação em vez de digitar.</p>
          <Button type="button" size="sm" onClick={start} className="h-8">
            <Mic className="mr-1.5 h-3.5 w-3.5" /> Iniciar gravação
          </Button>
        </div>
      )}

      {state === "recording" && (
        <>
          {transcript && (
            <div className="rounded border border-border bg-muted/30 p-2 text-xs whitespace-pre-wrap max-h-32 overflow-y-auto">
              {transcript}
            </div>
          )}
          <div className="flex justify-end">
            <Button type="button" size="sm" variant="destructive" onClick={stop} className="h-8">
              <Square className="mr-1.5 h-3.5 w-3.5" /> Parar
            </Button>
          </div>
        </>
      )}

      {state === "done" && (
        <>
          <div className="rounded border border-border bg-muted/30 p-2 text-xs whitespace-pre-wrap max-h-40 overflow-y-auto">
            {transcript || <span className="text-muted-foreground">Nada foi transcrito.</span>}
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" size="sm" variant="outline" onClick={reset} className="h-8">
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Gravar novamente
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => {
                if (!transcript.trim()) {
                  toast.error("Nada foi transcrito.");
                  return;
                }
                onConfirm(transcript.trim());
                reset();
              }}
              className="h-8"
              disabled={!transcript.trim()}
            >
              <Check className="mr-1.5 h-3.5 w-3.5" /> Usar este texto
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
