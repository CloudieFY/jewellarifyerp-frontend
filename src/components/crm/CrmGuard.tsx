/**
 * Route guard for the whole /crm/* area.
 *
 * A user needs at least one CRM permission to enter. While `GET /api/crm/me`
 * is in flight we render a light loading state (no redirect flash); an outright
 * "no access" answer bounces to /dashboard. Per-screen and per-action gating
 * still happens via <Can>/useCan and the backend re-enforces every request.
 */

import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useCrmMe } from "@/components/crm/Can";

export function CrmGuard({ children }: { children: ReactNode }) {
  const meQ = useCrmMe();

  if (meQ.isLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center text-muted-foreground">
        Loading…
      </div>
    );
  }
  if (meQ.data && !meQ.data.hasCrmAccess) {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
}
