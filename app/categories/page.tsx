"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ShopFooter, ShopHeader } from "@/app/components/shop-chrome";
import { apiProductToListing, type ApiProduct, type MarketplaceProduct } from "@/app/components/marketplace-product";
import { DEFAULT_PRODUCT_CATEGORIES } from "@/lib/product-categories";

const categoryIcons: Record<string, string> = {
  "Fresh vegetables": "🥬",
  "Fresh fruits": "🍎",
  "Meat & seafood": "🍗",
  "Dairy & eggs": "🥛",
  Bakery: "🥖",
  "Pantry essentials": "🍚",
  Drinks: "🧃",
  "Snacks & treats": "🍪",
  "Frozen foods": "🧊",
  "Home & kitchen": "🍳",
  "Health & beauty": "🧴",
  "Baby & kids": "🍼",
  "Pet supplies": "🐾",
  "Household essentials": "🧺",
};

export default function CategoriesPage() {
  const [products, setProducts] = useState<MarketplaceProduct[]>([]);
  const [extra, setExtra] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<"popular" | "az">("popular");

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const [productResponse, categoryResponse] = await Promise.allSettled([
          fetch("/api/products", { signal: AbortSignal.timeout(15_000) }),
          fetch("/api/categories", { signal: AbortSignal.timeout(15_000) }),
        ]);
        if (!active) return;
        if (productResponse.status === "fulfilled" && productResponse.value.ok) {
          const result = await productResponse.value.json();
          setProducts((Array.isArray(result.products) ? result.products as ApiProduct[] : []).map(apiProductToListing));
        }
        if (categoryResponse.status === "fulfilled" && categoryResponse.value.ok) {
          const result = await categoryResponse.value.json();
          const defaults = new Set(DEFAULT_PRODUCT_CATEGORIES.map((name) => name.toLowerCase()));
          setExtra((Array.isArray(result.categories) ? result.categories as string[] : [])
            .filter((name) => !defaults.has(name.toLowerCase())));
        }
      } catch (reason) {
        console.error("Could not load the category list.", reason);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const categories = useMemo(() => {
    const all = [...DEFAULT_PRODUCT_CATEGORIES, ...extra];
    const counted = all
      .map((name) => {
        const key = name.toLowerCase();
        const items = products.filter((product) => product.category.toLowerCase() === key);
        return { name, items: items.length, image: items[0]?.imageUrl };
      })
      .filter((entry, index, list) => list.findIndex((other) => other.name.toLowerCase() === entry.name.toLowerCase()) === index);
    if (order === "az") return [...counted].sort((a, b) => a.name.localeCompare(b.name));
    return [...counted].sort((a, b) => b.items - a.items);
  }, [extra, order, products]);

  return (
    <div className="sf-page">
      <ShopHeader />
      <main className="sf-shell" style={{ flex: "1 1 auto" }}>
        <div className="sf-breadcrumbs">
          <Link href="/">Home</Link>
          <span>/</span>
          <span>All Categories</span>
        </div>

        <div className="sf-pagehead">
          <Link href="/" className="sf-back" aria-label="Back to home">←</Link>
          <h1>All Categories</h1>
        </div>

        <div className="sf-cat-head">
          <span className="sf-cat-count">
            Showing <b>{categories.length}</b> categories · <b>{products.length}</b> products
          </span>
          <div className="sf-cat-tools">
            <select
              className="sf-select"
              value={order}
              onChange={(event) => setOrder(event.target.value as "popular" | "az")}
              aria-label="Sort categories"
            >
              <option value="popular">Popular first</option>
              <option value="az">A to Z</option>
            </select>
            <Link className="sf-more" href="/shop">Shop everything</Link>
          </div>
        </div>

        {loading ? (
          <div className="sf-cat-grid" aria-hidden="true">
            {Array.from({ length: 12 }).map((_, index) => (
              <div key={index} className="sf-circle">
                <span className="sf-circle-art" style={{ opacity: .5 }} />
                <b style={{ opacity: .3 }}>Loading…</b>
              </div>
            ))}
          </div>
        ) : (
          <div className="sf-cat-grid">
            {categories.map((category) => (
              <Link key={category.name} className="sf-circle" href={`/shop?category=${encodeURIComponent(category.name)}`}>
                <span className="sf-circle-art" aria-hidden="true">
                  {categoryIcons[category.name] ?? "🧺"}
                </span>
                <b>{category.name}</b>
                <small style={{ color: "var(--sf-muted)", fontSize: 10.5 }}>
                  {category.items} {category.items === 1 ? "item" : "items"}
                </small>
              </Link>
            ))}
          </div>
        )}
      </main>
      <ShopFooter />
    </div>
  );
}
