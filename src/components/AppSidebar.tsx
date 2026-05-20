import {
  Users,
  Settings,
  Sparkles,
  Rocket,
  Headphones,
  Briefcase,
  DollarSign,
  TrendingUp,
  CheckSquare,
  LayoutDashboard,
  Star,
  ChevronDown,
  LogOut,
  LucideIcon,
  Kanban,
  ListChecks,
  BarChart3,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useState } from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { UserAvatar } from "@/components/UserAvatar";
import { useAuth, signOut } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type NavChild = { title: string; url: string; icon?: LucideIcon };
type NavItem = {
  key: string;
  title: string;
  icon: LucideIcon;
  url?: string;
  children?: NavChild[];
  adminOnly?: boolean;
};
type NavSection = { label: string; items: NavItem[] };

const sections: NavSection[] = [
  {
    label: "Início",
    items: [{ key: "dashboard", title: "Dashboard", icon: LayoutDashboard, url: "/" }],
  },
  {
    label: "Vendas",
    items: [
      {
        key: "crm",
        title: "CRM",
        icon: Briefcase,
        children: [
          { title: "Pipeline", url: "/crm/pipeline", icon: Kanban },
          { title: "Atividades", url: "/crm/atividades", icon: ListChecks },
          { title: "Analytics", url: "/crm/analytics", icon: BarChart3 },
        ],
      },
    ],
  },
  {
    label: "Operação",
    items: [
      { key: "tickets", title: "Chamados", icon: Headphones, url: "/tickets" },
      { key: "tarefas", title: "Tarefas", icon: CheckSquare, url: "/tarefas" },
      { key: "implantacao", title: "Implantação", icon: Rocket, url: "/implantacao" },
      { key: "clientes", title: "Clientes", icon: Users, url: "/clientes" },
    ],
  },
  {
    label: "Gestão",
    items: [
      { key: "financeiro", title: "Financeiro", icon: DollarSign, url: "/financeiro", adminOnly: true },
      { key: "performance", title: "Performance", icon: TrendingUp, url: "/performance" },
      { key: "nps", title: "NPS", icon: Star, url: "/nps" },
    ],
  },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const { user, role } = useAuth();
  const collapsed = state === "collapsed";
  const { pathname } = useLocation();

  const isActive = (url: string) => {
    const path = url.split("?")[0];
    if (path === "/") return pathname === "/";
    return pathname === path || pathname.startsWith(path + "/");
  };

  const allItems = sections.flatMap((s) => s.items);
  const [openMap, setOpenMap] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      allItems
        .filter((i) => i.children)
        .map((i) => [i.key, i.children!.some((c) => isActive(c.url))]),
    ),
  );

  const renderItem = (item: NavItem) => {
    if (item.adminOnly && role !== "admin") return null;

    if (!item.children) {
      return (
        <SidebarMenuItem key={item.key}>
          <SidebarMenuButton asChild tooltip={item.title} isActive={isActive(item.url!)}>
            <NavLink
              to={item.url!}
              activeClassName="!bg-sidebar-accent !text-sidebar-primary !font-medium"
              className="rounded-lg"
            >
              <item.icon className="h-4 w-4" />
              <span>{item.title}</span>
            </NavLink>
          </SidebarMenuButton>
        </SidebarMenuItem>
      );
    }

    const isOpen = openMap[item.key] ?? false;
    const hasActive = item.children.some((c) => isActive(c.url));

    if (collapsed) {
      return (
        <SidebarMenuItem key={item.key}>
          <SidebarMenuButton asChild tooltip={item.title} isActive={hasActive}>
            <NavLink to={item.children[0].url}>
              <item.icon className="h-4 w-4" />
              <span>{item.title}</span>
            </NavLink>
          </SidebarMenuButton>
        </SidebarMenuItem>
      );
    }

    return (
      <Collapsible
        key={item.key}
        open={isOpen}
        onOpenChange={(o) => setOpenMap((m) => ({ ...m, [item.key]: o }))}
      >
        <SidebarMenuItem>
          <CollapsibleTrigger asChild>
            <SidebarMenuButton
              className={cn("rounded-lg", hasActive && "bg-sidebar-accent/50 text-sidebar-primary font-medium")}
            >
              <item.icon className="h-4 w-4" />
              <span>{item.title}</span>
              <ChevronDown
                className={cn("ml-auto h-3.5 w-3.5 transition-transform", isOpen && "rotate-180")}
              />
            </SidebarMenuButton>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <SidebarMenuSub>
              {item.children.map((c) => (
                <SidebarMenuSubItem key={c.url}>
                  <SidebarMenuSubButton asChild isActive={isActive(c.url)}>
                    <NavLink
                      to={c.url}
                      activeClassName="!bg-sidebar-accent !text-sidebar-primary !font-medium"
                      className="rounded-md"
                    >
                      {c.icon && <c.icon className="h-3.5 w-3.5" />}
                      <span className="text-xs">{c.title}</span>
                    </NavLink>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              ))}
            </SidebarMenuSub>
          </CollapsibleContent>
        </SidebarMenuItem>
      </Collapsible>
    );
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className={cn("flex items-center gap-2.5 px-2 py-1", collapsed && "justify-center px-0")}>
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-gradient-accent shadow-sm">
            <Sparkles className="h-4 w-4 text-accent-foreground" />
          </div>
          {!collapsed && (
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-semibold tracking-tight text-sidebar-foreground">Nortear</span>
              <span className="text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/60">
                Connect
              </span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        {sections.map((section) => {
          const visible = section.items.filter((i) => !i.adminOnly || role === "admin");
          if (visible.length === 0) return null;
          return (
            <SidebarGroup key={section.label}>
              {!collapsed && (
                <SidebarGroupLabel className="px-3 pt-4 pb-1 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/60">
                  {section.label}
                </SidebarGroupLabel>
              )}
              <SidebarGroupContent>
                <SidebarMenu>{visible.map(renderItem)}</SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}

        <SidebarGroup className="mt-auto">
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="Configurações" isActive={isActive("/configuracoes")}>
                  <NavLink
                    to="/configuracoes"
                    activeClassName="!bg-sidebar-accent !text-sidebar-primary !font-medium"
                    className="rounded-lg"
                  >
                    <Settings className="h-4 w-4" />
                    <span>Configurações</span>
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton tooltip="Sair" onClick={signOut} className="rounded-lg">
                  <LogOut className="h-4 w-4" />
                  <span>Sair</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-2">
        <div className={cn("flex items-center gap-2 rounded-md p-1.5", !collapsed && "hover:bg-sidebar-accent")}>
          <UserAvatar name={user?.user_metadata?.full_name ?? user?.email} size="sm" />
          {!collapsed && (
            <>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-xs font-medium text-sidebar-foreground">
                  {user?.user_metadata?.full_name ?? user?.email}
                </span>
                <span className="text-[10px] uppercase tracking-wider text-sidebar-foreground/60">
                  {role === "admin" ? "Admin" : role === "atendente" ? "Atendente" : role ?? "—"}
                </span>
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                onClick={signOut}
                title="Sair"
              >
                <LogOut className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
