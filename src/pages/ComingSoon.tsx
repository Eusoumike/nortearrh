import { Card } from "@/components/ui/card";
import { Construction } from "lucide-react";

export default function ComingSoon({ title, description }: { title: string; description?: string }) {
  return (
    <div className="p-6">
      <Card className="flex flex-col items-center justify-center py-20 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/15 text-accent">
          <Construction className="h-5 w-5" />
        </div>
        <h2 className="mt-4 text-lg font-semibold">{title}</h2>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description ?? "Este módulo chega na próxima onda. Estamos focando primeiro no essencial: tickets, clientes e dashboard."}</p>
      </Card>
    </div>
  );
}
