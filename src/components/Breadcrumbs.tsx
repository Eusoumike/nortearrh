import { Link, useLocation, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ChevronRight } from "lucide-react";
import { useMemo } from "react";

const STATIC_LABELS: Record<string, string> = {
  "": "Dashboard",
  tickets: "Chamados",
  tarefas: "Tarefas",
  implantacao: "Implantação",
  clientes: "Clientes",
  crm: "CRM",
  pipeline: "Pipeline",
  atividades: "Atividades",
  analytics: "Analytics",
  financeiro: "Financeiro",
  performance: "Performance",
  nps: "NPS",
  configuracoes: "Configurações",
  inbox: "Caixa de entrada",
  novo: "Novo",
};

export function Breadcrumbs() {
  const { pathname } = useLocation();
  const params = useParams();

  const parts = useMemo(() => pathname.split("/").filter(Boolean), [pathname]);

  // Detect entity ids (uuid-ish) to fetch dynamic label
  const dynamicSegment = parts.find((p) => /^[0-9a-f-]{8,}$/i.test(p));
  const parent = dynamicSegment ? parts[parts.indexOf(dynamicSegment) - 1] : null;

  const { data: dynamicLabel } = useQuery({
    queryKey: ["breadcrumb-label", parent, dynamicSegment],
    enabled: !!dynamicSegment && !!parent,
    queryFn: async () => {
      if (!dynamicSegment) return null;
      if (parent === "tickets") {
        const { data } = await supabase.from("tickets").select("ticket_number").eq("id", dynamicSegment).maybeSingle();
        return data?.ticket_number ? `#${data.ticket_number}` : null;
      }
      if (parent === "clientes") {
        const { data } = await supabase.from("clients").select("company, name").eq("id", dynamicSegment).maybeSingle();
        return data?.company || data?.name || null;
      }
      if (parent === "crm") {
        const { data } = await supabase.from("deals").select("company_name, title").eq("id", dynamicSegment).maybeSingle();
        return data?.company_name || data?.title || null;
      }
      return null;
    },
  });

  if (parts.length === 0) {
    return <span className="text-sm font-medium text-foreground">Dashboard</span>;
  }

  const crumbs: { label: string; href?: string }[] = [];
  let acc = "";
  for (const p of parts) {
    acc += "/" + p;
    if (p === dynamicSegment) {
      crumbs.push({ label: dynamicLabel ?? "…" });
    } else {
      crumbs.push({ label: STATIC_LABELS[p] ?? p, href: acc });
    }
  }

  return (
    <nav className="flex min-w-0 items-center gap-1.5 text-sm">
      {crumbs.map((c, i) => {
        const isLast = i === crumbs.length - 1;
        return (
          <div key={i} className="flex items-center gap-1.5 min-w-0">
            {i > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />}
            {isLast || !c.href ? (
              <span className="truncate font-medium text-foreground">{c.label}</span>
            ) : (
              <Link to={c.href} className="truncate text-muted-foreground hover:text-foreground transition-colors">
                {c.label}
              </Link>
            )}
          </div>
        );
      })}
    </nav>
  );
}
