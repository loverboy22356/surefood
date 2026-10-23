"use client";

import Link from "next/link";
import { onAuthStateChanged, type User } from "firebase/auth";
import { useEffect, useState } from "react";
import { firebaseAuth, firebaseConfigured } from "@/lib/firebase/client";
import { DEFAULT_PRODUCT_CATEGORIES } from "@/lib/product-categories";

export default function AdminCategoriesPage() {
  const [user, setUser] = useState<User | null>(null);
  const [staff, setStaff] = useState(false);
  const [categories, setCategories] = useState<string[]>([...DEFAULT_PRODUCT_CATEGORIES]);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!firebaseConfigured()) return;
    return onAuthStateChanged(firebaseAuth(), async (currentUser) => {
      setUser(currentUser);
      if (!currentUser) return;
      const claims = await currentUser.getIdTokenResult();
      setStaff(claims.claims.role === "staff" || claims.claims.role === "admin");
      try {
        const token = await currentUser.getIdToken();
        const response = await fetch("/api/categories", { headers: { authorization: `Bearer ${token}` } });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Could not load categories.");
        setCategories(result.categories);
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "Could not load categories.");
      }
    });
  }, []);

  async function addCategory(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/categories", {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not create category.");
      setCategories((current) => [...new Set([...current, result.category])].sort((a, b) => a.localeCompare(b)));
      setName("");
      setNotice(`${result.category} is now available to approved sellers.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not create category.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="manual-review-page">
      <header className="manual-review-header">
        <Link href="/admin/verification" className="brand"><span className="brand-mark">s</span><span>sure<span>food</span></span></Link>
        <div><span>STAFF WORKSPACE</span><h1>Product categories</h1><p>Categories created here are available to sellers when they list products.</p></div>
        <Link href="/admin/verification">Business verification →</Link>
      </header>
      {!user ? <p className="manual-review-empty">Sign in with a SureFood staff account to manage categories. <Link href="/login">Sign in →</Link></p>
        : !staff ? <p className="manual-review-alert" role="alert">A SureFood staff or admin account is required.</p>
          : <section className="manual-review-list">
            <article className="manual-review-card">
              <h2>Add category</h2>
              <form className="auth-form" onSubmit={addCategory}>
                <label htmlFor="admin-category-name">Category name</label>
                <input id="admin-category-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={60} required />
                <button className="auth-submit" type="submit" disabled={busy}>{busy ? "Saving..." : "Add category"}</button>
              </form>
              {error && <p className="manual-review-alert" role="alert">{error}</p>}
              {notice && <p className="manual-review-notice" role="status">{notice}</p>}
              <h2>Available categories</h2>
              <ul>{categories.map((category) => <li key={category}>{category}</li>)}</ul>
            </article>
          </section>}
    </main>
  );
}
