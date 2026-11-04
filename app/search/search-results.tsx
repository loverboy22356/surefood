"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ProductDetailsDialog,
  apiProductToListing,
  matchesSearch,
  readFavourites,
  writeFavourites,
  type ApiProduct,
  type MarketplaceProduct,
} from "@/app/components/marketplace-product";
import { ProductTile, ProductTileSkeleton, productDiscount } from "@/app/components/product-tile";
import { addItemToBasket } from "@/app/components/cart-client";
import { ShopFooter, ShopHeader } from "@/app/components/shop-chrome";

type PriceBandId = "any" | "low" | "mid" | "high" | "premium";

const priceBands: { id: PriceBandId; label: string }[] = [
  { id: "any", label: "Any price" },
  { id: "low", label: "Under ₦5,000" },
  { id: "mid", label: "₦5,000 – ₦10,000" },
  { id: "high", label: "₦10,000 – ₦20,000" },
  { id: "premium", label: "₦20,000 and above" },
];

function priceBandMatches(priceMinor: number, band: PriceBandId) {
  if (band === "any") return true;
  if (band === "low") return priceMinor < 500_000;
  if (band === "mid") return priceMinor >= 500_000 && priceMinor < 1_000_000;
  if (band === "high") return priceMinor >= 1_000_000 && priceMinor < 2_000_000;
  return priceMinor >= 2_000_000;
}

function productLocationLabel(product: MarketplaceProduct) {
  return product.sellerLocation || [product.sellerCity, product.sellerRegion].filter(Boolean).join(", ");
}

