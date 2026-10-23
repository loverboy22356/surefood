"use client";

import { useEffect, useRef, useState } from "react";
import { LANGUAGES, useLocale } from "./locale-provider";

export function LocaleSwitcher() {
  const {
    language, currency, autoDetectedLanguage, ratesError, ratesUpdatedAt,
    setLanguage, setCurrency, resetToDetected, availableCurrencies,
  } = useLocale();
  const [open, setOpen] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (wrapper.current && !wrapper.current.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const languageLabel = LANGUAGES.find((option) => option.code === language)?.label ?? language.toUpperCase();
  const detectedLabel = LANGUAGES.find((option) => option.code === autoDetectedLanguage)?.label ?? autoDetectedLanguage.toUpperCase();

  return (
    <div className="locale-switcher" data-no-translate translate="no" ref={wrapper}>
      <button
        type="button"
        className="locale-trigger"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={`Change language and currency. Current language ${languageLabel}, currency ${currency}.`}
        onClick={() => setOpen((current) => !current)}
      >
        <span aria-hidden="true">🌐</span>
        <span className="locale-trigger-language">{languageLabel}</span>
        <span className="locale-divider" aria-hidden="true">·</span>
        <strong>{currency}</strong>
      </button>
      {open && (
        <div className="locale-panel" role="dialog" aria-label="Language and currency">
          <div className="locale-panel-heading">
            <span className="section-kicker">SITE SETTINGS</span>
            <h2>Language &amp; currency</h2>
            <p>Your location was detected automatically: {detectedLabel}.</p>
          </div>
          <label>
            Language
            <select value={language} onChange={(event) => setLanguage(event.target.value)}>
              {LANGUAGES.map((option) => <option value={option.code} key={option.code}>{option.label}</option>)}
            </select>
          </label>
          <label>
            Currency
            <select value={currency} onChange={(event) => setCurrency(event.target.value)}>
              {availableCurrencies.map((code) => <option value={code} key={code}>{code}</option>)}
            </select>
          </label>
          <p className={ratesError ? "locale-status error" : "locale-status"}>
            {ratesError ? ratesError : ratesUpdatedAt ? `Live rates updated ${ratesUpdatedAt}` : "Loading live exchange rates…"}
          </p>
          <p className="locale-note">Prices are converted estimates. SureFood orders are always charged in NGN.</p>
          <button type="button" className="locale-reset" onClick={resetToDetected}>Follow my detected location</button>
        </div>
      )}
    </div>
  );
}
