"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { signInWithCustomToken, signInWithEmailAndPassword } from "firebase/auth";
import { firebaseAuth, firebaseConfigured } from "@/lib/firebase/client";
import { useState } from "react";

export default function AdminLandingPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "create">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [setupKey, setSetupKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function openAdminDashboard(idToken: string) {
    const response = await fetch("/api/profile", {
      headers: { authorization: `Bearer ${idToken}` },
      signal: AbortSignal.timeout(15_000),
    });
    const result = await response.json();
    if (response.status === 404) throw new Error("No admin profile exists yet. Use Create account with the setup key.");
    if (!response.ok) throw new Error(result.error || "Could not load your admin account.");

    const role = String(result.profile?.role ?? "");
    if (role !== "staff" && role !== "admin") {
      throw new Error("This account is not an admin or staff account.");
    }
    await firebaseAuth().currentUser?.getIdToken(true);
    router.replace("/admin/verification");
  }

  async function submitAdminForm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (!firebaseConfigured()) throw new Error("Firebase sign-in is not configured yet.");
      const auth = firebaseAuth();
      if (mode === "create") {
        if (password !== confirmPassword) throw new Error("The passwords do not match.");
        if (!setupKey.trim()) throw new Error("Enter the admin setup key.");
        const response = await fetch("/api/admin/bootstrap", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email, password, setupKey }),
          signal: AbortSignal.timeout(15_000),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Could not create the admin account.");
        await signInWithCustomToken(auth, result.token);
        router.replace("/admin/verification");
        return;
      }

      const credential = await signInWithEmailAndPassword(auth, email, password);
      const idToken = await credential.user.getIdToken(true);
      await openAdminDashboard(idToken);
    } catch (reason) {
      console.error("Admin account request failed.", reason);
      setError(reason instanceof Error ? reason.message : "Admin account request failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="admin-landing-page">
      <div className="admin-auth-stack">
        <Link href="/" className="brand admin-auth-brand">
          <span className="brand-mark admin-auth-mark">s</span>
          <span>sure<span className="admin-auth-brand-soft">food</span></span>
        </Link>

        <section className="admin-auth-hero">
          <p className="admin-auth-kicker">Staff workspace</p>
          <h1>Admin dashboard</h1>
          <p className="admin-auth-lede">Manage seller approvals, review documents, and control the marketplace.</p>
        </section>

        <form className="admin-auth-form" onSubmit={submitAdminForm}>
          <div role="group" className="admin-auth-modes" aria-label="Admin account action">
            <button type="button" className="admin-auth-mode" aria-pressed={mode === "signin"} data-active={mode === "signin"} onClick={() => { setMode("signin"); setError(""); }}>Sign in</button>
            <button type="button" className="admin-auth-mode" aria-pressed={mode === "create"} data-active={mode === "create"} onClick={() => { setMode("create"); setError(""); }}>Create account</button>
          </div>
          <label htmlFor="admin-email">Admin email</label>
          <input className="admin-auth-input" id="admin-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="admin@example.com" />
          <label htmlFor="admin-password">Password</label>
          <input className="admin-auth-input" id="admin-password" type="password" autoComplete={mode === "create" ? "new-password" : "current-password"} minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" />
          {mode === "create" && <>
            <label htmlFor="admin-confirm-password">Confirm password</label>
            <input className="admin-auth-input" id="admin-confirm-password" type="password" autoComplete="new-password" minLength={8} required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Enter password again" />
            <label htmlFor="admin-setup-key">Admin setup key</label>
            <input className="admin-auth-input" id="admin-setup-key" type="password" autoComplete="off" required value={setupKey} onChange={(event) => setSetupKey(event.target.value)} placeholder="Setup key" />
          </>}
          <button className="admin-auth-submit" type="submit" disabled={busy}>
            {busy ? "Please wait…" : mode === "create" ? "Create admin account" : "Sign in to admin"}
          </button>
        </form>

        {error && <p role="alert" className="admin-auth-error">{error}</p>}
      </div>
    </main>
  );
}
