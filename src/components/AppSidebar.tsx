import React from "react";
import {
  LayoutDashboard,
  Users,
  PlusCircle,
  BarChart3,
  Calendar,
  UserPlus,
  Bell,
  LogOut,
  User,
  Trophy,
  ClipboardList,
  ShieldCheck,
  FileText,
} from "lucide-react";
import { useLocation } from "react-router-dom";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import Logo from "@/components/Logo";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { signOut } = useAuth();
  const location = useLocation();
  const { isSuperAdmin, can } = usePermissions();

  const navItems = [
    { title: "Dashboard", url: "/", icon: LayoutDashboard, show: true },
    { title: "Contribuições TIM", url: "/contributions", icon: PlusCircle, show: true },
    { title: "Membros", url: "/members", icon: Users, show: true },
    { title: "Ranking", url: "/ranking", icon: Trophy, show: true },
    { title: "Eventos", url: "/events", icon: Calendar, show: true },
    { title: "Convidar Visitante", url: "/invite", icon: UserPlus, show: true },
    { title: "Relatórios", url: "/reports", icon: BarChart3, show: isSuperAdmin || can("view_reports") },
    { title: "Presença", url: "/attendance", icon: ClipboardList, show: isSuperAdmin || can("attendance_control") },
    { title: "Indicações Realizadas", url: "/admin/invitations", icon: FileText, show: isSuperAdmin || can("view_visitor_invitations") },
    { title: "Gerenciar Admins", url: "/admin/manage", icon: ShieldCheck, show: isSuperAdmin },
    { title: "Solicitações Pendentes", url: "/admin/pending", icon: ShieldCheck, show: isSuperAdmin },
    { title: "Notificações", url: "/notifications", icon: Bell, show: true },
    { title: "Meu Perfil", url: "/profile", icon: User, show: true },
  ];

  return (
    <Sidebar collapsible="icon" className="border-r border-border">
      <div className="p-4 border-b border-border">
        {collapsed ? (
          <span className="font-display font-extrabold text-primary text-lg">06</span>
        ) : (
          <Logo size="sm" />
        )}
      </div>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.filter((i) => i.show).map((item) => {
                const isActive = location.pathname === item.url;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        end
                        className={`flex items-center gap-3 px-3 py-3 rounded-lg transition-colors min-h-[44px] ${
                          isActive
                            ? "bg-primary text-primary-foreground font-medium"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted"
                        }`}
                        activeClassName=""
                      >
                        <item.icon className="h-6 w-6 shrink-0" />
                        {!collapsed && <span className="text-sm">{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-border p-2">
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-muted-foreground hover:text-destructive min-h-[44px]"
          onClick={() => signOut()}
        >
          <LogOut className="h-6 w-6" />
          {!collapsed && <span>Sair</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
