"use client";

import Link from "next/link";
import { onAuthStateChanged, type User } from "firebase/auth";
import { useCallback, useEffect, useState } from "react";
import { firebaseAuth, firebaseConfigured } from "@/lib/firebase/client";
import {
  basketFrequencies,
  deliveryDays,
  formatNaira,
  frequencyLabels,
  type BasketFrequency,
  type BasketSubscription,
} from "@/lib/baskets";
import "../../requests.css";

const statusLabels: Record<string, string> = { active: "Active", paused: "Paused", cancelled: "Cancelled" };

type BasketPlan = {
  id: string;
  name: string;
  audience: string;
  emoji: string;
  accent: string;
  items: string[];
  tiers: Array<{ id: string; label: string; priceMinor: number; note: string }>;
  popular?: boolean;
};

export default function BasketQueuePage() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [staff, setStaff] = useState(false);
  const [subscriptions, setSubscriptions] = useState<BasketSubscription[]>([]);
  const [plans, setPlans] = useState<BasketPlan[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [dates, setDates] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState("all");
  const [tab, setTab] = useState<"subscriptions" | "plans">("subscriptions");
  const [busyId, setBusyId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [planForm, setPlanForm] = useState<{
    name: string;
    audience: string;
    emoji: string;
    accent: string;
    items: string;
    tiers: string;
    popular: boolean;
  }>({ name: "", audience: "", emoji: "🧺", accent: "#6d28d9", items: "", tiers: "", popular: false });

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

  const loadPlans = useCallback(async (currentUser: User) => {
    try {
      const token = await currentUser.getIdToken();
      const response = await fetch("/api/basket-plans", { headers: { authorization: `Bearer ${token}` } });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not load basket plans.");
      setPlans(result.plans || []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load basket plans.");
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
      setPlans([]);
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
        await loadPlans(currentUser);
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "Could not verify staff access.");
      }
    });
  }, [loadQueue, loadPlans]);

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

  async function savePlan(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) return;
    setBusyId("new-plan");
    setError("");
    try {
      const token = await user.getIdToken();
      const tiers = planForm.tiers.split(",").map((tier) => {
        const [label, price] = tier.split("|");
        return { id: label.toLowerCase().replace(/\s+/g, "-"), label: label.trim(), priceMinor: Math.round(Number(price.trim()) * 100), note: "" };
      }).filter((tier) => tier.label && tier.priceMinor > 0);
      const items = planForm.items.split(",").map((item) => item.trim()).filter(Boolean);
      if (!planForm.name || !planForm.audience || !items.length || !tiers.length) {
        setError("A plan needs a name, audience, items, and at least one tier.");
        setBusyId("");
        return;
      }
      const response = await fetch("/api/basket-plans", {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({
          name: planForm.name,
          audience: planForm.audience,
          emoji: planForm.emoji,
          accent: planForm.accent,
          items,
          tiers,
          popular: planForm.popular,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not create basket plan.");
      setPlans((current) => [result.plan, ...current]);
      setPlanForm({ name: "", audience: "", emoji: "🧺", accent: "#6d28d9", items: "", tiers: "", popular: false });
      setNotice(`"${result.plan.name}" is now live for shoppers.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not create this basket plan.");
    } finally {
      setBusyId("");
    }
  }

  async function deletePlan(planId: string) {
    if (!user || !window.confirm(`Delete this basket plan? Active subscribers keep their current plan.`)) return;
    setBusyId(planId);
    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/basket-plans?id=${encodeURIComponent(planId)}`, {
        method: "DELETE",
        headers: { authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error((await response.json()).error || "Could not delete this plan.");
      setPlans((current) => current.filter((p) => p.id !== planId));
      setNotice("Basket plan removed.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not delete this basket plan.");
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
          <h1>{tab === "subscriptions" ? "Basket subscriptions" : "Basket plans"}</h1>
          <p>
            {tab === "subscriptions"
              ? "Every recurring basket lives here: confirm the first delivery, move a plan between active and paused, correct a delivery date, or leave a note the customer support team can see."
              : "Create and manage the basket plans shoppers can subscribe to. Plans are dynamic — add, edit, or retire them at any time."}
          </p>
        </div>
        <nav className="admin-queue-nav">
          <Link href="/admin/verification">Business verification</Link>
          <Link href="/admin/pay-later">Pay Later</Link>
          <Link href="/admin/special-orders">Event orders</Link>
          <Link href="/admin/quotes">Quotations</Link>
          <Link className="is-current" href="/admin/baskets">Baskets</Link>
          <Link href="/admin/categories">Categories</Link>
          <Link href="/admin/affiliates">Affiliates</Link>
        </nav>
        <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
          <button type="button" className={tab === "subscriptions" ? "is-current" : undefined} onClick={() => setTab("subscriptions")}>Subscriptions</button>
          <button type="button" className={tab === "plans" ? "is-current" : undefined} onClick={() => setTab("plans")}>Plans</button>
        </div>
      </header>

      {error && <p className="manual-review-alert" role="alert">{error}</p>}
      {notice && <p className="manual-review-notice" role="status">{notice}</p>}

      {tab === "subscriptions" && (
        <>
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
                                {frequencyLabels[subscription.frequency as BasketFrequency]} · {formatNaira(subscription.amountMinor)} per delivery · {subscription.deliveryDay}
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
                              Save date & note
                            </button>
                          </div>
                        </article>
                      ))}
                    </section>
                  )}
        </>
      )}

      {tab === "plans" && (
        <>
          {!authReady ? <p className="manual-review-empty">Checking staff access…</p>
            : !user ? <p className="manual-review-empty">Sign in with a Sure Foodz staff account to manage basket plans.</p>
              : !staff ? <p className="manual-review-alert" role="alert">A Sure Foodz staff or admin account is required.</p>
                : (
                  <section className="manual-review-list" aria-label="Basket plans">
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 24 }}>
                      <div>
                        <h2 style={{ margin: "0 0 12px" }}>Active basket plans</h2>
                        {plans.length === 0 ? <p style={{ color: "var(--sf-muted)" }}>No basket plans yet. Create one below.</p> : (
                          <div style={{ display: "grid", gap: 12 }}>
                            {plans.map((plan) => (
                              <article key={plan.id} className="manual-review-card" style={{ borderLeft: `4px solid ${plan.accent}` }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                                  <span style={{ fontSize: 24 }}>{plan.emoji}</span>
                                  <div>
                                    <strong style={{ display: "block" }}>{plan.name}</strong>
                                    <small style={{ color: "var(--sf-muted)" }}>{plan.audience}</small>
                                  </div>
                                  {plan.popular && <span style={{ marginLeft: "auto", fontSize: 11, padding: "2px 8px", borderRadius: 4, background: "#f0f7ff", color: "#1b6cff" }}>Popular</span>}
                                </div>
                                <p style={{ margin: "0 0 8px", fontSize: 13, color: "var(--sf-muted)" }}>{plan.items.join(", ")}</p>
                                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                  {plan.tiers.map((tier) => (
                                    <span key={tier.id} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 6, background: "var(--sf-soft)", fontSize: 12 }}>
                                      {tier.label} · {formatNaira(tier.priceMinor)}
                                    </span>
                                  ))}
                                </div>
                                <div className="manual-review-actions" style={{ marginTop: 10, gap: 8 }}>
                                  <button type="button" className="manual-review-reject" disabled={busyId === plan.id} onClick={() => void deletePlan(plan.id)}>
                                    {busyId === plan.id ? "Removing…" : "Remove plan"}
                                  </button>
                                </div>
                              </article>
                            ))}
                          </div>
                        )}
                      </div>
                      <div>
                        <form onSubmit={savePlan} style={{ display: "grid", gap: 10, background: "var(--sf-soft)", padding: 16, borderRadius: 12 }}>
                          <h2 style={{ margin: "0 0 8px", fontSize: 16 }}>Create basket plan</h2>
                          <label style={{ display: "grid", gap: 4, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em" }}>Plan name
                            <input name="name" value={planForm.name} onChange={(e) => setPlanForm((c) => ({ ...c, name: e.target.value }))} required maxLength={80} />
                          </label>
                          <label style={{ display: "grid", gap: 4, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em" }}>Who it's for
                            <textarea name="audience" rows={2} value={planForm.audience} onChange={(e) => setPlanForm((c) => ({ ...c, audience: e.target.value }))} required maxLength={160} placeholder="e.g. Students on a tight budget" />
                          </label>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                            <label style={{ display: "grid", gap: 4, fontSize: 12, fontWeight: 700 }}>Emoji
                              <input name="emoji" value={planForm.emoji} onChange={(e) => setPlanForm((c) => ({ ...c, emoji: e.target.value }))} maxLength={5} />
                            </label>
                            <label style={{ display: "grid", gap: 4, fontSize: 12, fontWeight: 700 }}>Accent colour
                              <input name="accent" type="color" value={planForm.accent} onChange={(e) => setPlanForm((c) => ({ ...c, accent: e.target.value }))} />
                            </label>
                          </div>
                          <label style={{ display: "grid", gap: 4, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em" }}>Items (comma separated)
                            <textarea name="items" rows={2} value={planForm.items} onChange={(e) => setPlanForm((c) => ({ ...c, items: e.target.value }))} placeholder="e.g. 5kg rice, 2kg beans, 1 litre oil" />
                          </label>
                          <label style={{ display: "grid", gap: 4, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em" }}>Tiers (label|price, comma separated)
                            <textarea name="tiers" rows={2} value={planForm.tiers} onChange={(e) => setPlanForm((c) => ({ ...c, tiers: e.target.value }))} placeholder="e.g. Basic|18500, Standard|26000, Premium|34000" />
                            <small style={{ color: "var(--sf-muted)" }}>Format: label|₦amount, separated by commas</small>
                          </label>
                          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                            <input type="checkbox" checked={planForm.popular} onChange={(e) => setPlanForm((c) => ({ ...c, popular: e.target.checked }))} />
                            Mark as popular
                          </label>
                          <button type="submit" className="manual-review-approve" disabled={busyId === "new-plan"}>
                            {busyId === "new-plan" ? "Creating…" : "Create plan"}
                          </button>
                        </form>
                      </div>
                    </div>
                  </section>
                )}
        </>
      )}
    </main>
  );
}
