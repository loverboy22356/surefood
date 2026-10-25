"use client";

import Image from "next/image";
import Link from "next/link";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { User } from "firebase/auth";
import { firebaseAuth, firebaseConfigured } from "@/lib/firebase/client";
import { useLocale } from "@/app/components/locale-provider";
import {
  formatMarketMoney as formatMoney,
  ProductDetailsDialog,
  eventOrderHref,
  apiProductToListing,
  readFavourites,
  writeFavourites,
  type ApiProduct,
  type MarketplaceProduct as Product,
} from "@/app/components/marketplace-product";
import "./home.css";

const homeCategories: { icon: string; name: string; label: string }[] = [
  { icon: "🥬", name: "Fresh vegetables", label: "Vegetables" },
  { icon: "🍎", name: "Fresh fruits", label: "Fruits" },
  { icon: "🌾", name: "Grains & cereals", label: "Grains & Cereals" },
  { icon: "🥔", name: "Tubers & roots", label: "Tubers & Roots" },
  { icon: "🧄", name: "Spices & seasonings", label: "Spices & Seasonings" },
  { icon: "🥚", name: "Dairy & eggs", label: "Dairy & Eggs" },
  { icon: "🍗", name: "Meat & seafood", label: "Meat & Poultry" },
  { icon: "🧺", name: "Pantry essentials", label: "Other Essentials" },
];

