import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Plus, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export interface TicketCategory {
  id: string;
  name: string;
  emoji: string | null;
  color: string;
}

interface Props {
  value: string;
  onChange: (title: string) => void;
  onCategorySelected?: (cat: TicketCategory | null) => void;
  placeholder?: string;
  id?: string;
  required?: boolean;
  maxLength?: number;
  className?: string;
  compact?: boolean;
}

export function TitleWithCategorySuggestions({
  value,
  onChange,
  onCategorySelected,
  placeholder = "Resumo do chamado",
  id,
  required,
  maxLength = 200,
  className,
  compact,
}: Props) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [focused, setFocused] = useState(false);
  const typedText = value.trim();

  const { data: categories } = useQuery({
    queryKey: ["ticket-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ticket_categories" as any)
        .select("id, name, emoji, color")
        .order("name");
      if (error) throw error;
      return (data ?? []) as unknown as TicketCategory[];
    },
  });

  const filtered = useMemo(() => {
    const q = typedText.toLowerCase();
    const list = categories ?? [];
    if (!q) return [];
    return list.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 8);
  }, [categories, typedText]);

  const exactMatch = useMemo(() => {
    const q = typedText.toLowerCase();
    if (!q) return null;
    return (categories ?? []).find((c) => c.name.toLowerCase() === q) ?? null;
  }, [categories, typedText]);

  const create = useMutation({
    mutationFn: async (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) throw new Error("Nome vazio");
      const { data, error } = await supabase
        .from("ticket_categories" as any)
        .insert({
          name: trimmed,
          emoji: "🏷️",
          color: "#0F7173",
          created_by: user?.id ?? null,
        } as any)
        .select("id, name, emoji, color")
        .single();
      if (error) throw error;
      return data as unknown as TicketCategory;
    },
    onSuccess: (cat) => {
      qc.invalidateQueries({ queryKey: ["ticket-categories"] });
      onChange(cat.name);
      onCategorySelected?.(cat);
      toast.success(`Classificação "${cat.name}" criada.`);
    },
    onError: (e: any) => {
      const msg = String(e.message ?? "");
      if (msg.includes("unique") || msg.includes("duplicate")) {
        toast.error("Já existe uma classificação com esse nome.");
      } else {
        toast.error(msg || "Erro ao criar classificação.");
      }
    },
  });

  const handleSelect = (cat: TicketCategory) => {
    onChange(cat.name);
    onCategorySelected?.(cat);
  };

  const showSuggestions = focused && filtered.length > 0;
  const showCreate = focused && typedText.length > 2 && !exactMatch;

  return (
    <div className="space-y-1.5">
      <Input
        id={id}
        required={required}
        value={value}
        maxLength={maxLength}
        placeholder={placeholder}
        className={cn(compact && "h-9", className)}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          // delay para permitir clique nos chips
          setTimeout(() => setFocused(false), 150);
        }}
        autoComplete="off"
      />

      {(showSuggestions || showCreate) && (
        <div className="flex flex-wrap items-center gap-1.5">
          {filtered.map((c) => (
            <button
              key={c.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleSelect(c)}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2.5 py-1 text-xs hover:bg-accent hover:text-accent-foreground transition-colors"
              style={{ borderColor: `${c.color}40` }}
            >
              <span className="leading-none">{c.emoji || "🏷️"}</span>
              <span>{c.name}</span>
              <span
                className="inline-flex h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: c.color }}
                aria-hidden
              />
            </button>
          ))}

          {showCreate && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => create.mutate(typedText)}
              disabled={create.isPending}
              className="inline-flex items-center gap-1 rounded-full border border-dashed border-primary/40 bg-primary/5 px-2.5 py-1 text-xs text-primary hover:bg-primary/10 transition-colors disabled:opacity-60"
            >
              {create.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Plus className="h-3 w-3" />
              )}
              <span>
                Criar classificação <strong>"{typedText}"</strong>
              </span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
