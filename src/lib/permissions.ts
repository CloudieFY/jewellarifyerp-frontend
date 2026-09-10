/**
 * Frontend CRM permission helpers — UX GATING ONLY.
 *
 * These decide what to *show*. They are NOT security: every CRM API route
 * enforces the same permission server-side (see backend
 * src/crm/middleware/requireCrmPermission.ts). Never rely on this module to
 * protect data.
 *
 * The effective permission list comes from the login / `/api/auth/me`
 * response (`session.user.permissions`) and already has wildcards expanded by
 * the backend, but we still honour `*` and `<entity>.*` here for safety.
 */

import type { TenantUser } from "./auth";

export const CRM_ROLES = [
  "crm_admin",
  "sales_exec",
  "demo_exec",
  "accounting",
  "support",
  "dealer",
] as const;

export type CrmRole = (typeof CRM_ROLES)[number];

function permissionList(user: TenantUser | null | undefined): string[] {
  return Array.isArray(user?.permissions) ? user!.permissions : [];
}

/** Does the current user hold `<entity>.<action>`? */
export function hasPermission(
  user: TenantUser | null | undefined,
  entity: string,
  action: string,
): boolean {
  if (!user) return false;
  const perms = permissionList(user);
  return (
    perms.includes("*") ||
    perms.includes(`${entity}.*`) ||
    perms.includes(`${entity}.${action}`)
  );
}

/** True if the user has ANY CRM permission (controls whether the CRM area shows at all). */
export function hasAnyCrmAccess(user: TenantUser | null | undefined): boolean {
  if (!user) return false;
  if (permissionList(user).length > 0) return true;
  // Fallback for sessions minted before the backend started sending
  // `permissions`: the shop owner always has CRM access.
  return user.role === "owner";
}

/** Convenience: check several permissions at once (all required). */
export function hasAllPermissions(
  user: TenantUser | null | undefined,
  checks: Array<[string, string]>,
): boolean {
  return checks.every(([e, a]) => hasPermission(user, e, a));
}
