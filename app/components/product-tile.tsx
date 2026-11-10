"use client";

import Link from "next/link";
import {
  formatMarketMoney,
  productImageUrl,
  sellerRoleLabels,
  type MarketplaceProduct,
} from "./marketplace-product";

export function productDiscount(product: MarketplaceProduct) {
  if (!product.oldPrice || product.oldPrice <= product.price) return 0;
  return Math.round((1 - product.price / product.oldPrice) * 100);
}

/**
 * The one product card the whole storefront uses. Everything it shows comes from
 * the listing itself — price, real stock, seller name, role and trading city — so
 * a card never promises something the seller has not listed.
 */
export function ProductTile({
  product,
  saved = false,
  onToggleSave,
  onAdd,
  onQuickView,
  flag,
  variant = "grid",
  priority = false,
}: {
  product: MarketplaceProduct;
  saved?: boolean;
  onToggleSave?: (product: MarketplaceProduct) => void;
  onAdd?: (product: MarketplaceProduct) => void;
  onQuickView?: (product: MarketplaceProduct) => void;
  flag?: string;
  variant?: "grid" | "rail";
  priority?: boolean;
}) {
  const off = productDiscount(product);
  const stock = product.stock ?? 0;
  const soldOut = stock <= 0;
  const lowStock = !soldOut && stock <= 5;
  const role = sellerRoleLabels[product.sellerRole ?? ""] ?? "Seller";
  const place = product.sellerCity || product.sellerRegion || "";
  const seller = product.sellerName || `Sure Foodz ${role.toLowerCase()}`;
  const isBundle = Boolean(product.isBundle);
  const packager = product.packager;

  return (
    <article className={`p-tile${variant === "rail" ? " is-rail" : ""}${soldOut ? " is-out" : ""}`}>
      <div className="p-tile-media">
        <Link
          className={product.imageUrl ? "p-tile-art" : "p-tile-art is-flat"}
          href={`/product/${product.id}`}
          tabIndex={-1}
          aria-hidden="true"
        >
          {product.imageUrl
            ? <img src={productImageUrl(product.imageUrl, 600)} alt="" loading={priority ? "eager" : "lazy"} decoding="async" />
            : <span>{product.emoji}</span>}
        </Link>

        <div className="p-tile-flags">
          {off > 0 && <span className="p-tile-off">-{off}%</span>}
          {flag && !soldOut && <span className="p-tile-flag">{flag}</span>}
          {soldOut && <span className="p-tile-out">Sold out</span>}
        </div>

        {onToggleSave && (
          <button
            type="button"
            className={saved ? "p-tile-save is-on" : "p-tile-save"}
            aria-label={saved ? `Remove ${product.name} from your wishlist` : `Save ${product.name} to your wishlist`}
            aria-pressed={saved}
            onClick={() => onToggleSave(product)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M12 20.2 5.2 13.6A4.4 4.4 0 0 1 11.4 7.4l.6.6.6-.6a4.4 4.4 0 0 1 6.2 6.2Z"
                fill={saved ? "currentColor" : "none"}
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        )}

        {onQuickView && (
          <button type="button" className="p-tile-quick" onClick={() => onQuickView(product)}>
            Quick view
          </button>
        )}
      </div>

      <div className="p-tile-body">
        <p className="p-tile-seller" title={`${seller}${place ? ` · ${place}` : ""}`}>
          {product.sellerVerified && (
            <svg viewBox="0 0 24 24" aria-label="Verified seller" className="p-tile-check">
              <circle cx="12" cy="12" r="9" fill="currentColor" />
              <path d="m8 12.3 2.6 2.6L16 9.5" fill="none" stroke="#fff" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
          <span>{seller}</span>
          {place && <i aria-hidden="true">·</i>}
          {place && <span className="p-tile-place">{place}</span>}
        </p>

        <Link className="p-tile-title" href={`/product/${product.id}`}>{product.name}{packager && <span className="p-tile-packager">Packed by {packager}</span>}</Link>

        {isBundle && <p className="p-tile-bundle">Bundle · {product.bundleItems?.slice(0, 3).join(" · ") ?? "multiple items"}</p>}

        <div className="p-tile-price">
          <strong>{formatMarketMoney(product.price, product.currency)}</strong>
          {off > 0 && product.oldPrice && (
            <del>{formatMarketMoney(product.oldPrice, product.currency)}</del>
          )}
        </div>

        <p className={`p-tile-stock${lowStock ? " is-low" : ""}${soldOut ? " is-out" : ""}`}>
          {soldOut
            ? "Restocking soon"
            : lowStock
              ? `Only ${stock} left`
              : `${product.category}`}
        </p>

        <button
          type="button"
          className="p-tile-add"
          disabled={soldOut}
          onClick={() => onAdd?.(product)}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M3 4h2l2.3 10.7h10.4L20 7H6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="9.4" cy="19" r="1.4" fill="currentColor" />
            <circle cx="17" cy="19" r="1.4" fill="currentColor" />
          </svg>
          {soldOut ? "Sold out" : "Add to cart"}
        </button>
      </div>
    </article>
  );
}

export function ProductTileSkeleton({ count = 4, variant = "grid" }: { count?: number; variant?: "grid" | "rail" }) {
  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className={`p-tile is-skeleton${variant === "rail" ? " is-rail" : ""}`} aria-hidden="true">
          <div className="p-tile-media" />
          <div className="p-tile-body">
            <span className="p-skel-line is-short" />
            <span className="p-skel-line" />
            <span className="p-skel-line is-medium" />
            <span className="p-skel-line is-price" />
          </div>
        </div>
      ))}
    </>
  );
}
