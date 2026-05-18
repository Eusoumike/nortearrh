import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Sparkles, Loader2, Apple } from "lucide-react";
import { lovable } from "@/integrations/lovable";

export default function Auth() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate("/", { replace: true });
    });
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error(error.message === "Invalid login credentials" ? "Credenciais inválidas." : error.message);
      return;
    }
    toast.success("Bem-vindo de volta!");
    navigate("/", { replace: true });
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: { full_name: fullName },
      },
    });
    setLoading(false);
    if (error) {
      if (error.message.includes("already registered")) toast.error("E-mail já cadastrado.");
      else toast.error(error.message);
      return;
    }
    toast.success("Conta criada! Aguarde um administrador liberar seu acesso aos dados.");
    navigate("/", { replace: true });
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
            A central de operações da sua equipe de sucesso do cliente.
          </h1>
          <p className="max-w-md text-sm leading-relaxed text-primary-foreground/75">
            Tickets, SLAs, implantação, clientes e integrações reunidos em uma única plataforma calma — feita para times que prezam por profundidade.
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

          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Entrar</TabsTrigger>
              <TabsTrigger value="signup">Criar conta</TabsTrigger>
            </TabsList>

            <TabsContent value="login" className="mt-6">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email-l">E-mail</Label>
                  <Input id="email-l" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@empresa.com" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pass-l">Senha</Label>
                  <Input id="pass-l" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
                <Button type="submit" disabled={loading} className="w-full bg-gradient-brand text-primary-foreground shadow-sm hover:opacity-90">
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Entrar no Hub
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup" className="mt-6">
              <form onSubmit={handleSignup} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="name-s">Nome completo</Label>
                  <Input id="name-s" required value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Maria Silva" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email-s">E-mail</Label>
                  <Input id="email-s" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@empresa.com" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pass-s">Senha</Label>
                  <Input id="pass-s" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
                  <p className="text-[11px] text-muted-foreground">Mínimo 6 caracteres.</p>
                </div>
                <Button type="submit" disabled={loading} className="w-full bg-gradient-brand text-primary-foreground shadow-sm hover:opacity-90">
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Criar minha conta
                </Button>
                <p className="text-center text-[11px] text-muted-foreground">
                  O primeiro usuário do workspace recebe acesso de administrador. Demais contas começam como visualizador e precisam ser promovidas por um admin antes de acessar tickets, clientes e interações.
                </p>
              </form>
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </div>
  );
}
