import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "@/locales/en.json";
import hi from "@/locales/hi.json";
import gu from "@/locales/gu.json";
import mr from "@/locales/mr.json";
import ta from "@/locales/ta.json";
import te from "@/locales/te.json";
import kn from "@/locales/kn.json";
import ml from "@/locales/ml.json";
import pa from "@/locales/pa.json";
import bn from "@/locales/bn.json";
import or from "@/locales/or.json";
import { SUPPORTED_LANGUAGES, type Language } from "@/context/LanguageContext";

export const LANGUAGE_STORAGE_KEY = "jewelshop.language";

function getInitialLanguage(): Language {
  try {
    const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY) as Language;
    if (stored && SUPPORTED_LANGUAGES.includes(stored)) return stored;
  } catch {}
  return "en";
}

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    hi: { translation: hi },
    gu: { translation: gu },
    mr: { translation: mr },
    ta: { translation: ta },
    te: { translation: te },
    kn: { translation: kn },
    ml: { translation: ml },
    pa: { translation: pa },
    bn: { translation: bn },
    or: { translation: or },
  },
  lng: getInitialLanguage(),
  fallbackLng: "en",
  interpolation: {
    escapeValue: false, // React already escapes values
  },
});

export default i18n;
