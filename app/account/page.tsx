"use client";

import Image from "next/image";
import Link from "next/link";
import { onAuthStateChanged, sendPasswordResetEmail, signOut, type User } from "firebase/auth";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { firebaseAuth, firebaseConfigured } from "@/lib/firebase/client";
import { readFavourites } from "@/app/components/marketplace-product";
import { ThemeToggle } from "@/app/components/theme-toggle";
import "./account.css";

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

type OrderSummary = {
  total: number;
  active: number;
  delivered: number;
  paid: number;
  awaitingPayment: number;
};

type IconName = "user" | "mail" | "phone" | "pin" | "clock" | "basket" | "check" | "star" | "receipt" | "gear" | "lock" | "heart" | "sparkle" | "signout" | "headset" | "camera";

const iconPaths: Record<IconName, string> = {
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-8 8a8 8 0 0 1 16 0",
  mail: "M3 6h18v12H3zM3 7l9 6 9-6",
  phone: "M6 3h3l2 4-2 2a12 12 0 0 0 6 6l2-2 4 2v3a2 2 0 0 1-2 2A16 16 0 0 1 4 5a2 2 0 0 1 2-2Z",
  pin: "M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11Zm0-8.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-13v5l3.5 2",
  basket: "M4 8h16l-2 9H6L4 8Zm4-1 4 10 4-10",
  check: "M4 12.5 9.5 18 20 6",
  star: "M12 3.5l2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 10l6.1-.9L12 3.5Z",
  receipt: "M6 3h12v18l-3-2-3 2-3-2-3 2V3Zm3 5h6M9 12h6",
  gear: "M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm8-3.5a8 8 0 0 0-.2-1.7l2-1.5-2-3.4-2.3 1a8 8 0 0 0-2.9-1.7L14.2 2h-4l-.4 2.7a8 8 0 0 0-2.9 1.7l-2.3-1-2 3.4 2 1.5a8 8 0 0 0 0 3.4l-2 1.5 2 3.4 2.3-1a8 8 0 0 0 2.9 1.7l.4 2.7h4l.4-2.7a8 8 0 0 0 2.9-1.7l2.3 1 2-3.4-2-1.5c.1-.5.2-1.1.2-1.7Z",
  lock: "M6 11h12v10H6zM9 11V8a3 3 0 0 1 6 0v3",
  heart: "M12 20s-7-4.4-7-9.3A4 4 0 0 1 12 8a4 4 0 0 1 7 2.7C19 15.6 12 20 12 20Z",
  sparkle: "M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3Zm6 9.5.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9.9-2.1Z",
  signout: "M15 4h4v16h-4M10 8l-4 4 4 4M6 12h9",
  headset: "M4 14v-2a8 8 0 0 1 16 0v2M4 14h3v6H5a1 1 0 0 1-1-1v-5Zm16 0h-3v6h2a1 1 0 0 0 1-1v-5Z",
  camera: "M4 8.5h3L8.5 6h7L17 8.5h3v10.5H4zM12 16.4a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Z",
};

function Icon({ name, className }: { name: IconName; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={iconPaths[name]} />
    </svg>
  );
}

const roleLabels: Record<AccountRole, string> = {
  buyer: "Buyer",
  vendor: "Vendor",
  supplier: "Supplier",
};

function formatOrderMoney(amountMinor: number, currency: string) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: currency || "NGN",
    maximumFractionDigits: 2,
  }).format(amountMinor / 100);
}

function memberSinceLabel(user: User) {
  const raw = user.metadata?.creationTime;
  const date = raw ? new Date(raw) : null;
  if (!date || Number.isNaN(date.getTime())) return "New member";
  return date.toLocaleDateString("en-NG", { month: "short", year: "numeric" });
}

