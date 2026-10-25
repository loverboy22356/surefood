"use client";

import Link from "next/link";
import { onAuthStateChanged, type User } from "firebase/auth";
import { useCallback, useEffect, useMemo, useState } from "react";
import { firebaseAuth, firebaseConfigured } from "@/lib/firebase/client";
import { AFFILIATE_COMMISSION_RATE, AFFILIATE_MIN_PAYOUT_MINOR } from "@/lib/affiliates";
import "../requests.css";
import "./affiliate.css";

type Payout = {
  id: string;
  amountMinor: number;
  status: string;
  requestedAt: string;
  paidAt: string | null;
  note: string;
};

type Summary = {
  affiliate: { code: string; name: string; email: string; status: string; commissionRate: number } | null;
  stats?: {
    referredOrders: number;
    paidOrders: number;
    earnedMinor: number;
    paidOutMinor: number;
    requestedMinor: number;
    availableMinor: number;
  };
  payouts?: Payout[];
  orders?: { id: string; subtotalMinor: number; commissionMinor: number; createdAt: string }[];
  minPayoutMinor?: number;
};

function money(minor: number) {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(minor / 100);
}

const steps = [
  { title: "Join free", copy: "Open an affiliate account with the same SureFood account you shop with." },
  { title: "Share your link", copy: "Every order that starts from your link is recorded against your code for 90 days." },
  { title: "Earn 5% on goods", copy: "You earn a share of the goods value of each order once the buyer has actually paid." },
  { title: "Get paid by hand", copy: "Request a payout and our team transfers it to your bank account and marks it paid." },
];

