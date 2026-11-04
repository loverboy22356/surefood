"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

export type MarketplaceProduct = {
  id: string;
  emoji: string;
  name: string;
  detail: string;
  category: string;
  price: number;
  oldPrice?: number;
  tag: string;
  stock?: number;
  imageUrl?: string;
  currency?: string;
  sellerId?: string;
  sellerName?: string;
  sellerLogoUrl?: string;
  sellerRole?: string;
  sellerVerified?: boolean;
  sellerCity?: string;
  sellerRegion?: string;
  sellerLocation?: string;
  productKind?: string;
  expiryDate?: string;
  nafdacNumber?: string;
  liveListing?: boolean;
};

export const sellerRoleLabels: Record<string, string> = {
  vendor: "Vendor",
  supplier: "Supplier",
  producer: "Producer",
  manufacturer: "Manufacturer",
};

export const productSourceLabels: Record<string, string> = {
  supplier: "Supplier (reselling)",
  farmer: "Farmer",
  producer: "Producer",
  manufacturer: "Manufacturer",
};

/**
 * Seller photos are stored on Cloudinary. Asking for a sharp rendition at the size
 * it is actually drawn (instead of whatever was uploaded) keeps cards and the
 * detail view crisp without shipping huge files.
 */
export function productImageUrl(url: string | undefined, width = 800) {
  if (!url) return "";
  const match = url.match(/^(https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(.+)$/);
  if (!match) return url;
  const [, prefix, rest] = match;
  // Only untouched uploads get a transformation; already-transformed URLs are kept.
  if (!/^v\d+\//.test(rest)) return url;
  return `${prefix}f_auto,q_auto:best,e_sharpen:60,dpr_auto,w_${width},c_limit/${rest}`;
}

export function formatMarketMoney(amountMinor: number, currencyCode = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currencyCode,
    currencyDisplay: "narrowSymbol",
    maximumFractionDigits: 2,
  }).format(amountMinor / 100);
}

function outOfStock(product: MarketplaceProduct) {
  return Boolean(product.liveListing) && (product.stock ?? 0) <= 0;
}

export function ProductCard({
  product,
  onAdd,
  onDetails,
  showStock = false,
  saved = false,
  onToggleSave,
}: {
  product: MarketplaceProduct;
  onAdd?: (product: MarketplaceProduct) => void;
  onDetails?: (product: MarketplaceProduct) => void;
  showStock?: boolean;
  saved?: boolean;
  onToggleSave?: (product: MarketplaceProduct) => void;
}) {
  const sellerLabel = product.liveListing
    ? `${(sellerRoleLabels[product.sellerRole ?? ""] ?? "Seller").toUpperCase()}${product.sellerName ? ` · ${product.sellerName}` : ""}`
    : "SUREFOOD SELECT";

  return (
    <article className="product-card marketplace-product-card" onClick={() => onDetails?.(product)}>
      <div className="product-art">
        <span className="product-tag">{product.tag}</span>
        {product.imageUrl
          ? <Image src={productImageUrl(product.imageUrl, 700)} alt={product.name} fill quality={92} sizes="(max-width: 700px) 50vw, (max-width: 1200px) 33vw, 300px" className="product-card-image" />
          : <span className="product-emoji">{product.emoji}</span>}
        <button
          type="button"
          aria-label={`${saved ? "Remove" : "Save"} ${product.name} ${saved ? "from" : "to"} favourites`}
          aria-pressed={saved}
          className={saved ? "save-button saved" : "save-button"}
          onClick={(event) => { event.stopPropagation(); onToggleSave?.(product); }}
        >♥</button>
      </div>
      {showStock && <div className={`limited-stock-note${(product.stock ?? 0) <= 4 ? " low" : ""}`}>{product.stock} units available</div>}
      <div className="product-info">
        <span className="product-source">{sellerLabel}</span>
        <h3>{product.name}</h3>
        <p>{product.detail}</p>
        <div className="product-price">
          <strong>{formatMarketMoney(product.price, product.currency)}</strong>
          {product.oldPrice && <><del>{formatMarketMoney(product.oldPrice, product.currency)}</del><span className="discount-pill">-{Math.round((1 - product.price / product.oldPrice) * 100)}%</span></>}
          <button
            type="button"
            aria-label={`Add ${product.name} to cart`}
            disabled={outOfStock(product)}
            onClick={(event) => { event.stopPropagation(); onAdd?.(product); }}
          >+</button>
        </div>
        <button
          type="button"
          className="product-details-link"
          onClick={(event) => { event.stopPropagation(); onDetails?.(product); }}
        >View seller &amp; details <span aria-hidden="true">→</span></button>
      </div>
    </article>
  );
}

