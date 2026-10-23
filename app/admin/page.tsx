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
    <main className="admin-landing-page" style={{ maxWidth: 760, margin: "40px auto", padding: 24 }}>
      <div style={{ display: "grid", gap: 20 }}>
        <Link href="/" className="brand" style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 28, fontWeight: 700, color: "#2f6b3c" }}>
          <span className="brand-mark" style={{ display: "inline-flex", width: 30, height: 30, alignItems: "center", justifyContent: "center", background: "#dfeedd", borderRadius: 10 }}>s</span>
          <span>sure<span style={{ color: "#4e7e5d" }}>food</span></span>
        </Link>

        <section style={{ background: "#f5f5f3", border: "1px solid #d9d7d2", borderRadius: 18, padding: 28 }}>
          <p style={{ textTransform: "uppercase", letterSpacing: 1.8, fontSize: 12, color: "#627a66", margin: 0 }}>Staff workspace</p>
          <h1 style={{ margin: "12px 0", fontSize: 48, lineHeight: 1.1 }}>Admin dashboard</h1>
          <p style={{ margin: 0, color: "#42534a", fontSize: 18 }}>Manage seller approvals, review documents, and control the marketplace.</p>
        </section>

        <form onSubmit={submitAdminForm} style={{ display: "grid", gap: 14 }}>
          <div role="group" aria-label="Admin account action" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <button type="button" aria-pressed={mode === "signin"} onClick={() => { setMode("signin"); setError(""); }} style={{ background: mode === "signin" ? "#2d6a45" : "white", color: mode === "signin" ? "white" : "#214a30", border: "1px solid #d2e1d3", borderRadius: 8, padding: 12, cursor: "pointer" }}>Sign in</button>
            <button type="button" aria-pressed={mode === "create"} onClick={() => { setMode("create"); setError(""); }} style={{ background: mode === "create" ? "#2d6a45" : "white", color: mode === "create" ? "white" : "#214a30", border: "1px solid #d2e1d3", borderRadius: 8, padding: 12, cursor: "pointer" }}>Create account</button>
          </div>
          <label htmlFor="admin-email">Admin email</label>
          <input id="admin-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="admin@example.com" style={{ border: "1px solid #cbd5cc", borderRadius: 8, padding: 14 }} />
          <label htmlFor="admin-password">Password</label>
          <input id="admin-password" type="password" autoComplete={mode === "create" ? "new-password" : "current-password"} minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" style={{ border: "1px solid #cbd5cc", borderRadius: 8, padding: 14 }} />
          {mode === "create" && <>
            <label htmlFor="admin-confirm-password">Confirm password</label>
            <input id="admin-confirm-password" type="password" autoComplete="new-password" minLength={8} required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Enter password again" style={{ border: "1px solid #cbd5cc", borderRadius: 8, padding: 14 }} />
            <label htmlFor="admin-setup-key">Admin setup key</label>
            <input id="admin-setup-key" type="password" autoComplete="off" required value={setupKey} onChange={(event) => setSetupKey(event.target.value)} placeholder="Setup key" style={{ border: "1px solid #cbd5cc", borderRadius: 8, padding: 14 }} />
          </>}
          <button type="submit" disabled={busy} style={{ background: "#2d6a45", color: "white", border: "none", borderRadius: 12, padding: "16px 18px", fontSize: 18, cursor: "pointer" }}>
            {busy ? "Please wait…" : mode === "create" ? "Create admin account" : "Sign in to admin"}
          </button>
        </form>

        {error && <p role="alert" style={{ color: "#a42323", background: "#ffe5e5", border: "1px solid #f4b0b0", borderRadius: 10, padding: 12 }}>{error}</p>}
      </div>
    </main>
  );
}
