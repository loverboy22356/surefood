"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  BASE_CURRENCY,
  cityFromTimezone,
  currencyForCountry,
  languageForCountry,
  TIMEZONE_COUNTRY,
} from "@/lib/geo";

export type LanguageOption = { code: string; label: string };

export const LANGUAGES: LanguageOption[] = [
  { code: "en", label: "English" },
  { code: "fr", label: "Français" },
  { code: "es", label: "Español" },
  { code: "pt", label: "Português" },
  { code: "ar", label: "العربية" },
  { code: "sw", label: "Kiswahili" },
  { code: "ha", label: "Hausa" },
  { code: "ig", label: "Igbo" },
  { code: "yo", label: "Yorùbá" },
  { code: "am", label: "አማርኛ" },
  { code: "de", label: "Deutsch" },
  { code: "it", label: "Italiano" },
  { code: "nl", label: "Nederlands" },
  { code: "pl", label: "Polski" },
  { code: "tr", label: "Türkçe" },
  { code: "ru", label: "Русский" },
  { code: "uk", label: "Українська" },
  { code: "zh-CN", label: "中文（简体）" },
  { code: "zh-TW", label: "中文（繁體）" },
  { code: "ja", label: "日本語" },
  { code: "ko", label: "한국어" },
  { code: "hi", label: "हिन्दी" },
  { code: "bn", label: "বাংলা" },
  { code: "ur", label: "اردو" },
  { code: "id", label: "Bahasa Indonesia" },
  { code: "ms", label: "Bahasa Melayu" },
  { code: "th", label: "ไทย" },
  { code: "vi", label: "Tiếng Việt" },
  { code: "fil", label: "Filipino" },
  { code: "fa", label: "فارسی" },
  { code: "he", label: "עברית" },
  { code: "el", label: "Ελληνικά" },
  { code: "sv", label: "Svenska" },
  { code: "no", label: "Norsk" },
  { code: "da", label: "Dansk" },
  { code: "fi", label: "Suomi" },
  { code: "cs", label: "Čeština" },
  { code: "ro", label: "Română" },
  { code: "hu", label: "Magyar" },
  { code: "bg", label: "Български" },
  { code: "sr", label: "Српски" },
  { code: "hr", label: "Hrvatski" },
  { code: "sk", label: "Slovenčina" },
  { code: "lt", label: "Lietuvių" },
  { code: "lv", label: "Latviešu" },
  { code: "et", label: "Eesti" },
  { code: "af", label: "Afrikaans" },
  { code: "zu", label: "isiZulu" },
  { code: "xh", label: "isiXhosa" },
  { code: "so", label: "Soomaali" },
  { code: "rw", label: "Ikinyarwanda" },
  { code: "mg", label: "Malagasy" },
  { code: "ka", label: "ქართული" },
  { code: "hy", label: "Հայերեն" },
  { code: "az", label: "Azərbaycan" },
  { code: "kk", label: "Қазақша" },
  { code: "uz", label: "Oʻzbek" },
  { code: "mn", label: "Монгол" },
  { code: "ne", label: "नेपाली" },
  { code: "si", label: "සිංහල" },
  { code: "ta", label: "தமிழ்" },
  { code: "te", label: "తెలుగు" },
  { code: "ml", label: "മലയാളം" },
  { code: "kn", label: "ಕನ್ನಡ" },
  { code: "gu", label: "ગુજરાતી" },
  { code: "mr", label: "मराठी" },
  { code: "pa", label: "ਪੰਜਾਬੀ" },
  { code: "my", label: "ဗမာ" },
  { code: "km", label: "ខ្មែរ" },
  { code: "lo", label: "ລາວ" },
];

const RTL = new Set(["ar", "he", "fa", "ur", "yi", "ps"]);

type RatesPayload = {
  base: string;
  updatedAt: string;
  rates: Record<string, number>;
};

