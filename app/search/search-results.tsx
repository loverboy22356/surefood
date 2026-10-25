"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  apiProductToListing,
  matchesSearch,
  ProductDetailsDialog,
  eventOrderHref,
  readFavourites,
  writeFavourites,
  type ApiProduct,
  type MarketplaceProduct,
} from "@/app/components/marketplace-product";
import { addItemToBasket, cartItemCount } from "@/app/components/cart-client";
import {
  BrowseHeader,
  BrowseHero,
  BrowseProductCard,
  BrowseResultBar,
  FilterSidebar,
  priceBandMatches,
  productLocationLabel,
  type PriceBandId,
} from "@/app/components/browse-ui";

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
  const [view, setView] = useState<"grid" | "list">("grid");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [favourites, setFavourites] = useState<MarketplaceProduct[]>([]);
  const [selected, setSelected] = useState<MarketplaceProduct | null>(null);
  const [notice, setNotice] = useState("");
  const [noticeTone, setNoticeTone] = useState<"ok" | "warn">("ok");
  const [basketCount, setBasketCount] = useState(0);

  useEffect(() => {
    setQuery(initialQuery);
    setTerm(initialQuery.trim());
    setCategory("");
    setSeller("");
  }, [initialQuery]);

  useEffect(() => {
    setFavourites(readFavourites());
    setBasketCount(cartItemCount());
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

  const priceCounts = useMemo(() => {
    const counts: Record<PriceBandId, number> = { any: scoped.length, low: 0, mid: 0, high: 0, premium: 0 };
    for (const product of scoped) {
      if (product.price < 500_000) counts.low += 1;
      else if (product.price < 1_000_000) counts.mid += 1;
      else if (product.price < 2_000_000) counts.high += 1;
      else counts.premium += 1;
    }
    return counts;
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

  const sellers = useMemo(() => new Set(matches.map((product) => product.sellerId).filter(Boolean)).size, [matches]);
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
    setBasketCount(cartItemCount());
  }

  const heroChips = [
    { label: "All Categories", count: scoped.length, active: !category, onClick: () => setCategory("") },
    ...categoryCounts.slice(0, 3).map((option) => ({
      label: option.name,
      count: option.count,
      active: category === option.name,
      onClick: () => setCategory(option.name),
    })),
  ];

  return (
    <main className="browse-page" data-local-currency>
      <BrowseHeader
        query={query}
        onQueryChange={setQuery}
        onSubmit={submitSearch}
        locations={locationOptions}
        location={location}
        onLocationChange={setLocation}
        savedCount={favourites.length}
        basketCount={basketCount}
      />

      <div className="browse-shell">
        <BrowseHero
          kicker="Search results"
          title={term ? "Results for" : "Search every live listing"}
          highlight={term || undefined}
          description={term
            ? "Discover fresh and quality food from trusted, verified sellers."
            : "Browse everything approved sellers have listed today."}
          chips={heroChips}
        />

        <div className="browse-layout">
          <FilterSidebar
            open={filtersOpen}
            onToggle={() => setFiltersOpen((current) => !current)}
            categoryCounts={categoryCounts}
            category={category}
            onCategory={setCategory}
            priceCounts={priceCounts}
            priceBand={priceBand}
            onPriceBand={setPriceBand}
            sellers={sellerCounts}
            seller={seller}
            onSeller={setSeller}
            onClear={clearFilters}
            clearDisabled={!filtersActive && sort === "relevance"}
          />

          <section className="browse-results" aria-label="Search results">
            <BrowseResultBar
              count={matches.length}
              noun={matches.length === 1 ? "product" : "products"}
              sort={sort}
              onSort={setSort}
              view={view}
              onView={setView}
              context={term
                ? `found for “${term}”${sellers ? ` · ${sellers} seller${sellers === 1 ? "" : "s"}` : ""}`
                : `available right now${sellers ? ` · ${sellers} seller${sellers === 1 ? "" : "s"}` : ""}`}
            />

            {error && <p className="browse-alert" role="alert">{error}</p>}

            {loading && (
              <div className={`browse-grid ${view}`} aria-hidden="true">
                {[0, 1, 2, 3].map((index) => <div className="browse-card skeleton" key={index} />)}
              </div>
            )}

            {!error && !loading && matches.length === 0 && (
              <div className="browse-empty">
                <span aria-hidden="true">🧺</span>
                <h2>No products matched {term ? `“${term}”` : "that filter"}</h2>
                <p>Try a different word or clear the filters to see everything approved sellers have listed today.</p>
                <div>
                  <button type="button" onClick={() => { setTerm(""); setQuery(""); clearFilters(); window.history.replaceState(null, "", "/search"); }}>Show all products</button>
                  <Link href="/">Back to marketplace</Link>
                </div>
              </div>
            )}

            {!loading && matches.length > 0 && (
              <div className={`browse-grid ${view}`}>
                {matches.map((product) => (
                  <BrowseProductCard
                    key={product.id}
                    product={product}
                    view={view}
                    saved={favouriteIds.has(product.id)}
                    onAdd={addToBasket}
                    onToggleSave={toggleFavourite}
                    onDetails={setSelected}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      {notice && (
        <div className={`browse-toast ${noticeTone}`} role="status">
          <span>{notice}</span>
          {noticeTone === "ok" && <Link href="/">Go to basket →</Link>}
          <button type="button" aria-label="Dismiss message" onClick={() => setNotice("")}>×</button>
        </div>
      )}

      {selected && (
        <ProductDetailsDialog
          key={selected.id}
          product={selected}
          onClose={() => setSelected(null)}
          onAdd={addToBasket}
          saved={favouriteIds.has(selected.id)}
          onToggleSave={toggleFavourite}
          onEventOrder={(product, quantity) => { window.location.assign(eventOrderHref(product, quantity)); }}
        />
      )}
    </main>
  );
}
