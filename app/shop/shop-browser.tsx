"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  apiProductToListing,
  formatMarketMoney,
  productImageUrl,
  readFavourites,
  writeFavourites,
  type ApiProduct,
  type MarketplaceProduct,
} from "@/app/components/marketplace-product";
import { addItemToBasket } from "@/app/components/cart-client";
import { ShopFooter, ShopHeader } from "@/app/components/shop-chrome";

function discountPercent(product: MarketplaceProduct) {
  if (!product.oldPrice || product.oldPrice <= product.price) return 0;
  return Math.round((1 - product.price / product.oldPrice) * 100);
}

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
      if (dealsOnly && discountPercent(product) === 0) return false;
      if (inStock && (product.stock ?? 0) <= 0) return false;
      if (minPrice && product.price < minimum) return false;
      if (maxPrice && product.price > maximum) return false;
      if (chosen && ![product.sellerRegion, product.sellerCity, product.sellerLocation]
        .some((place) => (place ?? "").trim().toLowerCase() === chosen)) return false;
      return true;
    });
    if (sort === "price-asc") items = [...items].sort((a, b) => a.price - b.price);
    if (sort === "price-desc") items = [...items].sort((a, b) => b.price - a.price);
    if (sort === "discount") items = [...items].sort((a, b) => discountPercent(b) - discountPercent(a));
    return items;
  }, [catalog, categories, dealsOnly, inStock, location, maxPrice, minPrice, sort]);

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

  function addToCart(product: MarketplaceProduct) {
    const result = addItemToBasket(product);
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
                    <input type="checkbox" readOnly checked={false} onChange={() => {}} aria-label={name} />
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

            {notice && <p className="sf-auth-note" role="status">{notice}</p>}
            {error && <p className="sf-auth-error" role="alert">{error}</p>}

            {loading ? (
              <div className="sf-grid" aria-hidden="true">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div key={index} className="sf-card" style={{ height: 320, opacity: .45 }} />
                ))}
              </div>
            ) : visible.length ? (
              <div className="sf-grid">
                {visible.map((product) => {
                  const off = discountPercent(product);
                  const saved = favourites.some((item) => item.id === product.id);
                  return (
                    <article key={product.id} className="sf-card">
                      <Link className={product.imageUrl ? "sf-card-art" : "sf-card-art is-flat"} href={`/product/${product.id}`}>
                        {product.imageUrl
                          ? <img src={productImageUrl(product.imageUrl, 500)} alt={product.name} loading="lazy" />
                          : <span aria-hidden="true">{product.emoji}</span>}
                        {off > 0 && <span className="sf-card-off">-{off}%</span>}
                        {product.tag && <span className="sf-card-tag">{product.tag}</span>}
                      </Link>
                      <div className="sf-card-body">
                        <span className="sf-card-source">
                          {product.sellerVerified ? "✔ " : ""}
                          {product.sellerRole === "supplier" ? "Supplier" : "Vendor"} · {product.sellerCity || "Nigeria"}
                        </span>
                        <Link className="sf-card-title" href={`/product/${product.id}`}>{product.name}</Link>
                        <div className="sf-card-price">
                          <strong>{formatMarketMoney(product.price, product.currency)}</strong>
                          {product.oldPrice && <del>{formatMarketMoney(product.oldPrice, product.currency)}</del>}
                        </div>
                        <button
                          type="button"
                          className="sf-card-add"
                          disabled={(product.stock ?? 0) <= 0}
                          onClick={() => addToCart(product)}
                        >
                          {(product.stock ?? 0) <= 0 ? "Out of stock" : "+ Add to Cart"}
                        </button>
                      </div>
                      <button
                        type="button"
                        className={saved ? "sf-card-save is-on" : "sf-card-save"}
                        aria-label={saved ? "Remove from wishlist" : "Save to wishlist"}
                        aria-pressed={saved}
                        onClick={() => toggleSave(product)}
                      >♥</button>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="sf-empty-state">
                Nothing matches those filters yet.{" "}
                <button
                  type="button"
                  className="sf-more"
                  onClick={() => { setCategories([]); setDealsOnly(false); setInStock(false); setMinPrice(""); setMaxPrice(""); clearLocation(); }}
                >
                  Clear filters
                </button>
              </div>
            )}
          </section>
        </div>
      </main>
      <ShopFooter />
    </div>
  );
}