type TrustedPartner = {
  id: string;
  name: string;
  location: string;
  logoUrl: string;
  emoji: string;
  mark?: string;
  route: string;
};

/** The checkout partners this storefront already advertises on product pages. */
const paymentPartners: TrustedPartner[] = [
  { id: "paystack", name: "Paystack", location: "Card & transfer", logoUrl: "", emoji: "", mark: "Ps", route: "" },
  { id: "verve", name: "Verve", location: "Card payments", logoUrl: "", emoji: "", mark: "Vv", route: "" },
  { id: "visa", name: "Visa", location: "Card payments", logoUrl: "", emoji: "", mark: "Vi", route: "" },
  { id: "mastercard", name: "Mastercard", location: "Card payments", logoUrl: "", emoji: "", mark: "Mc", route: "" },
];

/**
 * The approved-seller directory, fetched once per visit and shared by every
 * product panel that shows the partner strip.
 */
let partnerPromise: Promise<TrustedPartner[]> | null = null;

function readPartners(): Promise<TrustedPartner[]> {
  if (partnerPromise) return partnerPromise;
  const roles = ["supplier", "vendor", "producer", "manufacturer"];
  partnerPromise = Promise.allSettled(roles.map(async (role) => {
    const response = await fetch(`/api/marketplace/sellers?role=${role}`, { signal: AbortSignal.timeout(20_000) });
    if (!response.ok) return [] as TrustedPartner[];
    const data = await response.json() as { sellers?: unknown };
    if (!Array.isArray(data.sellers)) return [] as TrustedPartner[];
    return (data.sellers as Array<Record<string, unknown>>).map((seller) => ({
      id: String(seller.id ?? ""),
      name: String(seller.businessName ?? seller.name ?? "Sure Foodz seller"),
      location: String(seller.detail ?? ""),
      logoUrl: String(seller.logoUrl ?? ""),
      emoji: String(seller.emoji ?? "🏪"),
      route: String(seller.route ?? "/shop"),
    }));
  })).then((results) => results
    .flatMap((result) => (result.status === "fulfilled" ? result.value : []))
    .filter((partner, index, all) => partner.id && all.findIndex((item) => item.id === partner.id) === index))
    .catch(() => []);
  return partnerPromise;
}

