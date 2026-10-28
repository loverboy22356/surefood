"use client";

import { useTheme } from "./theme-provider";

/**
 * Light/dark switch. Rendered inside the profile page's settings list, so the
 * appearance choice lives with the rest of the account preferences.
 */
export function ThemeToggle() {
  const { theme, toggleTheme, ready } = useTheme();
  const dark = theme === "dark";

  return (
    <li className="acct-theme-row">
      <button
        className="acct-setting-button"
        type="button"
        onClick={toggleTheme}
        aria-pressed={dark}
        aria-label={`Appearance: ${dark ? "dark" : "light"} mode. Switch to ${dark ? "light" : "dark"} mode.`}
        title={`Switch to ${dark ? "light" : "dark"} mode`}
      >
        <span className="acct-settings-icon">
          {dark ? (
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
              <path d="M20.5 14.2A8.6 8.6 0 1 1 9.8 3.5a6.9 6.9 0 0 0 10.7 10.7Z" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
              <circle cx="12" cy="12" r="4.2" />
              <path d="M12 2.6v2.2M12 19.2v2.2M2.6 12h2.2M19.2 12h2.2M5.1 5.1l1.6 1.6M17.3 17.3l1.6 1.6M18.9 5.1l-1.6 1.6M6.7 17.3l-1.6 1.6" />
            </svg>
          )}
        </span>
        <span>
          <strong>Appearance</strong>
          <small>{ready ? (dark ? "Dark mode is on" : "Light mode is on") : "Loading your theme…"}</small>
        </span>
        <span className={`theme-pill${dark ? " is-dark" : ""}`} data-ready={ready ? "true" : "false"} aria-hidden="true">
          <span className="theme-pill-knob" />
        </span>
      </button>
    </li>
  );
}
