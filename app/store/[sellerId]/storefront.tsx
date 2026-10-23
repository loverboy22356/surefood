"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  readFavourites,
  writeFavourites,
  type MarketplaceProduct,
} from "@/app/components/marketplace-product";

type StoreProduct = {
  id: string;
  name: string;
  description: string;
  category: string;
  priceMinor: number;
  compareAtMinor?: number;
  currency: string;
  stock: number;
  imageUrl: string;
  productKind: string;
  expiryDate: string;
  nafdacNumber: string;
};

type StoreSeller = {
  id: string;
  role: string;
  name: string;
  displayName: string;
  city: string;
  region: string;
  location: string;
  country: string;
  registryVerified: boolean;
  verified: boolean;
};

type CartLine = {
  product: MarketplaceProduct;
  quantity: number;
};

const roleLabels: Record<string, string> = {
  vendor: "Vendor",
  supplier: "Supplier",
  producer: "Producer",
  manufacturer: "Manufacturer",
};

const roleArt: Record<string, string> = {
  vendor: "🏪",
  supplier: "📦",
  producer: "🌱",
  manufacturer: "🏭",
};

const sourceLabels: Record<string, string> = {
  supplier: "Supplier (reselling)",
  farmer: "Farmer",
  producer: "Producer",
  manufacturer: "Manufacturer",
};

const CART_KEY = "surefood-cart";

function money(amountMinor: number, currency: string) {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: currency || "NGN", maximumFractionDigits: 0 })
    .format(amountMinor / 100);
}

function registryBadge(seller: StoreSeller) {
  return seller.country === "NG" ? "CAC approved" : "Registry verified";
}

function readCart(): CartLine[] {
  try {
    const raw = window.localStorage.getItem(CART_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as CartLine[]) : [];
  } catch {
    return [];
  }
}

function writeCart(lines: CartLine[]) {
  try {
    if (lines.length) window.localStorage.setItem(CART_KEY, JSON.stringify(lines));
    else window.localStorage.removeItem(CART_KEY);
  } catch (error) {
    console.error("Could not save the SureFood basket.", error);
  }
}

