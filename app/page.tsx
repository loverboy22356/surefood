"use client";

import Image from "next/image";
import Link from "next/link";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { User } from "firebase/auth";
import { firebaseAuth, firebaseConfigured } from "@/lib/firebase/client";
import { useLocale } from "@/app/components/locale-provider";
import {
  formatMarketMoney as formatMoney,
  ProductCard,
  ProductDetailsDialog,
  apiProductToListing,
  type ApiProduct,
  readFavourites,
  writeFavourites,
  type MarketplaceProduct as Product,
} from "@/app/components/marketplace-product";

const categories: [string, string][] = [
  ["🥬", "Fresh vegetables"],
  ["🍎", "Fresh fruits"],
  ["🥩", "Meat & seafood"],
  ["🥛", "Dairy & eggs"],
  ["🥖", "Bakery"],
  ["🥫", "Pantry essentials"],
  ["🧃", "Drinks"],
  ["🍪", "Snacks & treats"],
  ["🧊", "Frozen foods"],
  ["🧴", "Home & kitchen"],
  ["🧼", "Health & beauty"],
  ["🍼", "Baby & kids"],
  ["🐾", "Pet supplies"],
  ["🧽", "Household essentials"],
];

type MarketplaceCard = {
  id: string;
  role: "vendor" | "supplier" | "producer" | "manufacturer";
  name: string;
  detail: string;
  emoji: string;
  imageUrl?: string;
  badge: string;
  route: string;
};

type CartLine = {
  product: Product;
  quantity: number;
};

type PlacedOrder = {
  id: string;
  sellerName: string;
  subtotalMinor: number;
  currency: string;
};

function sourceSellerCards(products: Product[], kind: "producer" | "manufacturer"): MarketplaceCard[] {
  const cards = new Map<string, MarketplaceCard>();
  for (const product of products) {
    if (product.productKind !== kind || !product.sellerId || cards.has(product.sellerId)) continue;
    const count = products.filter((item) => item.productKind === kind && item.sellerId === product.sellerId).length;
    cards.set(product.sellerId, {
      id: product.sellerId,
      role: kind,
      name: product.sellerName || "SureFood seller",
      detail: `${count} ${kind === "producer" ? "producer" : "manufactured"} listing${count === 1 ? "" : "s"}${product.sellerLocation ? ` · ${product.sellerLocation}` : ""}`,
      emoji: kind === "producer" ? "🌱" : "🏭",
      ...(product.imageUrl ? { imageUrl: product.imageUrl } : {}),
      badge: kind === "producer" ? "Producer goods" : "Manufactured goods",
      route: `/store/${product.sellerId}`,
    });
  }
  return [...cards.values()];
}

function categoriesMatch(productCategory: string, selectedCategory: string) {
  const product = productCategory.toLowerCase().trim();
  const selected = selectedCategory.toLowerCase().trim();
  return product === selected ||
    product === selected.replace(/^fresh /, "") ||
    product.replace(/^fresh /, "") === selected;
}

