import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Plus, Loader2, Tag } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export interface TicketCategory {
  id: string;
  name: string;
  emoji: string | null;
  color: string;
}

interface TitleCategoryComboboxProps {
  /** Texto atual do título */
  value: string;
  onChange: (title: string) => void;
  /** Disparado quando uma classificação é selecionada (ou criada) */
  onCategorySelected?: (cat: TicketCategory | null) => void;
  placeholder?: string;
  id?: string;
  required?: boolean;
  maxLength?: number;
  className?: string;
  /** Render compacto (h-9) */
  compact?: boolean;
}

export function TitleCategoryCombobox({
  value,
  onChange,
  onCategorySelected,
  placeholder = "Resumo do chamado",
  id,
  required,
  maxLength = 200,
  className,
  compact,
}: TitleCategoryComboboxProps) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
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
    const q = value.trim().toLowerCase();
    const list = categories ?? [];
    if (!q) return list.slice(0, 8);
    return list
      .filter((c) => c.name.toLowerCase().includes(q))
      .slice(0, 10);
  }, [categories, value]);

  const exactMatch = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!q) return null;
    return (categories ?? []).find((c) => c.name.toLowerCase() === q) ?? null;
  }, [categories, value]);

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
      setOpen(false);
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
    setOpen(false);
    // Devolve o foco ao input depois de fechar
    setTimeout(() => inputRef.current?.blur(), 0);
  };

  // Abre dropdown quando há foco e há sugestões ou texto
  useEffect(() => {
    if (!open) return;
    // Fecha se não houver nada para mostrar
    if ((filtered.length === 0) && !(value.trim() && !exactMatch)) {
      // Mantém aberto para permitir a opção "Criar"
    }
  }, [filtered.length, value, exactMatch, open]);

  const showCreate = !!typedText && !exactMatch;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Input
          ref={inputRef}
          id={id}
          required={required}
          value={value}
          maxLength={maxLength}
          placeholder={placeholder}
          className={cn(compact && "h-9", className)}
          onChange={(e) => {
            onChange(e.target.value);
            if (!open) setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
            if (e.key === "Enter") {
              e.preventDefault();
              setOpen(false);
              inputRef.current?.blur();
            }
            if (e.key === "ArrowDown" && filtered.length > 0) {
              e.preventDefault();
              const first = document.querySelector<HTMLButtonElement>(
                "[data-tcc-item='true']",
              );
              first?.focus();
            }
          }}
          autoComplete="off"
          aria-autocomplete="list"
        />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={4}
        className="w-[--radix-popover-trigger-width] p-0 max-h-[280px] overflow-auto"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {filtered.length > 0 && (
          <div className="py-1">
            {filtered.map((c) => (
              <button
                key={c.id}
                type="button"
                data-tcc-item="true"
                onClick={() => handleSelect(c)}
                className="flex w-full items-center gap-2 px-2.5 py-2 text-left text-sm hover:bg-accent focus:bg-accent focus:outline-none"
              >
                <span className="text-base leading-none">{c.emoji || "🏷️"}</span>
                <span className="flex-1 truncate">{c.name}</span>
                <span
                  className="inline-flex h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: c.color }}
                  aria-hidden
                />
              </button>
            ))}
          </div>
        )}

        {filtered.length === 0 && !typedText && (
          <div className="px-3 py-4 text-center text-xs text-muted-foreground">
            <Tag className="mx-auto mb-1 h-4 w-4 opacity-60" />
            Nenhuma classificação ainda.
            <div className="mt-0.5">Digite para criar a primeira.</div>
          </div>
        )}

        {showCreate && (
          <div className="border-t border-border">
            <button
              type="button"
              onClick={() => create.mutate(typedText)}
              disabled={create.isPending}
              className="flex w-full items-center gap-2 px-2.5 py-2 text-left text-sm text-primary hover:bg-accent focus:bg-accent focus:outline-none"
            >
              {create.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Plus className="h-3.5 w-3.5" />
              )}
              <span>
                Criar classificação <strong>"{typedText}"</strong>
              </span>
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
