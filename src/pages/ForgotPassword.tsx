import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Sparkles, Loader2, ArrowLeft, Mail } from "lucide-react";

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    setLoading(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    setSent(true);
    toast.success("E-mail de recuperação enviado! Verifique sua caixa de entrada.");
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden bg-gradient-brand lg:flex lg:flex-col lg:justify-between lg:p-12 overflow-hidden">
        <div className="absolute inset-0 opacity-30 [background:radial-gradient(circle_at_30%_20%,hsl(var(--primary-glow)/0.6),transparent_50%),radial-gradient(circle_at_70%_80%,hsl(var(--accent)/0.4),transparent_50%)]" />
        <div className="relative flex items-center gap-2 text-primary-foreground">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/90 shadow-lg">
            <Sparkles className="h-4 w-4 text-accent-foreground" />
          </div>
          <div>
            <p className="text-sm font-semibold tracking-tight">Hub</p>
            <p className="text-[11px] uppercase tracking-wider opacity-70">Customer Success</p>
          </div>
        </div>
        <div className="relative space-y-4 text-primary-foreground">
          <h1 className="text-4xl font-semibold leading-tight tracking-tight text-balance">
            Recupere o acesso à sua conta.
          </h1>
          <p className="max-w-md text-sm leading-relaxed text-primary-foreground/75">
            Enviaremos um link seguro para o seu e-mail para que você possa redefinir sua senha.
          </p>
        </div>
        <div className="relative grid grid-cols-3 gap-4 text-primary-foreground/80">
          {[
            { k: "98.4%", v: "SLA cumprido" },
            { k: "12min", v: "Resp. média" },
            { k: "+27%", v: "Resolução" },
          ].map((m) => (
            <div key={m.k}>
              <p className="font-mono text-2xl font-semibold text-primary-foreground">{m.k}</p>
              <p className="text-[11px] uppercase tracking-wider">{m.v}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center p-6">
        <Card className="w-full max-w-md p-8 shadow-elevated">
          <div className="mb-6 lg:hidden">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-brand">
                <Sparkles className="h-4 w-4 text-primary-foreground" />
              </div>
              <p className="text-lg font-semibold tracking-tight">Hub</p>
            </div>
          </div>

          <button
            onClick={() => navigate("/auth")}
            className="mb-4 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar para o login
          </button>

          <h2 className="text-2xl font-semibold tracking-tight mb-1">Esqueceu a senha?</h2>
          <p className="text-sm text-muted-foreground mb-6">
            Digite seu e-mail abaixo e enviaremos um link para redefinição.
          </p>

          {sent ? (
            <div className="space-y-4 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <Mail className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-medium">E-mail enviado!</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Verifique sua caixa de entrada (e pasta de spam) em <strong>{email}</strong>.
                </p>
              </div>
              <Button variant="outline" className="w-full" onClick={() => navigate("/auth")}>
                Voltar para o login
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="voce@empresa.com"
                />
              </div>
              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-brand text-primary-foreground shadow-sm hover:opacity-90"
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Enviar link de recuperação
              </Button>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
}