type LocaleContextValue = {
  language: string;
  currency: string;
  country: string;
  detectedCity: string;
  detectedRegion: string;
  autoDetectedLanguage: string;
  rates: Record<string, number> | null;
  ratesUpdatedAt: string;
  ratesError: string;
  setLanguage: (code: string) => void;
  setCurrency: (code: string) => void;
  resetToDetected: () => void;
  convertMajor: (amountMajor: number) => number | null;
  formatAmount: (amountMajor: number) => string | null;
  availableCurrencies: string[];
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

function detectLocale() {
  const nav = typeof navigator === "undefined" ? undefined : navigator;
  const preferred = nav?.languages?.[0] ?? nav?.language ?? "en";
  const [rawLanguage] = preferred.split("-");
  const browserLanguage = /^[a-z]{2,3}$/i.test(rawLanguage ?? "") ? (rawLanguage ?? "en").toLowerCase() : "en";
  const timezone = typeof Intl === "undefined" ? "" : Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";
  // The device timezone tracks where the visitor actually is, the browser locale only
  // says which language pack they installed, so the timezone wins. The region part of
  // the browser locale is ignored for location: many devices in Nigeria ship with en-US,
  // and that must not turn the catalogue's Naira prices into dollars.
  const country = TIMEZONE_COUNTRY[timezone] ?? "";
  const city = country ? cityFromTimezone(timezone) : "";
  // The language follows the detected location, not the browser's UI language.
  const language = languageForCountry(country) || browserLanguage;
  const currency = currencyForCountry(country) || BASE_CURRENCY;
  return { language, country, currency, city };
}

const STORAGE_KEY = "surefood-locale-v2";

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState("en");
  const [currency, setCurrencyState] = useState("NGN");
  const [country, setCountry] = useState("");
  const [detectedCity, setDetectedCity] = useState("");
  const [detectedRegion, setDetectedRegion] = useState("");
  const [manualChoice, setManualChoice] = useState(false);
  const [autoDetectedLanguage, setAutoDetectedLanguage] = useState("en");
  const [rates, setRates] = useState<Record<string, number> | null>(null);
  const [ratesUpdatedAt, setRatesUpdatedAt] = useState("");
  const [ratesError, setRatesError] = useState("");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const detected = detectLocale();
    setAutoDetectedLanguage(detected.language);
    setCountry(detected.country);
    setDetectedCity(detected.city);
    let storedLanguage = "";
    let storedCurrency = "";
    let storedManual = false;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      const parsed = raw
        ? JSON.parse(raw) as { language?: unknown; currency?: unknown; manual?: unknown }
        : null;
      // Only an explicit choice wins over the detected location. Preferences saved by
      // older versions were written automatically, so they are not treated as a choice.
      storedManual = parsed?.manual === true;
      if (storedManual) {
        if (typeof parsed?.language === "string") storedLanguage = parsed.language;
        if (typeof parsed?.currency === "string") storedCurrency = parsed.currency;
      }
    } catch (error) {
      console.error("Could not read the saved language preference.", error);
    }
    setManualChoice(storedManual);
    setLanguageState(storedLanguage || detected.language);
    setCurrencyState(storedCurrency || detected.currency);
    setHydrated(true);

    // Detect the visitor's location in the background and switch the site to that
    // location's language and currency, unless the visitor already chose one.
    let active = true;
    void (async () => {
      try {
        const response = await fetch("/api/location", { signal: AbortSignal.timeout(8_000) });
        if (!response.ok) return;
        const geo = await response.json() as { country?: unknown; city?: unknown; region?: unknown };
        const detectedCountry = typeof geo.country === "string" ? geo.country.toUpperCase() : "";
        if (!active || !/^[A-Z]{2}$/.test(detectedCountry)) return;
        const detectedLanguage = languageForCountry(detectedCountry) || detected.language;
        setCountry(detectedCountry);
        if (typeof geo.city === "string" && geo.city) setDetectedCity(geo.city);
        if (typeof geo.region === "string" && geo.region) setDetectedRegion(geo.region);
        setAutoDetectedLanguage(detectedLanguage);
        if (storedManual) return;
        setLanguageState(detectedLanguage);
        setCurrencyState(currencyForCountry(detectedCountry) || BASE_CURRENCY);
      } catch (error) {
        console.error("Could not detect your location.", error);
      }
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ language, currency, manual: manualChoice }));
    } catch (error) {
      console.error("Could not save the language preference.", error);
    }
    document.documentElement.lang = language;
    document.documentElement.dir = RTL.has(language.slice(0, 2)) ? "rtl" : "ltr";
  }, [language, currency, manualChoice, hydrated]);

  // Prices are set in Naira and converted for display. The rate is reloaded every ten
  // minutes (and whenever the visitor returns to the tab) so a day-trading currency
  // never leaves either side of the order out of pocket.
  useEffect(() => {
    let active = true;
    async function loadRates() {
      try {
        const response = await fetch("/api/rates", { cache: "no-store", signal: AbortSignal.timeout(12_000) });
        const data = await response.json() as RatesPayload & { error?: string };
        if (!response.ok) throw new Error(data.error || "Exchange rates are unavailable.");
        if (!active) return;
        setRates(data.rates);
        setRatesUpdatedAt(data.updatedAt);
        setRatesError("");
      } catch (error) {
        if (active) setRatesError(error instanceof Error ? error.message : "Exchange rates are unavailable.");
      }
    }
    void loadRates();
    const interval = window.setInterval(() => void loadRates(), 10 * 60 * 1000);
    const onVisible = () => { if (document.visibilityState === "visible") void loadRates(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      active = false;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const setLanguage = useCallback((code: string) => {
    setLanguageState(code);
    setManualChoice(true);
  }, []);
  const setCurrency = useCallback((code: string) => {
    setCurrencyState(code);
    setManualChoice(true);
  }, []);
  const resetToDetected = useCallback(() => {
    const detected = detectLocale();
    setLanguageState(detected.language);
    setCurrencyState(detected.currency);
    setCountry(detected.country);
    setDetectedCity(detected.city);
    setDetectedRegion("");
    setAutoDetectedLanguage(detected.language);
    setManualChoice(false);
  }, []);

  const convertMajor = useCallback((amountMajor: number) => {
    if (currency === "NGN") return amountMajor;
    const rate = rates?.[currency];
    if (!rate) return null;
    // Rounded to the smallest unit actually shown, so the displayed price is
    // exactly the price the visitor reads — no silent fraction of a cent.
    return Math.round(amountMajor * rate * 100) / 100;
  }, [currency, rates]);

  const formatAmount = useCallback((amountMajor: number) => {
    const converted = convertMajor(amountMajor);
    if (converted === null) return null;
    try {
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency,
        currencyDisplay: "narrowSymbol",
        maximumFractionDigits: currency === "NGN" ? 0 : 2,
      }).format(converted);
    } catch {
      return `${currency} ${converted.toFixed(2)}`;
    }
  }, [convertMajor, currency]);

  const availableCurrencies = useMemo(
    () => rates ? Object.keys(rates).sort((a, b) => a.localeCompare(b)) : ["NGN", "USD", "GBP", "EUR", "GHS", "KES", "ZAR"],
    [rates],
  );

  const value = useMemo<LocaleContextValue>(() => ({
    language,
    currency,
    country,
    detectedCity,
    detectedRegion,
    autoDetectedLanguage,
    rates,
    ratesUpdatedAt,
    ratesError,
    setLanguage,
    setCurrency,
    resetToDetected,
    convertMajor,
    formatAmount,
    availableCurrencies,
  }), [
    language, currency, country, detectedCity, detectedRegion, autoDetectedLanguage, rates, ratesUpdatedAt, ratesError,
    setLanguage, setCurrency, resetToDetected, convertMajor, formatAmount, availableCurrencies,
  ]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const context = useContext(LocaleContext);
  if (!context) throw new Error("useLocale must be used inside LocaleProvider.");
  return context;
}
