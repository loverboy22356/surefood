"use client";

import { useState } from "react";
import { useEffect } from "react";
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
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [human, setHuman] = useState(false);

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
      if (!response.ok) throw new Error(result.error || "No SureFood account was found for this Google account. Sign up first.");
      goToRole(result.profile.role);
    }).catch((reason: unknown) => {
      console.error("Google sign-in could not be completed.", reason);
      setError(reason instanceof Error ? reason.message : "Google sign-in could not be completed.");
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
    if (code === "auth/popup-closed-by-user") return "Google sign-in was cancelled. Select Continue with Google to try again.";
    if (code === "auth/popup-blocked") return "Your browser blocked the Google sign-in window. Allow popups for this site and try again.";
    if (code === "auth/unauthorized-domain") return "This site is not authorized for Google sign-in. Add its domain in Firebase Authentication settings.";
    if (code === "auth/operation-not-allowed") return "Google sign-in is not enabled for this Firebase project.";
    if (code === "auth/network-request-failed") return "Google sign-in could not reach Firebase. Check your connection and try again.";
    return reason instanceof Error ? reason.message : "Google sign-in could not be completed.";
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
      setStep("code");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not send a sign-in code.");
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
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
      setError("Please confirm you are not a robot first.");
      return;
    }
    setBusy(true);
    try {
      if (!firebaseConfigured()) throw new Error("Firebase sign-in is not configured yet.");
      const credential = await signInWithPopup(firebaseAuth(), new GoogleAuthProvider());
      const idToken = await credential.user.getIdToken();
      const response = await fetch("/api/profile", {
        headers: { authorization: `Bearer ${idToken}` },
        signal: AbortSignal.timeout(15_000),
      });
      const result = await response.json();
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("No SureFood account was found for this Google account. Create an account first, then sign in here.");
        }
        throw new Error(result.error || "Could not load your SureFood account.");
      }
      if (!result.profile || typeof result.profile.role !== "string") {
        throw new Error("Your SureFood account is missing its role. Contact support to restore your account.");
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
    <div className="auth-form-wrap">
      <div className="auth-heading"><span className="auth-overline">WELCOME BACK</span><h2>Good to see you.</h2><p>Sign in with a one-time email code. No password to remember.</p></div>
      {step === "email" ? (
        <form className="auth-form" onSubmit={requestCode}>
          <label htmlFor="login-email">Email address</label><input id="login-email" value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" placeholder="you@example.com" required />
          <button className="auth-submit" type="submit" disabled={busy}>{busy ? "Sending code..." : "Email me a sign-in code"} <span>→</span></button>
        </form>
      ) : (
        <form className="auth-form" onSubmit={verifyCode}>
          <p className="auth-flow-message">{message} <strong>{email}</strong></p>
          <label htmlFor="login-code">Six-digit email code</label><input id="login-code" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" placeholder="000000" required />
          <button className="auth-submit" type="submit" disabled={busy}>{busy ? "Verifying..." : "Verify and sign in"} <span>→</span></button>
          <button className="auth-back-link" type="button" onClick={() => { setStep("email"); setError(""); }}>Use a different email</button>
        </form>
      )}
      <HumanCheck verified={human} onChange={setHuman} disabled={busy} />
      {error && <p className="auth-error" role="alert">{error}</p>}
      <div className="auth-divider"><span />or<span /></div>
      <button className="google-button" type="button" disabled={busy || !human} onClick={loginWithGoogle}><span className="google-mark">G</span>Continue with Google</button>
      <p className="auth-switch">New to SureFood? <a href="/signup">Create an account</a></p>
    </div>
  );
}
