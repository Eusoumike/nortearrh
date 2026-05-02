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
  Lock,
  ChevronDown,
  LucideIcon,
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { UserAvatar } from "@/components/UserAvatar";
import { useAuth, signOut } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { cn } from "@/lib/utils";

type NavChild = { title: string; url: string };
type NavGroup = {
  key: string;
  title: string;
  icon: LucideIcon;
  children?: NavChild[];
  url?: string;
  disabled?: boolean;
};

const groups: NavGroup[] = [
  {
    key: "dashboard",
    title: "Dashboard",
    icon: LayoutDashboard,
    url: "/",
  },
  {
    key: "suporte",
    title: "Suporte",
    icon: Headphones,
    children: [
      { title: "Chamados", url: "/tickets" },
    ],
  },
  {
    key: "tarefas",
    title: "Tarefas",
    icon: CheckSquare,
    url: "/tarefas",
  },
  {
    key: "clientes",
    title: "Clientes",
    icon: Users,
    children: [{ title: "Carteira", url: "/clientes" }],
  },
  {
    key: "onboarding",
    title: "Onboarding",
    icon: Rocket,
    children: [
      { title: "Implantação", url: "/implantacao" },
    ],
  },
  {
    key: "crm",
    title: "CRM",
    icon: Briefcase,
    children: [{ title: "Pipeline", url: "/crm/pipeline" }],
  },
  {
    key: "financeiro",
    title: "Financeiro",
    icon: DollarSign,
    url: "/financeiro",
    adminOnly: true,
  },
  {
    key: "performance",
    title: "Performance",
    icon: TrendingUp,
    url: "/performance",
  },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const { user, role } = useAuth();
  const collapsed = state === "collapsed";
  const { pathname } = useLocation();

  const isChildActive = (url: string) => {
    const path = url.split("?")[0];
    return pathname === path || pathname.startsWith(path + "/");
  };

  const initialOpen = () =>
    Object.fromEntries(
      groups.map((g) => [g.key, g.children?.some((c) => isChildActive(c.url)) ?? false]),
    );

  const [openMap, setOpenMap] = useState<Record<string, boolean>>(initialOpen);

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
              <span className="text-[10px] uppercase tracking-wider text-sidebar-foreground/60">Connect</span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          {!collapsed && <SidebarGroupLabel>Navegação</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>
              {groups.map((g) => {
                if (g.disabled) {
                  return (
                    <SidebarMenuItem key={g.key}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <SidebarMenuButton
                            className="cursor-not-allowed opacity-50"
                            onClick={(e) => e.preventDefault()}
                          >
                            <g.icon className="h-4 w-4" />
                            <span>{g.title}</span>
                            {!collapsed && <Lock className="ml-auto h-3 w-3" />}
                          </SidebarMenuButton>
                        </TooltipTrigger>
                        <TooltipContent side="right">Em breve</TooltipContent>
                      </Tooltip>
                    </SidebarMenuItem>
                  );
                }

                if (!g.children || g.children.length === 0) {
                  return (
                    <SidebarMenuItem key={g.key}>
                      <SidebarMenuButton asChild tooltip={g.title}>
                        <NavLink
                          to={g.url ?? "#"}
                          activeClassName="!bg-sidebar-accent !text-sidebar-accent-foreground"
                        >
                          <g.icon className="h-4 w-4" />
                          <span>{g.title}</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                }

                const isOpen = openMap[g.key] ?? false;
                const hasActive = g.children.some((c) => isChildActive(c.url));

                // Collapsed sidebar: render as flat icon button linking to first child
                if (collapsed) {
                  return (
                    <SidebarMenuItem key={g.key}>
                      <SidebarMenuButton asChild tooltip={g.title}>
                        <NavLink to={g.children[0].url}>
                          <g.icon className="h-4 w-4" />
                          <span>{g.title}</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                }

                return (
                  <Collapsible
                    key={g.key}
                    open={isOpen}
                    onOpenChange={(o) => setOpenMap((m) => ({ ...m, [g.key]: o }))}
                  >
                    <SidebarMenuItem>
                      <CollapsibleTrigger asChild>
                        <SidebarMenuButton
                          className={cn(hasActive && "bg-sidebar-accent/50 text-sidebar-accent-foreground")}
                        >
                          <g.icon className="h-4 w-4" />
                          <span>{g.title}</span>
                          <ChevronDown
                            className={cn(
                              "ml-auto h-3.5 w-3.5 transition-transform",
                              isOpen && "rotate-180",
                            )}
                          />
                        </SidebarMenuButton>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <SidebarMenuSub>
                          {g.children.map((c) => (
                            <SidebarMenuSubItem key={c.url}>
                              <SidebarMenuSubButton asChild isActive={isChildActive(c.url)}>
                                <NavLink
                                  to={c.url}
                                  activeClassName="!bg-sidebar-accent !text-sidebar-accent-foreground"
                                >
                                  <span>{c.title}</span>
                                </NavLink>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          ))}
                        </SidebarMenuSub>
                      </CollapsibleContent>
                    </SidebarMenuItem>
                  </Collapsible>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-auto">
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="Configurações">
                  <NavLink to="/configuracoes" activeClassName="!bg-sidebar-accent !text-sidebar-accent-foreground">
                    <Settings className="h-4 w-4" />
                    <span>Configurações</span>
                  </NavLink>
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
                <span className="text-[10px] uppercase tracking-wider text-sidebar-foreground/60">{role ?? "—"}</span>
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
