"use client";

import Link from "next/link";
import { signInWithCustomToken, signInWithEmailAndPassword } from "firebase/auth";
import { onAuthStateChanged, type User } from "firebase/auth";
import { useCallback, useEffect, useState } from "react";
import { firebaseAuth, firebaseConfigured } from "@/lib/firebase/client";

type StatsCard = {
  label: string;
  value: string | number;
  trend: string;
  icon: string;
};

const nav: { label: string; href: string; icon: string }[] = [
  { label: "Dashboard", href: "/admin/dashboard", icon: "⌂" },
  { label: "Products", href: "/admin/products", icon: "▦" },
  { label: "Sellers", href: "/admin/sellers", icon: "🏪" },
  { label: "Orders", href: "/admin/orders", icon: "▱" },
  { label: "Basket plans", href: "/admin/baskets", icon: "🧺" },
  { label: "Categories", href: "/admin/categories", icon: "▤" },
  { label: "Quotations", href: "/admin/quotes", icon: "💬" },
  { label: "Event orders", href: "/admin/special-orders", icon: "🎉" },
  { label: "Pay Later", href: "/admin/pay-later", icon: "🗓" },
  { label: "Affiliates", href: "/admin/affiliates", icon: "♾" },
];

export default function AdminPage() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [staff, setStaff] = useState(false);
  const [mode, setMode] = useState<"signin" | "create">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [setupKey, setSetupKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [activeSection, setActiveSection] = useState("dashboard");
  const [stats, setStats] = useState<StatsCard[]>([]);
  const [loading, setLoading] = useState(false);

  const loadStats = useCallback(async (currentUser: User) => {
    try {
      const token = await currentUser.getIdToken();
      const responses = await Promise.allSettled([
        fetch("/api/products", { headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10_000) }),
        fetch("/api/orders", { headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10_000) }),
        fetch("/api/marketplace/sellers", { headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10_000) }),
        fetch("/api/basket-plans", { headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10_000) }),
      ]);
      const [productsRes, ordersRes, sellersRes, basketsRes] = responses;
      let productCount = 0, orderCount = 0, sellerCount = 0, basketCount = 0;
      if (productsRes.status === "fulfilled") {
        const data = await productsRes.value.json();
        productCount = Array.isArray(data.products) ? data.products.length : 0;
      }
      if (ordersRes.status === "fulfilled") {
        const data = await ordersRes.value.json();
        orderCount = Array.isArray(data.orders) ? data.orders.length : 0;
      }
      if (sellersRes.status === "fulfilled") {
        const data = await sellersRes.value.json();
        sellerCount = Array.isArray(data.sellers) ? data.sellers.length : 0;
      }
      if (basketsRes.status === "fulfilled") {
        const data = await basketsRes.value.json();
        basketCount = Array.isArray(data.plans) ? data.plans.length : 0;
      }
      setStats([
        { label: "Live products", value: productCount, trend: "catalogue", icon: "▦" },
        { label: "Orders", value: orderCount, trend: "all orders", icon: "▱" },
        { label: "Sellers", value: sellerCount, trend: "verified vendors", icon: "🏪" },
        { label: "Basket plans", value: basketCount, trend: "subscription plans", icon: "🧺" },
      ]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load platform stats.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!firebaseConfigured()) {
      setAuthReady(true);
      return;
    }
    return onAuthStateChanged(firebaseAuth(), async (currentUser) => {
      setUser(currentUser);
      setAuthReady(true);
      if (!currentUser) return;
      try {
        const tokenResult = await currentUser.getIdTokenResult();
        const role = String(tokenResult.claims.role ?? "");
        const isStaffUser = role === "staff" || role === "admin";
        setStaff(isStaffUser);
        if (isStaffUser) {
          await loadStats(currentUser);
        }
      } catch {
        /* fall through; the sign-in form will still work */
      }
    });
  }, [loadStats]);

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
    setStaff(true);
    const currentUser = firebaseAuth().currentUser;
    if (currentUser) await loadStats(currentUser);
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
        const currentUser = auth.currentUser;
        if (!currentUser) throw new Error("Could not sign in.");
        await openAdminDashboard(await currentUser.getIdToken(true));
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

  if (!authReady) return <div className="admin-loading">Loading staff workspace…</div>;

  if (user && staff) {
    return (
      <main className="admin-dashboard">
        <aside className="admin-sidebar">
          <Link href="/" className="admin-brand"><span className="brand-mark">s</span><span>sure<span>foodz</span></span></Link>
          <span className="admin-sidebar-title">Staff workspace</span>
          <nav className="admin-sidebar-nav">
            {nav.map((item) => (
              <button
                key={item.label}
                type="button"
                className={activeSection === item.label.toLowerCase().replace(/\s+/g, "-") ? "is-current" : undefined}
                onClick={() => setActiveSection(item.label.toLowerCase().replace(/\s+/g, "-"))}
              >
                <span>{item.icon}</span>{item.label}
              </button>
            ))}
          </nav>
          <div className="admin-sidebar-foot">
            <span>{user.email ?? "Staff"}</span>
            <button type="button" className="admin-sidebar-quit" onClick={() => { firebaseAuth().signOut(); window.location.href = "/admin"; }}>Sign out</button>
          </div>
        </aside>
        <div className="admin-dashboard-body">
          <header className="admin-dashboard-head">
            <h1>{activeSection.charAt(0).toUpperCase() + activeSection.slice(1)}</h1>
            <p>Manage the Sure Foodz marketplace from one place.</p>
          </header>

          {activeSection === "dashboard" && (
            <section className="admin-stats">
              {stats.map((card) => (
                <article key={card.label} className="admin-stat-card">
                  <span className="admin-stat-icon">{card.icon}</span>
                  <div>
                    <small>{card.label}</small>
                    <strong>{card.value}</strong>
                    <span className="admin-stat-trend">{card.trend}</span>
                  </div>
                </article>
              ))}
              <div className="admin-dashboard-note">
                <span>●</span> Platform data is live. Use the links on the left to manage products, sellers, orders, basket plans, categories, quotations, event orders, Pay Later applications, and affiliates.
              </div>
            </section>
          )}

          {activeSection !== "dashboard" && (
            <section className="admin-section-placeholder">
              <h2>{activeSection.charAt(0).toUpperCase() + activeSection.slice(1)}</h2>
              <p>Manage {activeSection} across the Sure Foodz platform.</p>
              <div className="admin-section-actions">
                <Link href="/admin/baskets" className="admin-section-button">Go to basket plans →</Link>
                <Link href="/admin/categories" className="admin-section-button">Go to categories →</Link>
                <Link href="/admin/quotes" className="admin-section-button">Go to quotations →</Link>
              </div>
            </section>
          )}
        </div>
      </main>
    );
  }

  // Not signed in as staff — show the sign-in / create form.
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
          <p className="admin-auth-lede">Manage products, sellers, orders, baskets, categories, and the whole Sure Foodz platform.</p>
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
