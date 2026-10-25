"use client";

import Link from "next/link";
import { onAuthStateChanged, type User } from "firebase/auth";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { firebaseAuth, firebaseConfigured } from "@/lib/firebase/client";

type AccountRole = "buyer" | "vendor" | "supplier";

type AccountProfile = {
  displayName: string;
  email: string;
  role: AccountRole;
  phone?: string;
  location?: string;
  verificationStatus?: string;
};

type BuyerOrder = {
  id: string;
  sellerName: string;
  sellerRole: string;
  items: { name: string; quantity: number }[];
  subtotalMinor: number;
  deliveryFeeMinor: number | null;
  totalMinor: number;
  currency: string;
  status: string;
  paymentStatus: string;
  paymentAuthorizationUrl?: string;
  createdAt?: string;
};

function formatOrderMoney(amountMinor: number, currency: string) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: currency || "NGN",
    maximumFractionDigits: 2,
  }).format(amountMinor / 100);
}

export default function AccountPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [profileError, setProfileError] = useState("");
  const [profileMissing, setProfileMissing] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [phone, setPhone] = useState("");
  const [location, setLocation] = useState("");
  const [orders, setOrders] = useState<BuyerOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState("");
  const [payingOrderId, setPayingOrderId] = useState("");
  const [orderNotice, setOrderNotice] = useState("");

  /**
   * Loads the stored profile for a signed-in customer. A 401 usually means the
   * cached ID token is stale or was revoked, so we refresh it once before
   * showing anything: asking a signed-in customer to sign in again is the last
   * resort, not the first answer.
   */
  const loadProfile = useCallback(async (currentUser: User, forceRefresh = false) => {
    setProfileError("");
    setProfileMissing(false);
    setLoadingProfile(true);
    const request = async (refresh: boolean) => {
      const token = await currentUser.getIdToken(refresh);
      return fetch("/api/profile", {
        headers: { authorization: `Bearer ${token}` },
        cache: "no-store",
      });
    };
    try {
      let response = await request(forceRefresh);
      if (response.status === 401 && !forceRefresh) response = await request(true);
      const result = await response.json();
      if (response.status === 404) {
        setProfileMissing(true);
        return null;
      }
      if (!response.ok) throw new Error(result.error || "We could not load your account details.");
      const accountProfile = result.profile as AccountProfile;
      setProfile(accountProfile);
      setPhone(accountProfile.phone ?? "");
      setLocation(accountProfile.location ?? "");
      return accountProfile;
    } catch (reason) {
      setProfileError(reason instanceof Error ? reason.message : "We could not load your account details just now.");
      return null;
    } finally {
      setLoadingProfile(false);
    }
  }, []);

  useEffect(() => {
    if (!firebaseConfigured()) {
      setProfileError("This site is not connected to its accounts service yet. Try again later.");
      setLoading(false);
      return;
    }

    let active = true;
    let orderRefreshInterval: number | undefined;
    let previousPayableOrderIds = new Set<string>();
    const loadOrders = async (currentUser: User) => {
      setOrdersLoading(true);
      try {
        const token = await currentUser.getIdToken();
        const response = await fetch("/api/orders", { headers: { authorization: `Bearer ${token}` } });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Could not load your orders.");
        if (active) {
          const nextOrders = result.orders as BuyerOrder[];
          const nextPayableOrderIds = new Set(nextOrders.filter((order) => order.status === "Awaiting buyer payment").map((order) => order.id));
          if ([...nextPayableOrderIds].some((id) => !previousPayableOrderIds.has(id))) {
            setOrderNotice("A seller has confirmed the delivery fee. Your order is ready for payment.");
          }
          previousPayableOrderIds = nextPayableOrderIds;
          setOrders(nextOrders);
        }
      } catch (reason) {
        if (active) setOrdersError(reason instanceof Error ? reason.message : "Could not load your orders.");
      } finally {
        if (active) setOrdersLoading(false);
      }
    };
    const unsubscribe = onAuthStateChanged(firebaseAuth(), async (currentUser) => {
      if (!active) return;
      setUser(currentUser);
      if (!currentUser) {
        router.replace("/login");
        setLoading(false);
        return;
      }

      const accountProfile = await loadProfile(currentUser);
      if (active && accountProfile) {
        await loadOrders(currentUser);
        orderRefreshInterval = window.setInterval(() => void loadOrders(currentUser), 20_000);
      }
      if (active) setLoading(false);
    });
    return () => {
      active = false;
      unsubscribe();
      if (orderRefreshInterval !== undefined) window.clearInterval(orderRefreshInterval);
    };
  }, [router, loadProfile]);

  useEffect(() => {
    const shouldFocusOrders = new URLSearchParams(window.location.search).get("orders") === "1";
    if (shouldFocusOrders) document.getElementById("buyer-orders")?.scrollIntoView({ behavior: "smooth" });
    if (new URLSearchParams(window.location.search).get("payment") === "success") {
      setOrderNotice("Paystack confirmed your payment. Your seller has been notified to prepare the order.");
    } else if (new URLSearchParams(window.location.search).get("payment") === "cancelled") {
      setOrderNotice("Payment was not completed. Your order remains available for payment.");
    }
  }, [ordersLoading]);

  async function saveBuyerDetails(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ phone, location }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not save your details.");
      setProfile(result.profile as AccountProfile);
      setPhone(result.profile.phone ?? "");
      setLocation(result.profile.location ?? "");
      setNotice("Your phone and delivery address have been saved.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save your details.");
    } finally {
      setSaving(false);
    }
  }

  async function payForOrder(order: BuyerOrder) {
    if (!user) return;
    setPayingOrderId(order.id);
    setOrdersError("");
    setOrderNotice("");
    try {
      if (order.paymentStatus === "pending" && order.paymentAuthorizationUrl) {
        window.location.assign(order.paymentAuthorizationUrl);
        return;
      }
      const token = await user.getIdToken();
      const response = await fetch("/api/payments/initialize", {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ orderId: order.id }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not start secure checkout.");
      if (typeof result.authorizationUrl !== "string") throw new Error("Paystack did not return a checkout link.");
      window.location.assign(result.authorizationUrl);
    } catch (reason) {
      setOrdersError(reason instanceof Error ? reason.message : "Could not start secure checkout.");
      setPayingOrderId("");
    }
  }

  if (loading) return <main className="business-loading">Loading your profile…</main>;
  if (!user) return <main className="business-loading">{error || "Taking you to sign in…"}</main>;

  const displayName = profile?.displayName || user.displayName || "SureFood customer";
  const email = profile?.email || user.email || "Email unavailable";

  return (
    <main className="account-page">
      <header className="account-header">
        <Link href="/" className="account-brand"><span className="brand-mark">s</span><span>sure<span>food</span></span></Link>
        <Link href="/" className="account-back">Back to shop</Link>
      </header>
      <section className="account-card">
        <span className="account-kicker">YOUR SUREFOOD ACCOUNT</span>
        <div className="account-avatar" aria-hidden="true">{displayName.slice(0, 1).toUpperCase()}</div>
        <h1>{displayName}</h1>
        <p className="account-email">{email}</p>
        {profile && error && <p className="account-error" role="alert">{error}</p>}
        {profile ? (
          <>
            <dl className="account-details">
              <div><dt>Account type</dt><dd>{profile.role}</dd></div>
              {profile.role !== "buyer" && profile.verificationStatus && (
                <div><dt>Business verification</dt><dd>{profile.verificationStatus.replaceAll("_", " ")}</dd></div>
              )}
            </dl>
            {profile.role === "buyer" ? (
              <form className="account-contact-form" onSubmit={saveBuyerDetails}>
                <p>Add and keep your phone number and delivery address current. Sellers use these details to arrange delivery.</p>
                <label htmlFor="buyer-phone">Phone number</label>
                <input
                  id="buyer-phone"
                  type="tel"
                  autoComplete="tel"
                  maxLength={24}
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="+234 800 000 0000"
                  required
                />
                <label htmlFor="buyer-location">Delivery address</label>
                <textarea
                  id="buyer-location"
                  autoComplete="street-address"
                  maxLength={240}
                  value={location}
                  onChange={(event) => setLocation(event.target.value)}
                  placeholder="Street address, area, city, and any delivery directions"
                  rows={3}
                  required
                />
                <button className="account-save-button" type="submit" disabled={saving}>
                  {saving ? "Saving…" : "Save contact details"}
                </button>
                {notice && <p className="account-success" role="status">{notice}</p>}
              </form>
            ) : (
              <dl className="account-details">
                <div><dt>Phone</dt><dd>{profile.phone || "Not provided"}</dd></div>
                <div><dt>Business location</dt><dd>{profile.location || "Not provided"}</dd></div>
              </dl>
            )}
            {profile?.role === "buyer" && <section className="buyer-orders" id="buyer-orders">
              <div className="buyer-orders-heading"><h2>Your orders</h2><span>Delivery is set by each seller. Pay only after they confirm the fee.</span></div>
              {ordersError && <p className="account-error" role="alert">{ordersError}</p>}
              {orderNotice && <p className="account-success" role="status">{orderNotice}</p>}
              {ordersLoading && orders.length === 0 ? <p className="buyer-orders-empty">Loading your orders…</p>
                : orders.length === 0 ? <p className="buyer-orders-empty">No orders yet. Products you order will appear here.</p>
                  : <ul className="buyer-order-list">{orders.map((order) => (
                    <li className="buyer-order-card" key={order.id}>
                      <div className="buyer-order-header"><strong>{order.sellerName}</strong><span className={`buyer-order-status ${order.status.toLowerCase().replaceAll(" ", "-")}`}>{order.status}</span></div>
                      <p>{order.items.map((item) => `${item.quantity} × ${item.name}`).join(", ")}</p>
                      <dl><div><dt>Items</dt><dd>{formatOrderMoney(order.subtotalMinor, order.currency)}</dd></div><div><dt>Delivery fee</dt><dd>{order.deliveryFeeMinor === null || order.deliveryFeeMinor === undefined ? "Seller confirming…" : formatOrderMoney(order.deliveryFeeMinor, order.currency)}</dd></div><div><dt>Total</dt><dd>{order.deliveryFeeMinor === null || order.deliveryFeeMinor === undefined ? "Pending delivery fee" : formatOrderMoney(order.totalMinor, order.currency)}</dd></div></dl>
                      {order.status === "Pending seller confirmation" && <p className="buyer-order-waiting" role="status">Waiting for {order.sellerName} to confirm the delivery fee. Checkout opens for payment the moment they add it, and we will notify you here.</p>}
                      {order.status === "Awaiting buyer payment" && order.paymentStatus !== "paid" && <p className="buyer-order-ready" role="status">Delivery fee confirmed. Payment is now open for this order.</p>}
                      {order.status === "Awaiting buyer payment" && order.paymentStatus !== "paid" && <button className="account-save-button" type="button" disabled={payingOrderId === order.id} onClick={() => void payForOrder(order)}>{payingOrderId === order.id ? "Opening secure checkout…" : order.paymentStatus === "pending" ? "Continue Paystack payment" : "Pay securely with Paystack"}</button>}
                      {order.paymentStatus === "paid" && <p className="buyer-order-paid">Payment confirmed. The seller can prepare your order.</p>}
                    </li>
                  ))}</ul>}
            </section>}
          </>
        ) : (
          <div className="account-recovery" role="status">
            <p>
              {profileMissing
                ? "You are signed in, but this account has no SureFood profile yet. Finish setting it up to start ordering."
                : profileError || "We could not load your account details just now."}
            </p>
            <div className="account-recovery-actions">
              {profileMissing ? (
                <Link className="account-save-button" href="/signup">Finish account setup</Link>
              ) : (
                <button
                  className="account-save-button"
                  type="button"
                  disabled={loadingProfile}
                  onClick={() => user && void loadProfile(user, true)}
                >
                  {loadingProfile ? "Trying again…" : "Try again"}
                </button>
              )}
            </div>
          </div>
        )}
        {(profile?.role === "vendor" || profile?.role === "supplier") && (
          <Link className="account-workspace-link" href={profile.verificationStatus === "approved" ? `/${profile.role}` : "/onboarding"}>
            {profile.verificationStatus === "approved" ? "Open your workspace" : "Continue business verification"} →
          </Link>
        )}
        <Link className="account-shop-link" href="/">Continue shopping</Link>
      </section>
    </main>
  );
}
