"use client";

import Image from "next/image";
import Link from "next/link";
import { formatMarketMoney, sellerRoleLabels as roleLabels, type MarketplaceProduct } from "./marketplace-product";

export type BrowseLocation = { value: string; label: string; count: number };

const priceBands = [
  { id: "any", label: "Any Price", min: 0, max: Number.POSITIVE_INFINITY },
  { id: "low", label: "Under ₦5,000", min: 0, max: 500_000 },
  { id: "mid", label: "₦5,000 – ₦10,000", min: 500_000, max: 1_000_000 },
  { id: "high", label: "₦10,000 – ₦20,000", min: 1_000_000, max: 2_000_000 },
  { id: "premium", label: "Above ₦20,000", min: 2_000_000, max: Number.POSITIVE_INFINITY },
] as const;

export type PriceBandId = typeof priceBands[number]["id"];

export function priceBandMatches(priceMinor: number, band: PriceBandId) {
  const range = priceBands.find((item) => item.id === band) ?? priceBands[0];
  return priceMinor >= range.min && priceMinor < range.max;
}

export function productLocationLabel(product: MarketplaceProduct) {
  return product.sellerLocation || [product.sellerCity, product.sellerRegion].filter(Boolean).join(", ");
}

export function productSubtitle(product: MarketplaceProduct) {
  const source = product.productKind ? roleLabels[product.productKind] ?? "" : "";
  const parts = [product.category, source].filter(Boolean);
  return parts.join(" • ") || "Fresh from an approved SureFood seller";
}

export function BrowseHeader({
  query,
  onQueryChange,
  onSubmit,
  locations,
  location,
  onLocationChange,
  savedCount,
  basketCount,
}: {
  query: string;
  onQueryChange?: (value: string) => void;
  onSubmit?: (value: string) => void;
  locations: BrowseLocation[];
  location: string;
  onLocationChange: (value: string) => void;
  savedCount: number;
  basketCount: number;
}) {
  return (
    <header className="shop-header">
      <Link href="/" className="shop-logo brand" aria-label="SureFood home">
        <span className="shop-logo-mark" aria-hidden="true">
          <span>s</span>
        </span>
        <span className="shop-logo-copy">
          <strong>sure<span>food</span></strong>
          <small>Fresh Food • Better Life</small>
        </span>
      </Link>
      <form
        className="shop-search"
        role="search"
        action="/search"
        onSubmit={(event) => {
          if (!onSubmit) return;
          event.preventDefault();
          onSubmit(query);
        }}
      >
        <span aria-hidden="true">⌕</span>
        <input
          type="search"
          name="q"
          value={query}
          onChange={(event) => onQueryChange?.(event.target.value)}
          placeholder="Search for products, suppliers, or categories..."
          aria-label="Search products"
        />
        <button type="submit">⌕ Search</button>
      </form>
      <div className="shop-header-actions">
        <label className="shop-location">
          <span aria-hidden="true">⌖</span>
          <select value={location} onChange={(event) => onLocationChange(event.target.value)} aria-label="Filter by seller location">
            <option value="">All locations</option>
            {locations.map((option) => (
              <option value={option.value} key={option.value}>{option.label}</option>
            ))}
          </select>
          <span aria-hidden="true">⌄</span>
        </label>
        <Link href="/favorites" className="shop-icon-button" aria-label={`Favourites${savedCount ? `, ${savedCount} saved` : ""}`}>
          <span aria-hidden="true">♥</span>
          {savedCount > 0 && <small>{savedCount}</small>}
        </Link>
        <Link href="/" className="shop-icon-button" aria-label={`Basket${basketCount ? `, ${basketCount} items` : ""}`}>
          <span aria-hidden="true">🛒</span>
          {basketCount > 0 && <small>{basketCount}</small>}
        </Link>
        <Link href="/account" className="shop-avatar" aria-label="Your account">👤</Link>
        <Link href="/" className="shop-back-link">Back to marketplace <span aria-hidden="true">→</span></Link>
      </div>
    </header>
  );
}