export default function Home() {
  const router = useRouter();
  const { currency } = useLocale();
  const [catalogProducts, setCatalogProducts] = useState<Product[]>([]);
  const [topVendors, setTopVendors] = useState<MarketplaceCard[]>([]);
  const [topSuppliers, setTopSuppliers] = useState<MarketplaceCard[]>([]);
  const [topProducers, setTopProducers] = useState<MarketplaceCard[]>([]);
  const [topManufacturers, setTopManufacturers] = useState<MarketplaceCard[]>([]);
  const [catalogError, setCatalogError] = useState("");
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [productSearch, setProductSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [favourites, setFavourites] = useState<Product[]>([]);
  const [extraCategories, setExtraCategories] = useState<string[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [buyerAccount, setBuyerAccount] = useState<"checking" | "guest" | "buyer" | "other">("checking");
  const [buyerUser, setBuyerUser] = useState<User | null>(null);
  const [accountName, setAccountName] = useState("");
  const [deliveryLocation, setDeliveryLocation] = useState("");
  const [deliveryPhone, setDeliveryPhone] = useState("");
  const [cartOpen, setCartOpen] = useState(false);
  const [placedOrders, setPlacedOrders] = useState<PlacedOrder[]>([]);
  const [checkoutNotice, setCheckoutNotice] = useState("");
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [checkoutId, setCheckoutId] = useState("");
  const [buyerOrderNotice, setBuyerOrderNotice] = useState("");
  const [cartNotice, setCartNotice] = useState("");
  const [orderNotice, setOrderNotice] = useState("");
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [categoriesOpen, setCategoriesOpen] = useState(true);
  const itemCount = cart.reduce((total, line) => total + line.quantity, 0);
  const subtotal = cart.reduce((total, line) => total + line.product.price * line.quantity, 0);
  const cartCurrency = cart[0]?.product.currency ?? "NGN";
  const categoryList = useMemo(() => {
    const defaults = categories.map(([icon, name]) => ({ icon, name }));
    return [...defaults, ...extraCategories.map((name) => ({ icon: "🏷", name }))];
  }, [extraCategories]);
  const favouriteIds = useMemo(() => new Set(favourites.map((item) => item.id)), [favourites]);
  const visibleProducts = catalogProducts.filter((product) =>
    (!selectedCategory || categoriesMatch(product.category, selectedCategory)) &&
    (!productSearch.trim() || `${product.name} ${product.detail} ${product.category}`.toLowerCase().includes(productSearch.trim().toLowerCase())),
  );
  const storefrontDeals = visibleProducts.filter((product) => product.oldPrice !== undefined && product.oldPrice > product.price);
  const storefrontLimited = visibleProducts.filter((product) => (product.stock ?? 0) > 0 && (product.stock ?? 0) <= 10);

  useEffect(() => {
    try {
      const storedCheckoutId = window.sessionStorage.getItem("surefood-checkout-id");
      const id = storedCheckoutId && /^[A-Za-z0-9-]{16,80}$/.test(storedCheckoutId)
        ? storedCheckoutId
        : crypto.randomUUID();
      window.sessionStorage.setItem("surefood-checkout-id", id);
      setCheckoutId(id);
      const savedCart = window.localStorage.getItem("surefood-cart");
      if (savedCart) {
        const parsed = JSON.parse(savedCart) as CartLine[];
        if (Array.isArray(parsed)) {
          const liveCart = parsed.filter((line) =>
            line &&
            line.product?.liveListing === true &&
            typeof line.product.id === "string" &&
            Number.isInteger(line.quantity) &&
            line.quantity > 0,
          );
          setCart(liveCart);
          if (liveCart.length) setCartOpen(true);
          if (liveCart.length < parsed.length) {
            setCartNotice("Unavailable preview items were removed from your saved basket.");
          }
        }
      }
    } catch (reason) {
      console.error("Could not restore the saved SureFood cart.", reason);
    }
  }, []);

  useEffect(() => {
    if (!firebaseConfigured()) {
      setBuyerAccount("guest");
      return;
    }
    return onAuthStateChanged(firebaseAuth(), async (user) => {
      setBuyerUser(user);
      if (!user) {
        setBuyerAccount("guest");
        setAccountName("");
        setDeliveryLocation("");
        setDeliveryPhone("");
        return;
      }
      setAccountName(user.displayName || user.email || "My profile");
      try {
        const [token, tokenResult] = await Promise.all([user.getIdToken(), user.getIdTokenResult()]);
        const isBuyer = tokenResult.claims.role === "buyer";
        setBuyerAccount(isBuyer ? "buyer" : "other");
        const response = await fetch("/api/profile", { headers: { authorization: `Bearer ${token}` } });
        if (!response.ok) {
          const result = await response.json();
          throw new Error(result.error || "Could not load your account profile.");
        }
        const result = await response.json();
        if (typeof result.profile?.displayName === "string" && result.profile.displayName) {
          setAccountName(result.profile.displayName);
        }
        setDeliveryLocation(typeof result.profile?.location === "string" ? result.profile.location : "");
        setDeliveryPhone(typeof result.profile?.phone === "string" ? result.profile.phone : "");
      } catch (reason) {
        console.error("Could not load the SureFood account profile.", reason);
        setBuyerAccount((current) => current === "checking" ? "other" : current);
      }
    });
  }, []);

  useEffect(() => {
    if (buyerAccount !== "buyer" || !buyerUser) return;
    let active = true;
    let previousPayableOrderIds = new Set<string>();
    async function checkBuyerOrders() {
      try {
        const token = await buyerUser!.getIdToken();
        const response = await fetch("/api/orders", { headers: { authorization: `Bearer ${token}` } });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Could not check your orders.");
        if (!active || !Array.isArray(result.orders)) return;
        const payableOrders = result.orders.filter((order: { id: string; status: string }) => order.status === "Awaiting buyer payment");
        const currentIds = new Set<string>(payableOrders.map((order: { id: string }) => order.id));
        if ([...currentIds].some((id) => !previousPayableOrderIds.has(id))) {
          setBuyerOrderNotice("A seller has confirmed your delivery fee. Your order is ready for payment.");
        }
        previousPayableOrderIds = currentIds;
      } catch (reason) {
        console.error("Could not check buyer order updates.", reason);
      }
    }
    void checkBuyerOrders();
    const interval = window.setInterval(() => void checkBuyerOrders(), 20_000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [buyerAccount, buyerUser]);

  useEffect(() => {
    try {
      if (cart.length) window.localStorage.setItem("surefood-cart", JSON.stringify(cart));
      else window.localStorage.removeItem("surefood-cart");
    } catch (reason) {
      console.error("Could not save the SureFood cart.", reason);
      setCartNotice("Your browser could not save this basket. Keep this page open while shopping.");
    }
  }, [cart]);

  useEffect(() => {
    try {
      setFavourites(readFavourites());
    } catch (reason) {
      console.error("Could not restore your SureFood favourites.", reason);
    }
    void fetch("/api/categories", { signal: AbortSignal.timeout(15_000) })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok || !Array.isArray(result.categories)) return;
        const defaults = new Set(categories.map(([, name]) => name.toLowerCase()));
        setExtraCategories((result.categories as string[]).filter((name) => !defaults.has(name.toLowerCase())));
      })
      .catch((reason: unknown) => console.error("Could not load the extra product categories.", reason));
  }, []);

  useEffect(() => {
    let active = true;
    async function loadCatalog() {
      const routes = [
        "/api/products",
        "/api/marketplace/sellers?role=vendor",
        "/api/marketplace/sellers?role=supplier",
      ];
      const results = await Promise.allSettled(routes.map(async (route) => {
        const response = await fetch(route, { signal: AbortSignal.timeout(15_000) });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || `Could not load ${route}.`);
        return data;
      }));
      if (!active) return;

      const errors: string[] = [];
      const productResult = results[0];
      if (productResult.status === "fulfilled" && Array.isArray(productResult.value.products)) {
        const listings = (productResult.value.products as ApiProduct[]).map(apiProductToListing);
        setCatalogProducts(listings);
        setTopProducers(sourceSellerCards(listings, "producer"));
        setTopManufacturers(sourceSellerCards(listings, "manufacturer"));
      } else {
        errors.push(productResult.status === "rejected" ? productResult.reason.message : "Live products returned an invalid response.");
      }

      const sellerSetters = [setTopVendors, setTopSuppliers];
      const roleNames = ["vendors", "suppliers"];
      results.slice(1).forEach((result, index) => {
        if (result.status === "fulfilled" && Array.isArray(result.value.sellers)) {
          sellerSetters[index](result.value.sellers as MarketplaceCard[]);
        } else {
          errors.push(result.status === "rejected" ? result.reason.message : `Approved ${roleNames[index]} returned an invalid response.`);
        }
      });

      const hasLoadedMarketplaceData = results.some((result) => result.status === "fulfilled");
      setCatalogError(hasLoadedMarketplaceData && errors.length > 0 ? errors.join(" ") : "");
      setCatalogLoading(false);
    }
    void loadCatalog();
    return () => { active = false; };
  }, []);

  function openProductDetails(product: Product) {
    setSelectedProduct(product);
  }

  function toggleFavourite(product: Product) {
    setFavourites((current) => {
      const exists = current.some((item) => item.id === product.id);
      const next = exists ? current.filter((item) => item.id !== product.id) : [...current, product];
      writeFavourites(next);
      return next;
    });
  }

  function addToCart(product: Product, amount = 1) {
    if (buyerAccount === "other") {
      setCartNotice("Please sign in with a buyer account to shop.");
      setCartOpen(true);
      return;
    }
    if (buyerAccount === "checking") {
      setCartNotice("Checking your SureFood account. Please try adding this item again.");
      setCartOpen(true);
      return;
    }
    const existingCurrency = cart[0]?.product.currency ?? "USD";
    if (cart.length > 0 && existingCurrency !== (product.currency ?? "USD")) {
      setCartNotice("Your cart can contain products in one currency at a time. Remove the other items first.");
      setCartOpen(true);
      return;
    }
    const liveListing = cart.find((line) => line.product.liveListing);
    if (product.liveListing && liveListing && product.sellerId !== liveListing.product.sellerId) {
      setCartNotice("Please place separate orders for products from different stores.");
      setCartOpen(true);
      return;
    }
    const existingLine = cart.find((line) => line.product.id === product.id);
    if (product.liveListing && existingLine && existingLine.quantity >= (product.stock ?? 0)) {
      setCartNotice("There is no more stock available for this product.");
      setCartOpen(true);
      return;
    }
    const nextCart = existingLine
      ? cart.map((line) => line.product.id === product.id
        ? { ...line, quantity: Math.min(line.quantity + amount, product.liveListing ? (product.stock ?? line.quantity + amount) : line.quantity + amount) }
        : line)
      : [...cart, { product, quantity: product.liveListing ? Math.min(amount, product.stock ?? amount) : amount }];
    rotateCheckoutId();
    setCart(nextCart);
    setPlacedOrders([]);
    setCheckoutNotice("");
    setCartNotice("");
    if (buyerAccount === "guest") {
      try {
        window.localStorage.setItem("surefood-cart", JSON.stringify(nextCart));
        router.push("/signup");
      } catch (reason) {
        console.error("Could not save the cart before buyer sign-up.", reason);
        setCartNotice("Your basket could not be saved for sign-up. Please check browser storage settings.");
        setCartOpen(true);
      }
    }
  }

  function changeQuantity(productId: string, amount: number) {
    rotateCheckoutId();
    setCart((currentCart) => {
      const nextCart = currentCart
        .map((line) =>
          line.product.id === productId ? { ...line, quantity: line.quantity + amount } : line,
        )
        .filter((line) => line.quantity > 0);
      return nextCart;
    });
    setCheckoutNotice("");
    setCartNotice("");
  }

  function rotateCheckoutId() {
    setCheckoutId("");
    try {
      window.sessionStorage.removeItem("surefood-checkout-id");
    } catch (reason) {
      console.error("Could not clear the previous checkout identifier.", reason);
    }
  }

  async function placeOrder() {
    if (cart.some((line) => !line.product.liveListing)) {
      setCheckoutNotice("Featured preview products cannot be ordered. Remove them and try again.");
      return;
    }
    if (buyerAccount === "checking") {
      setCheckoutNotice("Checking your account. Please try again in a moment.");
      return;
    }
    if (buyerAccount === "guest") {
      try {
        window.localStorage.setItem("surefood-cart", JSON.stringify(cart));
        router.push("/login");
      } catch (reason) {
        console.error("Could not save the cart before sign-in.", reason);
        setCheckoutNotice("Your cart could not be saved. Check your browser storage and try again.");
      }
      return;
    }
    if (buyerAccount !== "buyer" || !buyerUser) {
      setCheckoutNotice("Sign in with a buyer account to place an order.");
      return;
    }
    if (!/^[+()\d\s.-]{7,24}$/.test(deliveryPhone.trim())) {
      setCheckoutNotice("Enter a valid phone number for delivery in the cart.");
      return;
    }
    if (deliveryLocation.trim().length < 5) {
      setCheckoutNotice("Enter your full delivery address in the cart.");
      return;
    }
    if (!cart.length) {
      setCheckoutNotice("Add products to your cart before placing an order.");
      return;
    }

    setCheckoutBusy(true);
    setCheckoutNotice("");
    try {
      const token = await buyerUser.getIdToken();
      const requestId = checkoutId || crypto.randomUUID();
      window.sessionStorage.setItem("surefood-checkout-id", requestId);
      if (!checkoutId) setCheckoutId(requestId);
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({
          checkoutId: requestId,
          items: cart.map(({ product, quantity }) => ({ productId: product.id, quantity })),
          phone: deliveryPhone.trim(),
          deliveryAddress: deliveryLocation.trim(),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not place your order.");
      const createdOrders: PlacedOrder[] = Array.isArray(result.orders)
        ? result.orders.flatMap((order: Record<string, unknown>) => typeof order?.id === "string"
          ? [{
              id: order.id,
              sellerName: typeof order.sellerName === "string" && order.sellerName ? order.sellerName : "the seller",
              subtotalMinor: typeof order.subtotalMinor === "number" ? order.subtotalMinor : 0,
              currency: typeof order.currency === "string" ? order.currency : "NGN",
            }]
          : [])
        : [];
      setCart([]);
      setPlacedOrders(createdOrders);
      window.sessionStorage.removeItem("surefood-checkout-id");
      setCheckoutId("");
      setOrderNotice("Order sent. Wait for the seller to assign the delivery fee — payment opens for this order as soon as it is added.");
      setCartNotice("");
    } catch (reason) {
      setCheckoutNotice(reason instanceof Error ? reason.message : "Could not place your order.");
    } finally {
      setCheckoutBusy(false);
    }
  }

  return (
    <main className="shop" data-local-currency>
      <div className="announcement">
        <span>Good food, delivered fresh.</span>
        <span className="announcement-right">Fresh picks from approved local sellers</span>
      </div>
      <header className="site-header">
        <Link className="brand" href="/" aria-label="SureFood home">
          <span className="brand-mark">s</span>
          <span>sure<span>food</span></span>
        </Link>
        <form
          className="search-box"
          role="search"
          onSubmit={(event) => {
            event.preventDefault();
            const term = productSearch.trim();
            router.push(term ? `/search?q=${encodeURIComponent(term)}` : "/search");
          }}
        >
          <span aria-hidden="true">⌕</span>
          <input type="search" value={productSearch} onChange={(event) => setProductSearch(event.target.value)} placeholder="Search products, suppliers, or categories..." aria-label="Search products" />
          <button type="submit" className="search-submit" aria-label="Search">Search</button>
        </form>
        <nav className="header-actions" aria-label="Main navigation">
          <Link href={buyerAccount === "guest" ? "/login" : "/account"} className="header-action account-header-action">
            <span className="action-icon">♙</span>
            <span>
              <small>{buyerAccount === "guest" ? "Welcome" : "Your profile"}</small>
              <strong>{buyerAccount === "guest" ? "Sign in" : accountName || "My account"}</strong>
            </span>
          </Link>
          <Link href="/favorites" className="header-action favourites-action">
            <span className="action-icon favourite-icon">♥</span>
            <span><small>Favourites</small><strong>{favourites.length ? `${favourites.length} saved` : "Nothing saved"}</strong></span>
          </Link>
          <button type="button" className="header-action cart-action" aria-label={`Your cart, ${itemCount} items`} aria-expanded={cartOpen} onClick={() => setCartOpen(true)}>
            <span className="cart-icon">♧<i>{itemCount}</i></span>
            <span><small>Your cart</small><strong>{formatMoney(subtotal, cartCurrency)}</strong></span>
          </button>
        </nav>
      </header>

      <nav className="category-nav" aria-label="Shop departments">
        <Link href="#categories">Shop all</Link>
        <Link href="#fresh">Fresh food</Link>
        <Link href="#deals">Weekly deals</Link>
        <Link href="#local">Local favourites</Link>
        <Link href="#about">Our story</Link>
        <Link href="/signup?role=vendor" className="supplier-nav-link">Vendor portal</Link>
        <Link href="/signup?role=supplier" className="supplier-nav-link">Supplier portal</Link>
        <span className="nav-promo">Fresh picks, happy plates <span>→</span></span>
      </nav>

      <div className="page-content">
        {orderNotice && <div className="buyer-order-notice" role="status">{orderNotice}<Link href="/account?orders=1">View your orders →</Link><button type="button" aria-label="Dismiss order confirmation" onClick={() => setOrderNotice("")}>×</button></div>}
        {buyerOrderNotice && <div className="buyer-order-notice" role="status">{buyerOrderNotice}<Link href="/account?orders=1">Review and pay →</Link><button type="button" aria-label="Dismiss order notification" onClick={() => setBuyerOrderNotice("")}>×</button></div>}
        <div className="breadcrumbs"><span>Home</span><b>›</b><span>Groceries</span></div>
        <div className="home-grid">
          <aside className="categories-panel" id="categories">
            <div className="panel-heading"><h2>Shop by category</h2><button type="button" aria-label={categoriesOpen ? "Collapse categories" : "Expand categories"} aria-expanded={categoriesOpen} onClick={() => setCategoriesOpen((open) => !open)}>{categoriesOpen ? "−" : "+"}</button></div>
            {categoriesOpen && (
              <>
                <ul className={showAllCategories ? "expanded" : ""}>
                  {categoryList.slice(0, showAllCategories ? categoryList.length : 8).map(({ icon, name }) => (
                    <li key={name} className={selectedCategory === name ? "category-selected" : ""}>
                      <Link href="#fresh" onClick={() => setSelectedCategory((current) => current === name ? "" : name)}><span className="category-emoji">{icon}</span><span>{name}</span><span className="category-arrow">›</span></Link>
                    </li>
                  ))}
                </ul>
                <button type="button" className="all-categories" aria-expanded={showAllCategories} onClick={() => setShowAllCategories((show) => !show)}>{showAllCategories ? "Show fewer categories" : "View all categories"} <span>{showAllCategories ? "↑" : "→"}</span></button>
              </>
            )}
            <div className="help-card"><span className="help-icon">♡</span><strong>Need a hand?</strong><p>We&apos;re here to help you find the good stuff.</p><Link href="#about">Talk to our team →</Link></div>
          </aside>

          <div className="home-main">
            <section className="hero-banner" aria-label="Fresh food, made simple">
              <Image src="/images/home-hero.png" alt="SureFood fresh food banner" fill preload sizes="(max-width: 700px) 100vw, 75vw" className="hero-image" />
            </section>

            <div className="service-strip">
              <div><span className="service-icon">♧</span><span><strong>Fresh, always</strong><small>Picked at its best</small></span></div>
              <div><span className="service-icon">↗</span><span><strong>On your doorstep</strong><small>Fast, careful delivery</small></span></div>
              <div><span className="service-icon">♡</span><span><strong>Good for everyone</strong><small>Better food, better days</small></span></div>
            </div>
            <PromoRail />
          </div>
        </div>
        {catalogError && <p className="catalog-status" role="alert">Some live marketplace data could not be loaded.</p>}
        <div className="store-sections">
          <MarketplaceSection
            id="fresh"
            title="Good things, in season"
            eyebrow="A LITTLE SOMETHING FRESH"
            actionLabel="See all fresh"
            products={visibleProducts}
            onAdd={addToCart}
            onDetails={openProductDetails}
            savedIds={favouriteIds}
            onToggleSave={toggleFavourite}
            emptyMessage={catalogLoading ? "Loading live products…" : "No active products are listed yet."}
          />
          <MarketplaceSection
            id="flash-sales"
            title="Fresh food flash deals"
            eyebrow="LIVE SELLER DISCOUNTS"
            actionLabel="See all discounts"
            products={storefrontDeals}
            onAdd={addToCart}
            onDetails={openProductDetails}
            savedIds={favouriteIds}
            onToggleSave={toggleFavourite}
            variant="flash"
            emptyMessage={catalogLoading ? "Loading current deals…" : "There are no discounted products right now."}
          />
          <MarketplaceSection
            id="top-vendors"
            title="Approved vendors"
            eyebrow="BUSINESSES REVIEWED BY SUREFOOD"
            actionLabel="See all vendors"
            cards={topVendors}
            variant="feature"
            emptyMessage={catalogLoading ? "Loading approved vendors…" : "No approved vendors are listed yet."}
          />
          <LimitedStockSection products={storefrontLimited} onAdd={addToCart} onDetails={openProductDetails} savedIds={favouriteIds} onToggleSave={toggleFavourite} emptyMessage={catalogLoading ? "Loading limited-stock products…" : "No products have limited stock right now."} />
          <MarketplaceSection
            id="top-suppliers"
            title="Approved suppliers"
            eyebrow="BUSINESSES REVIEWED BY SUREFOOD"
            actionLabel="See all suppliers"
            cards={topSuppliers}
            variant="feature"
            emptyMessage={catalogLoading ? "Loading approved suppliers…" : "No approved suppliers are listed yet."}
          />
          <MarketplaceSection
            id="top-producers"
            title="Producers & growers"
            eyebrow="GROWN WITH CARE"
            actionLabel="See all producers"
            cards={topProducers}
            variant="feature"
            emptyMessage={catalogLoading ? "Loading producer sellers…" : "Sellers with producer-sourced products will appear here."}
          />
          <MarketplaceSection
            id="top-manufacturers"
            title="Manufacturers & makers"
            eyebrow="MADE LOCALLY, MADE WELL"
            actionLabel="See all manufacturers"
            cards={topManufacturers}
            variant="feature"
            emptyMessage={catalogLoading ? "Loading manufacturer sellers…" : "Sellers with manufactured products will appear here."}
          />
          <div className="lower-promo" id="deals"><span>GOOD FOOD, GOOD MOOD</span><strong>Something lovely is always in season.</strong><Link href="#flash-sales">See this week&apos;s picks →</Link></div>
        </div>
      </div>
      <footer className="site-footer" id="about"><span data-no-translate>sure<span>food</span></span><span>Little choices. A whole lot of good.</span><Link href="/signup?role=vendor" className="footer-vendor">Vendor portal</Link><Link href="/signup?role=supplier" className="footer-vendor">Supplier portal</Link><Link href="/signup" className="footer-join">Join the table <span>→</span></Link></footer>
      {selectedProduct && (
        <ProductDetailsDialog
          key={selectedProduct.id}
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onAdd={addToCart}
          saved={favouriteIds.has(selectedProduct.id)}
          onToggleSave={toggleFavourite}
        />
      )}
      {cartOpen && (
        <div className="cart-layer">
          <button className="cart-backdrop" type="button" aria-label="Close cart" onClick={() => setCartOpen(false)} />
          <aside className="cart-drawer" role="dialog" aria-modal="true" aria-labelledby="cart-heading">
            <div className="cart-drawer-header">
              <div><span className="cart-kicker">SUREFOOD</span><h2 id="cart-heading">{placedOrders.length > 0 && cart.length === 0 ? "Order sent" : <>Your cart <span>({itemCount})</span></>}</h2></div>
              <button type="button" className="cart-close" aria-label="Close cart" onClick={() => setCartOpen(false)}>×</button>
            </div>
            {cart.length === 0 ? (
              placedOrders.length > 0 ? (
                <div className="cart-empty cart-order-placed">
                  <span aria-hidden="true">✅</span>
                  <h3>Order sent{placedOrders.length === 1 ? ` to ${placedOrders[0].sellerName}` : " to your sellers"}</h3>
                  <p>Your basket has been sent. The seller will confirm delivery and add the delivery fee.</p>
                  <p className="cart-order-waiting"><strong>Payment stays closed until the delivery fee is assigned.</strong> As soon as the seller adds it, this order opens for payment and we notify you here and in your account.</p>
                  <ul className="cart-order-list">
                    {placedOrders.map((order) => (
                      <li key={order.id}><span>{order.sellerName}</span><strong>{formatMoney(order.subtotalMinor / 100, order.currency)}</strong><small>Delivery fee: waiting for the seller</small></li>
                    ))}
                  </ul>
                  <Link className="cart-order-track" href="/account">Track this order in my account →</Link>
                  <button type="button" onClick={() => { setPlacedOrders([]); setCartOpen(false); }}>Keep shopping</button>
                </div>
              ) : (
                <div className="cart-empty"><span>🧺</span><h3>Your basket is taking a little break.</h3><p>Add fresh picks and they&apos;ll show up right here.</p><button type="button" onClick={() => setCartOpen(false)}>Keep shopping</button></div>
              )
            ) : (
              <>
                <ul className="cart-lines">
                  {cart.map(({ product, quantity }) => (
                    <li className="cart-line" key={product.id}>
                      <span className="cart-line-emoji" aria-hidden="true">{product.imageUrl ? <Image src={product.imageUrl} alt="" width={52} height={52} quality={90} /> : product.emoji}</span>
                      <div className="cart-line-info"><strong>{product.name}</strong><small>{formatMoney(product.price, product.currency)} each</small><div className="quantity-control"><button type="button" aria-label={`Remove one ${product.name}`} onClick={() => changeQuantity(product.id, -1)}>−</button><span>{quantity}</span><button type="button" aria-label={`Add one ${product.name}`} onClick={() => addToCart(product)}>+</button></div></div>
                      <strong className="cart-line-total">{formatMoney(product.price * quantity, product.currency)}</strong>
                    </li>
                  ))}
                </ul>
                <div className="cart-summary"><div><span>Product subtotal</span><strong>{formatMoney(subtotal, cartCurrency)}</strong></div><small>The seller confirms delivery and its fee before you pay.</small>{currency !== "NGN" && <small className="currency-estimate">Prices are converted estimates at today&apos;s rate — your order is charged in NGN.</small>}{cartNotice && <p className="checkout-notice" role="alert">{cartNotice}</p>}{checkoutNotice && <p className="checkout-notice" role="status">{checkoutNotice}</p>}{buyerAccount === "buyer" && (<div className="cart-delivery"><label>Delivery phone<input type="tel" inputMode="tel" autoComplete="tel" value={deliveryPhone} onChange={(event) => setDeliveryPhone(event.target.value)} placeholder="0803 000 0000" /></label><label>Delivery address<input type="text" autoComplete="street-address" value={deliveryLocation} onChange={(event) => setDeliveryLocation(event.target.value)} placeholder="Street, city, state" /></label></div>)}<button type="button" className="checkout-button" disabled={checkoutBusy} onClick={() => void placeOrder()}>{checkoutBusy ? "Placing order…" : "Place order"} <span>→</span></button></div>
              </>
            )}
          </aside>
        </div>
      )}
    </main>
  );
}

const promoOffers = [
  { title: "Shop live listings", detail: "Browse products from approved sellers", icon: "🧺", action: "Browse products", href: "#fresh", style: "rose" },
  { title: "Local food businesses", detail: "Meet approved SureFood vendors", icon: "♡", action: "Meet vendors", href: "#top-vendors", style: "cream" },
  { title: "Find a supplier", detail: "Explore approved wholesale suppliers", icon: "📦", action: "View suppliers", href: "#top-suppliers", style: "orange" },
  { title: "Current discounts", detail: "See listings with a seller-set sale price", icon: "％", action: "Browse discounts", href: "#flash-sales", style: "blue" },
  { title: "Limited availability", detail: "Find live listings with low stock", icon: "🥑", action: "See low stock", href: "#limited-stock", style: "coral" },
];

function PromoRail() {
  const railRef = useRef<HTMLDivElement>(null);

  function scrollOffers(direction: -1 | 1) {
    railRef.current?.scrollBy({ left: railRef.current.clientWidth * direction * 0.75, behavior: "smooth" });
  }

  return (
    <section className="promo-rail" aria-label="Explore the marketplace">
      <div className="promo-rail-heading">
        <div><span className="section-kicker">SUREFOOD MARKETPLACE</span><h2>Explore the marketplace</h2></div>
        <div className="slider-buttons">
          <button type="button" aria-label="Scroll offers left" onClick={() => scrollOffers(-1)}>←</button>
          <button type="button" aria-label="Scroll offers right" onClick={() => scrollOffers(1)}>→</button>
        </div>
      </div>
      <div className="promo-rail-track" ref={railRef}>
        {promoOffers.map((offer) => (
          <Link className={`promo-card ${offer.style}`} href={offer.href} key={offer.title}>
            <span className="promo-card-copy"><strong>{offer.title}</strong><small>{offer.detail}</small></span>
            <span className="promo-card-icon" aria-hidden="true">{offer.icon}</span>
            <span className="promo-card-action">{offer.action}<span>→</span></span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function MarketplaceSection({
  id,
  title,
  eyebrow,
  actionLabel,
  products: sectionProducts,
  cards,
  onAdd,
  onDetails,
  savedIds,
  onToggleSave,
  emptyMessage,
  variant = "standard",
}: {
  id: string;
  title: string;
  eyebrow: string;
  actionLabel: string;
  products?: Product[];
  cards?: MarketplaceCard[];
  onAdd?: (product: Product) => void;
  onDetails?: (product: Product) => void;
  savedIds?: Set<string>;
  onToggleSave?: (product: Product) => void;
  emptyMessage: string;
  variant?: "standard" | "flash" | "feature";
}) {
  const sliderRef = useRef<HTMLDivElement>(null);
  const [showAll, setShowAll] = useState(false);

  function scrollCards(direction: -1 | 1) {
    if (sliderRef.current) {
      sliderRef.current.scrollBy({ left: sliderRef.current.clientWidth * direction * 0.8, behavior: "smooth" });
    }
  }

  return (
    <section className={`marketplace-section ${variant}`} id={id}>
      <div className="marketplace-section-heading">
        <div><span className="section-kicker">{eyebrow}</span><h2>{title}{variant === "standard" && <span> ✳</span>}</h2></div>
        <div className="marketplace-section-actions">
          {!showAll && <div className="slider-buttons"><button type="button" aria-label={`Scroll ${title} left`} onClick={() => scrollCards(-1)}>←</button><button type="button" aria-label={`Scroll ${title} right`} onClick={() => scrollCards(1)}>→</button></div>}
          <button type="button" className="see-all-button" aria-expanded={showAll} onClick={() => setShowAll((current) => !current)}>{showAll ? "Show less" : actionLabel} <span>{showAll ? "↑" : "→"}</span></button>
        </div>
      </div>
      {sectionProducts && (showAll
        ? <div className="marketplace-product-grid">{sectionProducts.map((product) => <ProductCard key={product.id} product={product} onAdd={onAdd} onDetails={onDetails} saved={savedIds?.has(product.id)} onToggleSave={onToggleSave} />)}</div>
        : <div className="marketplace-slider" ref={sliderRef}>{sectionProducts.map((product) => <ProductCard key={product.id} product={product} onAdd={onAdd} onDetails={onDetails} saved={savedIds?.has(product.id)} onToggleSave={onToggleSave} />)}</div>)}
      {cards && (showAll
        ? <div className="marketplace-feature-grid">{cards.map((card) => <FeatureCard key={card.id} card={card} />)}</div>
        : <div className="marketplace-slider feature-slider" ref={sliderRef}>{cards.map((card) => <FeatureCard key={card.id} card={card} />)}</div>)}
      {sectionProducts && sectionProducts.length === 0 && <p className="marketplace-empty">{emptyMessage}</p>}
      {cards && cards.length === 0 && <p className="marketplace-empty">{emptyMessage}</p>}
    </section>
  );
}

function LimitedStockSection({ products: sectionProducts, onAdd, onDetails, savedIds, onToggleSave, emptyMessage }: { products: Product[]; onAdd: (product: Product) => void; onDetails: (product: Product) => void; savedIds?: Set<string>; onToggleSave?: (product: Product) => void; emptyMessage: string }) {
  const [showAll, setShowAll] = useState(false);
  const visibleProducts = showAll ? sectionProducts : sectionProducts.slice(0, 6);

  return (
    <section className="marketplace-section limited-stock-section" id="limited-stock">
      <div className="marketplace-section-heading">
        <div><span className="section-kicker">LIVE INVENTORY</span><h2>Limited stock</h2><p>Products with 10 or fewer units currently available.</p></div>
        <button type="button" className="see-all-button" aria-expanded={showAll} onClick={() => setShowAll((current) => !current)}>{showAll ? "Show fewer products" : "See all low-stock products"} <span>{showAll ? "↑" : "→"}</span></button>
      </div>
      <div className="limited-stock-grid">{visibleProducts.map((product) => <ProductCard key={product.id} product={product} onAdd={onAdd} onDetails={onDetails} showStock saved={savedIds?.has(product.id)} onToggleSave={onToggleSave} />)}</div>
      {sectionProducts.length === 0 && <p className="marketplace-empty">{emptyMessage}</p>}
    </section>
  );
}

function FeatureCard({ card }: { card: MarketplaceCard }) {
  return (
    <article className="marketplace-feature-card">
      <div className="feature-card-art">
        {card.imageUrl
          ? <Image src={card.imageUrl} alt={`${card.name} product`} fill sizes="(max-width: 700px) 60vw, 240px" quality={90} className="feature-card-image" />
          : <span>{card.emoji}</span>}
        <small>{card.badge}</small>
      </div>
      <div className="feature-card-info"><h3>{card.name}</h3><p>{card.detail}</p><Link href={card.route}>Visit store <span>→</span></Link></div>
    </article>
  );
}
