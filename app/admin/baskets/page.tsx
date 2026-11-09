"use client";

import Link from "next/link";
import { onAuthStateChanged, type User } from "firebase/auth";
import { useCallback, useEffect, useState } from "react";
import { firebaseAuth, firebaseConfigured } from "@/lib/firebase/client";
import { deliveryDays, formatNaira, frequencyLabels, type BasketSubscription } from "@/lib/baskets";
import "../../requests.css";

const statusLabels: Record<string, string> = { active: "Active", paused: "Paused", cancelled: "Cancelled" };

export default function BasketQueuePage() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [staff, setStaff] = useState(false);
  const [subscriptions, setSubscriptions] = useState<BasketSubscription[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [dates, setDates] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState("all");
  const [busyId, setBusyId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadQueue = useCallback(async (currentUser: User, status = "all") => {
    setLoading(true);
    setError("");
    try {
      const token = await currentUser.getIdToken();
      const query = status === "all" ? "" : `?status=${encodeURIComponent(status)}`;
      const response = await fetch(`/api/admin/baskets${query}`, { headers: { authorization: `Bearer ${token}` } });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not load basket subscriptions.");
      const rows: BasketSubscription[] = result.subscriptions;
      setSubscriptions(rows);
      setNotes(Object.fromEntries(rows.map((row) => [row.id, row.notes ?? ""])));
      setDates(Object.fromEntries(rows.map((row) => [row.id, row.nextDelivery ?? ""])));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load basket subscriptions.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!firebaseConfigured()) {
      setError("Firebase is not configured on this deployment.");
      setAuthReady(true);
      return;
    }
    return onAuthStateChanged(firebaseAuth(), async (currentUser) => {
      setUser(currentUser);
      setAuthReady(true);
      setStaff(false);
      setSubscriptions([]);
      if (!currentUser) return;
      try {
        const token = await currentUser.getIdTokenResult();
        const isStaffUser = token.claims.role === "staff" || token.claims.role === "admin";
        setStaff(isStaffUser);
        if (!isStaffUser) {
          setError("A Sure Foodz staff or admin account is required to manage baskets.");
          return;
        }
        await loadQueue(currentUser, "all");
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "Could not verify staff access.");
      }
    });
  }, [loadQueue]);

  async function update(subscription: BasketSubscription, payload: Record<string, unknown>) {
    if (!user) return;
    setBusyId(subscription.id);
    setError("");
    setNotice("");
    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/admin/baskets/${encodeURIComponent(subscription.id)}`, {
        method: "PATCH",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not update this subscription.");
      setSubscriptions((current) => current.map((item) => item.id === subscription.id ? result.subscription as BasketSubscription : item));
      setNotice(`${subscription.planName || "Basket"} updated.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not update this subscription.");
    } finally {
      setBusyId("");
    }
  }

  return (
    <main className="manual-review-page">
      <header className="manual-review-header">
        <Link href="/" className="brand"><span className="brand-mark">s</span><span>sure<span>foodz</span></span></Link>
        <div>
          <span>STAFF WORKSPACE</span>
          <h1>Basket subscriptions</h1>
          <p>Every recurring basket lives here: confirm the first delivery, move a plan between active and paused, correct a delivery date, or leave a note the customer support team can see.</p>
        </div>
        {staff && (
          <button type="button" onClick={() => user && void loadQueue(user, filter)} disabled={loading}>
            {loading ? "Refreshing…" : "Refresh queue"}
          </button>
        )}
        <nav className="admin-queue-nav">
          <Link href="/admin/verification">Business verification</Link>
          <Link href="/admin/pay-later">Pay Later</Link>
          <Link href="/admin/special-orders">Event orders</Link>
          <Link href="/admin/quotes">Quotations</Link>
          <Link className="is-current" href="/admin/baskets">Baskets</Link>
          <Link href="/admin/categories">Categories</Link>
          <Link href="/admin/affiliates">Affiliates</Link>
        </nav>
      </header>

      {error && <p className="manual-review-alert" role="alert">{error}</p>}
      {notice && <p className="manual-review-notice" role="status">{notice}</p>}

      {staff && (
        <div className="admin-queue-nav" style={{ marginBottom: 16 }}>
          {["all", "active", "paused", "cancelled"].map((option) => (
            <button
              key={option}
              type="button"
              className={filter === option ? "is-current" : undefined}
              onClick={() => { setFilter(option); if (user) void loadQueue(user, option); }}
            >
              {option === "all" ? "All plans" : statusLabels[option]}
            </button>
          ))}
        </div>
      )}

      {!authReady ? <p className="manual-review-empty">Checking staff access…</p>
        : !user ? <p className="manual-review-empty">Sign in with a Sure Foodz staff account to manage baskets. <Link href="/login">Sign in →</Link></p>
          : staff && loading && subscriptions.length === 0 ? <p className="manual-review-empty">Loading basket subscriptions…</p>
            : staff && subscriptions.length === 0 ? <section className="manual-review-empty">No basket subscriptions yet.</section>
              : staff && (
                <section className="manual-review-list" aria-label="Basket subscriptions">
                  {subscriptions.map((subscription) => (
                    <article className="manual-review-card" key={subscription.id}>
                      <div className="manual-review-card-heading">
                        <div>
                          <span className="manual-review-role">
                            {statusLabels[subscription.status] ?? subscription.status} · {subscription.type === "custom" ? "Custom basket" : `${subscription.planName} · ${subscription.tier}`}
                          </span>
                          <h2>{subscription.customerName || subscription.email}</h2>
                          <p>{subscription.email} · {subscription.phone}</p>
                          <small>
                            {frequencyLabels[subscription.frequency]} · {formatNaira(subscription.amountMinor)} per delivery · {subscription.deliveryDay}
                          </small>
                        </div>
                      </div>

                      <dl className="manual-review-details">
                        <div className="manual-review-address"><dt>Delivery</dt><dd>{subscription.address}, {subscription.city}, {subscription.region}</dd></div>
                        <div><dt>Next delivery</dt><dd>{subscription.nextDelivery || "Not set"}</dd></div>
                        <div><dt>Started</dt><dd>{subscription.createdAt ? new Date(subscription.createdAt).toLocaleString() : "Unknown"}</dd></div>
                        {subscription.items.length > 0 && (
                          <div className="manual-review-address">
                            <dt>Items</dt>
                            <dd>{subscription.items.map((item) => `${item.quantity ? `${item.quantity} × ` : ""}${item.label}`).join(", ")}</dd>
                          </div>
                        )}
                      </dl>

                      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end" }}>
                        <label className="manual-review-note" style={{ flex: "1 1 220px" }}>
                          Next delivery date
                          <input
                            type="date"
                            value={dates[subscription.id] ?? ""}
                            onChange={(event) => setDates((current) => ({ ...current, [subscription.id]: event.target.value }))}
                          />
                        </label>
                        <label className="manual-review-note" style={{ flex: "1 1 220px" }}>
                          Delivery day
                          <select
                            value={subscription.deliveryDay}
                            onChange={(event) => void update(subscription, { deliveryDay: event.target.value })}
                          >
                            {deliveryDays.map((day) => <option key={day} value={day}>{day}</option>)}
                          </select>
                        </label>
                      </div>

                      <label className="manual-review-note">
                        Internal note
                        <textarea
                          value={notes[subscription.id] ?? ""}
                          onChange={(event) => setNotes((current) => ({ ...current, [subscription.id]: event.target.value }))}
                          maxLength={400}
                          placeholder="e.g. customer asked to switch to fortnightly from December"
                        />
                      </label>

                      <div className="manual-review-actions">
                        <button
                          type="button"
                          className="manual-review-reject"
                          disabled={busyId === subscription.id}
                          onClick={() => void update(subscription, { status: "cancelled", notes: notes[subscription.id] ?? "" })}
                        >
                          Cancel plan
                        </button>
                        <button
                          type="button"
                          className="manual-review-approve"
                          disabled={busyId === subscription.id}
                          onClick={() => void update(subscription, {
                            status: subscription.status === "active" ? "paused" : "active",
                            notes: notes[subscription.id] ?? "",
                          })}
                        >
                          {subscription.status === "active" ? "Pause plan" : "Activate plan"}
                        </button>
                        <button
                          type="button"
                          className="manual-review-approve"
                          disabled={busyId === subscription.id}
                          onClick={() => void update(subscription, {
                            nextDelivery: dates[subscription.id] ?? "",
                            notes: notes[subscription.id] ?? "",
                          })}
                        >
                          Save date &amp; note
                        </button>
                      </div>
                    </article>
                  ))}
                </section>
              )}
    </main>
  );
}