export function SearchResults({ initialQuery }: { initialQuery: string }) {
  const [query, setQuery] = useState(initialQuery);
  const [term, setTerm] = useState(initialQuery.trim());
  const [catalog, setCatalog] = useState<MarketplaceProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [category, setCategory] = useState("");
  const [seller, setSeller] = useState("");
  const [location, setLocation] = useState("");
  const [priceBand, setPriceBand] = useState<PriceBandId>("any");
  const [sort, setSort] = useState("relevance");
  const [favourites, setFavourites] = useState<MarketplaceProduct[]>([]);
  const [notice, setNotice] = useState("");
  const [quickView, setQuickView] = useState<MarketplaceProduct | null>(null);
  const [noticeTone, setNoticeTone] = useState<"ok" | "warn">("ok");

  useEffect(() => {
    setQuery(initialQuery);
    setTerm(initialQuery.trim());
    setCategory("");
    setSeller("");
    setLocation("");
  }, [initialQuery]);

  useEffect(() => {
    setFavourites(readFavourites());
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const response = await fetch("/api/products", { signal: AbortSignal.timeout(15_000) });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Search is temporarily unavailable.");
        if (!active) return;
        setCatalog((Array.isArray(result.products) ? result.products as ApiProduct[] : []).map(apiProductToListing));
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : "Search is temporarily unavailable.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 5_000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const searchMatches = useMemo(
    () => (term ? catalog.filter((product) => matchesSearch(product, term)) : catalog),
    [catalog, term],
  );

  const locationOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const product of searchMatches) {
      const label = productLocationLabel(product);
      if (label) counts.set(label, (counts.get(label) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([label, count]) => ({ value: label, label, count }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  }, [searchMatches]);

  const scoped = useMemo(
    () => searchMatches.filter((product) => !location || productLocationLabel(product) === location),
    [searchMatches, location],
  );

  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const product of scoped) if (product.category) counts.set(product.category, (counts.get(product.category) ?? 0) + 1);
    return [...counts.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [scoped]);

  const sellerCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const product of scoped) if (product.sellerName) counts.set(product.sellerName, (counts.get(product.sellerName) ?? 0) + 1);
    return [...counts.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [scoped]);

  const matches = useMemo(() => {
    const filtered = scoped.filter((product) =>
      (!category || product.category === category) &&
      (!seller || product.sellerName === seller) &&
      priceBandMatches(product.price, priceBand),
    );
    if (sort === "price-asc") return [...filtered].sort((a, b) => a.price - b.price);
    if (sort === "price-desc") return [...filtered].sort((a, b) => b.price - a.price);
    if (sort === "name") return [...filtered].sort((a, b) => a.name.localeCompare(b.name));
    return filtered;
  }, [scoped, category, seller, priceBand, sort]);

  const sellerTotal = useMemo(() => new Set(matches.map((product) => product.sellerId).filter(Boolean)).size, [matches]);
  const favouriteIds = useMemo(() => new Set(favourites.map((item) => item.id)), [favourites]);
  const filtersActive = Boolean(category || seller || location || priceBand !== "any");

  function submitSearch(value: string) {
    const next = value.trim();
    setTerm(next);
    setCategory("");
    setSeller("");
    setLocation("");
    setPriceBand("any");
    window.history.replaceState(null, "", next ? `/search?q=${encodeURIComponent(next)}` : "/search");
  }

  function clearFilters() {
    setCategory("");
    setSeller("");
    setLocation("");
    setPriceBand("any");
    setSort("relevance");
  }

  function toggleFavourite(product: MarketplaceProduct) {
    const exists = favourites.some((item) => item.id === product.id);
    const next = exists ? favourites.filter((item) => item.id !== product.id) : [...favourites, product];
    writeFavourites(next);
    setFavourites(next);
    setNoticeTone("ok");
    setNotice(exists ? `${product.name} removed from your favourites.` : `${product.name} saved to your favourites.`);
  }

  function addToBasket(product: MarketplaceProduct, quantity = 1) {
    const result = addItemToBasket(product, quantity);
    setNoticeTone(result.ok ? "ok" : "warn");
    setNotice(result.message);
  }

  return (
    <div className="sf-page">
      <ShopHeader />

      <main className="sf-shell" style={{ flex: "1 1 auto", paddingBottom: 50 }} data-local-currency>
        <div className="sf-breadcrumbs">
          <Link href="/">Home</Link>
          <span>/</span>
          <Link href="/shop">Shop</Link>
          <span>/</span>
          <span>{term ? "Search results" : "Search"}</span>
        </div>

        <div className="sf-list-bar">
          <div>
            <h1>{term ? `Results for “${term}”` : "Search every live listing"}</h1>
            <small>
              Showing <b style={{ color: "var(--sf-ink)" }}>{matches.length}</b> of {catalog.length} items
              {sellerTotal ? ` · ${sellerTotal} seller${sellerTotal === 1 ? "" : "s"}` : ""}
            </small>
          </div>
          <select className="sf-select" value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Sort products">
            <option value="relevance">Relevance</option>
            <option value="price-asc">Price: low to high</option>
            <option value="price-desc">Price: high to low</option>
            <option value="name">Name: A to Z</option>
          </select>
        </div>

        <form
          className="sf-search"
          style={{ maxWidth: 560, marginBottom: 18 }}
          onSubmit={(event) => { event.preventDefault(); submitSearch(query); }}
          role="search"
        >
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search products, categories or sellers…"
            aria-label="Search products"
          />
          <button type="submit" aria-label="Run search">⌕</button>
        </form>

        <div className="sf-list-layout">
          <aside className="sf-filters" aria-label="Filters">
            <details className="sf-filter-group" open>
              <summary>Category</summary>
              <div className="sf-filter-body">
                {categoryCounts.map((option) => (
                  <label key={option.name} className="sf-check">
                    <input
                      type="radio"
                      name="search-category"
                      checked={category === option.name}
                      onChange={() => setCategory(category === option.name ? "" : option.name)}
                    />
                    {option.name} <small style={{ color: "var(--sf-muted)" }}>({option.count})</small>
                  </label>
                ))}
                {!categoryCounts.length && <small style={{ color: "var(--sf-muted)" }}>No categories yet</small>}
              </div>
            </details>

            <details className="sf-filter-group" open>
              <summary>Sold by</summary>
              <div className="sf-filter-body">
                {sellerCounts.map((option) => (
                  <label key={option.name} className="sf-check">
                    <input
                      type="radio"
                      name="search-seller"
                      checked={seller === option.name}
                      onChange={() => setSeller(seller === option.name ? "" : option.name)}
                    />
                    {option.name} <small style={{ color: "var(--sf-muted)" }}>({option.count})</small>
                  </label>
                ))}
                {!sellerCounts.length && <small style={{ color: "var(--sf-muted)" }}>No sellers yet</small>}
              </div>
            </details>

            <details className="sf-filter-group" open={locationOptions.length > 0}>
              <summary>Location</summary>
              <div className="sf-filter-body">
                {locationOptions.map((option) => (
                  <label key={option.value} className="sf-check">
                    <input
                      type="radio"
                      name="search-location"
                      checked={location === option.value}
                      onChange={() => setLocation(location === option.value ? "" : option.value)}
                    />
                    {option.label} <small style={{ color: "var(--sf-muted)" }}>({option.count})</small>
                  </label>
                ))}
                {!locationOptions.length && <small style={{ color: "var(--sf-muted)" }}>No seller locations yet</small>}
              </div>
            </details>

            <details className="sf-filter-group" open>
              <summary>Price</summary>
              <div className="sf-filter-body">
                {priceBands.map((band) => (
                  <label key={band.id} className="sf-check">
                    <input
                      type="radio"
                      name="search-price"
                      checked={priceBand === band.id}
                      onChange={() => setPriceBand(band.id)}
                    />
                    {band.label}
                  </label>
                ))}
              </div>
            </details>

            <details className="sf-filter-group" open>
              <summary>Refine</summary>
              <div className="sf-filter-body">
                <button
                  type="button"
                  className="sf-more"
                  onClick={clearFilters}
                  disabled={!filtersActive && sort === "relevance"}
                >
                  Clear filters
                </button>
              </div>
            </details>
          </aside>

          <section aria-label="Search results">
            {error && <p className="sf-auth-error" role="alert">{error}</p>}

            {loading ? (
              <div className="sf-grid" aria-hidden="true">
                <ProductTileSkeleton count={8} />
              </div>
            ) : matches.length ? (
              <div className="sf-grid">
                {matches.map((product) => (
                  <ProductTile
                    key={product.id}
                    product={product}
                    saved={favouriteIds.has(product.id)}
                    onToggleSave={toggleFavourite}
                    onAdd={addToBasket}
                    onQuickView={setQuickView}
                  />
                ))}
              </div>
            ) : (
              <div className="sf-empty-state">
                <p style={{ margin: "0 0 10px" }}>
                  {term ? `Nothing matched “${term}”.` : "No products matched those filters."} Try a different word or clear the filters.
                </p>
                <button type="button" className="sf-more" onClick={() => { setQuery(""); setTerm(""); clearFilters(); window.history.replaceState(null, "", "/search"); }}>
                  Show all products
                </button>
                <p style={{ margin: "12px 0 0" }}><Link href="/shop" className="sf-more">Browse the shop</Link></p>
              </div>
            )}
          </section>
        </div>
      </main>

      <ShopFooter />

      {notice && (
        <div className={noticeTone === "warn" ? "sf-toast is-warn" : "sf-toast"} role="status">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="currentColor" /><path d="m7.5 12.3 3 3L16.5 9.4" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          <span>{notice}</span>
        </div>
      )}

      {quickView && (
        <ProductDetailsDialog
          product={quickView}
          onClose={() => setQuickView(null)}
          saved={favouriteIds.has(quickView.id)}
          onAdd={addToBasket}
          onToggleSave={toggleFavourite}
        />
      )}
    </div>
  );
}