export function Storefront({ sellerId }: { sellerId: string }) {
  const [seller, setSeller] = useState<StoreSeller | null>(null);
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [selected, setSelected] = useState<StoreProduct | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [noticeTone, setNoticeTone] = useState<"ok" | "warn">("ok");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState("featured");
  const [layout, setLayout] = useState<"grid" | "list">("grid");
  const [favourites, setFavourites] = useState<MarketplaceProduct[]>([]);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const response = await fetch(`/api/marketplace/sellers/${encodeURIComponent(sellerId)}`, {
          signal: AbortSignal.timeout(15_000),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "This store could not be loaded.");
        if (!active) return;
        setSeller(result.seller);
        setProducts(Array.isArray(result.products) ? result.products : []);
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : "This store could not be loaded.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [sellerId]);

  useEffect(() => {
    setFavourites(readFavourites());
  }, [sellerId]);

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setSelected(null);
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 5_000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const categories = useMemo(
    () => [...new Set(products.map((product) => product.category).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [products],
  );

  const visibleProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = products.filter((product) =>
      (!category || product.category === category) &&
      (!term || `${product.name} ${product.description} ${product.category}`.toLowerCase().includes(term)),
    );
    if (sort === "price-asc") return [...filtered].sort((a, b) => a.priceMinor - b.priceMinor);
    if (sort === "price-desc") return [...filtered].sort((a, b) => b.priceMinor - a.priceMinor);
    if (sort === "name") return [...filtered].sort((a, b) => a.name.localeCompare(b.name));
    return filtered;
  }, [products, category, search, sort]);

  function snapshot(product: StoreProduct): MarketplaceProduct {
    return {
      id: product.id,
      emoji: "🧺",
      name: product.name,
      detail: product.description || product.category,
      category: product.category,
      price: product.priceMinor,
      ...(product.compareAtMinor && product.compareAtMinor > product.priceMinor ? { oldPrice: product.compareAtMinor } : {}),
      tag: product.compareAtMinor && product.compareAtMinor > product.priceMinor ? "SALE" : "LIVE LISTING",
      stock: product.stock,
      imageUrl: product.imageUrl,
      currency: product.currency,
      sellerId: seller?.id,
      sellerName: seller?.name,
      sellerRole: seller?.role,
      sellerVerified: seller?.verified,
      sellerCity: seller?.city,
      sellerRegion: seller?.region,
      sellerLocation: seller?.location,
      productKind: product.productKind,
      expiryDate: product.expiryDate,
      nafdacNumber: product.nafdacNumber,
      liveListing: true,
    };
  }

  function toggleFavourite(product: StoreProduct) {
    const entry = snapshot(product);
    const exists = favourites.some((item) => item.id === product.id);
    const next = exists ? favourites.filter((item) => item.id !== product.id) : [...favourites, entry];
    writeFavourites(next);
    setFavourites(next);
    setNoticeTone("ok");
    setNotice(exists ? `${product.name} removed from your favourites.` : `${product.name} saved to your favourites.`);
  }

  function addToBasket(product: StoreProduct, amount: number) {
    if (!seller) return;
    if (product.stock <= 0) {
      setNoticeTone("warn");
      setNotice("This item is out of stock.");
      return;
    }
    const cart = readCart();
    const currency = cart[0]?.product.currency;
    if (cart.length && currency && currency !== product.currency) {
      setNoticeTone("warn");
      setNotice("Your basket can hold products in one currency at a time. Finish that order first.");
      return;
    }
    if (cart.length && cart.some((line) => line.product.sellerId !== seller.id)) {
      setNoticeTone("warn");
      setNotice("Your basket has items from another store. Place that order first, then shop here.");
      return;
    }
    const line = cart.find((item) => item.product.id === product.id);
    const nextQuantity = Math.min((line?.quantity ?? 0) + amount, product.stock);
    if (line && nextQuantity === line.quantity) {
      setNoticeTone("warn");
      setNotice("There is no more stock available for this product.");
      return;
    }
    const nextCart: CartLine[] = line
      ? cart.map((item) => item.product.id === product.id ? { ...item, quantity: nextQuantity } : item)
      : [...cart, { product: snapshot(product), quantity: nextQuantity }];
    writeCart(nextCart);
    setNoticeTone("ok");
    setNotice(`${product.name} added to your basket.`);
  }

  function openDetails(product: StoreProduct) {
    setQuantity(1);
    setSelected(product);
  }

  if (loading) return <main className="business-loading">Loading this store…</main>;

  if (error || !seller) {
    return (
      <main className="store-page" data-local-currency>
        <header className="store-topbar">
          <Link href="/" className="brand"><span className="brand-mark">s</span><span>sure<span>food</span></span></Link>
          <Link href="/">Back to marketplace →</Link>
        </header>
        <div className="store-body">
          <p className="marketplace-empty" role="alert">{error || "This store could not be found."}</p>
        </div>
      </main>
    );
  }

  const roleLabel = roleLabels[seller.role] ?? "Business";
  const related = selected ? products.filter((product) => product.id !== selected.id).slice(0, 4) : [];
  const about = `${seller.name} is an approved SureFood ${roleLabel.toLowerCase()}${seller.location ? ` in ${seller.location}` : ""}, reviewed and verified by our team${seller.country === "NG" ? ", serving buyers across Nigeria" : ""}.`;

  return (
    <main className="store-page" data-local-currency>
      <header className="store-topbar">
        <Link href="/" className="brand"><span className="brand-mark">s</span><span>sure<span>food</span></span></Link>
        <nav className="store-topbar-links" aria-label="Store navigation">
          <span>📍 {seller.location || "SureFood"}</span>
          <Link href="/favorites">♥ Favourites</Link>
          <Link href="/">Back to marketplace →</Link>
        </nav>
      </header>

      <div className="store-body">
        <section className="store-banner">
          <Image src="/images/store-banner.jpg" alt="" fill preload sizes="100vw" quality={90} className="store-banner-image" />
          <div className="store-banner-inner">
            <span className="store-avatar" aria-hidden="true">{roleArt[seller.role] ?? "🏬"}</span>
            <div className="store-banner-copy">
              <h1>{seller.name} {seller.verified && <span className="store-verified-tick" aria-label="Verified business">✓</span>}</h1>
              <p className="store-banner-meta">
                <span>📍 {seller.location || "Location not provided"}</span>
                <span aria-hidden="true">•</span>
                <span>{products.length} live listing{products.length === 1 ? "" : "s"}</span>
              </p>
              <div className="store-badges">
                <span className="store-chip verified">✓ Verified {roleLabel}</span>
                {seller.registryVerified && <span className="store-chip registry">🏛 {registryBadge(seller)}</span>}
              </div>
              <p className="store-banner-about">{about}</p>
            </div>
          </div>
        </section>

        <div className="store-trust-strip">
          <div><span className="store-trust-icon">🛡</span><span><strong>Verified Business</strong><small>Reviewed &amp; approved</small></span></div>
          <div><span className="store-trust-icon">★</span><span><strong>{roleLabel} Rating</strong><small>New on SureFood</small></span></div>
          <div><span className="store-trust-icon">🚚</span><span><strong>Delivery {seller.country === "NG" ? "Across Nigeria" : "Available"}</strong><small>Seller-handled delivery</small></span></div>
          <div><span className="store-trust-icon">📦</span><span><strong>Products Available</strong><small>{products.length} live listing{products.length === 1 ? "" : "s"}</small></span></div>
        </div>

        <section className="store-catalogue">
          <div className="store-catalogue-heading">
            <div><span className="section-kicker">SHOP THIS STORE</span><h2>Products from {seller.name}</h2></div>
          </div>
          <div className="store-toolbar">
            <label className="store-search">
              <span aria-hidden="true">⌕</span>
              <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search products…" aria-label={`Search products from ${seller.name}`} />
            </label>
            <label className="store-select">
              <span className="sr-only">Filter by category</span>
              <select value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Filter by category">
                <option value="">All Categories</option>
                {categories.map((name) => <option value={name} key={name}>{name}</option>)}
              </select>
            </label>
            <label className="store-select">
              <span className="sr-only">Sort products</span>
              <select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Sort products">
                <option value="featured">Sort by: Featured</option>
                <option value="price-asc">Price: low to high</option>
                <option value="price-desc">Price: high to low</option>
                <option value="name">Name: A to Z</option>
              </select>
            </label>
            <div className="store-layout-toggle" role="group" aria-label="Layout">
              <button type="button" className={layout === "grid" ? "active" : ""} aria-pressed={layout === "grid"} aria-label="Grid view" onClick={() => setLayout("grid")}>▦</button>
              <button type="button" className={layout === "list" ? "active" : ""} aria-pressed={layout === "list"} aria-label="List view" onClick={() => setLayout("list")}>☰</button>
            </div>
          </div>

          {products.length ? (
            visibleProducts.length ? (
              <div className={`store-item-grid ${layout}`}>
                {visibleProducts.map((product) => (
                  <article className="store-item-card" key={product.id} onClick={() => openDetails(product)}>
                    <div className="store-item-art">
                      {product.imageUrl
                        ? <Image src={product.imageUrl} alt={product.name} fill quality={90} sizes="(max-width: 700px) 45vw, 240px" className="store-item-image" />
                        : <span className="store-item-emoji" aria-hidden="true">🧺</span>}
                      {product.category && <span className="store-item-tag">{product.category}</span>}
                      <button
                        type="button"
                        className={favourites.some((item) => item.id === product.id) ? "store-item-save saved" : "store-item-save"}
                        aria-label={`${favourites.some((item) => item.id === product.id) ? "Remove" : "Save"} ${product.name} ${favourites.some((item) => item.id === product.id) ? "from" : "to"} favourites`}
                        aria-pressed={favourites.some((item) => item.id === product.id)}
                        onClick={(event) => { event.stopPropagation(); toggleFavourite(product); }}
                      >♥</button>
                    </div>
                    <div className="store-item-info">
                      <h3>{product.name}</h3>
                      <p>{product.category || "SureFood listing"}</p>
                      <div className="store-item-price">
                        <strong>{money(product.priceMinor, product.currency)}</strong>
                        {product.compareAtMinor && product.compareAtMinor > product.priceMinor && <del>{money(product.compareAtMinor, product.currency)}</del>}
                      </div>
                      <div className="store-item-actions">
                        <button type="button" className="store-item-details" onClick={(event) => { event.stopPropagation(); openDetails(product); }}>View item details</button>
                        <button
                          type="button"
                          className="store-item-add"
                          disabled={product.stock <= 0}
                          onClick={(event) => { event.stopPropagation(); addToBasket(product, 1); }}
                        >🛒 {product.stock <= 0 ? "Out of stock" : "Add to cart"}</button>
                      </div>
                    </div>
                  </article>
                ))}
                {products.length < 3 && (
                  <article className="store-item-placeholder">
                    <span className="store-placeholder-icon" aria-hidden="true">📦</span>
                    <h3>More products coming soon</h3>
                    <p>{seller.name} is adding more quality products. Check back soon for more great items.</p>
                    <Link href="/" className="store-follow-button">Browse the marketplace →</Link>
                  </article>
                )}
              </div>
            ) : (
              <p className="marketplace-empty">No products match this search in {seller.name}&apos;s store.</p>
            )
          ) : (
            <p className="marketplace-empty">This store has no live products at the moment.</p>
          )}
        </section>
      </div>

      {notice && (
        <div className={`store-notice ${noticeTone}`} role="status">
          <span>{notice}</span>
          {noticeTone === "ok" && <Link href="/">Go to basket →</Link>}
          <button type="button" aria-label="Dismiss message" onClick={() => setNotice("")}>×</button>
        </div>
      )}

      {selected && (
        <div className="product-modal-layer">
          <button className="product-modal-backdrop" type="button" aria-label="Close item details" onClick={() => setSelected(null)} />
          <section className="product-modal" role="dialog" aria-modal="true" aria-labelledby="store-detail-heading">
            <button type="button" className="product-modal-close" aria-label="Close item details" onClick={() => setSelected(null)}>×</button>
            <div className="product-modal-media">
              {selected.imageUrl
                ? <Image src={selected.imageUrl} alt={selected.name} fill quality={90} sizes="(max-width: 900px) 100vw, 380px" className="product-modal-image" />
                : <span className="product-modal-emoji" aria-hidden="true">🧺</span>}
              <span className="product-modal-verified">✓ Verified {roleLabel}</span>
            </div>
            <div className="product-modal-body">
              <div className="product-modal-heading">
                <h2 id="store-detail-heading">{selected.name}</h2>
                <span className={selected.stock > 0 ? "product-stock-pill" : "product-stock-pill out"}>{selected.stock > 0 ? "In Stock" : "Out of stock"}</span>
              </div>
              {selected.category && <p className="product-modal-category">◈ {selected.category}</p>}
              <p className="product-modal-price">{money(selected.priceMinor, selected.currency)} <small>per unit</small></p>
              <div className="product-modal-perks">
                <div><span aria-hidden="true">🌿</span><strong>Verified seller</strong><small>Reviewed by SureFood</small></div>
                <div><span aria-hidden="true">🚚</span><strong>Seller delivery</strong><small>Fee confirmed before you pay</small></div>
                <div><span aria-hidden="true">🛡</span><strong>Protected order</strong><small>Secure checkout</small></div>
              </div>
              <h3>Product Details</h3>
              <p className="product-modal-description">{selected.description || "This seller has not added a description for this item yet."}</p>
              <dl className="product-modal-specs">
                <div><dt>Seller</dt><dd>{seller.name}{seller.verified && <span className="verified-seller-badge">Verified</span>}</dd></div>
                {seller.registryVerified && <div><dt>Business registry</dt><dd>{registryBadge(seller)}</dd></div>}
                <div><dt>Seller type</dt><dd>{roleLabel}</dd></div>
                <div><dt>Location</dt><dd>{seller.location || "Location not provided"}</dd></div>
                <div><dt>Product source</dt><dd>{sourceLabels[selected.productKind] ?? "Supplier"}</dd></div>
                <div><dt>Availability</dt><dd>{selected.stock > 0 ? `${selected.stock} units available` : "Out of stock"}</dd></div>
                {selected.expiryDate && <div><dt>Expiry date</dt><dd>{selected.expiryDate}</dd></div>}
                {selected.nafdacNumber && <div><dt>NAFDAC number</dt><dd>{selected.nafdacNumber}</dd></div>}
              </dl>
              <div className="product-modal-actions">
                <div className="product-modal-quantity" role="group" aria-label="Quantity">
                  <button type="button" aria-label="Decrease quantity" disabled={quantity <= 1} onClick={() => setQuantity((value) => Math.max(1, value - 1))}>−</button>
                  <span>{quantity}</span>
                  <button type="button" aria-label="Increase quantity" disabled={quantity >= selected.stock} onClick={() => setQuantity((value) => Math.min(selected.stock, value + 1))}>＋</button>
                </div>
                <button type="button" className="product-modal-cart" disabled={selected.stock <= 0} onClick={() => { addToBasket(selected, quantity); setSelected(null); }}>🛒 Add to Cart</button>
                <button type="button" className="product-modal-wishlist" aria-pressed={favourites.some((item) => item.id === selected.id)} onClick={() => toggleFavourite(selected)}>{favourites.some((item) => item.id === selected.id) ? "♥ In Favourites" : "♡ Add to Favourites"}</button>
              </div>
            </div>
            {related.length > 0 && (
              <div className="product-modal-related">
                <h3>More from {seller.name}</h3>
                <div className="product-modal-related-grid">
                  {related.map((product) => (
                    <button type="button" key={product.id} onClick={() => openDetails(product)}>
                      <span>{product.imageUrl ? <Image src={product.imageUrl} alt="" width={44} height={44} quality={90} /> : "🧺"}</span>
                      <strong>{product.name}</strong>
                      <small>{money(product.priceMinor, product.currency)}</small>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