export default function AffiliatePage() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [copied, setCopied] = useState(false);
  const [payoutForm, setPayoutForm] = useState({ bankDetails: "", note: "" });

  const loadSummary = useCallback(async (currentUser: User) => {
    setLoading(true);
    setError("");
    try {
      const token = await currentUser.getIdToken();
      const response = await fetch("/api/affiliate", { headers: { authorization: `Bearer ${token}` } });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not load your affiliate dashboard.");
      setSummary(result);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load your affiliate dashboard.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!firebaseConfigured()) {
      setAuthReady(true);
      return;
    }
    return onAuthStateChanged(firebaseAuth(), (currentUser) => {
      setUser(currentUser);
      setAuthReady(true);
      if (currentUser) void loadSummary(currentUser);
      else setSummary(null);
    });
  }, [loadSummary]);

  const referralLink = useMemo(() => {
    if (!summary?.affiliate) return "";
    const origin = typeof window === "undefined" ? "" : window.location.origin;
    return `${origin}/?ref=${summary.affiliate.code}`;
  }, [summary]);

  async function join() {
    if (!user) return;
    setBusy(true);
    setError("");
    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/affiliate", { method: "POST", headers: { authorization: `Bearer ${token}` } });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not join the affiliate programme.");
      setSummary(result);
      setNotice("You are in. Share your link and your first commission is one order away.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not join the affiliate programme.");
    } finally {
      setBusy(false);
    }
  }

  async function copyLink() {
    if (!referralLink) return;
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setError("Your browser blocked the clipboard. Select the link and copy it manually.");
    }
  }

  async function requestPayout(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/affiliate/payouts", {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify(payoutForm),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not request a payout.");
      setNotice(result.message || "Payout requested.");
      setPayoutForm({ bankDetails: "", note: "" });
      await loadSummary(user);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not request a payout.");
    } finally {
      setBusy(false);
    }
  }

  const stats = summary?.stats;
  const affiliate = summary?.affiliate ?? null;
  const canRequest = Boolean(stats && stats.availableMinor >= AFFILIATE_MIN_PAYOUT_MINOR);

  return (
    <main className="service-page affiliate-page">
      <header className="service-topbar">
        <Link className="service-brand" href="/">
          <span className="mark">s</span>
          <span><strong>SureFood</strong><small>Fresh Food · Better Life</small></span>
        </Link>
        <div className="service-top-actions">
          <Link href="/pay-later">Pay Later</Link>
          <Link className="strong" href={user ? "/account" : "/login"}>{user ? "My account" : "Sign in"}</Link>
        </div>
      </header>

      <section className="service-hero">
        <div className="service-hero-inner">
          <span className="service-eyebrow">AFFILIATE PROGRAMME</span>
          <h1>Share good food,<br />earn on every <em>order</em>.</h1>
          <p>
            Send your link to people who cook, sell or buy in bulk. When they order food on SureFood, you earn{" "}
            {Math.round(AFFILIATE_COMMISSION_RATE * 100)}% of the goods value. Payouts are paid by hand by our team —
            request one as soon as you reach {money(AFFILIATE_MIN_PAYOUT_MINOR)}.
          </p>
          <ul className="service-hero-points">
            <li>Free to join</li>
            <li>90-day referral window</li>
            <li>Paid straight to your bank</li>
          </ul>
        </div>
      </section>

      <div className="service-shell">
        <div className="service-grid">
          <div>
            {error && <p className="service-alert" role="alert">{error}</p>}
            {notice && !error && <p className="service-notice" role="status">{notice}</p>}

            {!authReady ? (
              <p className="service-empty">Checking your account…</p>
            ) : !user ? (
              <section className="service-card">
                <h2>Sign in to join</h2>
                <p>Your affiliate account uses your SureFood account, so your code, orders and payouts stay in one place.</p>
                <Link className="auth-service-link" href="/login">Sign in to continue →</Link>
              </section>
            ) : loading && !summary ? (
              <p className="service-empty">Loading your affiliate dashboard…</p>
            ) : !affiliate ? (
              <section className="service-card">
                <h2>Join the affiliate programme</h2>
                <p>
                  One tap creates your referral code. There is nothing to pay, and you can stop sharing at any time.
                </p>
                <ul className="affiliate-join-list">
                  <li>Your own referral link and code</li>
                  <li>{Math.round(AFFILIATE_COMMISSION_RATE * 100)}% of the goods value of every paid order</li>
                  <li>Manual bank payout, requested from this page</li>
                </ul>
                <button className="service-submit" type="button" onClick={() => void join()} disabled={busy}>
                  {busy ? "Creating your code…" : "Join free"} <span aria-hidden="true">→</span>
                </button>
              </section>
            ) : (
              <>
                <section className="service-card affiliate-link-card">
                  <h2>Your referral link</h2>
                  <p>Share this anywhere — WhatsApp, Instagram, your shop. It works for 90 days after the first click.</p>
                  <div className="affiliate-code-row">
                    <strong>{affiliate.code}</strong>
                    <span className={affiliate.status === "active" ? "affiliate-status is-active" : "affiliate-status"}>
                      {affiliate.status === "active" ? "Active" : "Paused"}
                    </span>
                  </div>
                  <div className="affiliate-link-box">
                    <code>{referralLink}</code>
                    <button type="button" onClick={() => void copyLink()}>{copied ? "Copied ✓" : "Copy link"}</button>
                  </div>
                </section>

                <section className="service-card">
                  <h2>Your earnings</h2>
                  <div className="affiliate-stats">
                    <div><span>Available</span><strong>{money(stats?.availableMinor ?? 0)}</strong><small>Ready to request</small></div>
                    <div><span>Earned</span><strong>{money(stats?.earnedMinor ?? 0)}</strong><small>All paid orders</small></div>
                    <div><span>Paid out</span><strong>{money(stats?.paidOutMinor ?? 0)}</strong><small>Already sent</small></div>
                    <div><span>Orders</span><strong>{stats?.paidOrders ?? 0}</strong><small>of {stats?.referredOrders ?? 0} referred</small></div>
                  </div>

                  <h3>Request a payout</h3>
                  {!canRequest && (
                    <p className="service-help">
                      You can request a payout once you have {money(AFFILIATE_MIN_PAYOUT_MINOR)} available.
                      Every payout is checked and transferred by hand, so please give us the right bank details.
                    </p>
                  )}
                  <form className="service-form" onSubmit={requestPayout}>
                    <label className="service-field">
                      <span>Bank account (account name, bank, account number)</span>
                      <input
                        value={payoutForm.bankDetails}
                        onChange={(event) => setPayoutForm((current) => ({ ...current, bankDetails: event.target.value }))}
                        required
                        minLength={10}
                        maxLength={240}
                        placeholder="Ada Obi · GTBank · 0123456789"
                      />
                    </label>
                    <label className="service-field">
                      <span>Note for the team (optional)</span>
                      <input
                        value={payoutForm.note}
                        onChange={(event) => setPayoutForm((current) => ({ ...current, note: event.target.value }))}
                        maxLength={240}
                        placeholder="Anything we should know about this payout"
                      />
                    </label>
                    <button className="service-submit" type="submit" disabled={busy || !canRequest}>
                      {busy ? "Sending request…" : `Request ${money(stats?.availableMinor ?? 0)} payout`} <span aria-hidden="true">→</span>
                    </button>
                  </form>
                </section>

                <section className="service-card">
                  <h2>Payout history</h2>
                  {summary?.payouts && summary.payouts.length > 0 ? (
                    <ul className="affiliate-payouts">
                      {summary.payouts.map((payout) => (
                        <li key={payout.id}>
                          <span>
                            <strong>{money(payout.amountMinor)}</strong>
                            <small>{new Date(payout.requestedAt).toLocaleDateString()}{payout.note ? ` · ${payout.note}` : ""}</small>
                          </span>
                          <em className={`affiliate-payout-state is-${payout.status}`}>
                            {payout.status === "paid" ? "Paid" : payout.status === "cancelled" ? "Cancelled" : "Awaiting payment"}
                          </em>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="service-help">No payouts yet. Your first request will show here.</p>
                  )}
                  {summary?.orders && summary.orders.length > 0 && (
                    <>
                      <h3>Recent referred orders</h3>
                      <ul className="affiliate-orders">
                        {summary.orders.map((order) => (
                          <li key={`${order.id}-${order.createdAt}`}>
                            <span>{new Date(order.createdAt).toLocaleDateString()}</span>
                            <span>{money(order.subtotalMinor)}</span>
                            <strong>{order.commissionMinor > 0 ? money(order.commissionMinor) : "Awaiting payment"}</strong>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </section>
              </>
            )}
          </div>

          <aside className="pl-side">
            <section className="pl-how">
              <h2><span className="pl-panel-mark">✦</span> How it works</h2>
              <ol className="pl-how-list affiliate-how-list">
                {steps.map((step, index) => (
                  <li key={step.title}>
                    <span className="pl-how-num" aria-hidden="true">{index + 1}</span>
                    <span className="pl-how-copy"><strong>{step.title}</strong><small>{step.copy}</small></span>
                  </li>
                ))}
              </ol>
            </section>

            <section className="service-card">
              <h2>Fair rules</h2>
              <ul className="affiliate-rules">
                <li>Commission is earned on paid orders only, never on cancelled or unpaid ones.</li>
                <li>Your own orders never earn commission.</li>
                <li>Payouts are sent manually to the bank details you give us — allow up to five working days.</li>
                <li>We pause accounts that self-refer or send fake traffic.</li>
              </ul>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
