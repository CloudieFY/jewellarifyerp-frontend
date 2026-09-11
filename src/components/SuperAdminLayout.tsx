import { Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Sidebar,
  SidebarProvider,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarHeader,
  SidebarFooter,
  SidebarInset,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
} from "@/components/ui/sidebar";
import { LogOut, Store, MessageSquare, LayoutDashboard, Users, KanbanSquare, ListChecks, Presentation } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";

type NavItem = { path: string; icon: typeof Store; label: string };

const navGroups: { title: string; items: NavItem[] }[] = [
  {
    title: "Platform",
    items: [
      { path: "/superadmin", icon: Store, label: "Shops" },
      { path: "/superadmin/demo-requests", icon: MessageSquare, label: "Demo Requests" },
    ],
  },
  {
    title: "CRM",
    items: [
      { path: "/superadmin/crm/dashboard", icon: LayoutDashboard, label: "Dashboard" },
      { path: "/superadmin/crm/leads", icon: Users, label: "Leads" },
      { path: "/superadmin/crm/pipeline", icon: KanbanSquare, label: "Pipeline" },
      { path: "/superadmin/crm/tasks", icon: ListChecks, label: "Tasks" },
      { path: "/superadmin/crm/demos", icon: Presentation, label: "Demos" },
    ],
  },
];

export function SuperAdminLayout() {
  const { superAdminSession, logoutSuperAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader className="border-b border-sidebar-border">
          <div className="flex items-center gap-3 p-4">
            <img src="/logo.png" alt="Logo" className="w-10 h-10 object-contain bg-white p-1 rounded-md" />
            <div>
              <div className="font-display text-lg font-semibold leading-none text-sidebar-foreground">Super Admin</div>
              <div className="text-xs text-sidebar-muted-foreground mt-0.5">{superAdminSession?.admin.name}</div>
            </div>
          </div>
        </SidebarHeader>
        {navGroups.map((group) => (
          <SidebarGroup key={group.title}>
            <SidebarGroupLabel>{group.title}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      onClick={() => navigate(item.path)}
                      isActive={location.pathname === item.path}
                      tooltip={item.label}
                    >
                      <item.icon />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
        <SidebarFooter>
          <Button variant="ghost" className="w-full justify-start text-sidebar-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground" onClick={() => { logoutSuperAdmin(); navigate("/superadmin/login"); }}>
            <LogOut className="w-4 h-4 mr-2" /> Logout
          </Button>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <main className="p-4 sm:p-6 bg-muted/30 min-h-screen">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}