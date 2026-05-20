import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Check, X, Trash2, UserPlus, Settings as SettingsIcon, Copy, Phone, Mail, Link as LinkIcon, User, Users, Headphones, Rocket, DollarSign, Plug, Palette } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import type { Database } from "@/integrations/supabase/types";
import { TicketTitlesManager } from "@/components/settings/TicketTitlesManager";
import { HistoricoComissoesSection } from "@/components/settings/HistoricoComissoesSection";
import { ComissoesPadraoSection } from "@/components/settings/ComissoesPadraoSection";
import { ImplantacaoStagesManager } from "@/components/settings/ImplantacaoStagesManager";
import { AssistSolutionsCard } from "@/components/settings/AssistSolutionsCard";

type AppRole = Database["public"]["Enums"]["app_role"];

const TIMEZONES = [
  { value: "America/Sao_Paulo", label: "Brasília (GMT-3)" },
  { value: "America/Manaus", label: "Manaus (GMT-4)" },
  { value: "America/Rio_Branco", label: "Rio Branco (GMT-5)" },
  { value: "America/Noronha", label: "Fernando de Noronha (GMT-2)" },
  { value: "UTC", label: "UTC (GMT+0)" },
  { value: "America/New_York", label: "Nova York (GMT-5/-4)" },
  { value: "Europe/Lisbon", label: "Lisboa (GMT+0/+1)" },
];

const ROLE_LABEL: Record<AppRole, string> = {
  admin: "Admin",
  manager: "Gerente",
  agent: "Atendente",
  viewer: "Visualizador",
};

