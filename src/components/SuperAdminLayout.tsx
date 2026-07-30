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
} from "@/components/ui/sidebar";
import { LogOut, Store, MessageSquare } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";

const navItems = [
  { path: "/superadmin", icon: Store, label: "Shops" },
  { path: "/superadmin/demo-requests", icon: MessageSquare, label: "Demo Requests" },
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
        <SidebarMenu>
          {navItems.map((item) => (
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