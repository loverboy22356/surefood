"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  apiProductToListing,
  formatMarketMoney,
  productImageUrl,
  readFavourites,
  writeFavourites,
  type ApiProduct,
  type MarketplaceProduct,
} from "@/app/components/marketplace-product";
import { addItemToBasket, cartItemCount } from "@/app/components/cart-client";
import { ShopFooter, ShopHeader } from "@/app/components/shop-chrome";

function stockState(product: MarketplaceProduct) {
  if (!product.liveListing) return { label: "In stock", tone: "ok" as const };
  return (product.stock ?? 0) > 0
    ? { label: "In stock", tone: "ok" as const }
    : { label: "Out of stock", tone: "off" as const };
}

export function FavouritesBoard() {
  const [favourites, setFavourites] = useState<MarketplaceProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [noticeTone, setNoticeTone] = useState<"ok" | "warn">("ok");
  const [basketCount, setBasketCount] = useState(0);

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
          (Array.isArray(result.products) ? (result.products as ApiProduct[]) : [])
            .map(apiProductToListing)
            .map((product) => [product.id, product]),
        );
        // Saved items stay listed even if the seller pulled the listing, so the
        // shopper can see what happened instead of it silently disappearing.
        const refreshed = stored.map((item) => live.get(item.id) ?? item);
        if (!active) return;
        setFavourites(refreshed);
      } catch (reason) {
        console.error("Could not refresh your wishlist.", reason);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 5_000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const inStockCount = useMemo(
    () => favourites.filter((product) => stockState(product).tone === "ok").length,
    [favourites],
  );

  function addToBasket(product: MarketplaceProduct) {
    const result = addItemToBasket(product, 1);
    setNoticeTone(result.ok ? "ok" : "warn");
    setNotice(result.message);
    setBasketCount(cartItemCount());
  }

  function remove(product: MarketplaceProduct) {
    const next = favourites.filter((item) => item.id !== product.id);
    writeFavourites(next);
    setFavourites(next);
    setNoticeTone("ok");
    setNotice(`${product.name} removed from your wishlist.`);
  }

  return (
    <div className="sf-page">
      <ShopHeader />
      <main className="sf-shell" style={{ flex: "1 1 auto", paddingBottom: 56 }}>
        <nav className="sf-flow-steps" aria-label="Breadcrumb">
          <Link href="/">Home</Link><i>/</i>
          <span className="is-on">Wishlist</span>
        </nav>

        <div className="wl-head">
          <Link href="/" className="wl-back" aria-label="Back to the shop">←</Link>
          <button
            type="button"
            className="wl-share"
            aria-label="Share your wishlist"
            onClick={() => {
              const url = window.location.href;
              if (navigator.share) void navigator.share({ title: "My Sure Foodz wishlist", url }).catch(() => {});
              else void navigator.clipboard?.writeText(url).then(
                () => setNotice("Wishlist link copied to your clipboard."),
                () => setNotice("Copy the address bar to share your wishlist."),
              );
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="18" cy="5" r="2.6" stroke="currentColor" strokeWidth="1.8" />
              <circle cx="6" cy="12" r="2.6" stroke="currentColor" strokeWidth="1.8" />
              <circle cx="18" cy="19" r="2.6" stroke="currentColor" strokeWidth="1.8" />
              <path d="m8.5 10.8 7-4.2M8.5 13.2l7 4.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <h1 className="wl-title">Wishlist</h1>
        <p className="wl-lede">
          {loading
            ? "Loading your saved products…"
            : favourites.length
              ? `${favourites.length} saved ${favourites.length === 1 ? "product" : "products"} · ${inStockCount} ready to ship. Tap the trash icon to take one off the list.`
              : "Everything you save for later lands here, ready to add to your cart."}
        </p>

        {favourites.length > 0 && (
          <div className="wl-table" role="table" aria-label="Saved products">
            <div className="wl-row wl-row-head" role="row">
              <span role="columnheader">Products</span>
              <span role="columnheader">Price</span>
              <span role="columnheader">Stock status</span>
              <span role="columnheader">Actions</span>
            </div>

            {favourites.map((product) => {
              const state = stockState(product);
              return (
                <div className="wl-row" role="row" key={product.id}>
                  <div className="wl-product" role="cell">
                    <Link href={`/product/${product.id}`} className="wl-thumb">
                      {product.imageUrl ? (
                        <img src={productImageUrl(product.imageUrl, 160)} alt={product.name} loading="lazy" />
                      ) : (
                        <span aria-hidden="true">{product.emoji}</span>
                      )}
                    </Link>
                    <div className="wl-copy">
                      <Link href={`/product/${product.id}`} className="wl-name">{product.name}</Link>
                      <small>
                        {product.category}
                        {product.sellerName ? ` · ${product.sellerName}` : ""}
                      </small>
                    </div>
                  </div>

                  <div className="wl-price" role="cell">
                    {product.oldPrice ? <s>{formatMarketMoney(product.oldPrice, product.currency)}</s> : null}
                    <b>{formatMarketMoney(product.price, product.currency)}</b>
                  </div>

                  <div className="wl-stock" role="cell">
                    <span className={`wl-stock-pill is-${state.tone}`}>{state.label}</span>
                  </div>

                  <div className="wl-actions" role="cell">
                    <button
                      type="button"
                      className="wl-add"
                      onClick={() => addToBasket(product)}
                      disabled={state.tone === "off"}
                    >
                      Add to cart
                    </button>
                    <button
                      type="button"
                      className="wl-remove"
                      aria-label={`Remove ${product.name} from your wishlist`}
                      onClick={() => remove(product)}
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M4 7h16M9.5 7V5.2c0-.7.5-1.2 1.2-1.2h2.6c.7 0 1.2.5 1.2 1.2V7M6.5 7l.9 12.1c.1.9.8 1.6 1.7 1.6h5.8c.9 0 1.6-.7 1.7-1.6L17.5 7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!loading && !favourites.length && (
          <div className="wl-empty">
            <div className="wl-empty-art" aria-hidden="true">
              <span>♡</span>
            </div>
            <h2>Nothing saved yet</h2>
            <p>Tap the heart on any product and it will wait for you here.</p>
            <div className="wl-empty-cta">
              <Link href="/shop" className="wl-add">Start shopping</Link>
              <Link href="/search" className="wl-ghost">Browse the marketplace</Link>
            </div>
          </div>
        )}

        {notice && (
          <div className={`browse-toast ${noticeTone}`} role="status">
            <span>{notice}</span>
            {noticeTone === "ok" && basketCount > 0 && <Link href="/cart">Go to cart →</Link>}
            <button type="button" aria-label="Dismiss message" onClick={() => setNotice("")}>×</button>
          </div>
        )}
      </main>
      <ShopFooter />
    </div>
  );
}
