import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";

const TARGET_FIELDS: { key: string; label: string; required?: boolean }[] = [
  { key: "nome", label: "Nome", required: true },
  { key: "email", label: "Email", required: true },
  { key: "empresa", label: "Empresa", required: true },
  { key: "tempo_cliente", label: "Tempo como cliente" },
  { key: "frequencia_uso", label: "Frequência de uso" },
  { key: "nota_atendimento", label: "Nota atendimento (0-10)" },
  { key: "atendimento_evolucao", label: "Evolução do atendimento" },
  { key: "tempo_resposta", label: "Tempo de resposta" },
  { key: "confianca_informacoes", label: "Confiança (0-10)" },
  { key: "nps_score", label: "NPS (0-10)" },
  { key: "feedback_aberto", label: "Feedback aberto" },
  { key: "experiencia_geral", label: "Experiência geral" },
  { key: "sugestao_melhoria", label: "Sugestão de melhoria" },
  { key: "comentario_adicional", label: "Comentário adicional" },
];

const NUMERIC_FIELDS = new Set(["nota_atendimento", "confianca_informacoes", "nps_score"]);

interface ImportNpsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (rows: Record<string, any>[]) => void;
  isImporting: boolean;
}

/** Parser CSV simples com suporte a aspas duplas. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ",") {
        cur.push(cell);
        cell = "";
      } else if (ch === "\n" || ch === "\r") {
        if (ch === "\r" && text[i + 1] === "\n") i++;
        cur.push(cell);
        cell = "";
        if (cur.some((c) => c.trim() !== "")) rows.push(cur);
        cur = [];
      } else {
        cell += ch;
      }
    }
  }
  if (cell !== "" || cur.length > 0) {
    cur.push(cell);
    if (cur.some((c) => c.trim() !== "")) rows.push(cur);
  }
  return rows;
}

export function ImportNpsDialog({
  open,
  onOpenChange,
  onImport,
  isImporting,
}: ImportNpsDialogProps) {
  const [csvText, setCsvText] = useState("");
  const [mapping, setMapping] = useState<Record<string, string>>({});

  const parsed = useMemo(() => {
    if (!csvText.trim()) return null;
    const rows = parseCsv(csvText);
    if (rows.length < 2) return null;
    const [header, ...body] = rows;
    return { header, rows: body };
  }, [csvText]);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setCsvText(String(reader.result ?? ""));
    reader.readAsText(file);
  }

  function autoMap(header: string[]) {
    const next: Record<string, string> = {};
    for (const tf of TARGET_FIELDS) {
      const found = header.find(
        (h) => h.trim().toLowerCase() === tf.key || h.trim().toLowerCase() === tf.label.toLowerCase(),
      );
      if (found) next[tf.key] = found;
    }
    setMapping(next);
  }

  // Auto-map ao parsear
  useMemo(() => {
    if (parsed) autoMap(parsed.header);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parsed?.header.join("|")]);

  function buildRows() {
    if (!parsed) return [];
    const out: Record<string, any>[] = [];
    for (const r of parsed.rows) {
      const obj: Record<string, any> = {};
      for (const tf of TARGET_FIELDS) {
        const colName = mapping[tf.key];
        if (!colName) continue;
        const idx = parsed.header.indexOf(colName);
        if (idx === -1) continue;
        const raw = (r[idx] ?? "").trim();
        if (!raw) {
          obj[tf.key] = null;
          continue;
        }
        if (NUMERIC_FIELDS.has(tf.key)) {
          const n = Number(raw.replace(",", "."));
          obj[tf.key] = Number.isFinite(n) ? Math.max(0, Math.min(10, Math.round(n))) : null;
        } else {
          obj[tf.key] = raw;
        }
      }
      // Validação mínima
      if (obj.nome && obj.email && obj.empresa) out.push(obj);
    }
    return out;
  }

  function handleImport() {
    const rows = buildRows();
    if (rows.length === 0) {
      toast.error("Nenhuma linha válida encontrada (nome, email e empresa são obrigatórios).");
      return;
    }
    onImport(rows);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar feedbacks (CSV)</DialogTitle>
          <DialogDescription>
            Cole o conteúdo do CSV ou faça upload do arquivo. As colunas são mapeadas
            automaticamente quando o nome bate.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={handleFile}
              className="block text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Ou cole o CSV abaixo</Label>
            <Textarea
              rows={6}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder="nome,email,empresa,nps_score..."
              className="font-mono text-xs"
            />
          </div>

          {parsed && (
            <>
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Preview (primeiras 3 linhas)
                </h3>
                <div className="overflow-x-auto rounded-md border">
                  <table className="min-w-full text-xs">
                    <thead className="bg-surface-muted/50">
                      <tr>
                        {parsed.header.map((h, i) => (
                          <th key={i} className="px-2 py-1 text-left font-medium">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {parsed.rows.slice(0, 3).map((r, ri) => (
                        <tr key={ri} className="border-t">
                          {r.map((c, ci) => (
                            <td key={ci} className="max-w-[160px] truncate px-2 py-1">
                              {c}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Mapeamento de colunas
                </h3>
                <div className="grid gap-2 sm:grid-cols-2">
                  {TARGET_FIELDS.map((tf) => (
                    <div key={tf.key} className="flex items-center justify-between gap-2">
                      <Label className="text-xs">
                        {tf.label}
                        {tf.required && <span className="text-destructive"> *</span>}
                      </Label>
                      <Select
                        value={mapping[tf.key] ?? "__none__"}
                        onValueChange={(v) =>
                          setMapping((m) => {
                            const next = { ...m };
                            if (v === "__none__") delete next[tf.key];
                            else next[tf.key] = v;
                            return next;
                          })
                        }
                      >
                        <SelectTrigger className="h-8 w-[180px] text-xs">
                          <SelectValue placeholder="—" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">— Não importar —</SelectItem>
                          {parsed.header.map((h) => (
                            <SelectItem key={h} value={h}>
                              {h}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleImport}
            disabled={!parsed || isImporting}
            className="bg-gradient-brand text-primary-foreground hover:opacity-90"
          >
            {isImporting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            Importar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
