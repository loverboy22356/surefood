"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useBusinessAccount } from "@/lib/auth/use-business-account";

type StoreProduct = {
  id: string;
  name: string;
  category: string;
  priceMinor: number;
  stock: number;
  imageUrl?: string;
  status: string;
};

const currency = new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 });

export default function SupplierStorePreviewPage() {
  const account = useBusinessAccount("supplier");
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!account.user) return;
    let active = true;
    void (async () => {
      try {
        const token = await account.user!.getIdToken();
        const response = await fetch("/api/products?mine=true", {
          headers: { authorization: `Bearer ${token}` },
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Could not load your store preview.");
        if (active) setProducts(result.products.filter((product: StoreProduct) => product.status === "active"));
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : "Could not load your store preview.");
      }
    })();
    return () => { active = false; };
  }, [account.user]);

  if (account.loading) return <main className="business-loading">Loading your store preview…</main>;
  if (account.error) return <main className="business-loading" role="alert">{account.error}</main>;

  return (
    <main className="onboarding-page">
      <header className="onboarding-header">
        <Link href="/supplier" className="brand"><span className="brand-mark">s</span><span>sure<span>food</span></span></Link>
        <Link href="/supplier">Back to supplier dashboard →</Link>
      </header>
      <section className="onboarding-card">
        <span className="auth-overline">SUPPLIER STORE PREVIEW</span>
        <h1>{account.profile?.business?.businessName || account.profile?.displayName}</h1>
        <p className="onboarding-intro">Preview of your active supplier listings. This is your supplier catalog, not the buyer homepage.</p>
        {account.profile?.verificationStatus !== "approved" && <p className="onboarding-review-note">Your store listings are hidden from buyers until your business is approved. <Link href="/onboarding">Continue verification →</Link></p>}
        {error && <p className="auth-error" role="alert">{error}</p>}
        {products.length ? (
          <div className="retail-product-grid">
            {products.map((product) => (
              <article key={product.id} className="retail-product-card">
                <div className="retail-product-image">
                  {product.imageUrl ? <Image src={product.imageUrl} alt={product.name} fill sizes="220px" unoptimized /> : <span>📦</span>}
                </div>
                <div className="retail-product-details">
                  <small>{product.category}</small>
                  <h3>{product.name}</h3>
                  <div><strong>{currency.format(product.priceMinor / 100)}</strong><span>{product.stock} in stock</span></div>
                </div>
              </article>
            ))}
          </div>
        ) : <p className="retail-empty">No active supplier products to preview yet.</p>}
      </section>
    </main>
  );
}
