"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { firebaseAuth, firebaseConfigured } from "@/lib/firebase/client";
import { formatMarketMoney, productImageUrl } from "@/app/components/marketplace-product";
import { readCartLines, writeCartLines, type CartLine } from "@/app/components/cart-client";
import { ShopFooter, ShopHeader } from "@/app/components/shop-chrome";

type Step = "info" | "shipping" | "review" | "done";

const steps: { id: Step; label: string }[] = [
  { id: "info", label: "Customer Info" },
  { id: "shipping", label: "Shipping & Payments" },
  { id: "review", label: "Product Confirmation" },
];

const countryOptions = ["Nigeria", "Ghana", "Kenya", "South Africa", "United Kingdom", "United States"];

export default function CheckoutPage() {
  const [step, setStep] = useState<Step>("info");
  const [lines, setLines] = useState<CartLine[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("Nigeria");
  const [region, setRegion] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [delivery, setDelivery] = useState<"seller" | "pickup">("seller");
  const [payment, setPayment] = useState<"delivery" | "link">("delivery");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [placed, setPlaced] = useState<{ id: string; sellerName: string; totalMinor: number }[]>([]);

  useEffect(() => {
    setLines(readCartLines());
    if (!firebaseConfigured()) {
      setAuthChecked(true);
      return;
    }
    const stop = onAuthStateChanged(firebaseAuth(), (nextUser) => {
      setUser(nextUser);
      setAuthChecked(true);
      if (nextUser?.email) setEmail((current) => current || nextUser.email!);
      if (nextUser?.displayName) {
        const [first, ...rest] = nextUser.displayName.split(" ");
        setFirstName((current) => current || first);
        setLastName((current) => current || rest.join(" "));
      }
    });
    return stop;
  }, []);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      try {
        const token = await user.getIdToken();
        const response = await fetch("/api/profile", { headers: { authorization: `Bearer ${token}` } });
        if (!response.ok) return;
        const result = await response.json();
        const profile = result.profile ?? {};
        setPhone((current) => current || String(profile.phone ?? ""));
        setAddress((current) => current || String(profile.location ?? ""));
      } catch (reason) {
        console.error("Could not prefill your checkout details.", reason);
      }
    })();
  }, [user]);

  const subtotal = lines.reduce((total, line) => total + line.product.price * line.quantity, 0);
  const currency = lines[0]?.product.currency ?? "NGN";

  function goNext() {
    setError("");
    if (step === "info") {
      if (!/^\S+@\S+\.\S+$/.test(email.trim())) { setError("Enter a valid email address."); return; }
      if (!firstName.trim() || !lastName.trim()) { setError("Enter your first and last name."); return; }
      if (!/^[+()\d\s.-]{7,24}$/.test(phone.trim())) { setError("Enter a valid phone number."); return; }
      if (address.trim().length < 5) { setError("Enter your full delivery address."); return; }
      setStep("shipping");
      return;
    }
    if (step === "shipping") {
      setStep("review");
    }
  }

  async function placeOrder() {
    setError("");
    if (!user) {
      setError("Sign in with a buyer account to place this order.");
      return;
    }
    if (!lines.length) {
      setError("Your basket is empty.");
      return;
    }
    setBusy(true);
    try {
      const token = await user.getIdToken();
      const fullAddress = [address, city, region, country].filter(Boolean).join(", ");
      const checkoutId = crypto.randomUUID();
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({
          checkoutId,
          items: lines.map(({ product, quantity }) => ({ productId: product.id, quantity })),
          phone: phone.trim(),
          deliveryAddress: fullAddress.slice(0, 240),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not place your order.");
      setPlaced(
        (Array.isArray(result.orders) ? result.orders : []).map((order: Record<string, unknown>) => ({
          id: String(order.id ?? ""),
          sellerName: String(order.sellerName ?? "the seller"),
          totalMinor: Number(order.subtotalMinor ?? 0),
        })),
      );
      writeCartLines([]);
      window.dispatchEvent(new Event("surefood-cart-changed"));
      setStep("done");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not place your order.");
    } finally {
      setBusy(false);
    }
  }

  const summary = (
    <aside className="sf-summary">
      <h2>Order Summary</h2>
      <div className="sf-summary-row"><span>Price</span><b>{formatMarketMoney(subtotal, currency)}</b></div>
      <div className="sf-summary-row">
        <span>Delivery</span>
        <b>{delivery === "pickup" ? "Pickup at store" : "Confirmed by seller"}</b>
      </div>
      <div className="sf-summary-row">
        <span>Payment</span>
        <b>{payment === "delivery" ? "On delivery" : "After delivery fee"}</b>
      </div>
      <div className="sf-summary-row is-total"><span>Total Price</span><b>{formatMarketMoney(subtotal, currency)}</b></div>
      {step === "review" ? (
        <button className="sf-btn is-pay is-wide" type="button" onClick={placeOrder} disabled={busy}>
          {busy ? "Placing order…" : "Confirm Order"}
        </button>
      ) : (
        <button className="sf-btn is-pay is-wide" type="button" onClick={goNext}>Next →</button>
      )}
      <Link className="sf-btn is-ghost is-wide" href="/cart" style={{ marginTop: 8 }}>Edit basket</Link>
    </aside>
  );

  if (step === "done") {
    return (
      <div className="sf-page">
        <ShopHeader />
        <main className="sf-shell" style={{ flex: "1 1 auto" }}>
          <div className="sf-success">
            <div className="sf-success-art" aria-hidden="true">📦</div>
            <div className="sf-success-copy">
              <div className="sf-check-mark" aria-hidden="true">✓</div>
              <h1>Your order is successfully placed</h1>
              <p>
                Thank you for shopping with Sure Foodz. {placed.length === 1 ? "Your seller has" : "Your sellers have"} your order
                and will confirm the delivery fee before payment opens.
              </p>
              <div className="sf-success-actions">
                <Link className="sf-btn is-pay" href="/account">Go to dashboard</Link>
                {placed[0] && (
                  <Link className="sf-btn is-ghost" href={`/track-order?id=${encodeURIComponent(placed[0].id)}&email=${encodeURIComponent(email)}`}>
                    View order →
                  </Link>
                )}
              </div>
              {placed.length > 0 && (
                <p style={{ marginTop: 18, fontSize: 11 }}>
                  Order reference: <b>{placed.map((order) => order.id).join(", ")}</b>
                </p>
              )}
            </div>
          </div>
        </main>
        <ShopFooter />
      </div>
    );
  }

  return (
    <div className="sf-page">
      <ShopHeader />
      <main className="sf-shell" style={{ flex: "1 1 auto" }}>
        <nav className="sf-flow-steps" aria-label="Checkout progress">
          <Link href="/">Home</Link><i>/</i>
          <Link href="/cart">Cart</Link><i>/</i>
          <span className={step === "info" ? "is-on" : undefined}>Customer Info</span><i>/</i>
          <span className={step === "shipping" ? "is-on" : undefined}>Shipping &amp; Payments</span><i>/</i>
          <span className={step === "review" ? "is-on" : undefined}>Product Confirmation</span>
        </nav>

        <div className="sf-pagehead">
          <Link
            href={step === "info" ? "/cart" : step === "shipping" ? "/checkout" : "/checkout"}
            className="sf-back"
            onClick={() => { if (step === "shipping") setStep("info"); if (step === "review") setStep("shipping"); }}
            aria-label="Back"
          >←</Link>
          <div className="sf-flow-head" style={{ padding: 0 }}>
            <h1>
              {step === "info" ? "Customer Information" : step === "shipping" ? "Shipping & Payments" : "Product Confirmation"}
            </h1>
            <p>Let&apos;s complete your order.</p>
          </div>
        </div>

        {authChecked && !user && (
          <p className="sf-auth-note" style={{ marginBottom: 14 }}>
            You can fill everything in now. <Link href="/login">Sign in</Link> before the last step to place the order.
          </p>
        )}

        <div className="sf-flow-layout">
          <section>
            {step === "info" && (
              <>
                <div className="sf-block">
                  <h2>Customer information</h2>
                  <div className="sf-field">
                    <label htmlFor="co-email">Email</label>
                    <input id="co-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" autoComplete="email" />
                  </div>
                  <div className="sf-two">
                    <div className="sf-field">
                      <label htmlFor="co-first">First name</label>
                      <input id="co-first" value={firstName} onChange={(event) => setFirstName(event.target.value)} autoComplete="given-name" />
                    </div>
                    <div className="sf-field">
                      <label htmlFor="co-last">Last name</label>
                      <input id="co-last" value={lastName} onChange={(event) => setLastName(event.target.value)} autoComplete="family-name" />
                    </div>
                  </div>
                </div>

                <div className="sf-block">
                  <h2>Shipping address</h2>
                  <div className="sf-field">
                    <label htmlFor="co-country">Country</label>
                    <select id="co-country" className="sf-select" style={{ height: 46, width: "100%" }} value={country} onChange={(event) => setCountry(event.target.value)}>
                      {countryOptions.map((name) => <option key={name} value={name}>{name}</option>)}
                    </select>
                  </div>
                  <div className="sf-two">
                    <div className="sf-field">
                      <label htmlFor="co-region">State / region</label>
                      <input id="co-region" value={region} onChange={(event) => setRegion(event.target.value)} autoComplete="address-level1" />
                    </div>
                    <div className="sf-field">
                      <label htmlFor="co-city">City</label>
                      <input id="co-city" value={city} onChange={(event) => setCity(event.target.value)} autoComplete="address-level2" />
                    </div>
                  </div>
                  <div className="sf-field">
                    <label htmlFor="co-address">Delivery address</label>
                    <input id="co-address" value={address} onChange={(event) => setAddress(event.target.value)} autoComplete="street-address" placeholder="Street, house number, landmark" />
                  </div>
                  <div className="sf-field">
                    <label htmlFor="co-phone">Phone number</label>
                    <input id="co-phone" value={phone} onChange={(event) => setPhone(event.target.value)} type="tel" autoComplete="tel" placeholder="+234 ..." />
                  </div>
                </div>

                {error && <p className="sf-auth-error" role="alert">{error}</p>}
                <button className="sf-btn is-pay" type="button" onClick={goNext}>Next →</button>
              </>
            )}

            {step === "shipping" && (
              <>
                <div className="sf-block">
                  <h2>Delivery</h2>
                  <p className="sf-block-note">Sellers deliver their own food, so the fee is set by the seller after the order.</p>
                  <div style={{ display: "grid", gap: 10 }}>
                    <label className={delivery === "seller" ? "sf-option is-on" : "sf-option"}>
                      <input type="radio" name="delivery" checked={delivery === "seller"} onChange={() => setDelivery("seller")} />
                      <span>
                        <b>Seller delivery</b>
                        <small>Delivered to your address. The seller confirms the fee before you pay.</small>
                      </span>
                    </label>
                    <label className={delivery === "pickup" ? "sf-option is-on" : "sf-option"}>
                      <input type="radio" name="delivery" checked={delivery === "pickup"} onChange={() => setDelivery("pickup")} />
                      <span>
                        <b>Pick up at the store</b>
                        <small>Collect from the seller — no delivery fee at all.</small>
                      </span>
                    </label>
                  </div>
                </div>

                <div className="sf-block">
                  <h2>Payment</h2>
                  <div style={{ display: "grid", gap: 10 }}>
                    <label className={payment === "delivery" ? "sf-option is-on" : "sf-option"}>
                      <input type="radio" name="payment" checked={payment === "delivery"} onChange={() => setPayment("delivery")} />
                      <span>
                        <b>Pay on delivery</b>
                        <small>Pay the seller or rider when the food arrives.</small>
                      </span>
                    </label>
                    <label className={payment === "link" ? "sf-option is-on" : "sf-option"}>
                      <input type="radio" name="payment" checked={payment === "link"} onChange={() => setPayment("link")} />
                      <span>
                        <b>Pay after the delivery fee is confirmed</b>
                        <small>We send a secure Paystack link once the seller adds the fee.</small>
                      </span>
                    </label>
                  </div>
                </div>

                <button className="sf-btn is-pay" type="button" onClick={goNext}>Next →</button>
              </>
            )}

            {step === "review" && (
              <>
                <div className="sf-block">
                  <h2>Shipping information</h2>
                  <div className="sf-spec-row" style={{ gridTemplateColumns: "120px 1fr" }}>
                    <dt>Name</dt><dd>{firstName} {lastName}</dd>
                  </div>
                  <div className="sf-spec-row" style={{ gridTemplateColumns: "120px 1fr" }}>
                    <dt>Email</dt><dd>{email}</dd>
                  </div>
                  <div className="sf-spec-row" style={{ gridTemplateColumns: "120px 1fr" }}>
                    <dt>Address</dt><dd>{[address, city, region, country].filter(Boolean).join(", ")}</dd>
                  </div>
                  <div className="sf-spec-row" style={{ gridTemplateColumns: "120px 1fr" }}>
                    <dt>Phone</dt><dd>{phone}</dd>
                  </div>
                  <div className="sf-spec-row" style={{ gridTemplateColumns: "120px 1fr" }}>
                    <dt>Delivery</dt><dd>{delivery === "pickup" ? "Pick up at the store" : "Seller delivery"}</dd>
                  </div>
                  <div className="sf-spec-row" style={{ gridTemplateColumns: "120px 1fr" }}>
                    <dt>Payment</dt><dd>{payment === "delivery" ? "Pay on delivery" : "Pay after the fee is confirmed"}</dd>
                  </div>
                </div>

                <div className="sf-block">
                  <h2>Your items</h2>
                  <div className="sf-lines">
                    {lines.map((line) => (
                      <div className="sf-line" key={line.product.id} style={{ gridTemplateColumns: "62px minmax(0,1fr) auto" }}>
                        <span className="sf-line-media">
                          {line.product.imageUrl
                            ? <img src={productImageUrl(line.product.imageUrl, 160)} alt={line.product.name} />
                            : <span aria-hidden="true">{line.product.emoji}</span>}
                        </span>
                        <div>
                          <p className="sf-line-name">{line.quantity} × {line.product.name}</p>
                          <span className="sf-line-meta">{line.product.sellerName || line.product.category}</span>
                        </div>
                        <div className="sf-line-total">{formatMarketMoney(line.product.price * line.quantity, line.product.currency)}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {error && <p className="sf-auth-error" role="alert">{error}</p>}
                <button className="sf-btn is-pay" type="button" onClick={placeOrder} disabled={busy}>
                  {busy ? "Placing order…" : "Confirm order →"}
                </button>
              </>
            )}
          </section>
          {summary}
        </div>
      </main>
      <ShopFooter />
    </div>
  );
}
