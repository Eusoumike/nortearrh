import { useEffect, useMemo, useState } from "react";
import { Check, ChevronsUpDown, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import {
  getClientPrimary,
  getClientSecondary,
  getClientLabel,
  filterAndSortClients,
} from "@/lib/clientDisplay";

export type ClientOption = {
  id: string;
  name: string;
  cnpj: string | null;
  company?: string | null;
  contact_name?: string | null;
};

interface Props {
  value: string | null;
  onSelect: (client: ClientOption | null) => void;
  disabled?: boolean;
}

export function ClientCombobox({ value, onSelect, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ["clients-combobox"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name, cnpj, company, contact_name")
        .order("name");
      if (error) throw error;
      return (data ?? []) as ClientOption[];
    },
  });

  const selected = useMemo(
    () => clients.find((c) => c.id === value) ?? null,
    [clients, value],
  );

  const filtered = useMemo(() => {
    return filterAndSortClients(clients, search).slice(0, 50);
  }, [clients, search]);

  useEffect(() => {
    if (!open) setSearch("");
  }, [open]);

  return (
    <div className="flex items-center gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            disabled={disabled}
            className="w-full justify-between font-normal"
          >
            <span className={cn("truncate", !selected && "text-muted-foreground")}>
              {selected
                ? getClientLabel(selected)
                : isLoading
                  ? "Carregando…"
                  : "Selecionar cliente"}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Buscar por empresa, contato ou CNPJ…"
              value={search}
              onValueChange={setSearch}
            />
            <CommandList>
              <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
              <CommandGroup>
                {filtered.map((c) => (
                  <CommandItem
                    key={c.id}
                    value={c.id}
                    onSelect={() => {
                      onSelect(c);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === c.id ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">{getClientPrimary(c)}</span>
                      {getClientSecondary(c) && (
                        <span className="text-xs text-muted-foreground">
                          {getClientSecondary(c)}
                        </span>
                      )}
                      {c.cnpj && (
                        <span className="text-[10px] text-muted-foreground">CNPJ: {c.cnpj}</span>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {selected && (
        <Button asChild variant="ghost" size="icon" title="Ver perfil do cliente">
          <Link to={`/clientes/${selected.id}`}>
            <ExternalLink className="h-4 w-4" />
          </Link>
        </Button>
      )}
    </div>
  );
}
