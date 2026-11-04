"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ProductDetailsDialog,
  apiProductToListing,
  readFavourites,
  writeFavourites,
  type ApiProduct,
  type MarketplaceProduct,
} from "@/app/components/marketplace-product";
import { ProductTile, ProductTileSkeleton, productDiscount } from "@/app/components/product-tile";
import { addItemToBasket } from "@/app/components/cart-client";
import { ShopFooter, ShopHeader } from "@/app/components/shop-chrome";

function announceBasketChange() {
  window.dispatchEvent(new Event("surefood-cart-changed"));
}

export function ShopBrowser() {
  const params = useSearchParams();
  const router = useRouter();
  const [catalog, setCatalog] = useState<MarketplaceProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  const [sellers, setSellers] = useState<string[]>([]);
  const [dealsOnly, setDealsOnly] = useState(params.get("deals") === "1");
  const [inStock, setInStock] = useState(false);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [sort, setSort] = useState("position");
  const [location, setLocation] = useState(params.get("state") ?? "");
  const [favourites, setFavourites] = useState<MarketplaceProduct[]>([]);
  const [notice, setNotice] = useState("");
  const [chosenSellers, setChosenSellers] = useState<string[]>([]);
  const [quickView, setQuickView] = useState<MarketplaceProduct | null>(null);

  useEffect(() => {
    setCategories(params.getAll("category").filter(Boolean));
    setDealsOnly(params.get("deals") === "1");
    setLocation(params.get("state") ?? "");
  }, [params]);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const response = await fetch("/api/products", { signal: AbortSignal.timeout(15_000) });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "The shop is temporarily unavailable.");
        if (!active) return;
        const listings = (Array.isArray(result.products) ? result.products as ApiProduct[] : []).map(apiProductToListing);
        setCatalog(listings);
        setSellers([...new Set(listings.map((item) => item.sellerName).filter(Boolean) as string[])].sort());
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : "The shop is temporarily unavailable.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    setFavourites(readFavourites());
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 4_000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const allCategories = useMemo(
    () => [...new Set(catalog.map((product) => product.category))].sort(),
    [catalog],
  );

  const visible = useMemo(() => {
    const minimum = Number(minPrice) * 100;
    const maximum = Number(maxPrice) * 100;
    const chosen = location.trim().toLowerCase();
    let items = catalog.filter((product) => {
      if (categories.length && !categories.includes(product.category)) return false;
      if (dealsOnly && productDiscount(product) === 0) return false;
      if (chosenSellers.length && !chosenSellers.includes(product.sellerName ?? "")) return false;
      if (inStock && (product.stock ?? 0) <= 0) return false;
      if (minPrice && product.price < minimum) return false;
      if (maxPrice && product.price > maximum) return false;
      if (chosen && ![product.sellerRegion, product.sellerCity, product.sellerLocation]
        .some((place) => (place ?? "").trim().toLowerCase() === chosen)) return false;
      return true;
    });
    if (sort === "price-asc") items = [...items].sort((a, b) => a.price - b.price);
    if (sort === "price-desc") items = [...items].sort((a, b) => b.price - a.price);
    if (sort === "discount") items = [...items].sort((a, b) => productDiscount(b) - productDiscount(a));
    return items;
  }, [catalog, categories, chosenSellers, dealsOnly, inStock, location, maxPrice, minPrice, sort]);

  function toggleCategory(name: string) {
    setCategories((current) => current.includes(name)
      ? current.filter((item) => item !== name)
      : [...current, name]);
  }

  function clearLocation() {
    const next = new URLSearchParams(params.toString());
    next.delete("state");
    setLocation("");
    router.replace(next.toString() ? `/shop?${next.toString()}` : "/shop", { scroll: false });
  }

  function toggleSave(product: MarketplaceProduct) {
    const next = favourites.some((item) => item.id === product.id)
      ? favourites.filter((item) => item.id !== product.id)
      : [...favourites, product];
    setFavourites(next);
    writeFavourites(next);
  }

  function addToCart(product: MarketplaceProduct, quantity = 1) {
    const result = addItemToBasket(product, quantity);
    setNotice(result.message);
    if (result.ok) announceBasketChange();
  }

  return (
    <div className="sf-page">
      <ShopHeader />
      <main className="sf-shell" style={{ flex: "1 1 auto" }}>
        <div className="sf-breadcrumbs">
          <Link href="/">Home</Link>
          <span>/</span>
          <Link href="/categories">All Categories</Link>
          <span>/</span>
          <span>{location || (dealsOnly ? "All Offers" : categories.length === 1 ? categories[0] : "Shop")}</span>
        </div>

        <div className="sf-list-layout">
          <aside className="sf-filters" aria-label="Filters">
            <details className="sf-filter-group" open>
              <summary>Category</summary>
              <div className="sf-filter-body">
                {allCategories.map((name) => (
                  <label key={name} className="sf-check">
                    <input type="checkbox" checked={categories.includes(name)} onChange={() => toggleCategory(name)} />
                    {name}
                  </label>
                ))}
                {!allCategories.length && <small style={{ color: "var(--sf-muted)" }}>No categories yet</small>}
              </div>
            </details>

            <details className="sf-filter-group" open>
              <summary>Sold by</summary>
              <div className="sf-filter-body">
                {sellers.map((name) => (
                  <label key={name} className="sf-check">
                    <input
                      type="checkbox"
                      checked={chosenSellers.includes(name)}
                      onChange={() => setChosenSellers((current) => current.includes(name)
                        ? current.filter((item) => item !== name)
                        : [...current, name])}
                    />
                    {name}
                  </label>
                ))}
                {!sellers.length && <small style={{ color: "var(--sf-muted)" }}>No sellers yet</small>}
              </div>
            </details>

            <details className="sf-filter-group" open>
              <summary>Price</summary>
              <div className="sf-filter-body" style={{ gridTemplateColumns: "1fr 1fr", display: "grid", gap: 6 }}>
                <input
                  className="sf-select"
                  style={{ height: 34 }}
                  inputMode="numeric"
                  placeholder="From"
                  value={minPrice}
                  onChange={(event) => setMinPrice(event.target.value.replace(/\D/g, ""))}
                  aria-label="Minimum price"
                />
                <input
                  className="sf-select"
                  style={{ height: 34 }}
                  inputMode="numeric"
                  placeholder="To"
                  value={maxPrice}
                  onChange={(event) => setMaxPrice(event.target.value.replace(/\D/g, ""))}
                  aria-label="Maximum price"
                />
              </div>
            </details>

            <details className="sf-filter-group" open>
              <summary>Offer</summary>
              <div className="sf-filter-body">
                <label className="sf-check">
                  <input type="checkbox" checked={dealsOnly} onChange={() => setDealsOnly((value) => !value)} />
                  Discounted only
                </label>
                <label className="sf-check">
                  <input type="checkbox" checked={inStock} onChange={() => setInStock((value) => !value)} />
                  In stock only
                </label>
              </div>
            </details>
          </aside>

          <section>
            <div className="sf-list-bar">
              <div>
                <h1>{dealsOnly ? "All Offers" : "Shop everything"}</h1>
                <small>
                  Showing <b style={{ color: "var(--sf-ink)" }}>{visible.length}</b> of {catalog.length} items
                </small>
                {location && (
                  <span className="sf-location-active">
                    Selling in <b>{location}</b>
                    <button type="button" onClick={clearLocation} aria-label={`Stop filtering by ${location}`}>×</button>
                  </span>
                )}
              </div>
              <select className="sf-select" value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Sort products">
                <option value="position">Position</option>
                <option value="price-asc">Price: low to high</option>
                <option value="price-desc">Price: high to low</option>
                <option value="discount">Biggest discount</option>
              </select>
            </div>

            {error && <p className="sf-auth-error" role="alert">{error}</p>}

            {loading ? (
              <div className="sf-grid" aria-hidden="true">
                <ProductTileSkeleton count={8} />
              </div>
            ) : visible.length ? (
              <div className="sf-grid">
                {visible.map((product) => (
                  <ProductTile
                    key={product.id}
                    product={product}
                    saved={favourites.some((item) => item.id === product.id)}
                    onToggleSave={toggleSave}
                    onAdd={addToCart}
                    onQuickView={setQuickView}
                  />
                ))}
              </div>
            ) : (
              <div className="sf-empty-state">
                Nothing matches those filters yet.{" "}
                <button
                  type="button"
                  className="sf-more"
                  onClick={() => { setCategories([]); setChosenSellers([]); setDealsOnly(false); setInStock(false); setMinPrice(""); setMaxPrice(""); clearLocation(); }}
                >
                  Clear filters
                </button>
              </div>
            )}
          </section>
        </div>
      </main>
      <ShopFooter />

      {notice && (
        <div className="sf-toast" role="status">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="currentColor" /><path d="m7.5 12.3 3 3L16.5 9.4" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          <span>{notice}</span>
        </div>
      )}

      {quickView && (
        <ProductDetailsDialog
          product={quickView}
          onClose={() => setQuickView(null)}
          saved={favourites.some((item) => item.id === quickView.id)}
          onAdd={(product, quantity) => addToCart(product, quantity)}
          onToggleSave={toggleSave}
        />
      )}
    </div>
  );
}
