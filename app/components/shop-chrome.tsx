"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { firebaseAuth, firebaseConfigured } from "@/lib/firebase/client";
import { cartItemCount } from "./cart-client";
import {
  apiProductToListing,
  formatMarketMoney,
  productImageUrl,
  readFavourites,
  type ApiProduct,
  type MarketplaceProduct,
} from "./marketplace-product";
import "@/app/shop.css";

type PlaceOption = { code: string; name: string };

const quickNav = [
  "Fresh vegetables",
  "Fresh fruits",
  "Meat & seafood",
  "Dairy & eggs",
  "Bakery",
  "Pantry essentials",
  "Drinks",
  "Snacks & treats",
];

/**
 * The buyer-facing chrome: delivery bar, search header, category rail and footer.
 * It reads the basket and favourites straight from local storage so every page
 * shows the same counts without a state provider.
 */
export function ShopHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const [term, setTerm] = useState("");
  const [mega, setMega] = useState<string | null>(null);
  const [locationOpen, setLocationOpen] = useState(false);
  const [countries, setCountries] = useState<PlaceOption[]>([]);
  const [country, setCountry] = useState("NG");
  const [regions, setRegions] = useState<PlaceOption[]>([]);
  const [regionsLoading, setRegionsLoading] = useState(false);
  const [catalog, setCatalog] = useState<MarketplaceProduct[] | null>(null);
  const [categoryNames, setCategoryNames] = useState<string[]>(quickNav);
  const [basket, setBasket] = useState(0);
  const [saved, setSaved] = useState(0);
  const [signedIn, setSignedIn] = useState(false);
  const [place, setPlace] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileSearch, setMobileSearch] = useState(false);

  useEffect(() => {
    setMega(null);
    setLocationOpen(false);
  }, [pathname]);

  /* Escape closes the category and location panels; leaving the nav does it too. */
  useEffect(() => {
    if (!mega && !locationOpen) return;
    const dismiss = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setMega(null);
      setLocationOpen(false);
    };
    document.addEventListener("keydown", dismiss);
    return () => document.removeEventListener("keydown", dismiss);
  }, [mega, locationOpen]);

  /* The location dropdown loads its country list once, then regions per country. */
  useEffect(() => {
    if (!locationOpen || countries.length) return;
    let active = true;
    void (async () => {
      try {
        const response = await fetch("/api/location/regions", { signal: AbortSignal.timeout(15_000) });
        const data = await response.json();
        if (!active || !response.ok) return;
        setCountries(Array.isArray(data.countries) ? data.countries as PlaceOption[] : []);
      } catch {
        /* the picker keeps the default country when the list is unavailable */
      }
    })();
    return () => { active = false; };
  }, [locationOpen, countries.length]);

  useEffect(() => {
    if (!locationOpen) return;
    let active = true;
    setRegionsLoading(true);
    void (async () => {
      try {
        const response = await fetch(`/api/location/regions?country=${country}`, { signal: AbortSignal.timeout(15_000) });
        const data = await response.json();
        if (!active) return;
        setRegions(response.ok && Array.isArray(data.states) ? data.states as PlaceOption[] : []);
      } catch {
        if (active) setRegions([]);
      } finally {
        if (active) setRegionsLoading(false);
      }
    })();
    return () => { active = false; };
  }, [locationOpen, country]);

  /** Opens the mega menu and, the first time, loads the catalogue it previews. */
  async function openMenu(category: string) {
    setLocationOpen(false);
    setMega(category);
    if (catalog) return;
    try {
      const [productResponse, categoryResponse] = await Promise.allSettled([
        fetch("/api/products", { signal: AbortSignal.timeout(15_000) }),
        fetch("/api/categories", { signal: AbortSignal.timeout(15_000) }),
      ]);
      if (productResponse.status === "fulfilled" && productResponse.value.ok) {
        const result = await productResponse.value.json();
        setCatalog((Array.isArray(result.products) ? result.products as ApiProduct[] : []).map(apiProductToListing));
      } else {
        setCatalog([]);
      }
      if (categoryResponse.status === "fulfilled" && categoryResponse.value.ok) {
        const result = await categoryResponse.value.json();
        const extra = (Array.isArray(result.categories) ? result.categories as string[] : [])
          .filter((name) => !quickNav.some((known) => known.toLowerCase() === name.toLowerCase()));
        setCategoryNames([...quickNav, ...extra]);
      }
    } catch {
      setCatalog([]);
    }
  }

  useEffect(() => {
    const sync = () => {
      setBasket(cartItemCount());
      setSaved(readFavourites().length);
    };
    sync();
    window.addEventListener("storage", sync);
    window.addEventListener("surefood-cart-changed", sync);
    try {
      const stored = window.localStorage.getItem("surefood-place") ?? window.localStorage.getItem("surefood-city");
      if (stored) setPlace(stored.replace(/"/g, ""));
    } catch {
      /* storage can be blocked; the label simply stays generic */
    }
    if (!firebaseConfigured()) return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("surefood-cart-changed", sync);
    };
    const stop = onAuthStateChanged(firebaseAuth(), (user) => setSignedIn(Boolean(user)));
    return () => {
      stop();
      window.removeEventListener("storage", sync);
      window.removeEventListener("surefood-cart-changed", sync);
    };
  }, []);

  return (
    <>
      <div className="sf-utility">
        <div className="sf-utility-in">
          <div className="sf-utility-group">
            <span className="sf-utility-place">
              Welcome to <strong>surefoodz</strong> Marketplace!
            </span>
          </div>
          <div className="sf-utility-group is-end">
            <Link className="sf-utility-place" href="/account">
              Deliver to <strong>{place || "Nigeria"}</strong>
            </Link>
            <span className="sf-utility-divider" aria-hidden="true" />
            <Link href="/track-order">Track your order</Link>
            <Link href="/help">Help</Link>
            <Link href="/shop?deals=1">All Offers</Link>
          </div>
        </div>
      </div>

      <header className="sf-header">
        <div className="sf-header-in">
          <Link className="sf-brand" href="/" aria-label="Sure Foodz home">
            <span className="sf-brand-logo" aria-hidden="true">
              <img src="/images/surefoodz-logo.png" alt="" />
            </span>
            <span className="sf-brand-word">Sure<em>Foodz</em></span>
          </Link>
          <Link className="sf-brand-badge" href="/shop?deals=1" aria-label="Today's deals">
            <b>50% OFF</b>
            <small>Fresh Deals</small>
          </Link>

          <form
            className="sf-search"
            role="search"
            onSubmit={(event) => {
              event.preventDefault();
              const value = term.trim();
              router.push(value ? `/search?q=${encodeURIComponent(value)}` : "/categories");
            }}
          >
            <input
              type="search"
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              placeholder="Search essentials, groceries and more..."
              aria-label="Search products"
            />
            <button type="submit" aria-label="Search">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
                <path d="m16.5 16.5 4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </form>

          <div className="sf-tools">
            <button
              type="button"
              className="sf-tool sf-tool-search"
              aria-label="Search"
              aria-expanded={mobileSearch}
              onClick={() => setMobileSearch((open) => !open)}
            >
              <span className="sf-tool-icon" aria-hidden="true">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                  <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
                  <path d="m16.5 16.5 4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </span>
            </button>
            <Link className="sf-tool" href="/shop?deals=1">
              <span className="sf-tool-icon" aria-hidden="true">%</span>
              <span className="sf-tool-copy"><b>My Deals</b></span>
            </Link>
            <Link className="sf-tool" href="/favorites" aria-label={`Wishlist, ${saved} saved`}>
              <span className="sf-tool-icon" aria-hidden="true">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                  <path d="M12 20s-7.5-4.4-7.5-9.4A4.1 4.1 0 0 1 12 7.6a4.1 4.1 0 0 1 7.5 3C19.5 15.6 12 20 12 20Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                </svg>
                {saved > 0 && <i>{saved}</i>}
              </span>
            </Link>
            {signedIn ? (
              <Link className="sf-tool-signin" href="/account">My account</Link>
            ) : (
              <Link className="sf-tool-signin" href="/login">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle cx="12" cy="8.5" r="3.4" stroke="currentColor" strokeWidth="1.8" />
                  <path d="M5.5 19.5c.7-3.3 3.4-5.1 6.5-5.1s5.8 1.8 6.5 5.1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
                Sign Up/Sign In
              </Link>
            )}
            <Link className="sf-tool" href="/cart" aria-label={`Cart, ${basket} items`}>
              <span className="sf-tool-icon" aria-hidden="true">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                  <path d="M3 4h2l2.4 11.2h10.8L20 7H6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx="9.5" cy="19" r="1.4" fill="currentColor" />
                  <circle cx="17" cy="19" r="1.4" fill="currentColor" />
                </svg>
                {basket > 0 && <i>{basket}</i>}
              </span>
              <span className="sf-tool-copy"><b>Cart</b></span>
            </Link>
            <button
              type="button"
              className="sf-menu-toggle"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((open) => !open)}
            >
              <span aria-hidden="true" />
              <span aria-hidden="true" />
              <span aria-hidden="true" />
            </button>
          </div>
        </div>

        {mobileSearch && (
          <div className="sf-shell sf-mobile-search">
            <form
              className="sf-search"
              role="search"
              onSubmit={(event) => {
                event.preventDefault();
                const value = term.trim();
                router.push(value ? `/search?q=${encodeURIComponent(value)}` : "/categories");
              }}
            >
              <input
                type="search"
                value={term}
                onChange={(event) => setTerm(event.target.value)}
                placeholder="Search essentials, groceries and more..."
                aria-label="Search products"
                autoFocus
              />
              <button type="submit" aria-label="Search">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
                  <path d="m16.5 16.5 4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </form>
          </div>
        )}

        {menuOpen && (
          <div className="sf-shell" style={{ paddingBottom: 14 }}>
            <div className="sf-grid" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
              {[
                { href: "/categories", label: "All categories" },
                { href: "/shop", label: "Shop everything" },
                { href: "/pay-later", label: "Pay later" },
                { href: "/special-orders", label: "Event orders" },
                { href: "/favorites", label: "Wishlist" },
                { href: "/help", label: "Help centre" },
                { href: signedIn ? "/account" : "/login", label: signedIn ? "My account" : "Sign in" },
              ].map((item) => (
                <Link
                  key={item.href + item.label}
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  className="sf-btn is-ghost"
                  style={{ height: 40, fontSize: 12 }}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        )}
      </header>

      <nav
        className="sf-nav"
        aria-label="Shop by category"
        onMouseLeave={() => { setMega(null); setLocationOpen(false); }}
      >
        <div className="sf-nav-in">
          <button
            type="button"
            className={mega ? "sf-nav-pill is-open" : "sf-nav-pill"}
            aria-expanded={Boolean(mega)}
            onMouseEnter={() => openMenu(mega ?? "all")}
            onClick={() => openMenu(mega ?? "all")}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            All Categories
            <span className="sf-nav-chev" aria-hidden="true">▾</span>
          </button>
          <button
            type="button"
            className={locationOpen ? "sf-nav-pill is-open" : "sf-nav-pill"}
            aria-expanded={locationOpen}
            onClick={() => {
              setMega(null);
              setLocationOpen((open) => !open);
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M12 21s6.5-5.4 6.5-10.5a6.5 6.5 0 1 0-13 0C5.5 15.6 12 21 12 21Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
              <circle cx="12" cy="10.5" r="2.3" stroke="currentColor" strokeWidth="1.8" />
            </svg>
            Shop by location
            <span className="sf-nav-chev" aria-hidden="true">▾</span>
          </button>
          {quickNav.map((name) => (
            <Link
              key={name}
              className="sf-nav-link"
              href={`/shop?category=${encodeURIComponent(name)}`}
              onMouseEnter={() => openMenu(name)}
              onFocus={() => openMenu(name)}
            >
              {name}
              <span className="sf-nav-chev" aria-hidden="true">▾</span>
            </Link>
          ))}
          <Link className="sf-nav-link is-offer" href="/shop?deals=1">All Offers</Link>
        </div>

        {mega && (
          <div className="sf-mega">
            <div className="sf-mega-in">
              <ul className="sf-mega-list">
                {categoryNames.map((name) => (
                  <li key={name}>
                    <Link
                      className={name === (mega === "all" ? categoryNames[0] : mega) ? "is-active" : undefined}
                      href={`/shop?category=${encodeURIComponent(name)}`}
                      onMouseEnter={() => setMega(name)}
                    >
                      {name}
                      <span aria-hidden="true">›</span>
                    </Link>
                  </li>
                ))}
              </ul>

              <div className="sf-mega-featured">
                <h3>
                  Featured in <span>{mega === "all" ? categoryNames[0] : mega}</span>
                </h3>
                {(() => {
                  const active = mega === "all" ? categoryNames[0] : mega;
                  const inCategory = (catalog ?? []).filter((product) => product.category.toLowerCase() === active.toLowerCase());
                  const picks = (inCategory.length ? inCategory : (catalog ?? [])).slice(0, 3);
                  if (catalog && !picks.length) return <p className="sf-mega-empty">Sellers are adding listings here. Check back shortly.</p>;
                  return picks.map((product) => (
                    <Link key={product.id} className="sf-mega-item" href={`/product/${product.id}`}>
                      <span className="sf-mega-art" aria-hidden="true">
                        {product.imageUrl
                          ? <img src={productImageUrl(product.imageUrl, 200)} alt="" />
                          : product.emoji}
                      </span>
                      <span className="sf-mega-copy">
                        <b>{product.name}</b>
                        <small>{formatMarketMoney(product.price, product.currency)}</small>
                      </span>
                    </Link>
                  ));
                })()}
                <Link className="sf-mega-all" href="/categories">View all categories →</Link>
              </div>

              <Link className="sf-mega-promo" href="/shop?deals=1">
                <span className="sf-mega-promo-kicker">Deals of the day</span>
                <strong>Up to 50% off</strong>
                <small>Fresh picks, priced low for today only.</small>
                <em>Shop now</em>
              </Link>
            </div>
          </div>
        )}

        {locationOpen && (
          <div className="sf-location-drop">
            <div className="sf-location-panel">
              <div className="sf-location-panel-head">
                <strong>Shop by location</strong>
                <label className="sf-location-country">
                  <span className="sf-visually-hidden">Country</span>
                  <select
                    value={country}
                    onChange={(event) => setCountry(event.target.value)}
                    aria-label="Choose a country"
                  >
                    {countries.length === 0 && <option value="NG">Nigeria</option>}
                    {countries.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}
                  </select>
                </label>
              </div>

              {regionsLoading ? (
                <div className="sf-locations" aria-hidden="true">
                  {Array.from({ length: 12 }).map((_, index) => (
                    <span key={index} className="sf-location-pill is-loading" />
                  ))}
                </div>
              ) : regions.length ? (
                <div className="sf-locations">
                  {regions.map((region) => (
                    <Link
                      key={region.code}
                      className="sf-location-pill"
                      title={`Sellers trading in ${region.name}`}
                      href={`/shop?state=${encodeURIComponent(region.name)}`}
                      onClick={() => setLocationOpen(false)}
                    >
                      {region.name}
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="sf-location-empty">No regions listed here yet.</p>
              )}
            </div>
          </div>
        )}
      </nav>
    </>
  );
}

export function ShopFooter() {
  return (
    <footer className="sf-footer">
      <div className="sf-footer-trust" aria-label="Why shop with Sure Foodz">
        <div className="sf-footer-trust-item">
          <span className="sf-footer-trust-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 3.2 20 7.5v9L12 20.8 4 16.5v-9Z" /><path d="M4 7.5 12 12l8-4.5M12 12v8.8" strokeLinejoin="round" /></svg>
          </span>
          <span><b>Special order</b><small>Delivery in 24/H</small></span>
        </div>
        <div className="sf-footer-trust-item">
          <span className="sf-footer-trust-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M8 4h8v4a4 4 0 0 1-8 0V4Z" /><path d="M8 5H5v2a4 4 0 0 0 4 4M16 5h3v2a4 4 0 0 1-4 4" /><path d="M12 12v5M9 20h6l-1-3h-4l-1 3Z" strokeLinejoin="round" /></svg>
          </span>
          <span><b>24 hours return</b><small>100% money-back guarantee</small></span>
        </div>
        <div className="sf-footer-trust-item">
          <span className="sf-footer-trust-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="6" width="18" height="12" rx="2" /><path d="M3 10h18M7 14.5h3" strokeLinecap="round" /></svg>
          </span>
          <span><b>Pay later</b><small>Buy now, pay over 30 days</small></span>
        </div>
        <div className="sf-footer-trust-item">
          <span className="sf-footer-trust-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 13a8 8 0 0 1 16 0" /><rect x="3" y="13" width="4" height="7" rx="2" /><rect x="17" y="13" width="4" height="7" rx="2" /></svg>
          </span>
          <span><b>Support 24/7</b><small>Live contact and messages</small></span>
        </div>
      </div>
      <div className="sf-footer-grid">
        <div>
          <div className="sf-footer-brand">
            <span className="sf-footer-logo">
              <img src="/images/surefoodz-logo.png" alt="Sure Foodz" />
            </span>
          </div>
          <div className="sf-footer-contact">
            <b><a href="tel:+2348160961127">0816 096 1127</a></b>
            <small><a href="mailto:surefoodglobal@gmail.com">surefoodglobal@gmail.com</a></small>
            <small>No 1 surefoodz marketplace,<br />Lagos, Nigeria</small>
          </div>
        </div>
        <div>
          <h3>Top Category</h3>
          <ul>
            <li><Link href="/shop?category=Fresh%20vegetables">Fresh vegetables</Link></li>
            <li><Link href="/shop?category=Fresh%20fruits">Fresh fruits</Link></li>
            <li><Link href="/shop?category=Meat%20%26%20seafood">Meat &amp; seafood</Link></li>
            <li><Link href="/shop?category=Dairy%20%26%20eggs">Dairy &amp; eggs</Link></li>
            <li><Link href="/shop?category=Pantry%20essentials">Pantry essentials</Link></li>
          </ul>
        </div>
        <div>
          <h3>Quick Links</h3>
          <ul>
            <li><Link href="/account">My account</Link></li>
            <li><Link href="/favorites">Wishlist</Link></li>
            <li><Link href="/track-order">Track order</Link></li>
            <li><Link href="/pay-later">Pay later</Link></li>
            <li><Link href="/special-orders">Event orders</Link></li>
            <li><Link href="/help">Help centre</Link></li>
            <li><Link href="/terms">Terms &amp; conditions</Link></li>
            <li><Link href="/privacy">Privacy policy</Link></li>
          </ul>
        </div>
        <div>
          <h3>Download App</h3>
          <div className="sf-footer-apps">
            <a className="sf-footer-app" href="#android"><span aria-hidden="true">▶</span><span><small>Get it on</small><b>Google Play</b></span></a>
            <a className="sf-footer-app" href="#ios"><span aria-hidden="true"></span><span><small>Download on the</small><b>App Store</b></span></a>
          </div>
        </div>
        <div>
          <h3>Popular Tags</h3>
          <ul>
            <li><Link href="/shop?category=Fresh%20vegetables">Vegetables</Link></li>
            <li><Link href="/shop?category=Fresh%20fruits">Fruits</Link></li>
            <li><Link href="/shop?category=Drinks">Drinks</Link></li>
            <li><Link href="/shop?category=Bakery">Bakery</Link></li>
            <li><Link href="/shop?deals=1">Discount</Link></li>
          </ul>
        </div>
      </div>
      <div className="sf-footer-bottom">
        <span>© {new Date().getFullYear()} Sure Foodz. Fresh food, fair prices, delivered with care.</span>
        <div className="sf-pay-row" aria-label="Accepted payment methods">
          <span>Paystack</span>
          <span>Verve</span>
          <span>Visa</span>
          <span>Mastercard</span>
          <span>Bank transfer</span>
        </div>
      </div>
    </footer>
  );
}