function verificationLabel(profile: AccountProfile) {
  if (profile.role === "buyer") return "SureFood member";
  if (profile.verificationStatus === "approved") return "Verified";
  return (profile.verificationStatus || "verification pending").replaceAll("_", " ");
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
  const [editing, setEditing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [orders, setOrders] = useState<BuyerOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState("");
  const [payingOrderId, setPayingOrderId] = useState("");
  const [orderNotice, setOrderNotice] = useState("");
  const [orderSummary, setOrderSummary] = useState<OrderSummary | null>(null);
  const [memberSince, setMemberSince] = useState<string | null>(null);
  const [savedCount, setSavedCount] = useState(0);

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
      setMemberSince(typeof result.memberSince === "string" ? result.memberSince : null);
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
          setOrderSummary((result.summary as OrderSummary | undefined) ?? null);
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
    setSavedCount(readFavourites().length);
  }, []);

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
      setEditing(false);
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

  async function sendPasswordReset() {
    try {
      setResetting(true);
      await sendPasswordResetEmail(firebaseAuth(), email);
      setNotice(`We sent a password reset link to ${email}.`);
      setError("");
    } catch {
      setError("We could not send the password reset email just now. Please try again.");
    } finally {
      setResetting(false);
    }
  }

  async function logOut() {
    setSigningOut(true);
    setMenuOpen(false);
    try {
      await signOut(firebaseAuth());
      router.replace("/");
    } catch {
      setSigningOut(false);
      setError("We could not sign you out just now. Please try again.");
    }
  }

  if (loading) {
    return (
      <main className="acct-page">
        <div className="acct-loading">Loading your profile…</div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="acct-page">
        <div className="acct-loading">{error || "Taking you to sign in…"}</div>
      </main>
    );
  }

  const displayName = profile?.displayName || user.displayName || "SureFood customer";
  const email = profile?.email || user.email || "Email unavailable";
  const role = profile?.role;
  const initial = displayName.slice(0, 1).toUpperCase();
  const activeOrders = orderSummary?.active ?? 0;
  const deliveredOrders = orderSummary?.delivered ?? 0;
  const totalOrders = orderSummary?.total ?? orders.length;
  const joinedLabel = memberSince
    ? new Date(memberSince).toLocaleDateString("en-NG", { month: "short", year: "numeric" })
    : memberSinceLabel(user);
  const buyer = profile?.role === "buyer";

  return (
    <main className="acct-page">
      <header className="acct-topbar">
        <Link href="/" className="brand acct-brand">
          <span className="brand-mark">s</span>
          <span>sure<span>food</span></span>
        </Link>
        <div className="acct-topbar-actions">
          <Link className="acct-top-link" href="/">Shop</Link>
          <Link className="acct-top-link" href="/favorites">Favourites</Link>
          <div className="acct-user">
            <button
              type="button"
              className="acct-user-button"
              aria-label={`Account menu for ${displayName}`}
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              onClick={() => setMenuOpen((open) => !open)}
            >
              <span className="acct-user-avatar" aria-hidden="true">{initial}</span>
              <span className="acct-user-copy">
                <strong>{displayName}</strong>
                <small>{role ? roleLabels[role] : "Account"}</small>
              </span>
              <span className="acct-user-chevron" aria-hidden="true">⌄</span>
            </button>
            {menuOpen && (
              <>
                <button type="button" className="acct-menu-scrim" aria-label="Close menu" onClick={() => setMenuOpen(false)} />
                <div className="acct-menu" role="menu">
                  <Link role="menuitem" href="/account#buyer-orders" onClick={() => setMenuOpen(false)}>My orders</Link>
                  <Link role="menuitem" href="/favorites" onClick={() => setMenuOpen(false)}>Saved items</Link>
                  <Link role="menuitem" href="/affiliate" onClick={() => setMenuOpen(false)}>Affiliate programme</Link>
                  <Link role="menuitem" href="/pay-later" onClick={() => setMenuOpen(false)}>Pay later</Link>
                  <button role="menuitem" type="button" className="acct-menu-signout" onClick={() => void logOut()} disabled={signingOut}>
                    {signingOut ? "Signing out…" : "Log out"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      <div className="acct-shell">
        {!profile ? (
          <div className="acct-recovery" role="status">
            <p>
              {profileMissing
                ? "You are signed in, but this account has no SureFood profile yet. Finish setting it up to start ordering."
                : profileError || "We could not load your account details just now."}
            </p>
            <div className="acct-recovery-actions">
              {profileMissing ? (
                <Link className="acct-button" href="/signup">Finish account setup</Link>
              ) : (
                <button className="acct-button" type="button" disabled={loadingProfile} onClick={() => user && void loadProfile(user, true)}>
                  {loadingProfile ? "Trying again…" : "Try again"}
                </button>
              )}
              <button className="acct-button acct-button-ghost" type="button" onClick={() => void logOut()} disabled={signingOut}>
                {signingOut ? "Signing out…" : "Log out"}
              </button>
            </div>
          </div>
        ) : (
          <>
            <section className="acct-hero">
              <div className="acct-hero-body">
                <div className="acct-hero-avatar" aria-hidden="true">
                  {initial}
                  <span className="acct-hero-cam"><Icon name="camera" /></span>
                </div>
                <div className="acct-hero-copy">
                  <span className="acct-pill">{profile.verificationStatus === "approved" ? "✓ " : ""}{verificationLabel(profile)}</span>
                  <h1>{displayName}</h1>
                  <p className="acct-hero-meta"><Icon name="mail" /> {email}</p>
                  <p className="acct-hero-meta"><Icon name="pin" /> {profile.location || "Add your location"}</p>
                  <p className="acct-hero-note">
                    {buyer
                      ? "Fresh food, delivered with care. Keep your details current so sellers can reach you."
                      : "Manage your SureFood business account, orders and verification in one place."}
                  </p>
                </div>
              </div>
              <div className="acct-hero-aside">
                <button className="acct-hero-edit" type="button" onClick={() => { setEditing(true); document.getElementById("acct-details")?.scrollIntoView({ behavior: "smooth" }); }}>
                  ✎ Edit profile
                </button>
                <div className="acct-hero-art" aria-hidden="true">
                  <Image src="/images/home-produce.png" alt="" fill sizes="320px" />
                </div>
              </div>
            </section>

            <ul className="acct-stats">
              <li>
                <span className="acct-stat-icon is-violet"><Icon name="basket" /></span>
                <div><small>Total orders</small><strong>{totalOrders}</strong><em>{activeOrders > 0 ? `${activeOrders} in progress` : "All caught up"}</em></div>
              </li>
              <li>
                <span className="acct-stat-icon is-green"><Icon name="check" /></span>
                <div><small>Delivered</small><strong>{deliveredOrders}</strong><em>{totalOrders ? "Received" : "No orders yet"}</em></div>
              </li>
              <li>
                <span className="acct-stat-icon is-amber"><Icon name="star" /></span>
                <div><small>Saved items</small><strong><Link href="/favorites">{savedCount}</Link></strong><em>{savedCount ? "Your favourites" : "Nothing saved yet"}</em></div>
              </li>
              <li>
                <span className="acct-stat-icon is-blue"><Icon name="clock" /></span>
                <div><small>Member since</small><strong>{joinedLabel}</strong><em>{role ? roleLabels[role] : "Account"}</em></div>
              </li>
            </ul>

            <div className="acct-columns">
              <div className="acct-column">
                <section className="acct-card" id="acct-details">
                  <header className="acct-card-head">
                    <span className="acct-card-icon"><Icon name="user" /></span>
                    <div><h2>Personal information</h2><p>Your basic account details.</p></div>
                    {buyer && !editing && (
                      <button className="acct-card-action" type="button" onClick={() => setEditing(true)}>✎ Edit</button>
                    )}
                  </header>

                  {error && <p className="acct-alert" role="alert">{error}</p>}
                  {notice && <p className="acct-notice" role="status">{notice}</p>}

                  {buyer && editing ? (
                    <form className="acct-form" onSubmit={saveBuyerDetails}>
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
                      <div className="acct-form-actions">
                        <button className="acct-button" type="submit" disabled={saving}>
                          {saving ? "Saving…" : "Save changes"}
                        </button>
                        <button className="acct-button acct-button-ghost" type="button" onClick={() => setEditing(false)} disabled={saving}>
                          Cancel
                        </button>
                      </div>
                    </form>
                  ) : (
                    <dl className="acct-info-list">
                      <div><dt><Icon name="user" /> Full name</dt><dd>{displayName}</dd></div>
                      <div><dt><Icon name="mail" /> Email address</dt><dd>{email}</dd></div>
                      <div><dt><Icon name="phone" /> Phone number</dt><dd>{profile.phone || "Not provided"}</dd></div>
                      <div><dt><Icon name="pin" /> {buyer ? "Delivery address" : "Business location"}</dt><dd>{profile.location || "Not provided"}</dd></div>
                      <div><dt><Icon name="clock" /> Member since</dt><dd>{joinedLabel}</dd></div>
                      {role !== "buyer" && (
                        <div><dt><Icon name="check" /> Business verification</dt><dd className="acct-capitalise">{verificationLabel(profile)}</dd></div>
                      )}
                    </dl>
                  )}

                  {(role === "vendor" || role === "supplier") && (
                    <Link className="acct-wide-link" href={profile.verificationStatus === "approved" ? `/${role}` : "/onboarding"}>
                      {profile.verificationStatus === "approved" ? "Open your workspace" : "Continue business verification"} <span aria-hidden="true">→</span>
                    </Link>
                  )}
                </section>

                {buyer && (
                  <section className="acct-card" id="buyer-orders">
                    <header className="acct-card-head">
                      <span className="acct-card-icon"><Icon name="receipt" /></span>
                      <div><h2>Your orders</h2><p>Delivery is set by each seller. Pay once they confirm the fee.</p></div>
                      <Link className="acct-card-action" href="/">Shop more</Link>
                    </header>
                    {ordersError && <p className="acct-alert" role="alert">{ordersError}</p>}
                    {orderNotice && <p className="acct-notice" role="status">{orderNotice}</p>}
                    {ordersLoading && orders.length === 0 ? (
                      <p className="acct-empty">Loading your orders…</p>
                    ) : orders.length === 0 ? (
                      <p className="acct-empty">No orders yet. Products you order will appear here.</p>
                    ) : (
                      <ul className="acct-order-list">
                        {orders.map((order) => (
                          <li className="acct-order" key={order.id}>
                            <div className="acct-order-top">
                              <div>
                                <strong>{order.sellerName}</strong>
                                <small>{order.createdAt ? new Date(order.createdAt).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" }) : "Just now"}</small>
                              </div>
                              <span className={`acct-order-status ${order.status.toLowerCase().replaceAll(" ", "-")}`}>{order.status}</span>
                            </div>
                            <p className="acct-order-items">{order.items.map((item) => `${item.quantity} × ${item.name}`).join(", ")}</p>
                            <dl className="acct-order-totals">
                              <div><dt>Items</dt><dd>{formatOrderMoney(order.subtotalMinor, order.currency)}</dd></div>
                              <div><dt>Delivery fee</dt><dd>{order.deliveryFeeMinor === null || order.deliveryFeeMinor === undefined ? "Seller confirming…" : formatOrderMoney(order.deliveryFeeMinor, order.currency)}</dd></div>
                              <div><dt>Total</dt><dd>{order.deliveryFeeMinor === null || order.deliveryFeeMinor === undefined ? "Pending delivery fee" : formatOrderMoney(order.totalMinor, order.currency)}</dd></div>
                            </dl>
                            {order.status === "Pending seller confirmation" && (
                              <p className="acct-order-waiting" role="status">Waiting for {order.sellerName} to confirm the delivery fee. Checkout opens for payment the moment they add it.</p>
                            )}
                            {order.status === "Awaiting buyer payment" && order.paymentStatus !== "paid" && (
                              <>
                                <p className="acct-order-ready" role="status">Delivery fee confirmed. Payment is now open for this order.</p>
                                <button className="acct-button acct-button-wide" type="button" disabled={payingOrderId === order.id} onClick={() => void payForOrder(order)}>
                                  {payingOrderId === order.id ? "Opening secure checkout…" : order.paymentStatus === "pending" ? "Continue Paystack payment" : "Pay securely with Paystack"}
                                </button>
                              </>
                            )}
                            {order.paymentStatus === "paid" && <p className="acct-order-paid">Payment confirmed. The seller can prepare your order.</p>}
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                )}
              </div>

              <div className="acct-column">
                <section className="acct-card">
                  <header className="acct-card-head">
                    <span className="acct-card-icon"><Icon name="gear" /></span>
                    <div><h2>Account settings</h2><p>Manage your account preferences.</p></div>
                  </header>
                  <ul className="acct-settings">
                    <li><button className="acct-setting-button" type="button" onClick={() => void sendPasswordReset()} disabled={resetting}><span className="acct-settings-icon"><Icon name="lock" /></span><span><strong>Change password</strong><small>{resetting ? "Sending reset link…" : "Keep your account secure"}</small></span><em aria-hidden="true">›</em></button></li>
                    <li><Link href="/account#buyer-orders"><span className="acct-settings-icon"><Icon name="receipt" /></span><span><strong>My orders</strong><small>Track delivery and payments</small></span><em aria-hidden="true">›</em></Link></li>
                    <li><Link href="/favorites"><span className="acct-settings-icon"><Icon name="heart" /></span><span><strong>Saved items</strong><small>Products you love</small></span><em aria-hidden="true">›</em></Link></li>
                    <li><Link href="/affiliate"><span className="acct-settings-icon"><Icon name="sparkle" /></span><span><strong>Affiliate programme</strong><small>Earn on every referral</small></span><em aria-hidden="true">›</em></Link></li>
                    <li><Link href="/pay-later"><span className="acct-settings-icon"><Icon name="clock" /></span><span><strong>Pay later</strong><small>Buy now, pay on credit</small></span><em aria-hidden="true">›</em></Link></li>
                    <ThemeToggle />
                    <li>
                      <button className="acct-signout" type="button" onClick={() => void logOut()} disabled={signingOut}>
                        <span className="acct-settings-icon is-danger"><Icon name="signout" /></span>
                        <span><strong>{signingOut ? "Signing out…" : "Log out"}</strong><small>Sign out of this device</small></span>
                        <em aria-hidden="true">›</em>
                      </button>
                    </li>
                  </ul>
                </section>

                <section className="acct-help">
                  <span className="acct-help-icon"><Icon name="headset" /></span>
                  <div>
                    <h2>Need help?</h2>
                    <p>Our support team is here for your orders, payouts and verification.</p>
                    <a className="acct-button" href="mailto:support@surefoodz.com">Contact support <span aria-hidden="true">→</span></a>
                  </div>
                </section>

                <section className="acct-thanks">
                  <span className="acct-thanks-leaf"><Icon name="sparkle" /></span>
                  <p><strong>Thank you for being part of SureFood!</strong><small>Together we grow. Together we earn.</small></p>
                </section>
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
