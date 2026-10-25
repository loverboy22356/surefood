"use client";

import Link from "next/link";
import { onAuthStateChanged, type User } from "firebase/auth";
import { useCallback, useEffect, useState } from "react";
import { firebaseAuth, firebaseConfigured } from "@/lib/firebase/client";
import "../../requests.css";
import "../../affiliate/affiliate.css";

type Affiliate = {
  uid: string;
  code: string;
  name: string;
  email: string;
  status: string;
  commissionRate: number;
  createdAt: string;
};

type Payout = {
  id: string;
  code: string;
  name: string;
  email: string;
  amountMinor: number;
  bankDetails: string;
  note: string;
  status: string;
  requestedAt: string;
  paidAt: string | null;
};

function money(minor: number) {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(minor / 100);
}

export default function AffiliatesQueuePage() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [staff, setStaff] = useState(false);
  const [affiliates, setAffiliates] = useState<Affiliate[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadQueue = useCallback(async (currentUser: User) => {
    setLoading(true);
    setError("");
    try {
      const token = await currentUser.getIdToken();
      const response = await fetch("/api/admin/affiliates", { headers: { authorization: `Bearer ${token}` } });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not load affiliates.");
      setAffiliates(result.affiliates);
      setPayouts(result.payouts);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load affiliates.");
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
      if (!currentUser) return;
      try {
        const token = await currentUser.getIdTokenResult();
        const isStaffUser = token.claims.role === "staff" || token.claims.role === "admin";
        setStaff(isStaffUser);
        if (!isStaffUser) {
          setError("A SureFood staff or admin account is required to manage affiliate payouts.");
          return;
        }
        await loadQueue(currentUser);
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "Could not verify staff access.");
      }
    });
  }, [loadQueue]);

  async function mark(payout: Payout, status: "paid" | "cancelled") {
    if (!user) return;
    setBusyId(payout.id);
    setError("");
    setNotice("");
    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/admin/affiliates", {
        method: "PATCH",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ payoutId: payout.id, status }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not update this payout.");
      setNotice(`${payout.name || payout.code} payout ${money(payout.amountMinor)} marked ${status}.`);
      await loadQueue(user);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not update this payout.");
    } finally {
      setBusyId("");
    }
  }

  const waiting = payouts.filter((payout) => payout.status === "requested");

  return (
    <main className="manual-review-page">
      <header className="manual-review-header">
        <Link href="/" className="brand"><span className="brand-mark">s</span><span>sure<span>food</span></span></Link>
        <div>
          <span>STAFF WORKSPACE</span>
          <h1>Affiliate payouts</h1>
          <p>Affiliate earnings are paid by hand. Transfer the amount to the bank details below, then mark the payout paid.</p>
        </div>
        {staff && <button type="button" onClick={() => user && void loadQueue(user)} disabled={loading}>{loading ? "Refreshing…" : "Refresh queue"}</button>}
        <nav className="admin-queue-nav">
          <Link href="/admin/verification">Business verification</Link>
          <Link href="/admin/pay-later">Pay Later</Link>
          <Link href="/admin/special-orders">Event orders</Link>
          <Link href="/admin/categories">Categories</Link>
          <Link className="is-current" href="/admin/affiliates">Affiliates</Link>
        </nav>
      </header>

      {error && <p className="manual-review-alert" role="alert">{error}</p>}
      {notice && <p className="manual-review-notice" role="status">{notice}</p>}

      {!authReady ? <p className="manual-review-empty">Checking staff access…</p>
        : !user ? <p className="manual-review-empty">Sign in with a SureFood staff account to manage payouts. <Link href="/login">Sign in →</Link></p>
          : staff && loading && payouts.length === 0 ? <p className="manual-review-empty">Loading payouts…</p>
            : staff && waiting.length === 0 ? <section className="manual-review-empty">No affiliate payout is waiting to be paid.</section>
              : staff && (
                <section className="manual-review-list" aria-label="Affiliate payouts awaiting payment">
                  {waiting.map((payout) => (
                    <article className="manual-review-card" key={payout.id}>
                      <div className="manual-review-card-heading">
                        <div>
                          <span className="manual-review-role">Payout request · {payout.code}</span>
                          <h2>{payout.name || payout.email}</h2>
                          <p>{payout.email}</p>
                          <small>Requested {new Date(payout.requestedAt).toLocaleString()}</small>
                        </div>
                      </div>
                      <dl className="manual-review-details">
                        <div><dt>Amount</dt><dd>{money(payout.amountMinor)}</dd></div>
                        <div className="manual-review-address"><dt>Bank details</dt><dd>{payout.bankDetails || "Not provided"}</dd></div>
                        {payout.note && <div className="manual-review-address"><dt>Note</dt><dd>{payout.note}</dd></div>}
                      </dl>
                      <div className="manual-review-actions">
                        <button type="button" className="manual-review-reject" disabled={busyId === payout.id} onClick={() => void mark(payout, "cancelled")}>
                          {busyId === payout.id ? "Saving…" : "Cancel payout"}
                        </button>
                        <button type="button" className="manual-review-approve" disabled={busyId === payout.id} onClick={() => void mark(payout, "paid")}>
                          {busyId === payout.id ? "Saving…" : "Mark paid"}
                        </button>
                      </div>
                    </article>
                  ))}
                </section>
              )}

      {staff && affiliates.length > 0 && (
        <section className="manual-review-list" aria-label="All affiliates" style={{ marginTop: 24 }}>
          <h2>All affiliates ({affiliates.length})</h2>
          <ul className="affiliate-admin-list">
            {affiliates.map((affiliate) => (
              <li key={affiliate.uid}>
                <strong>{affiliate.name || affiliate.email}</strong>
                <span>{affiliate.code}</span>
                <span>{affiliate.email}</span>
                <em>{Math.round(affiliate.commissionRate * 100)}% · {affiliate.status}</em>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
