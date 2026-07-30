import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import type { InvoiceSettings } from "./storage";

/**
 * Two completely separate auth sessions can exist in this app:
 *   - tenantSession: a shop user (owner / operator / karigar) logged into
 *     their OWN shop. Holds the JWT issued by /api/auth/login.
 *   - superAdminSession: the platform super admin, logged into the
 *     super-admin panel. Holds the JWT issued by /api/superadmin/login.
 *
 * Only one is ever "active" for routing purposes, but we keep them in
 * separate localStorage keys so a super admin can flip to the platform
 * panel without being logged out of a shop session they were testing, etc.
 */

export type TenantUser = {
  id: string;
  username: string;
  name: string;
  role: "owner" | "operator" | "karigar";
  karigarRefId?: string;
  preferredLanguage?: "en" | "hi";
};

export type TenantShopInfo = {
  id: string;
  slug: string;
  shopName: string;
  plan: string;
  subscriptionEndDate: string;
  // Optional fields from the shop profile
  ownerName?: string;
  /** Display owner name/label on invoices (legacy field used by some screens). */
  numberOfShopOwner?: string;
  phone?: string;
  email?: string;
  address?: string;
  gstNumber?: string;
  logoUrl?: string;
  termsAndConditions?: string;
  invoiceSettings?: InvoiceSettings;

  // Social links (optional)
  instaId?: string;
  fbId?: string;
};

export type TenantSession = {
  token: string;
  user: TenantUser;
  shop: TenantShopInfo;
};

export type SuperAdminSession = {
  token: string;
  admin: { id: string; username: string; name: string };
};

interface AuthContextValue {
  tenantSession: TenantSession | null;
  superAdminSession: SuperAdminSession | null;
  isLoading: boolean;
  setTenantSession: (s: TenantSession | null) => void;
  setSuperAdminSession: (s: SuperAdminSession | null) => void;
  logoutTenant: () => void;
  logoutSuperAdmin: () => void;
}

const TENANT_KEY = "jewelshop.tenantSession";
const SUPERADMIN_KEY = "jewelshop.superAdminSession";

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function readFromStorage<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [tenantSession, setTenantSessionState] = useState<TenantSession | null>(() =>
    readFromStorage<TenantSession>(TENANT_KEY)
  );
  const [superAdminSession, setSuperAdminSessionState] = useState<SuperAdminSession | null>(() =>
    readFromStorage<SuperAdminSession>(SUPERADMIN_KEY)
  );
  const [isLoading, setIsLoading] = useState(true);

  // This effect ensures we don't render protected routes until the session
  // has been loaded from localStorage on initial app load.
  useEffect(() => {
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (tenantSession) localStorage.setItem(TENANT_KEY, JSON.stringify(tenantSession));
    else localStorage.removeItem(TENANT_KEY);
  }, [tenantSession]);

  useEffect(() => {
    if (superAdminSession) localStorage.setItem(SUPERADMIN_KEY, JSON.stringify(superAdminSession));
    else localStorage.removeItem(SUPERADMIN_KEY);
  }, [superAdminSession]);

  // This effect synchronizes the session in localStorage with any updates
  // that might have occurred on the backend (e.g., profile updates in another tab).
  useEffect(() => {
    const handleStorageChange = () => {
      setTenantSessionState(readFromStorage<TenantSession>(TENANT_KEY));
      setSuperAdminSessionState(readFromStorage<SuperAdminSession>(SUPERADMIN_KEY));
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const setTenantSession = useCallback((s: TenantSession | null) => setTenantSessionState(s), []);
  const setSuperAdminSession = useCallback(
    (s: SuperAdminSession | null) => setSuperAdminSessionState(s),
    []
  );
  const logoutTenant = useCallback(() => setTenantSessionState(null), []);
  const logoutSuperAdmin = useCallback(() => setSuperAdminSessionState(null), []);

  return (
    <AuthContext.Provider
      value={{
        tenantSession,
        superAdminSession,
        isLoading,
        setTenantSession,
        setSuperAdminSession,
        logoutTenant,
        logoutSuperAdmin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}

// Plain (non-hook) accessors so the API client (lib/api.ts) can read the
// current token outside of React component render, without prop drilling.
export function getStoredTenantToken(): string | null {
  return readFromStorage<TenantSession>(TENANT_KEY)?.token || null;
}
export function getStoredSuperAdminToken(): string | null {
  return readFromStorage<SuperAdminSession>(SUPERADMIN_KEY)?.token || null;
}
export function clearStoredTenantSession() {
  localStorage.removeItem(TENANT_KEY);
}
export function clearStoredSuperAdminSession() {
  localStorage.removeItem(SUPERADMIN_KEY);
}
