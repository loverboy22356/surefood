"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ShopFooter, ShopHeader } from "@/app/components/shop-chrome";
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
import { DEFAULT_PRODUCT_CATEGORIES } from "@/lib/product-categories";
import "./home-sections.css";

type SellerCard = {
  id: string;
  businessName?: string;
  displayName?: string;
  logoUrl?: string;
  role?: string;
  city?: string;
  region?: string;
  verificationStatus?: string;
};

const categoryIcons: Record<string, string> = {
  "Fresh vegetables": "🥬",
  "Fresh fruits": "🍎",
  "Meat & seafood": "🍗",
  "Dairy & eggs": "🥛",
  Bakery: "🥖",
  "Pantry essentials": "🍚",
  Drinks: "🧃",
  "Snacks & treats": "🍪",
  "Frozen foods": "🧊",
  "Home & kitchen": "🍳",
  "Health & beauty": "🧴",
  "Baby & kids": "🍼",
  "Pet supplies": "🐾",
  "Household essentials": "🧺",
};

function discountPercent(product: MarketplaceProduct) {
  if (!product.oldPrice || product.oldPrice <= product.price) return 0;
  return Math.round((1 - product.price / product.oldPrice) * 100);
}

function sellerName(seller: SellerCard) {
  return seller.businessName || seller.displayName || "Sure Foodz seller";
}

/** Countdown to the end of the current day, in the buyer's own clock. */
function useDealCountdown() {
  const [left, setLeft] = useState({ d: "00", h: "00", m: "00", s: "00" });
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const end = new Date(now);
      end.setHours(23, 59, 59, 999);
      const diff = Math.max(0, end.getTime() - now.getTime());
      const d = Math.floor(diff / 86_400_000);
      const h = Math.floor((diff % 86_400_000) / 3_600_000);
      const m = Math.floor((diff % 3_600_000) / 60_000);
      const s = Math.floor((diff % 60_000) / 1000);
      setLeft({
        d: String(d).padStart(2, "0"),
        h: String(h).padStart(2, "0"),
        m: String(m).padStart(2, "0"),
        s: String(s).padStart(2, "0"),
      });
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, []);
  return left;
}

const heroSlides = [
  {
    eyebrow: "Best deals on fresh food online",
    title: "Latest fresh vegetables,",
    accent: "up to 80% off",
    copy: "Farm-picked produce from verified sellers, delivered across Nigeria.",
    image: "/images/home-produce.webp",
    cta: "Shop groceries",
    href: "/shop",
    badge: "Save up to 80%",
  },
  {
    eyebrow: "Wholesale & bulk",
    title: "Stock your kitchen,",
    accent: "skip the middleman",
    copy: "Rice, grains and staples straight from verified suppliers at market prices.",
    image: "/images/promo-local-farmers.png",
    cta: "Shop staples",
    href: "/shop?category=Pantry%20essentials",
    badge: "Bulk pricing",
  },
  {
    eyebrow: "Buy now, pay later",
    title: "Take the food home today,",
    accent: "pay over 30 days",
    copy: "No bank card needed. Apply once with your NIN, income and address.",
    image: "/images/promo-quality.png",
    cta: "Apply for Pay Later",
    href: "/pay-later",
    badge: "No card needed",
  },
];

