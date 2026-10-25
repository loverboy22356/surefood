"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

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
          ? <Image src={product.imageUrl} alt={product.name} fill quality={90} sizes="(max-width: 700px) 45vw, (max-width: 1200px) 30vw, 240px" className="product-card-image" />
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

  return (
    <div className="product-modal-layer">
      <button className="product-modal-backdrop" type="button" aria-label="Close product details" onClick={onClose} />
      <section className="product-modal" role="dialog" aria-modal="true" aria-labelledby="product-details-heading">
        <button type="button" className="product-modal-close" aria-label="Close product details" onClick={onClose}>×</button>
        <div className="product-modal-media">
          {product.imageUrl
            ? <Image src={product.imageUrl} alt={product.name} fill quality={90} sizes="(max-width: 900px) 100vw, 440px" className="product-modal-image" />
            : <span className="product-modal-emoji" aria-hidden="true">{product.emoji}</span>}
          {product.tag && <span className="product-modal-ribbon">👑 {product.tag}</span>}
        </div>
        <div className="product-modal-body">
          <div className="pm-seller-head">
            <span className="pm-seller-mark" aria-hidden="true">🌿</span>
            <span className="pm-seller-name">
              <strong>{product.sellerName || "SureFood"}</strong>
              {product.sellerVerified && <i aria-label="Verified">✔</i>}
              <small>Quality products, always.</small>
            </span>
            <span className="pm-verified-pill">
              🛡 {product.sellerVerified ? "Verified" : "Approved"} {roleLabel}
            </span>
          </div>
          <h2 className="pm-product-name" id="product-details-heading">{product.name}</h2>
          <p className="product-modal-price">{formatMarketMoney(product.price, product.currency)} <small>per unit</small></p>
          <div className="product-modal-perks">
            <div><span aria-hidden="true">🛡</span><strong>{product.sellerVerified ? `Verified ${roleLabel}` : "Approved listing"}</strong><small>Reviewed by SureFood</small></div>
            <div><span aria-hidden="true">🚚</span><strong>Seller delivery</strong><small>Fast confirmed before you pay</small></div>
            <div><span aria-hidden="true">🔒</span><strong>Protected order</strong><small>Secure checkout</small></div>
          </div>
          <div className="pm-details">
            <h3>Product Details</h3>
            <p>{product.detail || "This seller has not added a description for this item yet."}</p>
            <dl className="product-modal-specs">
              <div><dt>{roleLabel}</dt><dd>{product.sellerName || "SureFood seller"}{product.sellerVerified && <span className="verified-seller-badge">Verified {roleLabel.toLowerCase()}</span>}</dd></div>
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
                <b>Verified {roleLabel.toLowerCase()}</b>
                <small>{product.sellerName || "SureFood seller"}{product.sellerLocation ? ` · ${product.sellerLocation}` : ""}</small>
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

export function writeFavourites(items: MarketplaceProduct[]) {
  try {
    if (items.length) window.localStorage.setItem("surefood-favourites", JSON.stringify(items));
    else window.localStorage.removeItem("surefood-favourites");
  } catch (error) {
    console.error("Could not save your favourites.", error);
  }
}
