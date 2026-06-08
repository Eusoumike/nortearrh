import { Link } from "react-router-dom";
import { Building2, Mail, Phone, MessageCircle, MapPin, ExternalLink } from "lucide-react";
import { formatCnpj } from "@/lib/formatters";
import { ClientCompletenessBadge } from "@/components/ClientCompletenessBadge";
import { cn } from "@/lib/utils";

const PRODUCT_LABEL: Record<string, string> = {
  rh_digital: "RH Digital",
  vr_beneficios: "VR Benefícios",
};

interface Props {
  client: any;
  className?: string;
  showLink?: boolean;
}

export function ClientPreviewCard({ client, className, showLink = true }: Props) {
  if (!client) return null;
  const org =
    client.razao_social || client.company || client.organization || client.name || "—";
  const nomeFantasia = client.nome_fantasia;
  const contato = client.contact_name;
  const cargo = client.contact_cargo;
  const email = client.contact_email || client.email;
  const phone = client.contact_phone || client.phone;
  const whatsapp = client.contact_whatsapp || client.whatsapp;
  const municipio = client.municipio;
  const estado = client.estado;
  const cnpj = client.cnpj;
  const products: string[] = client.products ?? [];

  return (
    <div className={cn("rounded-md border bg-muted/30 p-3 text-sm", className)}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 font-semibold">
            <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate">{org}</span>
          </div>
          {nomeFantasia && nomeFantasia !== org && (
            <p className="truncate text-xs text-muted-foreground">{nomeFantasia}</p>
          )}
          {cnpj && (
            <p className="font-mono text-[11px] text-muted-foreground">CNPJ: {formatCnpj(cnpj)}</p>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <ClientCompletenessBadge client={client} compact />
          {showLink && client.id && (
            <Link
              to={`/clientes/${client.id}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
            >
              Ver perfil <ExternalLink className="h-3 w-3" />
            </Link>
          )}
        </div>
      </div>

      {(contato || email || phone || whatsapp || municipio) && (
        <div className="mt-2 space-y-1 text-xs text-muted-foreground">
          {contato && (
            <p className="truncate">
              <span className="text-foreground">{contato}</span>
              {cargo && <span className="text-muted-foreground"> · {cargo}</span>}
            </p>
          )}
          {phone && (
            <a
              href={`tel:${phone}`}
              className="flex items-center gap-1.5 hover:text-foreground"
            >
              <Phone className="h-3 w-3" /> {phone}
            </a>
          )}
          {whatsapp && whatsapp !== phone && (
            <a
              href={`https://wa.me/${whatsapp.replace(/\D/g, "")}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 hover:text-foreground"
            >
              <MessageCircle className="h-3 w-3" /> {whatsapp}
            </a>
          )}
          {email && (
            <a
              href={`mailto:${email}`}
              className="flex items-center gap-1.5 truncate hover:text-foreground"
            >
              <Mail className="h-3 w-3 shrink-0" /> {email}
            </a>
          )}
          {(municipio || estado) && (
            <p className="flex items-center gap-1.5">
              <MapPin className="h-3 w-3" /> {[municipio, estado].filter(Boolean).join(" / ")}
            </p>
          )}
        </div>
      )}

      {products.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {products.map((p) => (
            <span
              key={p}
              className="rounded-full border bg-background px-2 py-0.5 text-[10px] font-medium"
            >
              {PRODUCT_LABEL[p] ?? p}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
