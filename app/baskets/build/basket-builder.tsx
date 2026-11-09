"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ShopFooter, ShopHeader } from "@/app/components/shop-chrome";
import {
  apiProductToListing,
  formatMarketMoney,
  matchesSearch,
  productImageUrl,
  type ApiProduct,
  type MarketplaceProduct,
} from "@/app/components/marketplace-product";
import {
  basketFrequencies,
  formatNaira,
  frequencyDiscount,
  frequencyLabels,
  priceForFrequency,
  type BasketFrequency,
} from "@/lib/baskets";
import { SubscribeForm, type BasketIntent } from "../subscribe-form";
import "../baskets.css";

export function BasketBuilder() {
  const [products, setProducts] = useState<MarketplaceProduct[] | null>(null);
  const [error, setError] = useState("");
  const [term, setTerm] = useState("");
  const [category, setCategory] = useState("all");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [frequency, setFrequency] = useState<BasketFrequency>("monthly");
  const [intent, setIntent] = useState<BasketIntent | null>(null);
  const [done, setDone] = useState<{ planName: string; nextDelivery: string } | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const response = await fetch("/api/products", { signal: AbortSignal.timeout(20_000) });
        const data = await response.json();
        if (!active) return;
        if (!response.ok) {
          setError(typeof data?.error === "string" ? data.error : "We could not load the market right now.");
          setProducts([]);
          return;
        }
        setProducts((Array.isArray(data.products) ? data.products as ApiProduct[] : []).map(apiProductToListing));
      } catch {
        if (active) {
          setError("We could not reach the market. Check your connection and try again.");
          setProducts([]);
        }
      }
    })();
    return () => { active = false; };
  }, []);

  const categories = useMemo(() => {
    const names = new Set((products ?? []).map((product) => product.category).filter(Boolean));
    return ["all", ...[...names].sort((a, b) => a.localeCompare(b))];
  }, [products]);

  const visible = useMemo(() => {
    const list = products ?? [];
    const byCategory = category === "all" ? list : list.filter((product) => product.category === category);
    return term.trim() ? byCategory.filter((product) => matchesSearch(product, term.trim())) : byCategory;
  }, [products, category, term]);

  const chosen = useMemo(() => (products ?? []).filter((product) => (quantities[product.id] ?? 0) > 0), [products, quantities]);
  const baseMinor = chosen.reduce((total, product) => total + product.price * (quantities[product.id] ?? 0), 0);
  const totalMinor = priceForFrequency(baseMinor, frequency);
  const itemCount = chosen.reduce((total, product) => total + (quantities[product.id] ?? 0), 0);

  function step(product: MarketplaceProduct, delta: number) {
    setQuantities((current) => {
      const next = Math.max(0, Math.min((current[product.id] ?? 0) + delta, product.stock ?? 99));
      if (next === 0) {
        const { [product.id]: _drop, ...rest } = current;
        return rest;
      }
      return { ...current, [product.id]: next };
    });
  }

  function review() {
    if (!chosen.length) return;
    setIntent({
      type: "custom",
      frequency,
      amountMinor: totalMinor,
      items: chosen.map((product) => ({ productId: product.id, quantity: quantities[product.id] ?? 1 })),
    });
  }

  return (
    <div className="sf-page">
      <ShopHeader />
      <main className="sf-shell bsk-main">
        <div className="bsk-crumbs">
          <Link href="/baskets">← Food baskets</Link>
          <span>Build your own</span>
        </div>

        <header className="bsk-build-head">
          <div>
            <span className="bsk-kicker">Custom basket</span>
            <h1>Build the basket your household actually uses</h1>
            <p>Pick products and quantities. We price it live and deliver it on your chosen rhythm.</p>
          </div>
          <div className="bsk-freq">
            <span className="bsk-label">Deliver</span>
            <div className="bsk-chips">
              {basketFrequencies.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={frequency === option ? "bsk-chip is-on" : "bsk-chip"}
                  aria-pressed={frequency === option}
                  onClick={() => setFrequency(option)}
                >
                  {frequencyLabels[option]}
                  {frequencyDiscount[option] > 0 && <em>save {Math.round(frequencyDiscount[option] * 100)}%</em>}
                </button>
              ))}
            </div>
          </div>
        </header>

        <div className="bsk-build-grid">
          <section className="bsk-market" aria-label="Available products">
            <div className="bsk-market-tools">
              <label className="bsk-search">
                <span aria-hidden="true">⌕</span>
                <input
                  type="search"
                  value={term}
                  onChange={(event) => setTerm(event.target.value)}
                  placeholder="Search rice, beans, oil…"
                  aria-label="Search products for your basket"
                />
              </label>
              <div className="bsk-chips is-scroll" role="group" aria-label="Filter by category">
                {categories.map((name) => (
                  <button
                    key={name}
                    type="button"
                    className={category === name ? "bsk-chip is-on" : "bsk-chip"}
                    aria-pressed={category === name}
                    onClick={() => setCategory(name)}
                  >
                    {name === "all" ? "All" : name}
                  </button>
                ))}
              </div>
            </div>

            {products === null && (
              <div className="bsk-market-grid" aria-hidden="true">
                {Array.from({ length: 8 }).map((_, index) => <span key={index} className="bsk-skeleton" />)}
              </div>
            )}

            {error && <p className="bsk-error" role="alert">{error}</p>}

            {products !== null && !visible.length && !error && (
              <p className="bsk-empty">No products match that search. Try another word or category.</p>
            )}

            {products !== null && visible.length > 0 && (
              <div className="bsk-market-grid">
                {visible.map((product) => {
                  const quantity = quantities[product.id] ?? 0;
                  return (
                    <article key={product.id} className={quantity ? "bsk-item is-on" : "bsk-item"}>
                      <div className="bsk-item-art">
                        {product.imageUrl
                          ? <img src={productImageUrl(product.imageUrl, 300)} alt="" loading="lazy" />
                          : <span aria-hidden="true">{product.emoji}</span>}
                      </div>
                      <div className="bsk-item-copy">
                        <h3>{product.name}</h3>
                        <p>{product.category}</p>
                        <strong>{formatMarketMoney(product.price, product.currency)}</strong>
                        <small>{product.sellerName ? `from ${product.sellerName}` : "Sure Foodz seller"}</small>
                      </div>
                      <div className="bsk-stepper" role="group" aria-label={`Quantity of ${product.name}`}>
                        <button type="button" aria-label={`Remove one ${product.name}`} onClick={() => step(product, -1)} disabled={!quantity}>−</button>
                        <span aria-live="polite">{quantity}</span>
                        <button type="button" aria-label={`Add one ${product.name}`} onClick={() => step(product, 1)}>+</button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          <aside className="bsk-summary" aria-label="Your basket">
            <h2>Your basket</h2>
            {chosen.length ? (
              <ul className="bsk-summary-list">
                {chosen.map((product) => (
                  <li key={product.id}>
                    <span>
                      <b>{product.name}</b>
                      <small>{quantities[product.id]} × {formatMarketMoney(product.price, product.currency)}</small>
                    </span>
                    <em>{formatNaira(product.price * (quantities[product.id] ?? 0))}</em>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="bsk-summary-empty">Add products from the market to start your basket.</p>
            )}

            <dl className="bsk-totals">
              <div><dt>Items</dt><dd>{itemCount}</dd></div>
              <div><dt>Basket value</dt><dd>{formatNaira(baseMinor)}</dd></div>
              {frequencyDiscount[frequency] > 0 && (
                <div className="is-save"><dt>Regular-supply discount</dt><dd>−{Math.round(frequencyDiscount[frequency] * 100)}%</dd></div>
              )}
              <div className="is-total"><dt>Per delivery</dt><dd>{formatNaira(totalMinor)}</dd></div>
            </dl>

            <button type="button" className="bsk-primary" onClick={review} disabled={!chosen.length}>
              Save this basket
            </button>
            <p className="bsk-small">
              Minimum basket value ₦5,000. Nothing is charged now — we confirm with sellers first.
            </p>
          </aside>
        </div>
      </main>
      <ShopFooter />

      {intent && (
        <SubscribeForm
          intent={intent}
          onClose={() => setIntent(null)}
          onSubscribed={(result) => {
            setIntent(null);
            setQuantities({});
            setDone(result);
          }}
        />
      )}

      {done && (
        <div className="bsk-done" role="status">
          <div>
            <strong>Your custom basket is saved.</strong>
            <span>First delivery: {done.nextDelivery ? new Date(`${done.nextDelivery}T09:00:00`).toDateString() : "we will confirm shortly"}.</span>
          </div>
          <Link href="/baskets/dashboard">Open my basket plan</Link>
          <button type="button" aria-label="Dismiss" onClick={() => setDone(null)}>×</button>
        </div>
      )}
    </div>
  );
}
