"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ShopFooter, ShopHeader } from "@/app/components/shop-chrome";
import {
  ProductDetailsDialog,
  apiProductToListing,
  readFavourites,
  productImageUrl,
  readRecentlyViewed,
  sellerRoleLabels,
  TrustedPartners,
  writeFavourites,
  type ApiProduct,
  type MarketplaceProduct,
} from "@/app/components/marketplace-product";
import { ProductTile, ProductTileSkeleton, productDiscount } from "@/app/components/product-tile";
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

const farmAisles = ["Fresh vegetables", "Fresh fruits", "Meat & seafood", "Dairy & eggs", "Bakery"];
const pantryAisles = ["Pantry essentials", "Snacks & treats", "Drinks", "Frozen foods"];

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
      setLeft({
        d: String(Math.floor(diff / 86_400_000)).padStart(2, "0"),
        h: String(Math.floor((diff % 86_400_000) / 3_600_000)).padStart(2, "0"),
        m: String(Math.floor((diff % 3_600_000) / 60_000)).padStart(2, "0"),
        s: String(Math.floor((diff % 60_000) / 1000)).padStart(2, "0"),
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
    cta: "Shop groceries",
    href: "/shop",
    badge: "Save up to 80%",
  },
  {
    eyebrow: "Wholesale & bulk",
    title: "Stock your kitchen,",
    accent: "skip the middleman",
    copy: "Rice, grains and staples straight from verified suppliers at market prices.",
    cta: "Shop staples",
    href: "/shop?category=Pantry%20essentials",
    badge: "Bulk pricing",
  },
  {
    eyebrow: "Buy now, pay later",
    title: "Take the food home today,",
    accent: "pay over 30 days",
    copy: "No bank card needed. Apply once with your NIN, income and address.",
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
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const [place, setPlace] = useState("");
  const [notice, setNotice] = useState("");
  const [slide, setSlide] = useState(0);
  const [loading, setLoading] = useState(true);
  const [catalogError, setCatalogError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [quickView, setQuickView] = useState<MarketplaceProduct | null>(null);
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
      // The catalogue failing is not the same as an empty shelf: say so and offer a retry.
      setCatalogError(products.status === "rejected");
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
    setRecentIds(readRecentlyViewed());
    try {
      const stored = window.localStorage.getItem("surefood-place") ?? window.localStorage.getItem("surefood-city");
      if (stored) setPlace(stored.replace(/"/g, "").trim());
    } catch {
      /* storage can be blocked; the page simply stays national */
    }
    return () => { active = false; };
  }, [reloadKey]);

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
    const discounted = [...catalog]
      .filter((product) => productDiscount(product) > 0)
      .sort((a, b) => productDiscount(b) - productDiscount(a));
    return (discounted.length >= 4 ? discounted : catalog).slice(0, 4);
  }, [catalog]);

  const bestDeal = deals.length ? productDiscount(deals[0]) : 0;

  /** The API returns newest listings first, so the head of the list is the arrivals shelf. */
  const arrivals = useMemo(() => catalog.slice(0, 10), [catalog]);

  const farmShelf = useMemo(
    () => catalog.filter((product) => farmAisles.includes(product.category)).slice(0, 10),
    [catalog],
  );

  const pantryShelf = useMemo(
    () => catalog.filter((product) => pantryAisles.includes(product.category)).slice(0, 10),
    [catalog],
  );

  const categories = useMemo(() => {
    const names = [...DEFAULT_PRODUCT_CATEGORIES, ...extraCategories];
    const unique = names.filter((name, index) => names.findIndex((other) => other.toLowerCase() === name.toLowerCase()) === index);
    return unique
      .map((name) => ({
        name,
        count: catalog.filter((product) => product.category.toLowerCase() === name.toLowerCase()).length,
      }))
      .filter((entry) => entry.count > 0)
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
      .slice(0, 10);
  }, [catalog, extraCategories]);

  // Each vendor card shows that store's own artwork, taken from its live listings.
  const vendorCards = useMemo(() => {
    const cards = sellers.map((seller) => {
      const items = catalog.filter((product) => product.sellerId === seller.id);
      const off = items.reduce((best, product) => Math.max(best, productDiscount(product)), 0);
      return { seller, items, off };
    });
    const local = place
      ? cards.filter(({ seller, items }) => [seller.city, seller.region, items[0]?.sellerCity, items[0]?.sellerRegion]
        .some((value) => (value ?? "").trim().toLowerCase() === place.toLowerCase()))
      : [];
    return (local.length ? local : cards).slice(0, 3);
  }, [catalog, place, sellers]);

  const recommended = useMemo(() => {
    const aisles = new Set<string>();
    for (const item of favourites) aisles.add(item.category);
    for (const id of recentIds) {
      const product = catalog.find((entry) => entry.id === id);
      if (product) aisles.add(product.category);
    }
    if (!aisles.size) return [];
    return catalog
      .filter((product) => aisles.has(product.category) && !recentIds.slice(0, 2).includes(product.id))
      .slice(0, 10);
  }, [catalog, favourites, recentIds]);

  const recentlyViewed = useMemo(
    () => recentIds
      .map((id) => catalog.find((product) => product.id === id))
      .filter((product): product is MarketplaceProduct => Boolean(product))
      .slice(0, 10),
    [catalog, recentIds],
  );

  function add(product: MarketplaceProduct, quantity = 1) {
    const result = addItemToBasket(product, quantity);
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
  const isSaved = (product: MarketplaceProduct) => favourites.some((item) => item.id === product.id);

  const tile = (product: MarketplaceProduct, options: { variant?: "grid" | "rail"; flag?: string; priority?: boolean } = {}) => (
    <ProductTile
      key={product.id}
      product={product}
      saved={isSaved(product)}
      onToggleSave={toggleSave}
      onAdd={add}
      onQuickView={setQuickView}
      variant={options.variant}
      flag={options.flag}
      priority={options.priority}
    />
  );

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
            {catalog.length > 0 && (
              <dl className="sf-hero-stats">
                <div><dt>Live listings</dt><dd>{catalog.length}</dd></div>
                <div><dt>{sellers.length === 1 ? "Verified seller" : "Verified sellers"}</dt><dd>{sellers.length}</dd></div>
                <div><dt>Aisles open</dt><dd>{categories.length}</dd></div>
              </dl>
            )}
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

        <section className="sf-sec" id="deals">
          <div className="sf-flash">
            <div>
              <div className="sf-sec-head">
                <div className="sf-sec-copy">
                  <span className="sf-sec-kicker">Limited time</span>
                  <h2>Deals of <em>the day</em></h2>
                  <p className="sf-sec-sub">The steepest discounts in every aisle, while stock lasts.</p>
                </div>
                <div className="sf-sec-side">
                  <Link className="sf-sec-link" href="/shop?deals=1">All offers <span aria-hidden="true">→</span></Link>
                </div>
              </div>
              <div className="sf-flash-grid">
                {loading
                  ? <ProductTileSkeleton count={4} />
                  : deals.map((product) => tile(product, { priority: true }))}
              </div>
            </div>
            <aside className="sf-flash-side">
              <span className="sf-flash-kicker">Resets at midnight</span>
              <h3>{bestDeal > 0 ? `Up to ${bestDeal}% off` : "Today's best baskets"}</h3>
              <p>Prices go back up when the timer runs out. Checkout before it does.</p>
              <div className="sf-flash-clock" role="timer" aria-label="Time left on today's deals">
                <span>{countdown.h}<small>hrs</small></span>
                <span>{countdown.m}<small>min</small></span>
                <span>{countdown.s}<small>sec</small></span>
              </div>
              <Link className="sf-flash-cta" href="/shop?deals=1">Shop all deals</Link>
            </aside>
          </div>
        </section>

        <section className="sf-sec">
          <div className="sf-sec-head">
            <div className="sf-sec-copy">
              <span className="sf-sec-kicker">Just landed</span>
              <h2>New <em>arrivals</em></h2>
              <p className="sf-sec-sub">The latest listings from vendors and suppliers on Sure Foodz.</p>
            </div>
            <div className="sf-sec-side">
              <Link className="sf-sec-link" href="/shop">Shop everything <span aria-hidden="true">→</span></Link>
            </div>
          </div>
          <div className="p-rail">
            {loading
              ? <ProductTileSkeleton count={5} variant="rail" />
              : arrivals.map((product) => tile(product, { variant: "rail", flag: "New" }))}
          </div>
        </section>

        {farmShelf.length > 0 && (
          <section className="sf-sec">
            <div className="sf-sec-head">
              <div className="sf-sec-copy">
                <span className="sf-sec-kicker">Market aisle</span>
                <h2>Farm <em>fresh</em></h2>
                <p className="sf-sec-sub">Vegetables, fruit, meat, dairy and bakery from sellers near you.</p>
              </div>
              <div className="sf-sec-side">
                <Link className="sf-sec-link" href="/shop?category=Fresh%20vegetables">Fresh aisles <span aria-hidden="true">→</span></Link>
              </div>
            </div>
            <div className="p-rail">{farmShelf.map((product) => tile(product, { variant: "rail" }))}</div>
          </section>
        )}

        {pantryShelf.length > 0 && (
          <section className="sf-sec">
            <div className="sf-sec-head">
              <div className="sf-sec-copy">
                <span className="sf-sec-kicker">Stock the kitchen</span>
                <h2>Pantry &amp; <em>staples</em></h2>
                <p className="sf-sec-sub">Rice, oils, drinks and everyday essentials — buy in bulk and save.</p>
              </div>
              <div className="sf-sec-side">
                <Link className="sf-sec-link" href="/shop?category=Pantry%20essentials">Pantry aisle <span aria-hidden="true">→</span></Link>
              </div>
            </div>
            <div className="p-rail">{pantryShelf.map((product) => tile(product, { variant: "rail" }))}</div>
          </section>
        )}

        {sellers.length > 0 && (
          <section className="sf-sec">
            <div className="sf-sec-head">
              <div className="sf-sec-copy">
                <span className="sf-sec-kicker">{place ? `Trading in ${place}` : "Our marketplace"}</span>
                <h2>{place ? <>Vendors <em>near you</em></> : <>Featured <em>vendors</em></>}</h2>
                <p className="sf-sec-sub">
                  {place
                    ? `Stores selling around ${place}, with their newest stock on the shelf.`
                    : "Verified stores on Sure Foodz, with their newest listings in stock."}
                </p>
              </div>
              <div className="sf-sec-side">
                <Link className="sf-sec-link" href="/shop">All stores <span aria-hidden="true">→</span></Link>
              </div>
            </div>
            <div className="p-vendors">
              {vendorCards.map(({ seller, items, off }) => (
                <Link key={seller.id} className="p-vendor" href={`/store/${seller.id}`}>
                  <span className="p-vendor-top">
                    <span className="p-vendor-mark" aria-hidden="true">
                      {seller.logoUrl
                        ? <img src={seller.logoUrl} alt="" loading="lazy" />
                        : sellerName(seller).slice(0, 2).toUpperCase()}
                    </span>
                    <span className="p-vendor-name">
                      <b>{sellerName(seller)}</b>
                      <small>
                        {seller.verificationStatus === "approved" && (
                          <svg viewBox="0 0 24 24" aria-label="Verified" aria-hidden="true">
                            <circle cx="12" cy="12" r="9" fill="currentColor" />
                            <path d="m8 12.3 2.6 2.6L16 9.5" fill="none" stroke="#fff" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                        {sellerRoleLabels[seller.role ?? ""] ?? "Vendor"}
                        {seller.city || seller.region ? ` · ${seller.city || seller.region}` : ""}
                      </small>
                    </span>
                  </span>
                  <span className="p-vendor-strip">
                    {items.slice(0, 3).map((product) => (
                      <span key={product.id} className={product.imageUrl ? "p-vendor-thumb" : "p-vendor-thumb is-flat"} aria-hidden="true">
                        {product.imageUrl
                          ? <img src={productImageUrl(product.imageUrl, 240)} alt="" loading="lazy" />
                          : product.emoji}
                      </span>
                    ))}
                    {items.length === 0 && [0, 1, 2].map((index) => <span key={index} className="p-vendor-thumb is-flat" aria-hidden="true">🏪</span>)}
                  </span>
                  <span className="p-vendor-foot">
                    <span>{items.length} {items.length === 1 ? "product" : "products"}{off > 0 && <> · up to <em>{off}% off</em></>}</span>
                    <span className="p-vendor-go">Visit store →</span>
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {recommended.length > 0 && (
          <section className="sf-sec">
            <div className="sf-sec-head">
              <div className="sf-sec-copy">
                <span className="sf-sec-kicker">Based on what you browsed</span>
                <h2>Recommended <em>for you</em></h2>
              </div>
              <div className="sf-sec-side">
                <Link className="sf-sec-link" href="/favorites">Your wishlist <span aria-hidden="true">→</span></Link>
              </div>
            </div>
            <div className="p-rail">{recommended.map((product) => tile(product, { variant: "rail" }))}</div>
          </section>
        )}

        {recentlyViewed.length > 0 && (
          <section className="sf-sec">
            <div className="sf-sec-head">
              <div className="sf-sec-copy">
                <span className="sf-sec-kicker">Pick up where you left off</span>
                <h2>Recently <em>viewed</em></h2>
              </div>
            </div>
            <div className="p-rail">{recentlyViewed.map((product) => tile(product, { variant: "rail" }))}</div>
          </section>
        )}

        {categories.length > 0 && (
          <section className="sf-sec" style={{ paddingBottom: 40 }}>
            <div className="sf-sec-head">
              <div className="sf-sec-copy">
                <span className="sf-sec-kicker">Popular right now</span>
                <h2>What shoppers <em>search for</em></h2>
              </div>
            </div>
            <div className="sf-tags">
              {categories.map((category) => (
                <Link key={category.name} className="sf-tag" href={`/shop?category=${encodeURIComponent(category.name)}`}>
                  {category.name}
                </Link>
              ))}
              <Link className="sf-tag" href="/shop?deals=1">Discount</Link>
              <Link className="sf-tag" href="/pay-later">Pay later</Link>
            </div>
          </section>
        )}

        {!loading && catalog.length === 0 && (
          <section className="sf-sec" style={{ paddingBottom: 40 }}>
            <div className="sf-empty-state">
              {catalogError ? (
                <>
                  <p style={{ margin: "0 0 6px", fontWeight: 700, color: "var(--sf-ink)" }}>We couldn&rsquo;t load the shelves</p>
                  <p style={{ margin: "0 0 14px" }}>The shop could not reach the product catalogue just now. Try again — your basket and saved items are safe.</p>
                  <button type="button" className="sf-more" onClick={() => { setLoading(true); setReloadKey((value) => value + 1); }}>
                    Try again
                  </button>
                </>
              ) : (
                <>
                  <p style={{ margin: "0 0 6px", fontWeight: 700, color: "var(--sf-ink)" }}>The shelves are being stocked</p>
                  <p style={{ margin: "0 0 14px" }}>Verified sellers are adding their first listings right now. Browse the aisles, or check back in a moment.</p>
                  <Link className="sf-more" href="/categories">Browse categories</Link>
                </>
              )}
            </div>
          </section>
        )}

        <section className="sf-partners-band">
          <TrustedPartners />
        </section>
      </main>
      <ShopFooter />

      {notice && (
        <div className="sf-toast" role="status">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="currentColor" /><path d="m7.5 12.3 3 3L16.5 9.4" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          <span>{notice}</span>
        </div>
      )}

      {quickView && (
        <ProductDetailsDialog
          product={quickView}
          onClose={() => setQuickView(null)}
          saved={isSaved(quickView)}
          onAdd={add}
          onToggleSave={toggleSave}
        />
      )}
    </div>
  );
}
