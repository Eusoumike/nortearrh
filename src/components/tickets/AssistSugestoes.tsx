import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Lightbulb, ExternalLink } from "lucide-react";

interface Props {
  tema?: string | null;
  moduloAfetado?: string | null;
}

export function AssistSugestoes({ tema, moduloAfetado }: Props) {
  const { data: artigos = [] } = useQuery({
    queryKey: ["assist-sugestoes", tema ?? "", moduloAfetado ?? ""],
    enabled: !!(tema || moduloAfetado),
    queryFn: async () => {
      let query = supabase
        .from("assist_artigos")
        .select("id, titulo, passos_solucao, modulo_afetado, tema_relacionado")
        .eq("publicado", true)
        .order("util_positivo", { ascending: false })
        .limit(3);
      if (tema) query = query.eq("tema_relacionado", tema);
      else if (moduloAfetado) query = query.eq("modulo_afetado", moduloAfetado);
      const { data } = await query;
      return data ?? [];
    },
    staleTime: 60_000,
  });

  if (!artigos.length) return null;

  return (
    <div className="rounded-lg border border-warning/30 bg-warning/5 p-3">
      <div className="mb-2 flex items-center gap-2">
        <Lightbulb className="h-4 w-4 text-warning" />
        <h4 className="text-sm font-semibold">Sugestões da base de conhecimento</h4>
      </div>
      <p className="mb-2 text-xs text-muted-foreground">
        Já resolvemos problemas parecidos antes. Pode ser útil consultar:
      </p>
      <ul className="space-y-1.5">
        {artigos.map((art: any) => (
          <li key={art.id}>
            <Link
              to={`/assist?artigo=${art.id}`}
              target="_blank"
              rel="noreferrer"
              className="group block rounded border-l-2 border-warning bg-background/60 p-2 hover:bg-background"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-xs font-medium text-foreground group-hover:text-primary">
                  {art.titulo}
                </span>
                <ExternalLink className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
              </div>
              {art.passos_solucao && (
                <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">
                  {art.passos_solucao}
                </p>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
