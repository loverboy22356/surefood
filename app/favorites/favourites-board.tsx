"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  apiProductToListing,
  ProductDetailsDialog,
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

export function FavouritesBoard() {
  const [favourites, setFavourites] = useState<MarketplaceProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<MarketplaceProduct | null>(null);
  const [notice, setNotice] = useState("");
  const [noticeTone, setNoticeTone] = useState<"ok" | "warn">("ok");
  const [basketCount, setBasketCount] = useState(0);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [seller, setSeller] = useState("");
  const [location, setLocation] = useState("");
  const [priceBand, setPriceBand] = useState<PriceBandId>("any");
  const [sort, setSort] = useState("relevance");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    setBasketCount(cartItemCount());
    const stored = readFavourites();
    setFavourites(stored);
    if (!stored.length) {
      setLoading(false);
      return;
    }
    let active = true;
    void (async () => {
      try {
        const response = await fetch("/api/products", { signal: AbortSignal.timeout(15_000) });
        const result = await response.json();
        if (!response.ok || !active) return;
        const live = new Map<string, MarketplaceProduct>(
          (Array.isArray(result.products) ? result.products as ApiProduct[] : [])
            .map(apiProductToListing)
            .map((product) => [product.id, product]),
        );
        const refreshed = stored.flatMap((item) => {
          const current = live.get(item.id);
          return current ? [current] : [];
        });
        if (!active) return;
        setFavourites(refreshed);
        if (refreshed.length !== stored.length) writeFavourites(refreshed);
      } catch (reason) {
        console.error("Could not refresh your favourites.", reason);
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

  const favouriteIds = useMemo(() => new Set(favourites.map((item) => item.id)), [favourites]);

  const term = search.trim().toLowerCase();
  const searched = useMemo(() => favourites.filter((product) =>
    !term || `${product.name} ${product.detail} ${product.category} ${product.sellerName ?? ""}`.toLowerCase().includes(term),
  ), [favourites, term]);

  const locationOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const product of searched) {
      const label = productLocationLabel(product);
      if (label) counts.set(label, (counts.get(label) ?? 0) + 1);
    }
    return [...counts.entries()].map(([label, count]) => ({ value: label, label, count })).sort((a, b) => b.count - a.count);
  }, [searched]);

  const scoped = useMemo(
    () => searched.filter((product) => !location || productLocationLabel(product) === location),
    [searched, location],
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

  const filtersActive = Boolean(category || seller || location || priceBand !== "any");

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

  function clearFilters() {
    setCategory("");
    setSeller("");
    setLocation("");
    setPriceBand("any");
    setSort("relevance");
    setSearch("");
  }

  function clearAll() {
    writeFavourites([]);
    setFavourites([]);
    clearFilters();
    setNoticeTone("ok");
    setNotice("Your favourites list is now empty.");
  }

  return (
    <main className="browse-page" data-local-currency>
      <BrowseHeader
        query={search}
        onQueryChange={setSearch}
        locations={locationOptions}
        location={location}
        onLocationChange={setLocation}
        savedCount={favourites.length}
        basketCount={basketCount}
      />

      <div className="browse-shell">
        <BrowseHero
          kicker="Saved items"
          title="Your favourites"
          description="Quick access to the products you love. Shop them again anytime."
          badge={favourites.length ? `${favourites.length} saved item${favourites.length === 1 ? "" : "s"}` : "Nothing saved yet"}
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
            clearDisabled={!filtersActive && !search}
          />

          <section className="browse-results" aria-label="Saved products">
            {favourites.length > 0 && (
              <BrowseResultBar
                count={matches.length}
                noun={matches.length === 1 ? "saved item" : "saved items"}
                sort={sort}
                onSort={setSort}
                view={view}
                onView={setView}
                context={favourites.length !== matches.length ? `of ${favourites.length} saved` : ""}
              />
            )}

            {loading && <div className="browse-grid grid" aria-hidden="true">{[0, 1].map((index) => <div className="browse-card skeleton" key={index} />)}</div>}

            {!loading && (
              <div className={matches.length === 0 ? "favourites-layout empty" : matches.length < 3 ? "favourites-layout" : "favourites-layout wide"}>
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
                <aside className="favourites-empty-panel">
                  <div className="favourites-empty-art" aria-hidden="true">
                    <span>🧺</span>
                    <i>♡</i>
                  </div>
                  <h2>{matches.length ? "No more saved items" : favourites.length ? "Nothing matches those filters" : "Nothing saved yet"}</h2>
                  <p>{matches.length
                    ? "Start exploring and save your favourite products for quick access later."
                    : favourites.length
                      ? "Try clearing the filters to see everything you have saved."
                      : "Browse the marketplace and tap the heart on products you want to come back to."}</p>
                  {matches.length
                    ? <Link href="/search" className="favourites-empty-cta">🧺 Explore Marketplace</Link>
                    : favourites.length
                      ? <button type="button" className="favourites-empty-cta" onClick={clearFilters}>Clear filters</button>
                      : <Link href="/" className="favourites-empty-cta">🧺 Explore Marketplace</Link>}
                  {favourites.length > 0 && <button type="button" className="favourites-clear" onClick={clearAll}>Clear all favourites</button>}
                </aside>
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
        />
      )}
    </main>
  );
}
