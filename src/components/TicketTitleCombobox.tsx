import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Check, ChevronsUpDown, Plus, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface TicketTitle {
  id: string;
  name: string;
}

interface Props {
  value: string;
  onChange: (title: string) => void;
  id?: string;
  required?: boolean;
  placeholder?: string;
  className?: string;
  compact?: boolean;
}

export function TicketTitleCombobox({
  value,
  onChange,
  id,
  required,
  placeholder = "Selecione ou digite o título…",
  className,
  compact,
}: Props) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const { data: titles } = useQuery({
    queryKey: ["ticket-titles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ticket_titles" as any)
        .select("id, name")
        .order("name");
      if (error) throw error;
      return (data ?? []) as unknown as TicketTitle[];
    },
  });

  const trimmed = search.trim();
  const list = titles ?? [];

  const exactMatch = useMemo(
    () => list.find((t) => t.name.toLowerCase() === trimmed.toLowerCase()),
    [list, trimmed],
  );

  const create = useMutation({
    mutationFn: async (name: string) => {
      const n = name.trim();
      if (!n) throw new Error("Nome vazio");
      const { data, error } = await supabase
        .from("ticket_titles" as any)
        .insert({ name: n, created_by: user?.id ?? null } as any)
        .select("id, name")
        .single();
      if (error) throw error;
      return data as unknown as TicketTitle;
    },
    onSuccess: (t) => {
      qc.invalidateQueries({ queryKey: ["ticket-titles"] });
      onChange(t.name);
      setOpen(false);
      setSearch("");
      toast.success(`Título "${t.name}" criado.`);
    },
    onError: (e: any) => {
      const msg = String(e.message ?? "");
      if (msg.includes("unique") || msg.includes("duplicate")) {
        toast.error("Já existe um título com esse nome.");
      } else {
        toast.error(msg || "Erro ao criar título.");
      }
    },
  });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-required={required}
          className={cn(
            "w-full justify-between font-normal",
            compact ? "h-9" : "h-10",
            !value && "text-muted-foreground",
            className,
          )}
        >
          <span className="truncate">{value || placeholder}</span>
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={true}>
          <CommandInput
            placeholder="Buscar ou digitar novo…"
            className="h-9"
            value={search}
            onValueChange={setSearch}
          />
          <CommandList className="max-h-[280px]">
            <CommandEmpty className="py-3 text-center text-xs text-muted-foreground">
              Nenhum título encontrado.
            </CommandEmpty>
            <CommandGroup>
              {list.map((t) => (
                <CommandItem
                  key={t.id}
                  value={t.name}
                  onSelect={() => {
                    onChange(t.name);
                    setOpen(false);
                    setSearch("");
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-3.5 w-3.5",
                      value === t.name ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <span className="truncate">{t.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
            {trimmed && !exactMatch && (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem
                    value={`__create__${trimmed}`}
                    onSelect={() => create.mutate(trimmed)}
                    disabled={create.isPending}
                    className="text-primary"
                  >
                    {create.isPending ? (
                      <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Plus className="mr-2 h-3.5 w-3.5" />
                    )}
                    <span>
                      Criar nova: <strong>"{trimmed}"</strong>
                    </span>
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
