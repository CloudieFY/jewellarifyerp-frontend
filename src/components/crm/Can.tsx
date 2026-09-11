/**
 * CRM permission gating for the UI — UX ONLY, never security.
 *
 * The effective permission list comes from `GET /api/crm/me` (wildcards already
 * expanded by the backend) and is cached with react-query. Every CRM API route
 * re-checks the same permission server-side, so a stale or over-permissive
 * result here can only ever show a button that then 403s.
 *
 *   const can = useCan();
 *   can("opportunity", "create");            // boolean
 *
 *   <Can entity="opportunity" action="create"><Button/></Can>
 */

import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTenantAPI } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { CrmMe } from "@/lib/crm";

/** Fetch + cache the caller's effective CRM access. */
export function useCrmMe() {
  const api = useTenantAPI();
  const { tenantSession } = useAuth();
  return useQuery<CrmMe>({
    queryKey: ["crm", "me"],
    queryFn: () => api.crm.me() as Promise<CrmMe>,
    enabled: !!tenantSession,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}

export type CanFn = (entity: string, action: string) => boolean;

/**
 * Returns a `can(entity, action)` predicate. Recomputes when `/api/crm/me`
 * resolves or the session changes.
 */
export function useCan(): CanFn {
  const meQ = useCrmMe();

  return (entity: string, action: string): boolean => {
    const perms = meQ.data?.permissions ?? [];

    if (perms.includes("*")) return true;
    if (perms.includes(`${entity}.*`)) return true;
    if (perms.includes(`${entity}.${action}`)) return true;

    return false;
  };
}

/** True if the CRM area should be visible to this user at all. */
export function useHasCrmAccess(): boolean {
  const meQ = useCrmMe();

  if (meQ.data) return meQ.data.hasCrmAccess;

  return false;
}

export function Can({
  entity,
  action,
  children,
  fallback = null,
}: {
  entity: string;
  action: string;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const can = useCan();
  return <>{can(entity, action) ? children : fallback}</>;
}
