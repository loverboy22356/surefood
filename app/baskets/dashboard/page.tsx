"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { firebaseAuth, firebaseConfigured } from "@/lib/firebase/client";
import { ShopFooter, ShopHeader } from "@/app/components/shop-chrome";
import {
  basketFrequencies,
  deliveryDays,
  formatNaira,
  frequencyLabels,
  type BasketFrequency,
  type BasketSubscription,
  type DeliveryDay,
} from "@/lib/baskets";
import "../baskets.css";

type Load = "checking" | "signed-out" | "ready";

export default function BasketDashboard() {
  const [authState, setAuthState] = useState<Load>("checking");
  const [user, setUser] = useState<User | null>(null);
  const [subscriptions, setSubscriptions] = useState<BasketSubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [editingId, setEditingId] = useState("");
  const [draft, setDraft] = useState({ frequency: "monthly" as BasketFrequency, deliveryDay: "Saturday" as DeliveryDay, address: "", phone: "", city: "", region: "" });

  useEffect(() => {
    if (!firebaseConfigured()) {
      setAuthState("signed-out");
      setLoading(false);
      return;
    }
    return onAuthStateChanged(firebaseAuth(), (next) => {
      setUser(next);
      setAuthState(next ? "ready" : "signed-out");
      if (!next) setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!user) return;
    let active = true;
    void (async () => {
      setLoading(true);
      try {
        const token = await user.getIdToken();
        const response = await fetch("/api/baskets/mine", { headers: { authorization: `Bearer ${token}` } });
        const data = await response.json().catch(() => ({}));
        if (!active) return;
        if (!response.ok) {
          setError(typeof data?.error === "string" ? data.error : "We could not load your basket plans.");
          return;
        }
        setSubscriptions(Array.isArray(data.subscriptions) ? data.subscriptions as BasketSubscription[] : []);
      } catch {
        if (active) setError("We could not reach Sure Foodz. Check your connection and try again.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [user]);

  async function patch(id: string, payload: Record<string, unknown>) {
    if (!user) return;
    setBusyId(id);
    setError("");
    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/baskets/${id}`, {
        method: "PATCH",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(typeof data?.error === "string" ? data.error : "We could not update that basket.");
        return;
      }
      setSubscriptions((current) => current.map((item) => item.id === id ? data.subscription as BasketSubscription : item));
      setEditingId("");
    } catch {
      setError("We could not reach Sure Foodz. Check your connection and try again.");
    } finally {
      setBusyId("");
    }
  }

  function startEdit(subscription: BasketSubscription) {
    setEditingId(subscription.id);
    setDraft({
      frequency: subscription.frequency,
      deliveryDay: subscription.deliveryDay,
      address: subscription.address,
      phone: subscription.phone,
      city: subscription.city,
      region: subscription.region,
    });
  }

  return (
    <div className="sf-page">
      <ShopHeader />
      <main className="sf-shell bsk-main">
        <div className="bsk-crumbs">
          <Link href="/baskets">← Food baskets</Link>
          <span>My basket plan</span>
        </div>

        <header className="bsk-dash-head">
          <div>
            <span className="bsk-kicker">Subscription dashboard</span>
            <h1>My Sure Foodz Basket</h1>
            <p>See what is coming, change the rhythm, or pause for a while.</p>
          </div>
          <Link className="bsk-ghost" href="/baskets">Browse baskets →</Link>
        </header>

        {error && <p className="bsk-error" role="alert">{error}</p>}

        {authState === "signed-out" && (
          <section className="bsk-empty-card">
            <h2>Sign in to see your basket plan</h2>
            <p>Your subscriptions, delivery dates and pauses live behind your account.</p>
            <div className="bsk-hero-actions">
              <Link className="bsk-primary" href="/login?next=/baskets/dashboard">Sign in</Link>
              <Link className="bsk-ghost" href="/signup">Create an account</Link>
            </div>
          </section>
        )}

        {authState === "ready" && loading && (
          <div className="bsk-skeleton-list" aria-hidden="true">
            {Array.from({ length: 2 }).map((_, index) => <span key={index} className="bsk-skeleton is-tall" />)}
          </div>
        )}

        {authState === "ready" && !loading && !subscriptions.length && (
          <section className="bsk-empty-card">
            <span className="bsk-plan-emoji" aria-hidden="true">🧺</span>
            <h2>You have no basket plan yet</h2>
            <p>Start with a ready-made basket or build one from the market.</p>
            <div className="bsk-hero-actions">
              <Link className="bsk-primary" href="/baskets">Choose a basket</Link>
              <Link className="bsk-ghost" href="/baskets/build">Build your own</Link>
            </div>
          </section>
        )}

        <div className="bsk-sub-grid">
          {subscriptions.map((subscription) => {
            const paused = subscription.status === "paused";
            const cancelled = subscription.status === "cancelled";
            return (
              <article key={subscription.id} className={cancelled ? "bsk-sub is-off" : "bsk-sub"}>
                <header>
                  <div>
                    <span className="bsk-kicker">{subscription.type === "custom" ? "Custom basket" : subscription.planName}</span>
                    <h2>{subscription.type === "custom" ? "My custom basket" : `${subscription.planName} · ${subscription.tier}`}</h2>
                  </div>
                  <span className={subscription.status === "active" ? "bsk-status is-on" : "bsk-status"}>
                    {subscription.status === "active" ? "Active" : subscription.status === "paused" ? "Paused" : "Cancelled"}
                  </span>
                </header>

                <div className="bsk-sub-stats">
                  <div><span>Next delivery</span><b>{subscription.nextDelivery ? new Date(`${subscription.nextDelivery}T09:00:00`).toDateString() : "—"}</b></div>
                  <div><span>Rhythm</span><b>{frequencyLabels[subscription.frequency]}</b></div>
                  <div><span>Per delivery</span><b>{formatNaira(subscription.amountMinor)}</b></div>
                </div>

                <p className="bsk-sub-address">
                  <span aria-hidden="true">⌖</span> {subscription.address}, {subscription.city}, {subscription.region}
                  <small>Deliver on {subscription.deliveryDay}</small>
                </p>

                {subscription.type === "custom" && (
                  <details className="bsk-sub-items">
                    <summary>What is inside ({subscription.items.length})</summary>
                    <ul>
                      {subscription.items.map((item, index) => (
                        <li key={`${item.label}-${index}`}>
                          {item.quantity ? `${item.quantity} × ` : ""}{item.label}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}

                {!cancelled && editingId !== subscription.id && (
                  <div className="bsk-sub-actions">
                    {subscription.status === "active" ? (
                      <>
                        <button type="button" className="bsk-ghost" disabled={busyId === subscription.id} onClick={() => patch(subscription.id, { action: "skip" })}>Skip next delivery</button>
                        <button type="button" className="bsk-ghost" disabled={busyId === subscription.id} onClick={() => patch(subscription.id, { action: "pause" })}>Pause plan</button>
                      </>
                    ) : (
                      <button type="button" className="bsk-primary" disabled={busyId === subscription.id} onClick={() => patch(subscription.id, { action: "resume" })}>Resume plan</button>
                    )}
                    <button type="button" className="bsk-ghost" onClick={() => startEdit(subscription)}>Edit details</button>
                    <button
                      type="button"
                      className="bsk-danger"
                      disabled={busyId === subscription.id}
                      onClick={() => {
                        if (window.confirm("Cancel this basket plan? You can start a new one at any time.")) {
                          void patch(subscription.id, { action: "cancel" });
                        }
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                )}

                {editingId === subscription.id && (
                  <form
                    className="bsk-sub-edit"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void patch(subscription.id, { action: "update", ...draft });
                    }}
                  >
                    <div className="bsk-form-grid">
                      <label>
                        <span>Rhythm</span>
                        <select value={draft.frequency} onChange={(event) => setDraft({ ...draft, frequency: event.target.value as BasketFrequency })}>
                          {basketFrequencies.map((option) => <option key={option} value={option}>{frequencyLabels[option]}</option>)}
                        </select>
                      </label>
                      <label>
                        <span>Delivery day</span>
                        <select value={draft.deliveryDay} onChange={(event) => setDraft({ ...draft, deliveryDay: event.target.value as DeliveryDay })}>
                          {deliveryDays.map((day) => <option key={day} value={day}>{day}</option>)}
                        </select>
                      </label>
                    </div>
                    <label className="bsk-wide">
                      <span>Address</span>
                      <input value={draft.address} onChange={(event) => setDraft({ ...draft, address: event.target.value })} required />
                    </label>
                    <div className="bsk-form-grid">
                      <label><span>City</span><input value={draft.city} onChange={(event) => setDraft({ ...draft, city: event.target.value })} required /></label>
                      <label><span>State</span><input value={draft.region} onChange={(event) => setDraft({ ...draft, region: event.target.value })} required /></label>
                    </div>
                    <label className="bsk-wide"><span>Phone</span><input value={draft.phone} onChange={(event) => setDraft({ ...draft, phone: event.target.value })} required /></label>
                    <div className="bsk-sub-actions">
                      <button type="submit" className="bsk-primary" disabled={busyId === subscription.id}>Save changes</button>
                      <button type="button" className="bsk-ghost" onClick={() => setEditingId("")}>Cancel</button>
                    </div>
                  </form>
                )}
              </article>
            );
          })}
        </div>
      </main>
      <ShopFooter />
    </div>
  );
}