export default function Settings() {
  const { user, role } = useAuth();
  const isAdmin = role === "admin";
  const qc = useQueryClient();

  // === Timezone ===


  // === Timezone ===
  const [systemTz, setSystemTz] = useState("America/Sao_Paulo");
  const [tzNow, setTzNow] = useState("");

  // === Profile ===
  const [fullName, setFullName] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");

  // === Aparência ===
  const [theme, setTheme] = useState<"light" | "dark">("light");

  // === Equipe ===
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<AppRole>("agent");
  const [removeTarget, setRemoveTarget] = useState<{ id: string; name: string } | null>(null);

  // ----- Carregar dados -----
  const { data: systemSettings } = useQuery({
    queryKey: ["system-settings"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data } = await supabase
        .from("system_settings")
        .select("id, timezone")
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  const { data: userSettings } = useQuery({
    queryKey: ["user-settings", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("user_settings")
        .select("theme")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  const { data: profile } = useQuery({
    queryKey: ["profile-self", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  const { data: team } = useQuery({
    queryKey: ["team-list"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .order("full_name", { ascending: true });
      const { data: roles } = await supabase.from("user_roles").select("user_id, role");
      const byUser = new Map<string, AppRole>();
      (roles ?? []).forEach((r) => byUser.set(r.user_id, r.role));
      return (profiles ?? [])
        .map((p) => ({ ...p, role: byUser.get(p.id) ?? null }))
        .filter((p) => p.role !== null);
    },
  });

  // ----- Sincronizar estados quando dados chegam -----
  useEffect(() => {
    if (systemSettings) {
      setSystemTz(systemSettings.timezone ?? "America/Sao_Paulo");
    }
  }, [systemSettings]);


  useEffect(() => {
    if (userSettings) {
      setTheme((userSettings.theme as "light" | "dark") ?? "light");
    }
  }, [userSettings]);

  useEffect(() => {
    if (profile) setFullName(profile.full_name ?? "");
  }, [profile]);

  // Aplicar tema
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  // Relógio do fuso
  useEffect(() => {
    const update = () => {
      try {
        setTzNow(
          new Intl.DateTimeFormat("pt-BR", {
            timeZone: systemTz,
            dateStyle: "short",
            timeStyle: "medium",
          }).format(new Date()),
        );
      } catch {
        setTzNow("—");
      }
    };
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, [systemTz]);



  // ----- Ações: Timezone -----
  async function handleSaveTimezone() {
    const upsert = {
      ...(systemSettings?.id ? { id: systemSettings.id } : {}),
      timezone: systemTz,
      updated_by: user!.id,
    };
    const { error } = await supabase.from("system_settings").upsert(upsert);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Fuso horário salvo" });
    qc.invalidateQueries({ queryKey: ["system-settings"] });
  }

  // ----- Ações: Perfil -----
  async function handleSaveProfile() {
    if (newPwd && newPwd !== confirmPwd) {
      toast({ title: "Senhas não conferem", variant: "destructive" });
      return;
    }
    if (newPwd && newPwd.length < 6) {
      toast({ title: "Senha deve ter ao menos 6 caracteres", variant: "destructive" });
      return;
    }

    const { error: pErr } = await supabase
      .from("profiles")
      .update({ full_name: fullName })
      .eq("id", user!.id);
    if (pErr) {
      toast({ title: "Erro ao salvar perfil", description: pErr.message, variant: "destructive" });
      return;
    }

    if (newPwd) {
      const { error: pwErr } = await supabase.auth.updateUser({ password: newPwd });
      if (pwErr) {
        toast({ title: "Erro ao trocar senha", description: pwErr.message, variant: "destructive" });
        return;
      }
      setNewPwd("");
      setConfirmPwd("");
    }

    toast({ title: "Perfil atualizado" });
    qc.invalidateQueries({ queryKey: ["profile-self", user?.id] });
  }

  // ----- Ações: Aparência -----
  async function handleSaveTheme(next: "light" | "dark") {
    setTheme(next);
    const upsert = { user_id: user!.id, theme: next, timezone: systemTz };
    const { error } = await supabase.from("user_settings").upsert(upsert);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    qc.invalidateQueries({ queryKey: ["user-settings", user?.id] });
  }

  // ----- Ações: Equipe -----
  async function handleInvite() {
    if (!inviteEmail.trim()) return;
    const { error } = await supabase.auth.signUp({
      email: inviteEmail.trim(),
      password: crypto.randomUUID(),
      options: { emailRedirectTo: `${window.location.origin}/auth` },
    });
    if (error) {
      toast({ title: "Erro ao convidar", description: error.message, variant: "destructive" });
      return;
    }
    toast({
      title: "Convite enviado",
      description: `O usuário receberá email para definir senha. Defina o papel após o primeiro login.`,
    });
    setInviteOpen(false);
    setInviteEmail("");
    setInviteRole("agent");
    qc.invalidateQueries({ queryKey: ["team-list"] });
  }

  async function handleChangeRole(userId: string, newRole: AppRole) {
    const { error } = await supabase.rpc("admin_set_user_role", {
      _target_user: userId,
      _role: newRole,
    });
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Papel atualizado" });
    qc.invalidateQueries({ queryKey: ["team-list"] });
  }

  async function handleRemoveAccess() {
    if (!removeTarget) return;
    const target = removeTarget;
    const { error } = await supabase.rpc("admin_remove_user_access", {
      _target_user: target.id,
    });
    if (error) {
      toast({ title: "Erro ao remover acesso", description: error.message, variant: "destructive" });
      return;
    }
    // Atualiza cache local imediatamente removendo o usuário da lista
    qc.setQueryData<typeof team>(["team-list"], (prev) =>
      (prev ?? []).filter((u) => u.id !== target.id),
    );
    toast({ title: "Usuário removido com sucesso", description: target.name });
    setRemoveTarget(null);
    qc.invalidateQueries({ queryKey: ["team-list"] });
  }

  const categories = [
    { key: "perfil", label: "Perfil", icon: User, show: true },
    { key: "equipe", label: "Equipe", icon: Users, show: isAdmin },
    { key: "suporte", label: "Suporte", icon: Headphones, show: true },
    { key: "onboarding", label: "Onboarding", icon: Rocket, show: true },
    { key: "financeiro", label: "Financeiro", icon: DollarSign, show: isAdmin },
    { key: "integracoes", label: "Integrações", icon: Plug, show: isAdmin },
    { key: "aparencia", label: "Aparência", icon: Palette, show: true },
  ].filter((c) => c.show);

  const [activeCategory, setActiveCategory] = useState<string>("perfil");

  return (
    <div className="flex flex-1 flex-col">
      <div className="border-b border-border px-6 py-4">
        <div className="flex items-center gap-3">
          <SettingsIcon className="h-6 w-6 text-muted-foreground" />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Configurações</h1>
            <p className="text-sm text-muted-foreground">Integrações, equipe e preferências.</p>
          </div>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Sidebar */}
        <aside className="w-[220px] shrink-0 border-r border-border bg-muted/20 p-3">
          <nav className="space-y-1">
            {categories.map((c) => {
              const Icon = c.icon;
              const active = activeCategory === c.key;
              return (
                <button
                  key={c.key}
                  onClick={() => setActiveCategory(c.key)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                    active
                      ? "bg-accent text-accent-foreground font-medium"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {c.label}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl space-y-6 p-6">
            {activeCategory === "perfil" && (
              <Card>
                <CardHeader>
                  <CardTitle>Meu perfil</CardTitle>
                  <CardDescription>Atualize seu nome e senha de acesso.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="full-name">Nome</Label>
                      <Input id="full-name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input id="email" value={user?.email ?? ""} disabled />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="new-pwd">Nova senha</Label>
                      <Input id="new-pwd" type="password" value={newPwd}
                        onChange={(e) => setNewPwd(e.target.value)}
                        placeholder="(deixe em branco para não trocar)" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirm-pwd">Confirmar senha</Label>
                      <Input id="confirm-pwd" type="password" value={confirmPwd}
                        onChange={(e) => setConfirmPwd(e.target.value)} />
                    </div>
                  </div>
                  <Button onClick={handleSaveProfile}>Salvar alterações</Button>
                </CardContent>
              </Card>
            )}

            {activeCategory === "equipe" && isAdmin && (
              <Card>
                <CardHeader className="flex flex-row items-start justify-between space-y-0">
                  <div>
                    <CardTitle>Equipe</CardTitle>
                    <CardDescription>Gerencie usuários e papéis.</CardDescription>
                  </div>
                  <Button size="sm" onClick={() => setInviteOpen(true)}>
                    <UserPlus className="mr-2 h-4 w-4" />
                    Convidar usuário
                  </Button>
                </CardHeader>
                <CardContent className="space-y-2">
                  {(team ?? []).map((m) => (
                    <div key={m.id} className="flex flex-wrap items-center gap-3 rounded-md border p-3">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{m.full_name ?? "—"}</div>
                        <div className="truncate text-xs text-muted-foreground">{m.email}</div>
                      </div>
                      {m.id === user?.id ? (
                        <Badge variant="secondary">{ROLE_LABEL[m.role ?? "viewer"]} (você)</Badge>
                      ) : (
                        <Select value={m.role ?? "viewer"} onValueChange={(v) => handleChangeRole(m.id, v as AppRole)}>
                          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {(["admin", "manager", "agent", "viewer"] as AppRole[]).map((r) => (
                              <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      <Button size="icon" variant="ghost" disabled={m.id === user?.id}
                        onClick={() => setRemoveTarget({ id: m.id, name: m.full_name ?? m.email })}
                        title="Remover acesso">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  {(team ?? []).length === 0 && (
                    <p className="text-sm text-muted-foreground">Nenhum usuário cadastrado.</p>
                  )}
                </CardContent>
              </Card>
            )}

            {activeCategory === "suporte" && (
              <>
                <VrSupportContactsCard />
                <TicketTitlesManager />
                <AssistSolutionsCard />
              </>
            )}

            {activeCategory === "onboarding" && <ImplantacaoStagesManager />}

            {activeCategory === "financeiro" && isAdmin && (
              <>
                <ComissoesPadraoSection />
                <HistoricoComissoesSection />
              </>
            )}

            {activeCategory === "integracoes" && isAdmin && (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle>Integração Pipedrive</CardTitle>
                    <CardDescription>
                      Cole o API Token do Pipedrive. Ele fica salvo no banco com acesso restrito a admins.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="pipedrive-token">API Token</Label>
                      <Input id="pipedrive-token" type="password" placeholder="Cole o token aqui"
                        value={pipedriveToken} onChange={(e) => setPipedriveToken(e.target.value)} autoComplete="off" />
                    </div>
                    {pipedriveStatus && (
                      <div className={`flex items-center gap-2 rounded-md border p-3 text-sm ${
                        pipedriveStatus.ok
                          ? "border-success/30 bg-success/10 text-success"
                          : "border-destructive/30 bg-destructive/10 text-destructive"
                      }`}>
                        {pipedriveStatus.ok ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                        <span>
                          {pipedriveStatus.ok
                            ? `Conectado como ${pipedriveStatus.name}`
                            : `Token inválido — ${(pipedriveStatus as { ok: false; msg: string }).msg}`}
                        </span>
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <Button onClick={handleTestPipedrive} disabled={pipedriveTesting}>
                        {pipedriveTesting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Salvar e Testar
                      </Button>
                      {systemSettings?.pipedrive_api_token && (
                        <Button variant="outline" onClick={handleRemovePipedrive}>Remover</Button>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Fuso horário do sistema</CardTitle>
                    <CardDescription>Padrão usado para exibir datas e horários.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Fuso</Label>
                        <Select value={systemTz} onValueChange={setSystemTz}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {TIMEZONES.map((tz) => (
                              <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Hora atual</Label>
                        <div className="flex h-10 items-center rounded-md border bg-muted px-3 text-sm font-mono">
                          {tzNow}
                        </div>
                      </div>
                    </div>
                    <Button onClick={handleSaveTimezone}>Salvar</Button>
                  </CardContent>
                </Card>
              </>
            )}

            {activeCategory === "aparencia" && (
              <Card>
                <CardHeader>
                  <CardTitle>Aparência</CardTitle>
                  <CardDescription>Tema claro ou escuro — preferência salva por usuário.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between rounded-md border p-3">
                    <div>
                      <div className="text-sm font-medium">Modo escuro</div>
                      <div className="text-xs text-muted-foreground">
                        {theme === "dark" ? "Ativado" : "Desativado"}
                      </div>
                    </div>
                    <Switch checked={theme === "dark"}
                      onCheckedChange={(v) => handleSaveTheme(v ? "dark" : "light")} />
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Convidar */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Convidar usuário</DialogTitle>
            <DialogDescription>
              Enviamos um email de cadastro. Após o primeiro login, ajuste o papel na lista da equipe.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="invite-email">Email</Label>
              <Input id="invite-email" type="email" value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)} placeholder="pessoa@empresa.com" />
            </div>
            <div className="space-y-2">
              <Label>Papel desejado (aplicar depois)</Label>
              <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as AppRole)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(["admin", "manager", "agent", "viewer"] as AppRole[]).map((r) => (
                    <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>Cancelar</Button>
            <Button onClick={handleInvite}>Enviar convite</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remover acesso */}
      <AlertDialog open={!!removeTarget} onOpenChange={(o) => !o && setRemoveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover acesso?</AlertDialogTitle>
            <AlertDialogDescription>
              {removeTarget?.name} perderá o papel atual e não poderá acessar dados protegidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemoveAccess}>Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// =============================================================
// Contatos de Suporte VR
// =============================================================

const VR_CONTACTS = [
  { key: "tel", label: "Suporte via telefone", value: "(11) 4004-4938", icon: Phone, copyValue: "(11) 4004-4938" },
  { key: "email", label: "E-mail de suporte", value: "meajuda@pontomais.com.br", icon: Mail, copyValue: "meajuda@pontomais.com.br" },
  { key: "fin", label: "Contato financeiro", value: "4004-4938", icon: Phone, copyValue: "4004-4938" },
  { key: "rh", label: "Guia do RH", value: "https://beneficios.vr.com.br/3Cgbrzz", icon: LinkIcon, copyValue: "https://beneficios.vr.com.br/3Cgbrzz" },
  { key: "trab", label: "Guia do trabalhador", value: "https://beneficios.vr.com.br/3AFLxEG", icon: LinkIcon, copyValue: "https://beneficios.vr.com.br/3AFLxEG" },
];

function VrSupportContactsCard() {
  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "Copiado", description: label });
    } catch {
      toast({ title: "Erro ao copiar", variant: "destructive" });
    }
  };

  const copyAll = async () => {
    const text =
      `*Contatos de Suporte VR / Pontomais*\n\n` +
      `📞 Suporte via telefone: (11) 4004-4938\n` +
      `✉️ E-mail de suporte: meajuda@pontomais.com.br\n` +
      `💰 Contato financeiro: 4004-4938\n` +
      `🔗 Guia do RH: https://beneficios.vr.com.br/3Cgbrzz\n` +
      `🔗 Guia do trabalhador: https://beneficios.vr.com.br/3AFLxEG`;
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "Copiado", description: "Todos os contatos formatados para WhatsApp." });
    } catch {
      toast({ title: "Erro ao copiar", variant: "destructive" });
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle>Contatos de Suporte VR</CardTitle>
          <CardDescription>
            Dados oficiais para encaminhar ao cliente quando necessário.
          </CardDescription>
        </div>
        <Button size="sm" onClick={copyAll}>
          <Copy className="mr-2 h-4 w-4" /> Copiar tudo
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {VR_CONTACTS.map((c) => {
          const Icon = c.icon;
          return (
            <div
              key={c.key}
              className="flex flex-wrap items-center gap-3 rounded-md border p-3"
            >
              <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-xs text-muted-foreground">{c.label}</div>
                <div className="truncate text-sm font-medium">{c.value}</div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => copy(c.copyValue, c.label)}
              >
                <Copy className="mr-2 h-3.5 w-3.5" /> Copiar
              </Button>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
