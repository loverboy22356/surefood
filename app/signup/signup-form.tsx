"use client";

import { useEffect, useRef, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import {
  GoogleAuthProvider,
  getRedirectResult,
  signInWithCustomToken,
  signInWithPopup,
  signInWithRedirect,
  type User,
} from "firebase/auth";
import type { AppRole } from "@/lib/auth/types";
import { firebaseAuth, firebaseConfigured } from "@/lib/firebase/client";

type SignupRole = "buyer" | "vendor" | "supplier";

const roleOptions: { value: SignupRole; title: string; description: string; icon: string }[] = [
  { value: "buyer", title: "Buyer", description: "Shop fresh food for home", icon: "🧺" },
  { value: "vendor", title: "Vendor", description: "Sell to local customers", icon: "🏪" },
  { value: "supplier", title: "Supplier", description: "Supply businesses in bulk", icon: "📦" },
];

function destination(role: AppRole) {
  if (role === "vendor") return "/vendor";
  if (role === "supplier") return "/supplier";
  if (role === "staff" || role === "admin") return "/admin/verification";
  return "/#about";
}

function isSignupRole(value: unknown): value is SignupRole {
  return roleOptions.some((option) => option.value === value);
}

const googleSignupStorageKey = "surefood-google-signup";

async function createGoogleProfile(user: User, role: SignupRole, displayName: string, phone: string, location: string) {
  const idToken = await user.getIdToken();
  const response = await fetch("/api/profile", {
    method: "POST",
    headers: { authorization: `Bearer ${idToken}`, "content-type": "application/json" },
    body: JSON.stringify({ role, displayName: displayName || user.displayName || "", phone, location }),
    signal: AbortSignal.timeout(15_000),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Could not create your account.");
  await user.getIdToken(true);
  return result.profile as { role: AppRole };
}

export default function SignupForm() {
  const router = useRouter();
  const [role, setRole] = useState<SignupRole>("buyer");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [location, setLocation] = useState("");
  const [step, setStep] = useState<"details" | "code">("details");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [googleEmail, setGoogleEmail] = useState("");
  const [digits, setDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const boxes = useRef<Array<HTMLInputElement | null>>([]);
  const code = digits.join("");

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

  useEffect(() => {
    const requestedRole = new URLSearchParams(window.location.search).get("role");
    if (isSignupRole(requestedRole)) setRole(requestedRole);
  }, []);

  useEffect(() => {
    if (!firebaseConfigured()) return;
    const auth = firebaseAuth();
    let active = true;
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user || !active) return;
      setGoogleEmail(user.email ?? "");
      setEmail((current) => current || user.email || "");
      setDisplayName((current) => current || user.displayName || "");
    });
    void (async () => {
      try {
        const credential = await getRedirectResult(auth);
        await auth.authStateReady();
        if (!active) return;

        const user = credential?.user ?? auth.currentUser;
        const storedSignup = window.sessionStorage.getItem(googleSignupStorageKey);
        if (!user) {
          if (storedSignup) throw new Error("Google sign-in did not complete. Please try again.");
          return;
        }
        if (!storedSignup) return;

        const isGoogleUser = credential || user.providerData.some(
          (provider) => provider.providerId === GoogleAuthProvider.PROVIDER_ID,
        );
        if (!isGoogleUser) throw new Error("Sign in with Google to continue creating your account.");

        let details: unknown;
        try {
          details = JSON.parse(storedSignup);
        } catch {
          throw new Error("Your saved sign-up details could not be read. Please try again.");
        }
        if (!details || typeof details !== "object") {
          throw new Error("Your saved sign-up details are incomplete. Please try again.");
        }
        const signupDetails = details as Record<string, unknown>;
        if (!isSignupRole(signupDetails.role) ||
            typeof signupDetails.displayName !== "string" ||
            typeof signupDetails.phone !== "string" ||
            typeof signupDetails.location !== "string") {
          throw new Error("Your saved sign-up details are incomplete. Please try again.");
        }

        setBusy(true);
        setRole(signupDetails.role);
        const profile = await createGoogleProfile(
          user,
          signupDetails.role,
          signupDetails.displayName,
          signupDetails.phone,
          signupDetails.location,
        );
        if (!active) return;
        window.sessionStorage.removeItem(googleSignupStorageKey);
        router.replace(destination(profile.role));
      } catch (reason: unknown) {
        console.error("Google sign-up could not be completed.", reason);
        if (active) {
          setError(reason instanceof Error ? reason.message : "Google sign-up could not be completed.");
        }
      } finally {
        if (active) setBusy(false);
      }
    })();
    return () => {
      active = false;
      unsubscribe();
    };
  }, [router]);

  async function requestCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/request-code", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ purpose: "signup", role, displayName, email, phone, location }),
        signal: AbortSignal.timeout(15_000),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not send your verification code.");
      setMessage(result.message);
      setStep("code");
    } catch (reason) {
      setError(reason instanceof DOMException && reason.name === "TimeoutError"
        ? "The sign-up request timed out. Check Firebase Admin, OTP, and email settings, then try again."
        : reason instanceof Error ? reason.message : "Could not send your verification code.");
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
      router.replace(destination(result.profile.role));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not verify your code.");
    } finally {
      setBusy(false);
    }
  }

  async function signupWithGoogle() {
    setBusy(true);
    setError("");
    try {
      if (!firebaseConfigured()) throw new Error("Firebase sign-in is not configured yet.");
      const auth = firebaseAuth();
      const existingGoogleUser = auth.currentUser?.providerData.some(
        (provider) => provider.providerId === GoogleAuthProvider.PROVIDER_ID,
      ) ? auth.currentUser : null;
      let googleUser = existingGoogleUser;
      if (!googleUser) {
        try {
          googleUser = (await signInWithPopup(auth, new GoogleAuthProvider())).user;
        } catch (reason) {
          // Popups are blocked in many mobile browsers and in-app webviews. Keep the
          // details the visitor typed, then finish through a full-page redirect that
          // the effect above picks up when they come back.
          const code = reason && typeof reason === "object" && "code" in reason ? String(reason.code) : "";
          if (["auth/popup-blocked", "auth/popup-closed-by-user", "auth/cancelled-popup-request", "auth/operation-not-supported-in-this-environment", "auth/web-storage-unsupported"].includes(code)) {
            window.sessionStorage.setItem(googleSignupStorageKey, JSON.stringify({ role, displayName, phone, location }));
            await signInWithRedirect(auth, new GoogleAuthProvider());
            return;
          }
          throw reason;
        }
      }
      const profile = await createGoogleProfile(googleUser, role, displayName, phone, location);
      window.sessionStorage.removeItem(googleSignupStorageKey);
      router.replace(destination(profile.role));
    } catch (reason) {
      console.error("Google sign-up could not be completed.", reason);
      const code = reason && typeof reason === "object" && "code" in reason ? String(reason.code) : "";
      setError(code === "auth/popup-blocked"
        ? "Your browser blocked the Google sign-in popup. Allow popups for this site and try again."
        : code === "auth/unauthorized-domain"
          ? "This domain is not authorized for Google sign-in yet. Add it under Firebase Authentication → Settings → Authorized domains."
          : reason instanceof Error ? reason.message : "Google sign-up could not be completed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {step === "details" ? (
        <form onSubmit={requestCode} noValidate>
          <div className="sf-roles" role="group" aria-label="How will you use Sure Foodz?">
            {roleOptions.map((option) => (
              <button
                type="button"
                key={option.value}
                className={role === option.value ? "sf-role is-on" : "sf-role"}
                aria-pressed={role === option.value}
                onClick={() => setRole(option.value)}
              >
                <span aria-hidden="true">{option.icon}</span>
                <b>{option.title}</b>
                <small>{option.description}</small>
              </button>
            ))}
          </div>

          <div className="sf-field">
            <label htmlFor="signup-name">Full name</label>
            <input
              id="signup-name"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              type="text"
              autoComplete="name"
              placeholder="Enter your full name"
              required
            />
          </div>

          <div className="sf-field">
            <label htmlFor="signup-email">Email</label>
            <input
              id="signup-email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              autoComplete="email"
              placeholder="Enter your email address"
              required
            />
          </div>

          <div className="sf-field">
            <label htmlFor="signup-phone">Phone number</label>
            <input
              id="signup-phone"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              type="tel"
              autoComplete="tel"
              placeholder="+234 ..."
              required
            />
          </div>

          <div className="sf-field">
            <label htmlFor="signup-location">Your location</label>
            <input
              id="signup-location"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              type="text"
              autoComplete="address-level2"
              placeholder="City, neighbourhood"
              required
            />
          </div>

          <label className="sf-check" style={{ marginBottom: 16 }}>
            <input type="checkbox" required />
            <span>I agree to the <a href="/terms">Terms of Service</a> and <a href="/privacy">Privacy Policy</a>.</span>
          </label>

          <button className="sf-btn is-wide" type="submit" disabled={busy}>
            {busy ? "Creating your account…" : "Sign Up"}
          </button>
          {error && <p className="sf-auth-error" role="alert" style={{ marginTop: 12 }}>{error}</p>}
        </form>
      ) : (
        <form onSubmit={verifyCode} noValidate>
          <div className="sf-otp-head">
            <h2>We just sent an SMS</h2>
            <p>Enter the security code we sent to <b>{email}</b></p>
          </div>
          <div className="sf-otp-row" role="group" aria-label="Six-digit verification code">
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
              <button type="button" onClick={() => { setStep("details"); setError(""); }}>Resend it</button>
            </span>
            <span className="sf-otp-timer" aria-hidden="true">60s</span>
          </div>
          <button className="sf-btn is-wide" type="submit" disabled={busy}>
            {busy ? "Verifying…" : "Submit"}
          </button>
          {error && <p className="sf-auth-error" role="alert">{error}</p>}
          <p className="sf-auth-note" style={{ marginTop: 12 }}>{message}</p>
        </form>
      )}

      <div className="sf-or"><span>Or</span></div>

      <button className="sf-google" type="button" disabled={busy} onClick={signupWithGoogle}>
        <span className="sf-google-mark" aria-hidden="true">G</span>
        {googleEmail ? `Continue with ${googleEmail}` : "Sign Up with Google"}
      </button>

      <p className="sf-auth-switch">Already a member? <a href="/login">Log in</a></p>
    </div>
  );
}
