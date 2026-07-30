import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import i18n, { LANGUAGE_STORAGE_KEY } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { tenantAuthAPI } from "@/lib/api";

export type Language = "en" | "hi";

interface LanguageContextValue {
  language: Language;
  setLanguage: (lang: Language) => void;
}

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

function readStoredLanguage(): Language {
  try {
    const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (stored === "en" || stored === "hi") return stored;
  } catch {}
  return "en";
}

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(readStoredLanguage);
  const { tenantSession, setTenantSession } = useAuth();

  // On login (or whenever the profile's saved preference changes), the
  // profile value takes precedence over whatever was in localStorage on
  // this device - this is what makes the language "follow" the account
  // across devices/browsers on next login.
  useEffect(() => {
    const profileLang = tenantSession?.user?.preferredLanguage;
    if (profileLang && (profileLang === "en" || profileLang === "hi") && profileLang !== language) {
      setLanguageState(profileLang);
    }
    // Only re-run when the logged-in user identity changes, not on every
    // tenantSession object reference change (e.g. shop profile edits).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantSession?.user?.id, tenantSession?.user?.preferredLanguage]);

  // Keep i18next and localStorage in sync with the current language,
  // instantly re-rendering every component using useTranslation()/t().
  useEffect(() => {
    i18n.changeLanguage(language);
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    } catch {}
  }, [language]);

  const setLanguage = useCallback(
    (lang: Language) => {
      setLanguageState(lang);
      // Persist to the user's profile so it's restored on next login,
      // from any device. Best-effort - a logged-out user (or a failed
      // request) still gets the instant local switch above.
      if (tenantSession?.token) {
        tenantAuthAPI
          .updateLanguage(lang, tenantSession.token)
          .then(() => {
            setTenantSession({
              ...tenantSession,
              user: { ...tenantSession.user, preferredLanguage: lang },
            });
          })
          .catch(() => {
            // Non-fatal: the UI has already switched language locally;
            // it just won't be remembered on another device this time.
          });
      }
    },
    [tenantSession, setTenantSession]
  );

  return (
    <LanguageContext.Provider value={{ language, setLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
};

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within a LanguageProvider");
  return ctx;
}
