/**
 * Horizontal CRM section nav, shown at the top of every CRM screen. Each tab is
 * hidden unless the user holds the matching `<entity>.view` permission (the same
 * gate the sidebar and the backend use).
 */

import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  KanbanSquare,
  Target,
  ListChecks,
  Contact,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCan } from "@/components/crm/Can";

type CrmNavItem = {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  entity: string;
  action: string;
};

const ITEMS: CrmNavItem[] = [
  { to: "/crm/dashboard", label: "Dashboard", icon: LayoutDashboard, entity: "report", action: "view" },
  { to: "/crm/leads", label: "Leads", icon: Users, entity: "lead", action: "view" },
  { to: "/crm/pipeline", label: "Pipeline", icon: KanbanSquare, entity: "opportunity", action: "view" },
  { to: "/crm/opportunities", label: "Opportunities", icon: Target, entity: "opportunity", action: "view" },
  { to: "/crm/tasks", label: "Tasks", icon: ListChecks, entity: "task", action: "view" },
  { to: "/customers", label: "Customers", icon: Contact, entity: "customer", action: "view" },
];

export function CrmNav({ className }: { className?: string }) {
  const can = useCan();
  const visible = ITEMS.filter((i) => can(i.entity, i.action));

  if (visible.length === 0) return null;

  return (
    <nav
      className={cn(
        "flex items-center gap-1 overflow-x-auto scrollbar-none border-b border-border pb-2 mb-1",
        className,
      )}
    >
      {visible.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                "inline-flex items-center gap-1.5 shrink-0 px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted",
              )
            }
          >
            <Icon className="h-3.5 w-3.5" />
            {item.label}
          </NavLink>
        );
      })}
    </nav>
  );
}