export function TrustedPartners() {
  const [sellers, setSellers] = useState<TrustedPartner[] | null>(null);

  useEffect(() => {
    let active = true;
    void readPartners().then((list) => { if (active) setSellers(list); });
    return () => { active = false; };
  }, []);

  const base = sellers
    ? [...sellers.slice(0, 5), ...paymentPartners]
    : Array.from({ length: 4 }, (_, index) => ({
      id: `loading-${index}`, name: "", location: "", logoUrl: "", emoji: "", mark: "", route: "",
    }));
  // Repeat the row so a short list still fills the track on wide screens.
  const repetitions = Math.max(1, Math.ceil(10 / base.length));
  const chips = sellers ? Array.from({ length: repetitions }, () => base).flat() : base;

  return (
    <section className="pm-partners" aria-label="Trusted partners on Sure Foodz" aria-busy={!sellers}>
      <div className="pm-partners-head">
        <strong>Trusted partners</strong>
        <small>{sellers ? "Verified sellers and payment partners" : "Loading trusted partners…"}</small>
      </div>
      <div className="pm-partners-viewport">
        <div className="pm-partners-track" style={{ animationDuration: `${Math.max(20, chips.length * 3)}s` }}>
          {[0, 1].map((copy) => (
            <div
              className="pm-partners-group"
              key={copy}
              aria-hidden={copy === 1 ? true : undefined}
            >
              {chips.map((partner, index) => {
                const inner = (
                  <>
                    <span className="pm-partner-mark" aria-hidden="true">
                      {partner.logoUrl
                        ? <img src={productImageUrl(partner.logoUrl, 96)} alt="" />
                        : partner.mark ? <em>{partner.mark}</em> : partner.emoji || null}
                    </span>
                    <span className="pm-partner-copy">
                      <b>{partner.name || "\u00a0"}</b>
                      <small>{partner.location || (sellers ? "Sure Foodz" : "\u00a0")}</small>
                    </span>
                  </>
                );
                const key = `${copy}-${index}-${partner.id}`;
                if (!sellers) return <span key={key} className="pm-partner is-loading">{inner}</span>;
                if (!partner.route) return <span key={key} className="pm-partner">{inner}</span>;
                return (
                  <Link key={key} className="pm-partner" href={partner.route} tabIndex={copy === 1 ? -1 : undefined}>
                    {inner}
                  </Link>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function eventOrderHref(product: { name: string }, quantity: number) {
  return `/special-orders?items=${encodeURIComponent(`${quantity} × ${product.name}`)}`;
}

export function payLaterHref(product: { name: string; price: number; currency?: string }, quantity: number) {
  const params = new URLSearchParams({
    product: product.name,
    qty: String(quantity),
    price: String(product.price),
    currency: product.currency ?? "NGN",
  });
  return `/pay-later?${params.toString()}`;
}

export function ProductDetailsDialog({
  product,
  onClose,
  onAdd,
  saved = false,
  onToggleSave,
  onEventOrder,
}: {
  product: MarketplaceProduct;
  onClose: () => void;
  onAdd?: (product: MarketplaceProduct, quantity: number) => void;
  saved?: boolean;
  onToggleSave?: (product: MarketplaceProduct) => void;
  onEventOrder?: (product: MarketplaceProduct, quantity: number) => void;
}) {
  const [quantity, setQuantity] = useState(1);
  const roleLabel = sellerRoleLabels[product.sellerRole ?? ""] ?? "Seller";
  const maxQuantity = product.liveListing ? Math.max(1, product.stock ?? 0) : 99;
  // The seller block is built from the listing itself, so it never shows a
  // placeholder tagline or a role the API did not give us.
  const sellerName = product.sellerName || "Sure Foodz seller";
  const sellerPlace = product.sellerLocation
    || [product.sellerCity, product.sellerRegion].filter(Boolean).join(", ");
  const sellerMeta = [
    `${product.sellerVerified ? "Verified" : "Approved"} ${roleLabel.toLowerCase()}`,
    sellerPlace,
  ].filter(Boolean).join(" · ");

  return (
    <div className="product-modal-layer">
      <button className="product-modal-backdrop" type="button" aria-label="Close product details" onClick={onClose} />
      <section className="product-modal" role="dialog" aria-modal="true" aria-labelledby="product-details-heading">
        <button type="button" className="product-modal-close" aria-label="Close product details" onClick={onClose}>×</button>
        <div className="product-modal-media">
          {product.imageUrl
            ? <Image src={productImageUrl(product.imageUrl, 1200)} alt={product.name} fill quality={92} sizes="(max-width: 900px) 100vw, 460px" className="product-modal-image" priority />
            : <span className="product-modal-emoji" aria-hidden="true">{product.emoji}</span>}
          {product.tag && <span className="product-modal-ribbon">👑 {product.tag}</span>}
        </div>
        <div className="product-modal-body">
          <div className="pm-seller-head">
            <span className="pm-seller-mark" aria-hidden="true">
              {product.sellerLogoUrl
                ? <img src={productImageUrl(product.sellerLogoUrl, 96)} alt="" />
                : "🌿"}
            </span>
            <span className="pm-seller-name">
              <strong>{sellerName}</strong>
              {product.sellerVerified && <i aria-label="Verified seller">✔</i>}
              <small>{sellerMeta}</small>
            </span>
            <span className="pm-verified-pill">
              🛡 {product.sellerVerified ? "Verified" : "Approved"} {roleLabel}
            </span>
          </div>
          <h2 className="pm-product-name" id="product-details-heading">{product.name}</h2>
          <p className="product-modal-price">{formatMarketMoney(product.price, product.currency)} <small>per unit</small></p>
          <div className="product-modal-perks">
            <div><span aria-hidden="true">🛡</span><strong>{product.sellerVerified ? `Verified ${roleLabel}` : "Approved listing"}</strong><small>Reviewed by Sure Foodz</small></div>
            <div><span aria-hidden="true">🚚</span><strong>Seller delivery</strong><small>Fast confirmed before you pay</small></div>
            <div><span aria-hidden="true">🔒</span><strong>Protected order</strong><small>Secure checkout</small></div>
          </div>
          <div className="pm-details">
            <h3>Product Details</h3>
            <p>{product.detail || "This seller has not added a description for this item yet."}</p>
            <dl className="product-modal-specs">
              <div><dt>{roleLabel}</dt><dd>{sellerName}{<span className="verified-seller-badge">{product.sellerVerified ? "Verified" : "Approved"} {roleLabel.toLowerCase()}</span>}</dd></div>
              <div><dt>Location</dt><dd>{product.sellerLocation || "Location not provided"}</dd></div>
              <div><dt>Product source</dt><dd>{productSourceLabels[product.productKind ?? ""] ?? "Supplier"}</dd></div>
              <div><dt>Category</dt><dd>{product.category}</dd></div>
              {product.expiryDate && <div><dt>Expiry date</dt><dd>{product.expiryDate}</dd></div>}
              {product.nafdacNumber && <div><dt>NAFDAC number</dt><dd>{product.nafdacNumber}</dd></div>}
            </dl>
          </div>
          {product.sellerId && (
            <div className="product-modal-store-bar">
              <span className="pm-store-mark" aria-hidden="true">🏪</span>
              <span className="pm-store-copy">
                <b>{product.sellerVerified ? "Verified" : "Approved"} {roleLabel.toLowerCase()}</b>
                <small>{sellerName}{sellerPlace ? ` · ${sellerPlace}` : ""}</small>
              </span>
              <Link className="pm-store-button" href={`/store/${product.sellerId}`}>Open store →</Link>
            </div>
          )}
          <div className="pm-choices">
            <Link
              className="pm-choice pay-later"
              href={payLaterHref(product, quantity)}
            >
              <span className="pm-choice-icon" aria-hidden="true">🗓</span>
              <span className="pm-choice-copy"><b>Pay Later</b><small>Buy now, pay later (up to 30 days)</small></span>
              <i aria-hidden="true">›</i>
            </Link>
            {onEventOrder ? (
              <button
                type="button"
                className="pm-choice special"
                disabled={outOfStock(product)}
                onClick={() => { onEventOrder(product, quantity); onClose(); }}
              >
                <span className="pm-choice-icon" aria-hidden="true">🎉</span>
                <span className="pm-choice-copy"><b>Special Order</b><small>Custom quantity &amp; bulk order</small></span>
                <i aria-hidden="true">›</i>
              </button>
            ) : (
              <Link className="pm-choice special" href={eventOrderHref(product, quantity)}>
                <span className="pm-choice-icon" aria-hidden="true">🎉</span>
                <span className="pm-choice-copy"><b>Special Order</b><small>Custom quantity &amp; bulk order</small></span>
                <i aria-hidden="true">›</i>
              </Link>
            )}
          </div>
          <div className="product-modal-actions">
            <div className="product-modal-quantity" role="group" aria-label="Quantity">
              <button type="button" aria-label="Decrease quantity" disabled={quantity <= 1} onClick={() => setQuantity((value) => Math.max(1, value - 1))}>−</button>
              <span>{quantity}</span>
              <button type="button" aria-label="Increase quantity" disabled={quantity >= maxQuantity} onClick={() => setQuantity((value) => Math.min(maxQuantity, value + 1))}>＋</button>
            </div>
            <button
              type="button"
              className="product-modal-cart"
              disabled={outOfStock(product)}
              onClick={() => { onAdd?.(product, quantity); onClose(); }}
            >🛒 Add to Cart</button>
            <button type="button" className="product-modal-wishlist" aria-pressed={saved} onClick={() => onToggleSave?.(product)}>{saved ? "♥ Add to Favourites" : "♡ Add to Favourites"}</button>
          </div>
          <Link
            className="product-modal-paylater"
            href={payLaterHref(product, quantity)}
          >⚡ Take this on Pay Later — buy now, pay later →</Link>
        </div>
      </section>
    </div>
  );
}

export type ApiProduct = {
  id: string;
  name: string;
  description?: string;
  category: string;
  imageUrl?: string;
  priceMinor: number;
  compareAtMinor?: number;
  stock: number;
  currency: string;
  sellerId?: string;
  sellerName?: string;
  sellerLogoUrl?: string;
  sellerRole?: string;
  sellerVerified?: boolean;
  sellerCity?: string;
  sellerRegion?: string;
  sellerLocation?: string;
  productKind?: string;
  expiryDate?: string;
  nafdacNumber?: string;
};

export function apiProductToListing(product: ApiProduct): MarketplaceProduct {
  const onSale = Boolean(product.compareAtMinor && product.compareAtMinor > product.priceMinor);
  return {
    id: product.id,
    emoji: "🧺",
    name: product.name,
    detail: product.description || product.category,
    category: product.category,
    price: product.priceMinor,
    ...(onSale ? { oldPrice: product.compareAtMinor } : {}),
    tag: onSale ? "SALE" : "LIVE LISTING",
    stock: product.stock,
    imageUrl: product.imageUrl,
    currency: product.currency,
    sellerId: product.sellerId,
    sellerName: product.sellerName,
    sellerLogoUrl: product.sellerLogoUrl,
    sellerRole: product.sellerRole,
    sellerVerified: product.sellerVerified,
    sellerCity: product.sellerCity,
    sellerRegion: product.sellerRegion,
    sellerLocation: product.sellerLocation,
    productKind: product.productKind,
    expiryDate: product.expiryDate,
    nafdacNumber: product.nafdacNumber,
    liveListing: true,
  };
}

export function matchesSearch(product: MarketplaceProduct, term: string) {
  const haystack = `${product.name} ${product.detail} ${product.category} ${product.sellerName ?? ""} ${product.productKind ?? ""}`.toLowerCase();
  return term.toLowerCase().split(/\s+/).filter(Boolean).every((word) => haystack.includes(word));
}

export function readFavourites(): MarketplaceProduct[] {
  try {
    const raw = window.localStorage.getItem("surefood-favourites");
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as MarketplaceProduct[]).filter((item) => item && typeof item.id === "string") : [];
  } catch {
    return [];
  }
}

const RECENT_KEY = "surefood-recently-viewed";

/** Ids of the last products opened, newest first — the home page re-reads them from the catalogue. */
export function readRecentlyViewed(): string[] {
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

export function rememberViewed(productId: string) {
  if (!productId) return;
  try {
    const next = [productId, ...readRecentlyViewed().filter((id) => id !== productId)].slice(0, 12);
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* storage can be blocked; browsing still works */
  }
}

export function writeFavourites(items: MarketplaceProduct[]) {
  try {
    if (items.length) window.localStorage.setItem("surefood-favourites", JSON.stringify(items));
    else window.localStorage.removeItem("surefood-favourites");
  } catch (error) {
    console.error("Could not save your favourites.", error);
  }
}
