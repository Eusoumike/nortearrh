import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Sparkles, Loader2, CheckCircle2 } from "lucide-react";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    // Check if this is a recovery session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        toast.error("Link inválido ou expirado.");
        navigate("/auth");
      }
    });
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast.error("As senhas não coincidem.");
      return;
    }

    if (password.length < 6) {
      toast.error("A senha deve ter no mínimo 6 caracteres.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    setSuccess(true);
    toast.success("Senha redefinida com sucesso!");
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
            Redefina sua senha com segurança.
          </h1>
          <p className="max-w-md text-sm leading-relaxed text-primary-foreground/75">
            Escolha uma nova senha forte para proteger sua conta.
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

          {success ? (
            <div className="space-y-4 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-500/10">
                <CheckCircle2 className="h-6 w-6 text-green-500" />
              </div>
              <div>
                <h3 className="font-medium">Senha redefinida!</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Sua senha foi atualizada com sucesso.
                </p>
              </div>
              <Button
                className="w-full bg-gradient-brand text-primary-foreground shadow-sm hover:opacity-90"
                onClick={() => navigate("/auth")}
              >
                Ir para o login
              </Button>
            </div>
          ) : (
            <>
              <h2 className="text-2xl font-semibold tracking-tight mb-1">Nova senha</h2>
              <p className="text-sm text-muted-foreground mb-6">
                Digite sua nova senha abaixo.
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="password">Nova senha</Label>
                  <Input
                    id="password"
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                  <p className="text-[11px] text-muted-foreground">Mínimo 6 caracteres.</p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="confirm-password">Confirmar senha</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    required
                    minLength={6}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-brand text-primary-foreground shadow-sm hover:opacity-90"
                >
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Redefinir senha
                </Button>
              </form>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
