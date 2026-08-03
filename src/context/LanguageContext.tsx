import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import i18n, { LANGUAGE_STORAGE_KEY } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { tenantAuthAPI } from "@/lib/api";

export type Language = "en" | "hi" | "gu" | "mr" | "ta" | "te" | "kn" | "ml" | "pa" | "bn" | "or";
export const SUPPORTED_LANGUAGES: Language[] = ["en", "hi", "gu", "mr", "ta", "te", "kn", "ml", "pa", "bn", "or"];

interface LanguageContextValue {
  language: Language;
  setLanguage: (lang: Language) => void;
}

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

function readStoredLanguage(): Language {
  try {
    const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY) as Language;
    if (stored && SUPPORTED_LANGUAGES.includes(stored)) return stored;
  } catch {}
  return "en";
}

function applyGoogleTranslate(lang: Language) {
  try {
    const cookieVal = lang === "en" ? "" : `/en/${lang}`;
    document.cookie = `googtrans=${cookieVal}; path=/; domain=${window.location.hostname}`;
    document.cookie = `googtrans=${cookieVal}; path=/;`;

    const combo = document.querySelector(".goog-te-combo") as HTMLSelectElement | null;
    if (combo) {
      combo.value = lang === "en" ? "" : lang;
      combo.dispatchEvent(new Event("change"));
    }
  } catch (e) {
    console.warn("Google Translate bridge error:", e);
  }
}

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(readStoredLanguage);
  const { tenantSession, setTenantSession } = useAuth();

  useEffect(() => {
    const profileLang = tenantSession?.user?.preferredLanguage as Language;
    if (profileLang && SUPPORTED_LANGUAGES.includes(profileLang) && profileLang !== language) {
      setLanguageState(profileLang);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantSession?.user?.id, tenantSession?.user?.preferredLanguage]);

  // Keep i18next, localStorage, and full-page DOM translator in sync with current language
  useEffect(() => {
    i18n.changeLanguage(language);
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    } catch {}

    applyGoogleTranslate(language);
    const timer = setTimeout(() => applyGoogleTranslate(language), 800);
    return () => clearTimeout(timer);
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