type SellerCard = {
  id: string;
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

function categoriesMatch(productCategory: string, selectedCategory: string) {
  const product = productCategory.toLowerCase().trim();
  const selected = selectedCategory.toLowerCase().trim();
  return product === selected ||
    product === selected.replace(/^fresh /, "") ||
    product.replace(/^fresh /, "") === selected;
}

function initialsOf(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

const mapPins = [
  { top: "18%", left: "24%" },
  { top: "34%", left: "56%" },
  { top: "14%", left: "72%" },
  { top: "58%", left: "38%" },
  { top: "46%", left: "84%" },
];

const partners = ["Olam", "farmcrowdy", "DANGOTE", "Nestlé", "Unilever", "PZ Cussons", "NIRSAL", "NNPC", "Flour Mills"];

const deliveryCities = ["Lagos", "Abuja", "Port Harcourt", "Ibadan", "Kano", "Enugu", "Benin City", "Kaduna"];

export default function Home() {
  const router = useRouter();
  const { currency, country, detectedCity } = useLocale();
  const [catalogProducts, setCatalogProducts] = useState<Product[]>([]);
  const [topVendors, setTopVendors] = useState<SellerCard[]>([]);
  const [catalogError, setCatalogError] = useState("");
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
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
  const [locationNotice, setLocationNotice] = useState("");
  const [chosenCity, setChosenCity] = useState("");
  const [locatedLabel, setLocatedLabel] = useState("");
  const [locationMenuOpen, setLocationMenuOpen] = useState(false);
  const itemCount = cart.reduce((total, line) => total + line.quantity, 0);
  const subtotal = cart.reduce((total, line) => total + line.product.price * line.quantity, 0);
  const cartCurrency = cart[0]?.product.currency ?? "NGN";
  const favouriteIds = useMemo(() => new Set(favourites.map((item) => item.id)), [favourites]);
  const visibleProducts = catalogProducts.filter((product) =>
    !selectedCategory || categoriesMatch(product.category, selectedCategory),
  );
  const featuredProducts = visibleProducts.slice(0, 10);
  const categoryStrip = useMemo(
    () => [...homeCategories, ...extraCategories.map((name) => ({ icon: "🏷", name, label: name }))],
    [extraCategories],
  );
  const maxDiscount = useMemo(() => {
    let best = 0;
    for (const product of catalogProducts) {
      if (product.oldPrice && product.oldPrice > product.price) {
        best = Math.max(best, Math.round((1 - product.price / product.oldPrice) * 100));
      }
    }
    return best;
  }, [catalogProducts]);
  const productSellers = useMemo(() => {
    const sellers = new Map<string, SellerCard>();
    for (const product of catalogProducts) {
      if (!product.sellerId || sellers.has(product.sellerId)) continue;
      sellers.set(product.sellerId, {
        id: product.sellerId,
        name: product.sellerName || "SureFood seller",
        detail: [product.sellerCity || product.sellerLocation, product.sellerRole ? `${product.sellerRole[0].toUpperCase()}${product.sellerRole.slice(1)}` : ""].filter(Boolean).join(" · ") || product.category,
        emoji: "🏪",
        ...(product.imageUrl ? { imageUrl: product.imageUrl } : {}),
        badge: "Approved seller",
        route: `/store/${product.sellerId}`,
      });
    }
    return [...sellers.values()];
  }, [catalogProducts]);
  const nearbySellers = topVendors.length > 0 ? topVendors : productSellers;
  const vendorCards = useMemo(() => nearbySellers.slice(0, 5).map((vendor) => {
    const listings = catalogProducts.filter((product) => product.sellerId === vendor.id);
    const cheapest = listings.reduce<Product | null>(
      (current, product) => (!current || product.price < current.price ? product : current),
      null,
    );
    return {
      ...vendor,
      listings: listings.length,
      fromPrice: cheapest ? cheapest.price : null,
      currency: cheapest?.currency ?? "NGN",
    };
  }), [nearbySellers, catalogProducts]);
  const spotlightVendor = vendorCards[0];
  const accountInitials = initialsOf(accountName);
  const countryName = useMemo(() => {
    if (!country) return "";
    try {
      return new Intl.DisplayNames(["en"], { type: "region" }).of(country.toUpperCase()) ?? country;
    } catch {
      return country;
    }
  }, [country]);
  const placeLabel = chosenCity || locatedLabel || countryName || "Set your location";

  useEffect(() => {
    setChosenCity(window.localStorage.getItem("surefood-delivery-city") ?? "");
    const savedLocation = window.localStorage.getItem("surefood-current-location");
    if (savedLocation) setLocatedLabel(savedLocation);
  }, []);

  function chooseCity(city: string) {
    setChosenCity(city);
    setLocationMenuOpen(false);
    window.localStorage.setItem("surefood-delivery-city", city);
    if (city) setLocationNotice(`Showing approved sellers around ${city}.`);
    else setLocationNotice("");
  }

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
        const defaults = new Set(homeCategories.map((category) => category.name.toLowerCase()));
        setExtraCategories((result.categories as string[]).filter((name) => !defaults.has(name.toLowerCase())));
      })
      .catch((reason: unknown) => console.error("Could not load the extra product categories.", reason));
  }, []);

  useEffect(() => {
    let active = true;
    async function loadCatalog() {
      const routes = ["/api/products", "/api/marketplace/sellers?role=vendor"];
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
        setCatalogProducts((productResult.value.products as ApiProduct[]).map(apiProductToListing));
      } else {
        errors.push(productResult.status === "rejected" ? productResult.reason.message : "Live products returned an invalid response.");
      }

      const vendorResult = results[1];
      if (vendorResult.status === "fulfilled" && Array.isArray(vendorResult.value.sellers)) {
        setTopVendors(vendorResult.value.sellers as SellerCard[]);
      } else {
        errors.push(vendorResult.status === "rejected" ? vendorResult.reason.message : "Approved vendors returned an invalid response.");
      }

      setCatalogError(errors.join(" "));
      setCatalogLoading(false);
    }
    void loadCatalog();
    return () => { active = false; };
  }, []);

  function selectCategory(name: string) {
    setSelectedCategory((current) => current === name ? "" : name);
    window.setTimeout(() => {
      document.getElementById("hm-products")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 30);
  }

  async function enableLocation() {
    setLocationMenuOpen(false);
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setLocationNotice("This browser cannot share a location. Pick your city from the location button instead.");
      return;
    }
    setLocationNotice("Finding your location…");
    let settled = false;
    const guard = window.setTimeout(() => {
      if (!settled) setLocationNotice("Your browser is still asking for location. Allow it, or pick your city from the location button.");
    }, 12_000);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        settled = true;
        window.clearTimeout(guard);
        void nameLocatedPlace(position.coords.latitude, position.coords.longitude);
      },
      () => {
        settled = true;
        window.clearTimeout(guard);
        setLocationNotice("Location permission was declined or blocked. Pick your city from the location button instead.");
      },
      { enableHighAccuracy: false, timeout: 12_000, maximumAge: 300_000 },
    );
  }

  /** Turns a GPS fix into a place name, so the label never guesses a city. */
  async function nameLocatedPlace(latitude: number, longitude: number) {
    setLocationNotice("Naming your location…");
    try {
      const response = await fetch(`/api/location?lat=${latitude}&lon=${longitude}`, {
        signal: AbortSignal.timeout(12_000),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "We could not name your location.");
      const city = typeof result.city === "string" && result.city
        ? result.city
        : typeof result.region === "string" ? result.region : "";
      const countryName = typeof result.country === "string" && result.country
        ? new Intl.DisplayNames(["en"], { type: "region" }).of(result.country) ?? ""
        : "";
      const label = [city, countryName].filter(Boolean).join(", ");
      if (!label) throw new Error("We could not name your location.");
      setLocatedLabel(label);
      setChosenCity("");
      window.localStorage.removeItem("surefood-delivery-city");
      window.localStorage.setItem("surefood-current-location", label);
      setLocationNotice(`Location on. Showing approved sellers around ${city || label}.`);
    } catch (reason) {
      setLocationNotice(reason instanceof Error ? reason.message : "We could not name your location.");
    }
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
    setCart((currentCart) => currentCart
      .map((line) => line.product.id === productId ? { ...line, quantity: line.quantity + amount } : line)
      .filter((line) => line.quantity > 0));
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
    <main className="shop-home" data-local-currency>
      <header className="hm-header">
        <div className="hm-shell hm-header-inner">
          <Link className="hm-brand" href="/" aria-label="SureFood home">
            <span className="hm-brand-mark" aria-hidden="true">
              <svg width="21" height="21" viewBox="0 0 24 24" fill="none">
                <path d="M20 3.5C10.6 3.9 4.6 8.6 4.6 16.2c0 1.9.5 3.3.5 3.3 2.6-6.1 7.3-9.9 13-11.4-5 2.3-8.8 6-11.2 11.6 7.6 1 11.9-4 12.6-15.2Z" fill="currentColor" />
              </svg>
            </span>
            <span className="hm-brand-text">
              <strong>SureFood</strong>
              <small>Fresh Food · Better Life</small>
            </span>
          </Link>
          <nav className="hm-nav" aria-label="Main navigation">
            <Link href="/" className="is-active">Home</Link>
            <Link href="/search">Shop</Link>
            <Link href="/signup?role=supplier">Suppliers</Link>
            <Link href="#hm-categories">Categories</Link>
            <Link href="#hm-about">About Us</Link>
            <Link href="#hm-contact">Contact</Link>
          </nav>
          <div className="hm-header-tools">
            <div className="hm-location-wrap">
              <button
                type="button"
                className="hm-location"
                aria-haspopup="listbox"
                aria-expanded={locationMenuOpen}
                onClick={() => setLocationMenuOpen((open) => !open)}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12Z" stroke="currentColor" strokeWidth="1.8" />
                  <circle cx="12" cy="10" r="2.6" stroke="currentColor" strokeWidth="1.8" />
                </svg>
                {placeLabel}
                <span aria-hidden="true">⌄</span>
              </button>
              {locationMenuOpen && (
                <div className="hm-location-menu" role="listbox" aria-label="Choose your delivery city">
                  <button type="button" role="option" aria-selected={!chosenCity} onClick={() => { chooseCity(""); enableLocation(); }}>
                    Use my current location
                  </button>
                  {deliveryCities.map((city) => (
                    <button key={city} type="button" role="option" aria-selected={chosenCity === city} onClick={() => chooseCity(city)}>{city}</button>
                  ))}
                </div>
              )}
            </div>
            <Link className="hm-icon-button" href="/search" aria-label="Search products">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
                <path d="m16.5 16.5 4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </Link>
            <Link className="hm-icon-button" href="/favorites" aria-label={`Favourites, ${favourites.length} saved`}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M12 20s-7.5-4.4-7.5-9.4A4.1 4.1 0 0 1 12 7.6a4.1 4.1 0 0 1 7.5 3C19.5 15.6 12 20 12 20Z" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" />
              </svg>
              {favourites.length > 0 && <i>{favourites.length}</i>}
            </Link>
            <button type="button" className="hm-icon-button" aria-label={`Your cart, ${itemCount} items`} onClick={() => setCartOpen(true)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M3 4h2l2.4 11.2h10.8L20 7H6" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="9.5" cy="19" r="1.5" fill="currentColor" />
                <circle cx="17" cy="19" r="1.5" fill="currentColor" />
              </svg>
              {itemCount > 0 && <i>{itemCount}</i>}
            </button>
            <Link
              className="hm-avatar"
              href={buyerAccount === "guest" ? "/login" : "/account"}
              aria-label={buyerAccount === "guest" ? "Sign in to SureFood" : `Your account, ${accountName || "buyer"}`}
            >
              {buyerAccount === "guest" || !accountInitials ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle cx="12" cy="8.5" r="3.5" stroke="currentColor" strokeWidth="1.9" />
                  <path d="M5 20c.8-3.5 3.6-5.4 7-5.4s6.2 1.9 7 5.4" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
                </svg>
              ) : accountInitials}
            </Link>
          </div>
        </div>
      </header>

      <section className="hm-hero" aria-label="Fresh food for a healthier you">
        <Image
          src="/images/home-produce.png"
          alt="A basket of fresh vegetables and fruit"
          fill
          loading="eager"
          fetchPriority="high"
          sizes="100vw"
          className="hm-hero-image"
        />
        <div className="hm-hero-inner">
          <div className="hm-shell">
            <div className="hm-hero-copy">
              <span className="hm-hero-eyebrow">FARM FRESH · LOCAL · TRUSTED</span>
              <h1>Fresh Food<br />for a <span>Healthier You</span></h1>
              <p>Quality fruits, vegetables, grains and more from trusted local farmers and suppliers.</p>
              <form
                className="hm-hero-search"
                role="search"
                onSubmit={(event) => {
                  event.preventDefault();
                  const term = searchTerm.trim();
                  router.push(term ? `/search?q=${encodeURIComponent(term)}` : "/search");
                }}
              >
                <span aria-hidden="true">⌕</span>
                <input
                  type="search"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search for fresh products, suppliers or categories…"
                  aria-label="Search for fresh products"
                />
                <button type="submit">Search</button>
              </form>
              <ul className="hm-hero-trust">
                <li><span className="hm-trust-icon" aria-hidden="true">📍</span><span><strong>Track Nearby Vendors</strong><small>Find trusted sellers near you</small></span></li>
                <li><span className="hm-trust-icon" aria-hidden="true">🛡</span><span><strong>Secure Payments</strong><small>Pay with confidence</small></span></li>
                <li><span className="hm-trust-icon" aria-hidden="true">🌿</span><span><strong>Fresh &amp; Quality</strong><small>Farm to your table</small></span></li>
              </ul>
            </div>
          </div>
        </div>
        <span className="hm-hero-script" aria-hidden="true">Good Food<br />Good Life</span>
        <Link className="hm-hero-finder" href="#hm-vendors">
          <span className="hm-finder-pin" aria-hidden="true">📍</span>
          <span><strong>Find Nearby Vendors</strong><small>See trusted sellers near you</small></span>
          <b aria-hidden="true">→</b>
        </Link>
      </section>

      <div className="hm-shell">
        <section className="hm-categories" id="hm-categories" aria-label="Shop by category">
          <div className="hm-cat-head">Shop by Category <span aria-hidden="true">→</span></div>
          {categoryStrip.map((category) => (
            <button
              key={category.name}
              type="button"
              className={selectedCategory === category.name ? "hm-cat is-selected" : "hm-cat"}
              aria-pressed={selectedCategory === category.name}
              onClick={() => selectCategory(category.name)}
            >
              <span className="hm-cat-icon" aria-hidden="true">{category.icon}</span>
              {category.label}
            </button>
          ))}
        </section>

        <section className="hm-offer" aria-label="This season's offer">
          <div className="hm-offer-art" aria-hidden="true">
            <Image src="/images/store-banner.jpg" alt="" fill sizes="(max-width: 720px) 100vw, 620px" className="hm-offer-image" />
          </div>
          <div className="hm-offer-copy">
            <span className="hm-offer-pill">SPECIAL OFFER</span>
            <h2>Premium staples, farm-fresh prices</h2>
            <p>Rice, grains and everyday essentials hand-picked from approved local sellers.</p>
            <Link className="hm-offer-cta" href="#hm-products">Shop Now <span aria-hidden="true">→</span></Link>
          </div>
          <span className="hm-offer-badge">
            {maxDiscount > 0 ? <>Up to<strong>{maxDiscount}%</strong>off</> : <>Farm<strong>Fresh</strong>daily</>}
          </span>
        </section>

        {orderNotice && (
          <div className="buyer-order-notice" role="status">
            {orderNotice}
            <Link href="/account?orders=1">View your orders →</Link>
            <button type="button" aria-label="Dismiss order confirmation" onClick={() => setOrderNotice("")}>×</button>
          </div>
        )}
        {buyerOrderNotice && (
          <div className="buyer-order-notice" role="status">
            {buyerOrderNotice}
            <Link href="/account?orders=1">Review and pay →</Link>
            <button type="button" aria-label="Dismiss order notification" onClick={() => setBuyerOrderNotice("")}>×</button>
          </div>
        )}

        <section className="hm-section" id="hm-products">
          <div className="hm-section-head">
            <div>
              <span className="hm-kicker">✦ Featured Products</span>
              <h2>{selectedCategory || "Fresh & Quality Products"}</h2>
              <p>
                {selectedCategory
                  ? <span className="hm-filter-note">{visibleProducts.length} live listing{visibleProducts.length === 1 ? "" : "s"} in {selectedCategory}. <button type="button" onClick={() => setSelectedCategory("")}>Clear filter</button></span>
                  : "Handpicked by trusted local farmers and suppliers."}
              </p>
            </div>
            <Link className="hm-view-all" href="/search">View All Products <span aria-hidden="true">→</span></Link>
          </div>
          {catalogError && <p className="hm-catalog-error" role="alert">{catalogError}</p>}
          {featuredProducts.length > 0 ? (
            <div className="hm-product-grid">
              {featuredProducts.map((product) => (
                <HomeProductCard
                  key={product.id}
                  product={product}
                  saved={favouriteIds.has(product.id)}
                  onAdd={addToCart}
                  onDetails={setSelectedProduct}
                  onToggleSave={toggleFavourite}
                />
              ))}
            </div>
          ) : (
            <p className="hm-empty">
              {catalogLoading ? "Loading live products…" : "No products match this category yet."}
            </p>
          )}
        </section>

        <section className="hm-nearby" id="hm-vendors" aria-label="Nearby vendors">
          <div className="hm-nearby-copy">
            <span className="hm-nearby-pin" aria-hidden="true">📍</span>
            <h2>Find Nearby Vendors</h2>
            <p>Discover trusted sellers near you and compare prices in real time.</p>
            <button type="button" className="hm-nearby-action" onClick={enableLocation}>◎ Enable Location</button>
            <p className="hm-nearby-note">{locationNotice || "Allow location access for the best experience."}</p>
          </div>
          <div className="hm-map" aria-label="Map of nearby approved vendors">
            {mapPins.map((pin, index) => (
              <span className="hm-map-pin" key={`${pin.top}-${pin.left}`} style={{ top: pin.top, left: pin.left }} aria-hidden="true">
                <i>{index + 1}</i>
              </span>
            ))}
            {spotlightVendor && (
              <div className="hm-map-card">
                <span className="hm-map-card-art" aria-hidden="true">
                  {spotlightVendor.imageUrl
                    ? <Image src={spotlightVendor.imageUrl} alt="" fill sizes="40px" />
                    : spotlightVendor.emoji}
                </span>
                <div>
                  <strong>{spotlightVendor.name}</strong>
                  <small>
                    {spotlightVendor.fromPrice !== null
                      ? `From ${formatMoney(spotlightVendor.fromPrice, spotlightVendor.currency)} · ${spotlightVendor.listings} listing${spotlightVendor.listings === 1 ? "" : "s"}`
                      : spotlightVendor.detail}
                  </small>
                </div>
                <Link href={spotlightVendor.route}>View</Link>
              </div>
            )}
          </div>
          <div className="hm-vendor-panel">
            <div className="hm-vendor-head">
              <strong>Nearby Vendors</strong>
              <Link href="/search">View All →</Link>
            </div>
            <ul className="hm-vendor-list">
              {vendorCards.length > 0 ? vendorCards.map((vendor) => (
                <li key={vendor.id}>
                  <Link className="hm-vendor-row" href={vendor.route}>
                    <span className="hm-vendor-art" aria-hidden="true">
                      {vendor.imageUrl ? <Image src={vendor.imageUrl} alt="" fill sizes="32px" /> : vendor.emoji}
                    </span>
                    <div>
                      <strong>{vendor.name}</strong>
                      <small>{vendor.detail}</small>
                    </div>
                    {vendor.fromPrice !== null && <b>{formatMoney(vendor.fromPrice, vendor.currency)}</b>}
                  </Link>
                </li>
              )) : (
                <li className="hm-vendor-empty">
                  {catalogLoading ? "Loading approved vendors…" : "Approved vendors will appear here once they list products."}
                </li>
              )}
            </ul>
          </div>
        </section>

        <section className="hm-promos" aria-label="Why shop with SureFood">
          <Link className="hm-promo" href="#hm-vendors" aria-label="Support local farmers — shop local">
            <Image src="/images/promo-local-farmers.png" alt="Support local farmers: your purchase helps build stronger communities" fill sizes="(max-width: 720px) 100vw, 33vw" />
          </Link>
          <Link className="hm-promo" href="#hm-products" aria-label="Seasonal picks — shop now">
            <Image src="/images/promo-seasonal-picks.png" alt="Seasonal picks: fresh, natural and in season" fill sizes="(max-width: 720px) 100vw, 33vw" />
          </Link>
          <Link className="hm-promo" href="#hm-about" aria-label="Quality you can trust — learn more">
            <Image src="/images/promo-quality.png" alt="Quality you can trust: freshness, safety and real quality" fill sizes="(max-width: 720px) 100vw, 33vw" />
          </Link>
        </section>

        <section className="hm-partners" aria-label="Our trusted partners">
          <div className="hm-partners-head">
            <strong>Our Trusted Partners</strong>
            <small>Working together for a healthier and stronger community.</small>
          </div>
          <div className="hm-partner-track">
            {partners.map((partner) => <span key={partner}>{partner}</span>)}
          </div>
        </section>
      </div>

      <footer className="hm-footer" id="hm-about">
        <div className="hm-shell">
          <div className="hm-footer-top">
            <Link className="hm-brand" href="/" aria-label="SureFood home">
              <span className="hm-brand-mark" aria-hidden="true">
                <svg width="21" height="21" viewBox="0 0 24 24" fill="none">
                  <path d="M20 3.5C10.6 3.9 4.6 8.6 4.6 16.2c0 1.9.5 3.3.5 3.3 2.6-6.1 7.3-9.9 13-11.4-5 2.3-8.8 6-11.2 11.6 7.6 1 11.9-4 12.6-15.2Z" fill="currentColor" />
                </svg>
              </span>
              <span className="hm-brand-text"><strong>SureFood</strong><small>Fresh Food · Better Life</small></span>
            </Link>
            <nav className="hm-footer-links" aria-label="Footer navigation">
              <Link href="/">Home</Link>
              <Link href="/search">Shop</Link>
              <Link href="/signup?role=supplier">Suppliers</Link>
              <Link href="#hm-categories">Categories</Link>
              <Link href="#hm-about">About Us</Link>
              <Link href="/pay-later">Pay later</Link>
              <Link href="/special-orders">Event orders</Link>
              <Link href="#hm-contact">Contact</Link>
            </nav>
            <div className="hm-footer-social" aria-label="SureFood on social media">
              <span aria-hidden="true">f</span>
              <span aria-hidden="true">◎</span>
              <span aria-hidden="true">▶</span>
              <span aria-hidden="true">in</span>
            </div>
          </div>
          <div className="hm-footer-bottom" id="hm-contact">
            <span>© {new Date().getFullYear()} SureFood. All rights reserved.</span>
            <span><Link href="/signup?role=vendor">Sell on SureFood</Link><Link href="/signup?role=supplier">Supplier portal</Link></span>
          </div>
        </div>
      </footer>

      {selectedProduct && (
        <ProductDetailsDialog
          key={selectedProduct.id}
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onAdd={addToCart}
          saved={favouriteIds.has(selectedProduct.id)}
          onToggleSave={toggleFavourite}
          onEventOrder={(product, quantity) => router.push(eventOrderHref(product, quantity))}
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

function HomeProductCard({
  product,
  saved,
  onAdd,
  onDetails,
  onToggleSave,
}: {
  product: Product;
  saved: boolean;
  onAdd: (product: Product) => void;
  onDetails: (product: Product) => void;
  onToggleSave: (product: Product) => void;
}) {
  const stock = product.stock ?? 0;
  const outOfStock = Boolean(product.liveListing) && stock <= 0;
  const discount = product.oldPrice && product.oldPrice > product.price
    ? Math.round((1 - product.price / product.oldPrice) * 100)
    : 0;
  const badge = discount > 0
    ? { label: "Sale", tone: "sale" }
    : stock > 0 && stock <= 10
      ? { label: "Low stock", tone: "low" }
      : product.tag === "LIVE LISTING"
        ? { label: "Fresh", tone: "fresh" }
        : { label: product.tag, tone: "" };
  const sellerLine = [product.sellerName, product.sellerLocation || product.sellerCity].filter(Boolean).join(" · ");

  return (
    <article className="hm-product" onClick={() => onDetails(product)}>
      <div className="hm-product-media">
        <span className={`hm-product-badge ${badge.tone}`}>{badge.label}</span>
        <button
          type="button"
          className={saved ? "hm-product-save saved" : "hm-product-save"}
          aria-label={`${saved ? "Remove" : "Save"} ${product.name} ${saved ? "from" : "to"} favourites`}
          aria-pressed={saved}
          onClick={(event) => { event.stopPropagation(); onToggleSave(product); }}
        >♥</button>
        {product.imageUrl
          ? <Image src={product.imageUrl} alt={product.name} fill quality={90} sizes="(max-width: 720px) 45vw, (max-width: 1120px) 24vw, 230px" />
          : <span className="hm-product-emoji" aria-hidden="true">{product.emoji}</span>}
      </div>
      <div className="hm-product-body">
        <h3>{product.name}</h3>
        <p className="hm-product-seller">{sellerLine || product.category}</p>
        <div className="hm-product-price">
          <strong>{formatMoney(product.price, product.currency)}</strong>
          {product.oldPrice && <del>{formatMoney(product.oldPrice, product.currency)}</del>}
          {discount > 0 && <span className="hm-product-off">-{discount}%</span>}
        </div>
        <button
          type="button"
          className="hm-add"
          disabled={outOfStock}
          onClick={(event) => { event.stopPropagation(); onAdd(product); }}
        >
          <span aria-hidden="true">🛒</span>{outOfStock ? "Out of stock" : "Add to Cart"}
        </button>
      </div>
    </article>
  );
}
