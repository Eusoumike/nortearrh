import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface TemaAutocompleteProps {
  value: string;
  onChange: (tema: string, moduloSugerido?: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
  compact?: boolean;
}

export function TemaAutocomplete({
  value,
  onChange,
  placeholder = "Digite ou selecione um tema…",
  disabled,
  compact,
}: TemaAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const { data: temas = [] } = useQuery({
    queryKey: ["temas-frequentes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ticket_temas_frequentes")
        .select("tema, modulo_afetado_sugerido, total_ocorrencias")
        .eq("ativo", true)
        .order("total_ocorrencias", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 60_000,
  });

  const q = search.trim().toLowerCase();
  const filtrados = useMemo(() => {
    if (!q) return temas;
    return temas.filter((t: any) => (t.tema ?? "").toLowerCase().includes(q));
  }, [temas, q]);

  const exactMatch = temas.some(
    (t: any) => (t.tema ?? "").toLowerCase() === q,
  );

  const handleSelect = (tema: string, moduloSugerido?: string | null) => {
    onChange(tema, moduloSugerido ?? null);
    setSearch("");
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          disabled={disabled}
          className={cn(
            "w-full justify-between font-normal",
            compact && "h-9",
            !value && "text-muted-foreground",
          )}
        >
          <span className="truncate text-left">{value || placeholder}</span>
          <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Buscar tema…"
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            {filtrados.length === 0 && !q && (
              <CommandEmpty>Nenhum tema cadastrado.</CommandEmpty>
            )}
            {filtrados.length > 0 && (
              <CommandGroup heading="Temas frequentes">
                {filtrados.map((t: any) => (
                  <CommandItem
                    key={t.tema}
                    value={t.tema}
                    onSelect={() => handleSelect(t.tema, t.modulo_afetado_sugerido)}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-3.5 w-3.5",
                        value === t.tema ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm">{t.tema}</span>
                    </div>
                    <span className="ml-2 text-[10px] text-muted-foreground">
                      {t.total_ocorrencias}×
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {q && !exactMatch && (
              <CommandGroup heading="Novo">
                <CommandItem
                  value={`__new__:${search}`}
                  onSelect={() => handleSelect(search.trim())}
                >
                  <Plus className="mr-2 h-3.5 w-3.5" />
                  <span className="text-sm">
                    Criar tema: <strong>{search.trim()}</strong>
                  </span>
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