export default function Home() {
  const [catalog, setCatalog] = useState<MarketplaceProduct[]>([]);
  const [sellers, setSellers] = useState<SellerCard[]>([]);
  const [extraCategories, setExtraCategories] = useState<string[]>([]);
  const [favourites, setFavourites] = useState<MarketplaceProduct[]>([]);
  const [notice, setNotice] = useState("");
  const [slide, setSlide] = useState(0);
  const [loading, setLoading] = useState(true);
  const countdown = useDealCountdown();

  useEffect(() => {
    let active = true;
    void (async () => {
      const routes = ["/api/products", "/api/marketplace/sellers?role=vendor", "/api/categories"];
      const results = await Promise.allSettled(routes.map(async (route) => {
        const response = await fetch(route, { signal: AbortSignal.timeout(15_000) });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || `Could not load ${route}.`);
        return data;
      }));
      if (!active) return;
      const [products, vendorList, categories] = results;
      const listings = products.status === "fulfilled" && Array.isArray(products.value.products)
        ? (products.value.products as ApiProduct[]).map(apiProductToListing)
        : [];
      setCatalog(listings);
      const approvedVendors = vendorList.status === "fulfilled" && Array.isArray(vendorList.value.sellers)
        ? vendorList.value.sellers as SellerCard[]
        : [];
      // The vendor directory only lists fully reviewed accounts; when it is still empty
      // the stores are read from their live listings so the shelves are never blank.
      const fromListings = new Map<string, SellerCard>();
      for (const product of listings) {
        if (!product.sellerId || !product.sellerName || fromListings.has(product.sellerId)) continue;
        fromListings.set(product.sellerId, {
          id: product.sellerId,
          businessName: product.sellerName,
          logoUrl: product.sellerLogoUrl,
          role: product.sellerRole,
          city: product.sellerCity,
          region: product.sellerRegion,
        });
      }
      setSellers(approvedVendors.length ? approvedVendors : [...fromListings.values()]);
      if (categories.status === "fulfilled" && Array.isArray(categories.value.categories)) {
        const defaults = new Set(DEFAULT_PRODUCT_CATEGORIES.map((name) => name.toLowerCase()));
        setExtraCategories((categories.value.categories as string[]).filter((name) => !defaults.has(name.toLowerCase())));
      }
      setLoading(false);
    })();
    setFavourites(readFavourites());
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => setSlide((current) => (current + 1) % heroSlides.length), 7_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 4_000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const deals = useMemo(() => {
    const discounted = catalog.filter((product) => discountPercent(product) > 0);
    return (discounted.length ? discounted : catalog).slice(0, 4);
  }, [catalog]);

  const categories = useMemo(() => {
    const names = [...DEFAULT_PRODUCT_CATEGORIES, ...extraCategories];
    const unique = names.filter((name, index) => names.findIndex((other) => other.toLowerCase() === name.toLowerCase()) === index);
    const counted = unique.map((name) => ({
      name,
      count: catalog.filter((product) => product.category.toLowerCase() === name.toLowerCase()).length,
      image: catalog.find((product) => product.category.toLowerCase() === name.toLowerCase() && product.imageUrl)?.imageUrl,
    }));
    return counted.sort((a, b) => b.count - a.count).slice(0, 12);
  }, [catalog, extraCategories]);

  const frequently = useMemo(() => catalog.slice(0, 8), [catalog]);

  // Each vendor card shows that store's own artwork, taken from its best listing.
  const vendorCards = useMemo(
    () => sellers.slice(0, 3).map((seller) => {
      const items = catalog.filter((product) => product.sellerId === seller.id);
      const best = items.reduce<MarketplaceProduct | null>(
        (acc, product) => (!acc || discountPercent(product) > discountPercent(acc) ? product : acc),
        null,
      );
      return { seller, product: best, count: items.length, off: best ? discountPercent(best) : 0 };
    }),
    [catalog, sellers],
  );

  function add(product: MarketplaceProduct) {
    const result = addItemToBasket(product);
    setNotice(result.message);
    if (result.ok) window.dispatchEvent(new Event("surefood-cart-changed"));
  }

  function toggleSave(product: MarketplaceProduct) {
    const next = favourites.some((item) => item.id === product.id)
      ? favourites.filter((item) => item.id !== product.id)
      : [...favourites, product];
    setFavourites(next);
    writeFavourites(next);
    window.dispatchEvent(new Event("surefood-cart-changed"));
  }

  const current = heroSlides[slide];

  return (
    <div className="sf-page">
      <ShopHeader />
      <main className="sf-shell" style={{ flex: "1 1 auto" }}>
        <section className="sf-hero" aria-label="Featured offers">
          <span className="sf-hero-curve is-a" aria-hidden="true" />
          <span className="sf-hero-curve is-b" aria-hidden="true" />
          <span className="sf-hero-ring" aria-hidden="true" />
          <span className="sf-hero-dot" aria-hidden="true" />
          <div className="sf-hero-copy">
            <span className="sf-hero-eyebrow">{current.eyebrow}</span>
            <h1>{current.title} <em>{current.accent}</em></h1>
            <p className="sf-hero-text">{current.copy}</p>
            <div className="sf-hero-actions">
              <Link className="sf-hero-cta" href={current.href}>{current.cta} →</Link>
              <Link className="sf-hero-ghost" href="/shop?deals=1">{current.badge}</Link>
            </div>
          </div>
          <div className="sf-hero-art">
            <img src="/images/hero-produce.webp" alt="Sure Foodz fresh produce basket, grocery bag and delivery app" />
          </div>
          <button className="sf-hero-arrow is-prev" type="button" aria-label="Previous offer" onClick={() => setSlide((value) => (value - 1 + heroSlides.length) % heroSlides.length)}>‹</button>
          <button className="sf-hero-arrow is-next" type="button" aria-label="Next offer" onClick={() => setSlide((value) => (value + 1) % heroSlides.length)}>›</button>
          <div className="sf-hero-dots">
            {heroSlides.map((item, index) => (
              <button
                key={item.title}
                type="button"
                className={index === slide ? "is-on" : undefined}
                aria-label={`Offer ${index + 1}`}
                onClick={() => setSlide(index)}
              />
            ))}
          </div>
        </section>

        <section className="sf-trust" aria-label="Why shop with Sure Foodz">
          <div className="sf-trust-item">
            <span className="sf-trust-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 3.2 20 7.5v9L12 20.8 4 16.5v-9Z" /><path d="M4 7.5 12 12l8-4.5M12 12v8.8" strokeLinejoin="round" /></svg>
            </span>
            <span><b>Special order</b><small>Delivery in 24/H</small></span>
          </div>
          <div className="sf-trust-item">
            <span className="sf-trust-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M8 4h8v4a4 4 0 0 1-8 0V4Z" /><path d="M8 5H5v2a4 4 0 0 0 4 4M16 5h3v2a4 4 0 0 1-4 4" /><path d="M12 12v5M9 20h6l-1-3h-4l-1 3Z" strokeLinejoin="round" /></svg>
            </span>
            <span><b>24 hours return</b><small>100% money-back guarantee</small></span>
          </div>
          <div className="sf-trust-item">
            <span className="sf-trust-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="6" width="18" height="12" rx="2" /><path d="M3 10h18M7 14.5h3" strokeLinecap="round" /></svg>
            </span>
            <span><b>Pay later</b><small>Buy now, pay over 30 days</small></span>
          </div>
          <div className="sf-trust-item">
            <span className="sf-trust-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 13a8 8 0 0 1 16 0" /><rect x="3" y="13" width="4" height="7" rx="2" /><rect x="17" y="13" width="4" height="7" rx="2" /></svg>
            </span>
            <span><b>Support 24/7</b><small>Live contact and messages</small></span>
          </div>
        </section>

        {sellers.length > 0 && (
          <section className="sf-section">
            <div className="sf-section-head">
              <h2>Shop <em>by brand</em></h2>
              <Link className="sf-more" href="/shop">View all</Link>
            </div>
            <div className="sf-brands">
              {sellers.slice(0, 6).map((seller) => (
                <Link key={seller.id} className="sf-brand-tile" href={`/store/${seller.id}`}>
                  <span className={`sf-brand-monogram${seller.logoUrl ? " has-logo" : ""}`} aria-hidden="true">
                    {seller.logoUrl
                      ? <img src={seller.logoUrl} alt="" loading="lazy" />
                      : sellerName(seller).slice(0, 2).toUpperCase()}
                  </span>
                  <span className="sf-brand-name">{sellerName(seller).slice(0, 16)}</span>
                </Link>
              ))}
            </div>
          </section>
        )}

        <section className="sf-section" id="deals">
          <div className="sf-section-head">
            <h2>Today&apos;s deals of the day</h2>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span className="sf-countdown">
                Deals end in
                <b>{countdown.d}d</b><b>{countdown.h}h</b><b>{countdown.m}m</b><b>{countdown.s}s</b>
              </span>
              <Link className="sf-more" href="/shop?deals=1">View all deals</Link>
            </div>
          </div>
          {loading ? (
            <div className="sf-grid" aria-hidden="true">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="sf-card" style={{ height: 320, opacity: .45 }} />
              ))}
            </div>
          ) : deals.length ? (
            <div className="sf-grid is-four">
              {deals.map((product) => {
                const off = discountPercent(product);
                const saved = favourites.some((item) => item.id === product.id);
                return (
                  <article key={product.id} className="sf-card">
                    <Link className={product.imageUrl ? "sf-card-art" : "sf-card-art is-flat"} href={`/product/${product.id}`}>
                      {product.imageUrl
                        ? <img src={productImageUrl(product.imageUrl, 500)} alt={product.name} loading="lazy" />
                        : <span aria-hidden="true">{product.emoji}</span>}
                      {(product.stock ?? 0) <= 0
                        ? <span className="sf-card-soldout">Sold out</span>
                        : off > 0 && <span className="sf-card-off">{off}% OFF</span>}
                    </Link>
                    <div className="sf-card-body">
                      <span className="sf-card-source">
                        {product.sellerVerified ? "✔ " : ""}
                        {product.sellerName || product.category}
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
                        onClick={() => add(product)}
                      >
                        {(product.stock ?? 0) <= 0 ? "Sold out" : "Add to cart"}
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
            <div className="sf-empty-state">Sellers are adding their first listings. Check back shortly.</div>
          )}
        </section>

        <section className="sf-section">
          <div className="sf-section-head">
            <h2>Shop from <em>top categories</em></h2>
            <Link className="sf-more" href="/categories">View all</Link>
          </div>
          <div className="sf-circles">
            {categories.slice(0, 6).map((category, index) => (
              <Link
                key={category.name}
                className={index === 0 ? "sf-circle is-active" : "sf-circle"}
                href={`/shop?category=${encodeURIComponent(category.name)}`}
              >
                <span className="sf-circle-art" aria-hidden="true">
                  {categoryIcons[category.name] ?? "🧺"}
                </span>
                <b>{category.name}</b>
              </Link>
            ))}
          </div>
        </section>

        {sellers.length > 0 && (
          <section className="sf-section">
            <div className="sf-section-head">
              <h2>Top <em>vendors and suppliers</em></h2>
              <Link className="sf-more" href="/shop">View all</Link>
            </div>
            <div className="sf-vendors">
              {vendorCards.map(({ seller, product, count, off }, index) => (
                <Link key={seller.id} className={`sf-vendor-card tone-${index + 1}`} href={`/store/${seller.id}`}>
                  <span className="sf-vendor-tag">{sellerName(seller).slice(0, 14)}</span>
                  <span className="sf-vendor-art" aria-hidden="true">
                    {product?.imageUrl
                      ? <img src={productImageUrl(product.imageUrl, 500)} alt="" />
                      : <span className="sf-vendor-emoji">{product?.emoji ?? "🏪"}</span>}
                  </span>
                  <span className="sf-vendor-off">{off > 0 ? `Up to ${off}% OFF` : "Fresh in store"}</span>
                  <span className="sf-vendor-count">{count} {count === 1 ? "product" : "products"} · {seller.city || seller.region || "Nigeria"}</span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {frequently.length > 0 && (
          <section className="sf-section">
            <div className="sf-section-head">
              <h2>Frequently <em>bought together</em></h2>
              <Link className="sf-more" href="/shop">View all</Link>
            </div>
            <div className="sf-rail">
              {frequently.map((product) => {
                const off = discountPercent(product);
                const saved = favourites.some((item) => item.id === product.id);
                const soldOut = (product.stock ?? 0) <= 0;
                return (
                  <article key={product.id} className="sf-card sf-card-rich">
                    <Link className={product.imageUrl ? "sf-card-art" : "sf-card-art is-flat"} href={`/product/${product.id}`}>
                      {product.imageUrl
                        ? <img src={productImageUrl(product.imageUrl, 400)} alt={product.name} loading="lazy" />
                        : <span aria-hidden="true">{product.emoji}</span>}
                      {off > 0 && <span className="sf-card-off">-{off}%</span>}
                      {soldOut && <span className="sf-card-tag">Sold out</span>}
                    </Link>
                    <div className="sf-card-body">
                      <Link className="sf-card-title" href={`/product/${product.id}`}>{product.name}</Link>
                      <p className="sf-card-desc">{product.detail}</p>
                      <div className="sf-card-price">
                        <strong>{formatMarketMoney(product.price, product.currency)}</strong>
                        {product.oldPrice && <del>{formatMarketMoney(product.oldPrice, product.currency)}</del>}
                      </div>
                      <div className="sf-card-actions">
                        <button
                          type="button"
                          className={saved ? "sf-card-heart is-on" : "sf-card-heart"}
                          aria-label={saved ? "Remove from wishlist" : "Save to wishlist"}
                          aria-pressed={saved}
                          onClick={() => toggleSave(product)}
                        >♥</button>
                        <button
                          type="button"
                          className="sf-card-buy"
                          disabled={soldOut}
                          onClick={() => add(product)}
                        >{soldOut ? "Sold out" : "Add to cart"}</button>
                        <Link className="sf-card-eye" href={`/product/${product.id}`} aria-label={`View ${product.name}`}>👁</Link>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}

        <section className="sf-section" style={{ paddingBottom: 40 }}>
          <div className="sf-section-head">              <h2>Top <em>offers for you</em></h2>
          </div>
          <div className="sf-promos">
            <Link className="sf-promo" href="/pay-later">
              <span><b>Pay Later</b><small>Buy now, pay over 30 days — no card needed</small></span>
              <i aria-hidden="true">🗓</i>
            </Link>
            <Link className="sf-promo" href="/special-orders">
              <span><b>Special &amp; event orders</b><small>Order ahead for weddings and events at a discount</small></span>
              <i aria-hidden="true">🎉</i>
            </Link>
            <Link className="sf-promo" href="/shop?deals=1">
              <span><b>All offers</b><small>Every discounted item in one place</small></span>
              <i aria-hidden="true">%</i>
            </Link>
          </div>
        </section>

        {notice && <p className="sf-auth-note" role="status" style={{ paddingBottom: 16 }}>{notice}</p>}
      </main>
      <ShopFooter />
    </div>
  );
}
