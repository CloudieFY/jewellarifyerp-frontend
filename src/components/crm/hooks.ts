/**
 * Shared CRM data hooks — used by every CRM screen so the user / branch picker
 * lists and id→name resolution are fetched once and cached by react-query.
 *
 * All three endpoints are read-only and permission-gated server-side:
 *   /api/crm/users     — any CRM access
 *   /api/crm/branches  — branch.view (falls back to an empty list on 403)
 */

import { useQuery } from "@tanstack/react-query";
import { useTenantAPI } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { CrmUser, CrmBranch } from "@/lib/crm";

export function useCrmUsers() {
  const api = useTenantAPI();
  const { tenantSession } = useAuth();
  return useQuery<CrmUser[]>({
    queryKey: ["crm", "users"],
    queryFn: () => api.crm.users() as Promise<CrmUser[]>,
    enabled: !!tenantSession,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}

export function useCrmBranches() {
  const api = useTenantAPI();
  const { tenantSession } = useAuth();
  return useQuery<CrmBranch[]>({
    queryKey: ["crm", "branches"],
    queryFn: () => api.crm.branches() as Promise<CrmBranch[]>,
    enabled: !!tenantSession,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}

/**
 * Returns `userName(id)` / `branchName(id)` resolvers plus the raw lists.
 * Unknown ids fall back to the id string; nullish ids render as "—".
 */
export function useCrmNameMaps() {
  const usersQ = useCrmUsers();
  const branchesQ = useCrmBranches();

  const users = usersQ.data ?? [];
  const branches = branchesQ.data ?? [];

  const userName = (id: string | null | undefined) =>
    !id ? "—" : users.find((u) => u.id === id)?.name ?? id;
  const branchName = (id: string | null | undefined) =>
    !id ? "—" : branches.find((b) => b.id === id)?.name ?? id;

  return { users, branches, userName, branchName, usersQ, branchesQ };
}