export function BrowseHero({
  kicker,
  title,
  highlight,
  description,
  chips,
  badge,
}: {
  kicker: string;
  title: string;
  highlight?: string;
  description: string;
  chips?: { label: string; count?: number; active?: boolean; onClick?: () => void }[];
  badge?: string;
}) {
  return (
    <section className="browse-hero">
      <Image src="/images/store-banner.jpg" alt="" fill preload sizes="100vw" quality={90} className="browse-hero-image" />
      <div className="browse-hero-overlay" />
      <div className="browse-hero-copy">
        <span className="browse-hero-kicker">{kicker}</span>
        <h1>{title}{highlight && <> <span>&ldquo;{highlight}&rdquo;</span></>}</h1>
        <p>{description}</p>
        {badge && <span className="browse-hero-badge">♥ {badge}</span>}
        {chips && chips.length > 0 && (
          <div className="browse-hero-chips" role="group" aria-label="Quick category filters">
            {chips.map((chip) => (
              <button
                type="button"
                key={chip.label}
                className={chip.active ? "active" : ""}
                aria-pressed={chip.active}
                onClick={chip.onClick}
              >
                {chip.label}{typeof chip.count === "number" && <span>({chip.count})</span>}
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export function FilterSidebar({
  open,
  onToggle,
  categoryCounts,
  category,
  onCategory,
  priceCounts,
  priceBand,
  onPriceBand,
  sellers,
  seller,
  onSeller,
  onClear,
  clearDisabled,
}: {
  open: boolean;
  onToggle: () => void;
  categoryCounts: { name: string; count: number }[];
  category: string;
  onCategory: (value: string) => void;
  priceCounts: Record<PriceBandId, number>;
  priceBand: PriceBandId;
  onPriceBand: (value: PriceBandId) => void;
  sellers: { name: string; count: number }[];
  seller: string;
  onSeller: (value: string) => void;
  onClear: () => void;
  clearDisabled: boolean;
}) {
  return (
    <aside className={open ? "browse-filters open" : "browse-filters"} aria-label="Filter products">
      <div className="browse-filters-heading">
        <h2>☰ Filters</h2>
        <button type="button" className="browse-filters-toggle" aria-expanded={open} onClick={onToggle}>{open ? "Hide" : "Show"}</button>
        <button type="button" className="browse-filters-clear" onClick={onClear} disabled={clearDisabled}>Clear all</button>
      </div>
      <div className="browse-filters-body">

      <fieldset className="browse-filter-group">
        <legend>Category</legend>
        <label className="browse-filter-option">
          <input type="radio" name="category" checked={category === ""} onChange={() => onCategory("")} />
          <span>All Categories</span>
        </label>
        {categoryCounts.map((option) => (
          <label className="browse-filter-option" key={option.name}>
            <input type="radio" name="category" checked={category === option.name} onChange={() => onCategory(option.name)} />
            <span>{option.name}</span>
            <small>{option.count}</small>
          </label>
        ))}
      </fieldset>

      <fieldset className="browse-filter-group">
        <legend>Price Range (₦)</legend>
        {priceBands.map((band) => (
          <label className="browse-filter-option" key={band.id}>
            <input type="radio" name="price-band" checked={priceBand === band.id} onChange={() => onPriceBand(band.id)} />
            <span>{band.label}</span>
            <small>{priceCounts[band.id] ?? 0}</small>
          </label>
        ))}
      </fieldset>

      <fieldset className="browse-filter-group">
        <legend>Seller</legend>
        <label className="browse-filter-option">
          <input type="radio" name="seller" checked={seller === ""} onChange={() => onSeller("")} />
          <span>All Sellers</span>
        </label>
        {sellers.map((option) => (
          <label className="browse-filter-option" key={option.name}>
            <input type="radio" name="seller" checked={seller === option.name} onChange={() => onSeller(option.name)} />
            <span>{option.name}</span>
            <small>{option.count}</small>
          </label>
        ))}
      </fieldset>
      </div>
    </aside>
  );
}

export function BrowseResultBar({
  count,
  noun = "products",
  sort,
  onSort,
  view,
  onView,
  context,
}: {
  count: number;
  noun?: string;
  sort: string;
  onSort: (value: string) => void;
  view: "grid" | "list";
  onView: (value: "grid" | "list") => void;
  context?: string;
}) {
  return (
    <div className="browse-result-bar">
      <p><strong>{count}</strong> {noun} {context}</p>
      <div className="browse-result-tools">
        <label className="browse-sort-control">
          <span aria-hidden="true">⇅</span>
          <span className="sr-only">Sort results</span>
          <select value={sort} onChange={(event) => onSort(event.target.value)} aria-label="Sort results">
            <option value="relevance">Sort by: Relevance</option>
            <option value="price-asc">Sort by: Price low to high</option>
            <option value="price-desc">Sort by: Price high to low</option>
            <option value="name">Sort by: Name A to Z</option>
          </select>
        </label>
        <div className="browse-view-toggle" role="group" aria-label="Result layout">
          <button type="button" className={view === "grid" ? "active" : ""} aria-pressed={view === "grid"} aria-label="Grid view" onClick={() => onView("grid")}>▦</button>
          <button type="button" className={view === "list" ? "active" : ""} aria-pressed={view === "list"} aria-label="List view" onClick={() => onView("list")}>☰</button>
        </div>
      </div>
    </div>
  );
}

export function BrowseProductCard({
  product,
  saved,
  view,
  onAdd,
  onToggleSave,
  onDetails,
}: {
  product: MarketplaceProduct;
  saved: boolean;
  view: "grid" | "list";
  onAdd: (product: MarketplaceProduct) => void;
  onToggleSave: (product: MarketplaceProduct) => void;
  onDetails: (product: MarketplaceProduct) => void;
}) {
  const outOfStock = (product.stock ?? 0) <= 0;
  const discounted = Boolean(product.oldPrice && product.oldPrice > product.price);
  const kindBadge = product.productKind === "producer"
    ? "FARM FRESH"
    : product.productKind === "manufacturer"
      ? "MADE LOCALLY"
      : product.productKind === "supplier" ? "WHOLESALE" : "MARKET PICK";
  const badge = discounted
    ? "SALE"
    : product.productKind
      ? kindBadge
      : (product.stock ?? 99) <= 5 ? "LOW STOCK" : "FRESH";
  const role = roleLabels[product.sellerRole ?? ""] ?? "Seller";
  const location = productLocationLabel(product);

  return (
    <article className={`browse-card ${view === "list" ? "list" : ""}`}>
      <div className="browse-card-media">
        {product.imageUrl
          ? <Image src={product.imageUrl} alt={product.name} fill sizes="(max-width: 700px) 90vw, (max-width: 1200px) 40vw, 300px" quality={90} className="browse-card-image" />
          : <span className="browse-card-emoji" aria-hidden="true">{product.emoji}</span>}
        <span className="browse-card-badge">{badge}</span>
        <button
          type="button"
          className={saved ? "browse-card-save saved" : "browse-card-save"}
          aria-label={`${saved ? "Remove" : "Save"} ${product.name} ${saved ? "from" : "to"} favourites`}
          aria-pressed={saved}
          onClick={() => onToggleSave(product)}
        >♥</button>
      </div>
      <div className="browse-card-body">
        <div className="browse-card-seller">
          <span>{product.sellerName || "SureFood seller"}</span>
          {product.sellerVerified && <span className="browse-card-verified" aria-label="Verified seller">✓</span>}
          <span className="browse-card-role">{role}</span>
        </div>
        <h3>{product.name}</h3>
        <p>{productSubtitle(product)}</p>
        <div className="browse-card-price">
          <strong>{formatMarketMoney(product.price, product.currency)}</strong>
          <small>/ item</small>
          {discounted && <><del>{formatMarketMoney(product.oldPrice!, product.currency)}</del><span className="browse-card-discount">-{Math.round((1 - product.price / product.oldPrice!) * 100)}%</span></>}
        </div>
        <div className="browse-card-meta">
          {location && <span>🚚 {location}</span>}
          {typeof product.stock === "number" && <span className={product.stock <= 5 ? "low" : ""}>{outOfStock ? "Out of stock" : `${product.stock} in stock`}</span>}
        </div>
        <div className="browse-card-actions">
          <button type="button" className="browse-card-view" onClick={() => onDetails(product)}>View seller &amp; details</button>
          <button type="button" className="browse-card-add" disabled={outOfStock} onClick={() => onAdd(product)}>
            <span aria-hidden="true">🛒</span> {outOfStock ? "Out of stock" : "Add to Cart"}
          </button>
        </div>
      </div>
    </article>
  );
}

export const browseRoleLabel = (role?: string) => (role ? roleLabels[role] ?? role : "seller");
