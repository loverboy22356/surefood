"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  GoogleAuthProvider,
  getRedirectResult,
  signInWithCustomToken,
  signInWithPopup,
  signInWithRedirect,
} from "firebase/auth";
import { firebaseAuth, firebaseConfigured } from "@/lib/firebase/client";
import { HumanCheck } from "@/app/components/human-check";

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [digits, setDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [step, setStep] = useState<"email" | "code">("email");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [human, setHuman] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const boxes = useRef<Array<HTMLInputElement | null>>([]);
  const code = digits.join("");

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setInterval(() => setCooldown((seconds) => Math.max(0, seconds - 1)), 1_000);
    return () => window.clearInterval(timer);
  }, [cooldown > 0]);

  useEffect(() => {
    if (!firebaseConfigured()) return;
    const auth = firebaseAuth();
    void getRedirectResult(auth).then(async (credential) => {
      if (!credential) return;
      setBusy(true);
      const idToken = await credential.user.getIdToken();
      const response = await fetch("/api/profile", {
        headers: { authorization: `Bearer ${idToken}` },
        signal: AbortSignal.timeout(15_000),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "No Sure Foodz account was found for this Google account. Sign up first.");
      goToRole(result.profile.role);
    }).catch((reason: unknown) => {
      console.error("Google sign-in could not be completed.", reason);
      setError(googleSignInError(reason));
    }).finally(() => setBusy(false));
  }, []);

  function goToRole(role: string) {
    if (role === "staff" || role === "admin") {
      router.replace("/admin/verification");
      return;
    }
    router.replace(role === "vendor" ? "/vendor" : role === "supplier" ? "/supplier" : "/");
  }

  function googleSignInError(reason: unknown) {
    const code = reason && typeof reason === "object" && "code" in reason
      ? String(reason.code)
      : "";
    if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") return "Google sign-in was cancelled. Select Login with Google to try again.";
    if (code === "auth/popup-blocked") return "Your browser blocked the Google sign-in window. Allow popups for this site and try again, or open the site in Chrome.";
    if (code === "auth/unauthorized-domain") {
      const host = typeof window === "undefined" ? "this address" : window.location.host;
      return `Google blocks sign-in from ${host}. Open the site at http://localhost:3000 instead, or add ${host} under Firebase Authentication → Settings → Authorized domains.`;
    }
    if (code === "auth/operation-not-allowed") return "Google sign-in is not enabled for this Firebase project.";
    if (code === "auth/network-request-failed") return "Google sign-in could not reach Firebase. Check your connection and try again.";
    return reason instanceof Error ? reason.message : "Google sign-in could not be completed.";
  }

  /**
   * Popups are blocked or ignored in plenty of mobile browsers and in-app
   * webviews, so a failed popup falls back to a full-page redirect that
   * completes through getRedirectResult above.
   */
  function shouldFallBackToRedirect(reason: unknown) {
    const code = reason && typeof reason === "object" && "code" in reason ? String(reason.code) : "";
    return [
      "auth/popup-blocked",
      "auth/popup-closed-by-user",
      "auth/cancelled-popup-request",
      "auth/operation-not-supported-in-this-environment",
      "auth/web-storage-unsupported",
    ].includes(code);
  }

  function typeDigit(index: number, value: string) {
    const clean = value.replace(/\D/g, "");
    if (!clean) {
      setDigits((current) => current.map((digit, at) => (at === index ? "" : digit)));
      return;
    }
    if (clean.length > 1) {
      setDigits((current) => {
        const next = [...current];
        clean.slice(0, 6 - index).split("").forEach((digit, offset) => { next[index + offset] = digit; });
        return next;
      });
      boxes.current[Math.min(5, index + clean.length)]?.focus();
      return;
    }
    setDigits((current) => current.map((digit, at) => (at === index ? clean : digit)));
    if (index < 5) boxes.current[index + 1]?.focus();
  }

  async function requestCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!human) {
      setError("Please confirm you are not a robot first.");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/auth/request-code", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ purpose: "login", email }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not send a sign-in code.");
      setMessage(result.message);
      setDigits(["", "", "", "", "", ""]);
      setCooldown(60);
      setStep("code");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not send a sign-in code.");
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (code.length < 6) {
      setError("Enter the six-digit code from your email.");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/auth/verify-code", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not verify your code.");
      await signInWithCustomToken(firebaseAuth(), result.token);
      goToRole(result.profile.role);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not verify your code.");
    } finally {
      setBusy(false);
    }
  }

  async function loginWithGoogle() {
    setError("");
    if (!human) {
      setError("Complete the quick human check above, then select Login with Google.");
      return;
    }
    setBusy(true);
    try {
      if (!firebaseConfigured()) throw new Error("Firebase sign-in is not configured yet.");
      const auth = firebaseAuth();
      let googleUser;
      try {
        googleUser = (await signInWithPopup(auth, new GoogleAuthProvider())).user;
      } catch (reason) {
        if (!shouldFallBackToRedirect(reason)) throw reason;
        await signInWithRedirect(auth, new GoogleAuthProvider());
        return;
      }
      const idToken = await googleUser.getIdToken();
      const response = await fetch("/api/profile", {
        headers: { authorization: `Bearer ${idToken}` },
        signal: AbortSignal.timeout(15_000),
      });
      const result = await response.json();
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("No Sure Foodz account was found for this Google account. Create an account first, then sign in here.");
        }
        throw new Error(result.error || "Could not load your Sure Foodz account.");
      }
      if (!result.profile || typeof result.profile.role !== "string") {
        throw new Error("Your Sure Foodz account is missing its role. Contact support to restore your account.");
      }
      goToRole(result.profile.role);
    } catch (reason) {
      console.error("Google sign-in could not be completed.", reason);
      setError(googleSignInError(reason));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {step === "email" ? (
        <form onSubmit={requestCode} noValidate>
          <div className="sf-field">
            <label htmlFor="login-email">Email</label>
            <input
              id="login-email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              autoComplete="email"
              placeholder="Enter your email address"
              required
            />
          </div>
          <HumanCheck verified={human} onChange={setHuman} disabled={busy} />
          {!human && <p className="sf-auth-note">Complete the human check above, then continue.</p>}
          <button className="sf-btn is-wide" type="submit" disabled={busy || !human}>
            {busy ? "Sending your code…" : "Login"}
          </button>
          {error && <p className="sf-auth-error" role="alert">{error}</p>}
        </form>
      ) : (
        <form onSubmit={verifyCode} noValidate>
          <div className="sf-otp-head">
            <h2>Check your email</h2>
            <p>Enter the 6-digit code we sent to <b>{email}</b></p>
          </div>
          <div className="sf-otp-row" role="group" aria-label="Six-digit sign-in code">
            {digits.map((digit, index) => (
              <input
                key={index}
                ref={(node) => { boxes.current[index] = node; }}
                value={digit}
                onChange={(event) => typeDigit(index, event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Backspace" && !digit && index > 0) boxes.current[index - 1]?.focus();
                }}
                inputMode="numeric"
                autoComplete={index === 0 ? "one-time-code" : "off"}
                aria-label={`Digit ${index + 1}`}
                maxLength={6}
                autoFocus={index === 0}
              />
            ))}
          </div>
          <div className="sf-otp-meta">
            <span>
              Didn&apos;t get the code?{" "}
              <button
                type="button"
                disabled={cooldown > 0}
                onClick={() => { setStep("email"); setError(""); }}
              >
                {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend it"}
              </button>
            </span>
            <span className="sf-otp-timer" aria-hidden="true">{cooldown > 0 ? `${cooldown}s` : "Ready"}</span>
          </div>
          <button className="sf-btn is-wide" type="submit" disabled={busy}>
            {busy ? "Verifying…" : "Submit"}
          </button>
          {error && <p className="sf-auth-error" role="alert">{error}</p>}
          <p className="sf-auth-note" style={{ marginTop: 12 }}>{message}</p>
        </form>
      )}

      <div className="sf-or"><span>Or</span></div>

      <button className="sf-google" type="button" disabled={busy || !human} onClick={loginWithGoogle}>
        <span className="sf-google-mark" aria-hidden="true">G</span>
        {busy ? "Connecting to Google…" : "Login with Google"}
      </button>

      <p className="sf-auth-switch">First time here? <a href="/signup">Sign up</a></p>
    </div>
  );
}
