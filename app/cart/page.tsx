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
import { ProductTile } from "@/app/components/product-tile";
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

  function add(product: MarketplaceProduct, quantity = 1) {
    addItemToBasket(product, quantity);
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
          <section className="sf-sec">
            <div className="sf-sec-head">
              <div className="sf-sec-copy">
                <span className="sf-sec-kicker">Complete your basket</span>
                <h2>You might <em>also like</em></h2>
              </div>
              <div className="sf-sec-side">
                <Link className="sf-sec-link" href="/shop">View all <span aria-hidden="true">→</span></Link>
              </div>
            </div>
            <div className="sf-grid">
              {extra.map((item) => (
                <ProductTile
                  key={item.id}
                  product={item}
                  saved={favourites.some((entry) => entry.id === item.id)}
                  onToggleSave={toggleSave}
                  onAdd={add}
                />
              ))}
            </div>
          </section>
        )}
      </main>
      <ShopFooter />
    </div>
  );
}
