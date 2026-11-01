"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  formatMarketMoney,
  productImageUrl,
  readFavourites,
  writeFavourites,
  type MarketplaceProduct,
} from "@/app/components/marketplace-product";
import { apiProductToListing, type ApiProduct } from "@/app/components/marketplace-product";
import {
  addItemToBasket,
  cartItemCount,
  readCartLines,
  writeCartLines,
  type CartLine,
} from "@/app/components/cart-client";
import { ShopFooter, ShopHeader } from "@/app/components/shop-chrome";
import "@/app/home-sections.css";

export default function CartPage() {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [suggestions, setSuggestions] = useState<MarketplaceProduct[]>([]);
  const [favourites, setFavourites] = useState<MarketplaceProduct[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setLines(readCartLines());
    setFavourites(readFavourites());
    setReady(true);
    void (async () => {
      try {
        const response = await fetch("/api/products", { signal: AbortSignal.timeout(15_000) });
        const result = await response.json();
        if (!response.ok) return;
        setSuggestions((Array.isArray(result.products) ? result.products as ApiProduct[] : []).map(apiProductToListing));
      } catch (reason) {
        console.error("Could not load suggestions for the basket.", reason);
      }
    })();
  }, []);

  function persist(next: CartLine[]) {
    setLines(next);
    writeCartLines(next);
    window.dispatchEvent(new Event("surefood-cart-changed"));
  }

  function changeQuantity(productId: string, quantity: number) {
    persist(lines.map((line) => line.product.id === productId
      ? { ...line, quantity: Math.max(1, Math.min(quantity, line.product.stock ?? 99)) }
      : line));
  }

  function remove(productId: string) {
    persist(lines.filter((line) => line.product.id !== productId));
  }

  function add(product: MarketplaceProduct) {
    addItemToBasket(product);
    persist(readCartLines());
  }

  function toggleSave(product: MarketplaceProduct) {
    const next = favourites.some((item) => item.id === product.id)
      ? favourites.filter((item) => item.id !== product.id)
      : [...favourites, product];
    setFavourites(next);
    writeFavourites(next);
    window.dispatchEvent(new Event("surefood-cart-changed"));
  }

  const subtotal = lines.reduce((total, line) => total + line.product.price * line.quantity, 0);
  const currency = lines[0]?.product.currency ?? "NGN";
  const itemCount = cartItemCount();
  const extra = useMemo(
    () => suggestions.filter((item) => !lines.some((line) => line.product.id === item.id)).slice(0, 4),
    [lines, suggestions],
  );

  return (
    <div className="sf-page">
      <ShopHeader />
      <main className="sf-shell" style={{ flex: "1 1 auto" }}>
        <nav className="sf-flow-steps" aria-label="Checkout progress">
          <Link href="/">Home</Link><i>/</i>
          <span className="is-on">Cart</span><i>/</i>
          <span>Customer Info</span><i>/</i>
          <span>Shipping &amp; Payments</span><i>/</i>
          <span>Product Confirmation</span>
        </nav>

        <div className="sf-pagehead">
          <Link href="/shop" className="sf-back" aria-label="Back to shopping">←</Link>
          <div className="sf-flow-head" style={{ padding: 0 }}>
            <h1>My Cart</h1>
            <p>Review your basket before checkout.</p>
          </div>
        </div>

        {ready && !lines.length ? (
          <div className="sf-empty-state" style={{ margin: "10px 0 50px" }}>
            <p style={{ margin: "0 0 14px" }}>Your basket is empty. Fresh food is one tap away.</p>
            <Link className="sf-btn" href="/shop">Start shopping</Link>
          </div>
        ) : (
          <div className="sf-flow-layout">
            <section>
              <p className="sf-count">Number of items: <b>{itemCount}</b></p>
              <div className="sf-lines">
                {lines.map((line) => (
                  <article key={line.product.id} className="sf-line">
                    <Link className="sf-line-media" href={`/product/${line.product.id}`}>
                      {line.product.imageUrl
                        ? <img src={productImageUrl(line.product.imageUrl, 200)} alt={line.product.name} />
                        : <span aria-hidden="true">{line.product.emoji}</span>}
                    </Link>
                    <div>
                      <p className="sf-line-name">
                        <Link href={`/product/${line.product.id}`}>
                          {line.quantity} {line.product.name}
                        </Link>
                      </p>
                      <span className="sf-line-meta">
                        <i aria-hidden="true" />
                        {line.product.sellerName || line.product.category}
                      </span>
                    </div>
                    <div className="sf-line-price">{formatMarketMoney(line.product.price, line.product.currency)}</div>
                    <div className="sf-qty" role="group" aria-label={`Quantity for ${line.product.name}`}>
                      <button type="button" onClick={() => changeQuantity(line.product.id, line.quantity - 1)} disabled={line.quantity <= 1} aria-label="Decrease quantity">−</button>
                      <span>{line.quantity}</span>
                      <button type="button" onClick={() => changeQuantity(line.product.id, line.quantity + 1)} aria-label="Increase quantity">＋</button>
                    </div>
                    <div className="sf-line-total">{formatMarketMoney(line.product.price * line.quantity, line.product.currency)}</div>
                    <button type="button" className="sf-line-remove" onClick={() => remove(line.product.id)} aria-label={`Remove ${line.product.name}`}>🗑</button>
                  </article>
                ))}
              </div>
            </section>

            <aside className="sf-summary">
              <h2>Order Summary</h2>
              <div className="sf-summary-row"><span>Price</span><b>{formatMarketMoney(subtotal, currency)}</b></div>
              <div className="sf-summary-row"><span>Delivery</span><b>Confirmed by seller</b></div>
              <div className="sf-summary-row"><span>Payment</span><b>On delivery or card</b></div>
              <div className="sf-summary-row is-total"><span>Total Price</span><b>{formatMarketMoney(subtotal, currency)}</b></div>
              <Link className="sf-btn is-pay is-wide" href="/checkout">Pay Now →</Link>
              <Link className="sf-btn is-ghost is-wide" href="/shop" style={{ marginTop: 8 }}>Continue shopping</Link>
              <p style={{ margin: "12px 0 0", fontSize: 10.5, color: "var(--sf-muted)", lineHeight: 1.5 }}>
                The delivery fee is added by the seller after the order is placed, before you pay.
              </p>
            </aside>
          </div>
        )}

        {extra.length > 0 && (
          <section className="sf-section">
            <div className="sf-section-head">
              <h2>You might also like</h2>
              <Link className="sf-more" href="/shop">View all</Link>
            </div>
            <div className="sf-grid">
              {extra.map((item) => {
                const off = item.oldPrice && item.oldPrice > item.price
                  ? Math.round(((item.oldPrice - item.price) / item.oldPrice) * 100)
                  : 0;
                const saved = favourites.some((entry) => entry.id === item.id);
                const soldOut = (item.stock ?? 0) <= 0;
                return (
                  <article key={item.id} className="sf-card sf-card-rich">
                    <Link className={item.imageUrl ? "sf-card-art" : "sf-card-art is-flat"} href={`/product/${item.id}`}>
                      {item.imageUrl
                        ? <img src={productImageUrl(item.imageUrl, 400)} alt={item.name} loading="lazy" />
                        : <span aria-hidden="true">{item.emoji}</span>}
                      {off > 0 && <span className="sf-card-off">-{off}%</span>}
                      {soldOut && <span className="sf-card-tag">Sold out</span>}
                    </Link>
                    <div className="sf-card-body">
                      <Link className="sf-card-title" href={`/product/${item.id}`}>{item.name}</Link>
                      <p className="sf-card-desc">{item.detail}</p>
                      <div className="sf-card-price">
                        <strong>{formatMarketMoney(item.price, item.currency)}</strong>
                        {item.oldPrice && <del>{formatMarketMoney(item.oldPrice, item.currency)}</del>}
                      </div>
                      <div className="sf-card-actions">
                        <button
                          type="button"
                          className={saved ? "sf-card-heart is-on" : "sf-card-heart"}
                          aria-label={saved ? "Remove from wishlist" : "Save to wishlist"}
                          aria-pressed={saved}
                          onClick={() => toggleSave(item)}
                        >♥</button>
                        <button
                          type="button"
                          className="sf-card-buy"
                          disabled={soldOut}
                          onClick={() => add(item)}
                        >{soldOut ? "Sold out" : "Add to cart"}</button>
                        <Link className="sf-card-eye" href={`/product/${item.id}`} aria-label={`View ${item.name}`}>👁</Link>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}
      </main>
      <ShopFooter />
    </div>
  );
}
