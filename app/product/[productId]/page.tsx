"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  apiProductToListing,
  eventOrderHref,
  formatMarketMoney,
  payLaterHref,
  productImageUrl,
  productSourceLabels,
  readFavourites,
  rememberViewed,
  sellerRoleLabels,
  writeFavourites,
  type ApiProduct,
  type MarketplaceProduct,
} from "@/app/components/marketplace-product";
import { addItemToBasket } from "@/app/components/cart-client";
import { ShopFooter, ShopHeader } from "@/app/components/shop-chrome";
import "../product.css";

type InfoTab = "description" | "additional" | "specification" | "reviews";

const infoTabs: Array<{ key: InfoTab; label: string }> = [
  { key: "description", label: "Description" },
  { key: "additional", label: "Additional information" },
  { key: "specification", label: "Specification" },
  { key: "reviews", label: "Reviews" },
];

export default function ProductPage() {
  const paramsPromise = useParams<{ productId: string }>();
  const router = useRouter();
  const [productId, setProductId] = useState("");
  const [catalog, setCatalog] = useState<MarketplaceProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [notice, setNotice] = useState("");
  const [saved, setSaved] = useState(false);
  const [tab, setTab] = useState<InfoTab>("description");

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const params = await paramsPromise;
        if (active) setProductId(typeof params.productId === "string" ? params.productId : "");
      } catch {
        /* params may not be ready yet */
      }
    })();
    return () => { active = false; };
  }, [paramsPromise]);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const response = await fetch("/api/products", { signal: AbortSignal.timeout(15_000) });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "This product could not be loaded.");
        if (!active) return;
        setCatalog((Array.isArray(result.products) ? result.products as ApiProduct[] : []).map(apiProductToListing));
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : "This product could not be loaded.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const product = useMemo(
    () => catalog.find((item) => item.id === productId) ?? null,
    [catalog, productId],
  );

  const related = useMemo(() => {
    const others = catalog.filter((item) => item.id !== productId);
    const sameCategory = others.filter((item) => item.category === product?.category);
    return [...sameCategory, ...others.filter((item) => !sameCategory.includes(item))].slice(0, 4);
  }, [catalog, product?.category, productId]);

  useEffect(() => {
    if (!product) return;
    setSaved(readFavourites().some((item) => item.id === product.id));
    rememberViewed(product.id);
  }, [product]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 4_000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const off = product?.oldPrice && product.oldPrice > product.price
    ? Math.round((1 - product.price / product.oldPrice) * 100)
    : 0;
  const maxQuantity = product?.liveListing ? Math.max(1, product.stock ?? 0) : 99;
  const roleLabel = sellerRoleLabels[product?.sellerRole ?? ""] ?? "Seller";
  const inStock = (product?.stock ?? 0) > 0;
  const place = product?.sellerLocation || product?.sellerCity || "Nigeria";
  const sellerName = product?.sellerName || "Sure Foodz";

  function addToCart() {
    if (!product) return;
    const result = addItemToBasket(product, quantity);
    setNotice(result.message);
    if (result.ok) window.dispatchEvent(new Event("surefood-cart-changed"));
  }

  function buyNow() {
    if (!product) return;
    const result = addItemToBasket(product, quantity);
    setNotice(result.message);
    if (!result.ok) return;
    window.dispatchEvent(new Event("surefood-cart-changed"));
    router.push("/cart");
  }

  function buyThis(item: MarketplaceProduct) {
    const result = addItemToBasket(item, 1);
    if (!result.ok) {
      setNotice(result.message);
      return;
    }
    window.dispatchEvent(new Event("surefood-cart-changed"));
    router.push("/cart");
  }

  function toggleSave() {
    if (!product) return;
    const current = readFavourites();
    const next = current.some((item) => item.id === product.id)
      ? current.filter((item) => item.id !== product.id)
      : [...current, product];
    writeFavourites(next);
    setSaved(next.some((item) => item.id === product.id));
    window.dispatchEvent(new Event("surefood-cart-changed"));
  }

  function shareProduct() {
    void navigator.clipboard?.writeText(window.location.href);
    setNotice("Product link copied.");
  }

  return (
    <div className="sf-page">
      <ShopHeader />
      <main className="sf-shell" style={{ flex: "1 1 auto" }}>
        <div className="sf-breadcrumbs">
          <Link href="/">Home</Link>
          <span>/</span>
          <Link href="/shop">Shop</Link>
          {product && (
            <>
              <span>/</span>
              <Link href={`/shop?category=${encodeURIComponent(product.category)}`}>{product.category}</Link>
            </>
          )}
          <span>/</span>
          <span>{product?.name ?? "Product"}</span>
        </div>

        {error && <p className="sf-auth-error" role="alert" style={{ marginTop: 16 }}>{error}</p>}

        {loading ? (
          <div className="pd-detail" aria-hidden="true">
            <div className="pd-main" style={{ opacity: .5 }} />
            <div style={{ display: "grid", gap: 12, alignContent: "start" }}>
              <div style={{ height: 24, background: "var(--sf-soft)", borderRadius: 6 }} />
              <div style={{ height: 16, width: "60%", background: "var(--sf-soft)", borderRadius: 6 }} />
              <div style={{ height: 120, background: "var(--sf-soft)", borderRadius: 10 }} />
            </div>
          </div>
        ) : !product ? (
          <div className="sf-empty-state" style={{ margin: "30px 0 50px" }}>
            We could not find that product. It may have sold out or been removed.{" "}
            <Link className="sf-more" href="/shop">Back to the shop</Link>
          </div>
        ) : (
          <>
            <div className="pd-detail">
              <div className="pd-media">
                <div className="pd-main">
                  {product.imageUrl
                    ? <img src={productImageUrl(product.imageUrl, 1200)} alt={product.name} />
                    : <span style={{ fontSize: 90 }} aria-hidden="true">{product.emoji}</span>}
                  {off > 0 && <span className="sf-card-off" style={{ top: 14, left: 14 }}>-{off}%</span>}
                </div>
              </div>

              <div className="pd-info">
                <span className="pd-source">
                  {product.sellerVerified ? "✔ Verified " : "Approved "}
                  {roleLabel}
                </span>
                <h1 className="pd-title">{product.name}</h1>

                <div className="pd-meta">
                  <span>Availability: <b className={inStock ? "is-in" : undefined}>{inStock ? "In stock" : "Out of stock"}</b></span>
                  <span>Category: <b>{product.category}</b></span>
                  <span>Sold by: <b>{sellerName}</b></span>
                  {product.packager && <span>Packed by: <b>{product.packager}</b></span>}
                  {product.isBundle && <span>Type: <b>Bundle</b></span>}
                </div>

                <div className="pd-price">
                  <b>{formatMarketMoney(product.price, product.currency)}</b>
                  {product.oldPrice && <del>{formatMarketMoney(product.oldPrice, product.currency)}</del>}
                  {off > 0 && <em>-{off}%</em>}
                </div>
                {product.isBundle && product.bundleItems && product.bundleItems.length > 0 && (
                  <div className="pd-bundle-info">
                    <span>📦 Bundle includes:</span>
                    <ul>{product.bundleItems.map((item) => <li key={item}>{item}</li>)}</ul>
                  </div>
                )}
                {product.packager && (
                  <div className="pd-packager-info">
                    <span>🏭 Packed by:</span> <b>{product.packager}</b>
                  </div>
                )}
                <p className="pd-paylater">
                  or <Link href={payLaterHref(product, quantity)}>pay over 30 days with Pay Later</Link>
                  {inStock && <> · {product.stock} available from this seller</>}
                </p>

                <div className="pd-buy">
                  <div className="sf-qty" role="group" aria-label="Quantity">
                    <button type="button" onClick={() => setQuantity((value) => Math.max(1, value - 1))} disabled={quantity <= 1} aria-label="Decrease quantity">−</button>
                    <span>{quantity}</span>
                    <button type="button" onClick={() => setQuantity((value) => Math.min(maxQuantity, value + 1))} disabled={quantity >= maxQuantity} aria-label="Increase quantity">＋</button>
                  </div>
                  <button className="pd-add" type="button" onClick={addToCart} disabled={!inStock}>
                    {inStock ? "Add to Cart" : "Out of stock"}
                  </button>
                  <button className="pd-now" type="button" onClick={buyNow} disabled={!inStock}>Buy Now</button>
                </div>

                <div className="pd-links">
                  <button type="button" className={saved ? "is-on" : undefined} onClick={toggleSave} aria-pressed={saved}>
                    {saved ? "♥ Saved to wishlist" : "♡ Add to Wishlist"}
                  </button>
                  <button type="button" onClick={shareProduct}>⧉ Share product</button>
                  <Link href={eventOrderHref(product, quantity)}>🎉 Special order</Link>
                  {product.sellerId && <Link href={`/store/${product.sellerId}`}>🏪 Open store</Link>}
                </div>

                {notice && <p className="sf-auth-note" role="status">{notice}</p>}

                <div className="pd-safe">
                  <span>🔒 100% guarantee safe checkout</span>
                  <div className="sf-pay-row">
                    <span>Paystack</span>
                    <span>Verve</span>
                    <span>Visa</span>
                    <span>Mastercard</span>
                  </div>
                </div>

                {product.sellerId && (
                  <div className="pd-seller">
                    <span aria-hidden="true">🏪</span>
                    <span style={{ display: "grid", gap: 2 }}>
                      <b style={{ fontSize: 12.5 }}>
                        {sellerName} {<span className="sf-verify">{product.sellerVerified ? "Verified" : "Approved"} {roleLabel.toLowerCase()}</span>}
                      </b>
                      <small style={{ fontSize: 10.5, color: "var(--sf-muted)" }}>{place}</small>
                    </span>
                    <Link className="sf-seller-btn" href={`/store/${product.sellerId}`} style={{ marginLeft: "auto" }}>Open store →</Link>
                  </div>
                )}
              </div>
            </div>

            <section className="pd-tabs" aria-label="Product information">
              <div className="pd-tablist" role="tablist">
                {infoTabs.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    role="tab"
                    id={`pd-tab-${item.key}`}
                    aria-selected={tab === item.key}
                    aria-controls="pd-tabpanel"
                    className={tab === item.key ? "is-on" : undefined}
                    onClick={() => setTab(item.key)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <div className="pd-tabbody" id="pd-tabpanel" role="tabpanel" aria-labelledby={`pd-tab-${tab}`}>
                <div className="pd-copy">
                  {tab === "description" && (
                    <>
                      <h3>Description</h3>
                      <p>{product.detail || "This seller has not added a description for this item yet."}</p>
                      <ul>
                        <li>Verified {roleLabel.toLowerCase()}, checked by the Sure Foodz team</li>
                        <li>Pay on delivery or with a card at checkout</li>
                        <li>Pay Later — buy now and pay over 30 days, no card needed</li>
                        <li>Special and event orders at a discount when you plan ahead</li>
                      </ul>
                    </>
                  )}

                  {tab === "additional" && (
                    <table className="pd-spec-table">
                      <tbody>
                        <tr><th>Availability</th><td>{inStock ? `In stock (${product.stock})` : "Out of stock"}</td></tr>
                        <tr><th>Category</th><td>{product.category}</td></tr>
                        <tr><th>Sold by</th><td>{sellerName}</td></tr>
                        <tr><th>Location</th><td>{place}</td></tr>
                        <tr><th>Product source</th><td>{productSourceLabels[product.productKind ?? ""] ?? "Supplier"}</td></tr>
                      </tbody>
                    </table>
                  )}

                  {tab === "specification" && (
                    <table className="pd-spec-table">
                      <tbody>
                        <tr><th>Price</th><td>{formatMarketMoney(product.price, product.currency)}</td></tr>
                        {product.oldPrice && <tr><th>Was</th><td>{formatMarketMoney(product.oldPrice, product.currency)}</td></tr>}
                        <tr><th>Currency</th><td>{product.currency}</td></tr>
                        <tr><th>Product source</th><td>{productSourceLabels[product.productKind ?? ""] ?? "Supplier"}</td></tr>
                        {product.expiryDate && <tr><th>Best before</th><td>{product.expiryDate}</td></tr>}
                        {product.nafdacNumber && <tr><th>NAFDAC number</th><td>{product.nafdacNumber}</td></tr>}
                      </tbody>
                    </table>
                  )}

                  {tab === "reviews" && (
                    <>
                      <h3>Reviews</h3>
                      <p>No reviews yet. Buyers can rate this item once their order is delivered.</p>
                      <p>Every seller on Sure Foodz is verified before their products go live, so you can shop with confidence today.</p>
                    </>
                  )}
                </div>

                <aside className="pd-side">
                  <h3>Feature</h3>
                  <div className="pd-feature-list">
                    <div><span className="pd-feature-icon" aria-hidden="true">🗓</span><span>Pay Later — pay over 30 days, no card needed</span></div>
                    <div><span className="pd-feature-icon" aria-hidden="true">↺</span><span>24 hours return with a 100% money-back guarantee</span></div>
                    <div><span className="pd-feature-icon" aria-hidden="true">✔</span><span>Verified {roleLabel.toLowerCase()}, reviewed by our team</span></div>
                    <div><span className="pd-feature-icon" aria-hidden="true">🎉</span><span>Special and event orders at a planned-ahead discount</span></div>
                    <div><span className="pd-feature-icon" aria-hidden="true">🔒</span><span>Secure payment with Paystack</span></div>
                  </div>
                </aside>

                <aside className="pd-side">
                  <h3>Shipping information</h3>
                  <div className="pd-ship-list">
                    <div><b>Delivery</b><br />Arranged by the seller after checkout</div>
                    <div><b>Pickup</b><br />Collect from {place}</div>
                    <div><b>Returns</b><br />Report within 24 hours of delivery</div>
                    <div><b>Questions</b><br />Message the seller from your order</div>
                  </div>
                </aside>
              </div>
            </section>

            {related.length > 0 && (
              <section className="sf-section">
                <div className="sf-section-head">
                  <h2>Frequently bought together</h2>
                  <Link className="sf-more" href={`/shop?category=${encodeURIComponent(product.category)}`}>View all</Link>
                </div>
                <div className="sf-grid">
                  {related.map((item) => (
                    <article key={item.id} className="pd-deal-card">
                      <Link className="pd-deal-art" href={`/product/${item.id}`}>
                        {item.imageUrl
                          ? <img src={productImageUrl(item.imageUrl, 500)} alt={item.name} loading="lazy" />
                          : <span aria-hidden="true">{item.emoji}</span>}
                      </Link>
                      <Link className="pd-deal-name" href={`/product/${item.id}`}>{item.name}</Link>
                      <span className="pd-deal-price">{formatMarketMoney(item.price, item.currency)}</span>
                      <button
                        type="button"
                        className="pd-deal-buy"
                        disabled={(item.stock ?? 0) <= 0}
                        onClick={() => buyThis(item)}
                      >
                        {(item.stock ?? 0) <= 0 ? "Sold out" : `Buy now — ${formatMarketMoney(item.price, item.currency)}`}
                      </button>
                    </article>
                  ))}
                </div>
              </section>
            )}

            <section className="sf-section" style={{ paddingBottom: 40 }}>
              <div className="sf-section-head">
                <h2>Top offers in {product.category}</h2>
                <Link className="sf-more" href="/shop?deals=1">View all</Link>
              </div>
              <div className="pd-offers">
                <Link className="pd-offer is-a" href={payLaterHref(product, quantity)}>
                  <b>Pay Later</b>
                  <small>Buy now, pay over 30 days — no card needed</small>
                  <em>Up to 30 days to pay</em>
                </Link>
                <Link className="pd-offer is-b" href={eventOrderHref(product, quantity)}>
                  <b>Special order</b>
                  <small>Order ahead for weddings and events</small>
                  <em>Up to 20% off</em>
                </Link>
                <Link className="pd-offer is-c" href={`/store/${product.sellerId ?? ""}`}>
                  <b>{sellerName}</b>
                  <small>{place} · verified {roleLabel.toLowerCase()}</small>
                  <em>Visit the store →</em>
                </Link>
              </div>
            </section>
          </>
        )}
      </main>
      <ShopFooter />
    </div>
  );
}
