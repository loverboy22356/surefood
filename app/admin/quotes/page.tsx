"use client";

import Link from "next/link";
import { onAuthStateChanged, type User } from "firebase/auth";
import { useCallback, useEffect, useState } from "react";
import { firebaseAuth, firebaseConfigured } from "@/lib/firebase/client";
import { businessTypeLabels, orderRhythmLabels, type BusinessQuote, type BusinessType, type OrderRhythm } from "@/lib/business";
import "../../requests.css";

const statusLabels: Record<string, string> = {
  requested: "Awaiting quote",
  quoted: "Quote sent",
  confirmed: "Confirmed",
  declined: "Declined",
};

export default function QuoteQueuePage() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [staff, setStaff] = useState(false);
  const [quotes, setQuotes] = useState<BusinessQuote[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [totals, setTotals] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadQueue = useCallback(async (currentUser: User) => {
    setLoading(true);
    setError("");
    try {
      const token = await currentUser.getIdToken();
      const response = await fetch("/api/admin/quotes", { headers: { authorization: `Bearer ${token}` } });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not load quotation requests.");
      const rows: BusinessQuote[] = result.quotes;
      setQuotes(rows);
      setNotes(Object.fromEntries(rows.map((row) => [row.id, row.quoteNote ?? ""])));
      setTotals(Object.fromEntries(rows.map((row) => [row.id, row.quotedTotalMinor ? String(Math.round(row.quotedTotalMinor / 100)) : ""])));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load quotation requests.");
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
      setQuotes([]);
      if (!currentUser) return;
      try {
        const token = await currentUser.getIdTokenResult();
        const isStaffUser = token.claims.role === "staff" || token.claims.role === "admin";
        setStaff(isStaffUser);
        if (!isStaffUser) {
          setError("A Sure Foodz staff or admin account is required to price quotations.");
          return;
        }
        await loadQueue(currentUser);
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "Could not verify staff access.");
      }
    });
  }, [loadQueue]);

  async function update(quote: BusinessQuote, status: string) {
    if (!user) return;
    const quoteNote = notes[quote.id]?.trim() ?? "";
    const total = Number(totals[quote.id]);
    if (status === "quoted" && quoteNote.length < 5) {
      setError("Add a note explaining the quotation before sending it.");
      return;
    }
    if (status === "declined" && !quoteNote) {
      setError("Add a note explaining why this request cannot be quoted.");
      return;
    }
    setBusyId(quote.id);
    setError("");
    setNotice("");
    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/admin/quotes/${encodeURIComponent(quote.id)}`, {
        method: "PATCH",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({
          status,
          quoteNote,
          ...(Number.isFinite(total) && total > 0 ? { quotedTotalMinor: Math.round(total * 100) } : {}),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not update this quotation.");
      setQuotes((current) => current.map((item) => item.id === quote.id ? { ...item, status: status as BusinessQuote["status"], quoteNote } : item));
      setNotice(`${quote.reference} marked ${statusLabels[status] ?? status}.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not update this quotation.");
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
          <h1>Business quotations</h1>
          <p>Bulk and wholesale requests from restaurants, canteens, offices and resellers. Price the basket, write the terms, then mark it quoted — the customer sees your note in their confirmation email.</p>
        </div>
        {staff && <button type="button" onClick={() => user && void loadQueue(user)} disabled={loading}>{loading ? "Refreshing…" : "Refresh queue"}</button>}
        <nav className="admin-queue-nav">
          <Link href="/admin/verification">Business verification</Link>
          <Link href="/admin/pay-later">Pay Later</Link>
          <Link href="/admin/special-orders">Event orders</Link>
          <Link className="is-current" href="/admin/quotes">Quotations</Link>
          <Link href="/admin/baskets">Baskets</Link>
          <Link href="/admin/categories">Categories</Link>
          <Link href="/admin/affiliates">Affiliates</Link>
        </nav>
      </header>

      {error && <p className="manual-review-alert" role="alert">{error}</p>}
      {notice && <p className="manual-review-notice" role="status">{notice}</p>}

      {!authReady ? <p className="manual-review-empty">Checking staff access…</p>
        : !user ? <p className="manual-review-empty">Sign in with a Sure Foodz staff account to price quotations. <Link href="/login">Sign in →</Link></p>
          : staff && loading && quotes.length === 0 ? <p className="manual-review-empty">Loading quotation requests…</p>
            : staff && quotes.length === 0 ? <section className="manual-review-empty">No quotation requests yet.</section>
              : staff && (
                <section className="manual-review-list" aria-label="Quotation requests">
                  {quotes.map((quote) => (
                    <article className="manual-review-card" key={quote.id}>
                      <div className="manual-review-card-heading">
                        <div>
                          <span className="manual-review-role">
                            {statusLabels[quote.status] ?? quote.status} · {quote.reference} · {businessTypeLabels[quote.businessType as BusinessType] ?? quote.businessType}
                          </span>
                          <h2>{quote.businessName}</h2>
                          <p>{quote.contactName} · {quote.email} · {quote.phone}</p>
                          <small>{orderRhythmLabels[quote.rhythm as OrderRhythm] ?? quote.rhythm} · requested {quote.createdAt ? new Date(quote.createdAt).toLocaleString() : "recently"}</small>
                        </div>
                      </div>

                      <dl className="manual-review-details">
                        <div className="manual-review-address"><dt>Needs</dt><dd>{quote.needs}</dd></div>
                        {quote.quantity && <div className="manual-review-address"><dt>Quantities</dt><dd>{quote.quantity}</dd></div>}
                        <div className="manual-review-address"><dt>Delivery</dt><dd>{quote.address || "Not provided"}, {quote.city} {quote.region}</dd></div>
                        {quote.notes && <div className="manual-review-address"><dt>Customer notes</dt><dd>{quote.notes}</dd></div>}
                      </dl>

                      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                        <label className="manual-review-note" style={{ flex: "0 1 200px" }}>
                          Quoted total (₦)
                          <input
                            type="number"
                            min={0}
                            inputMode="numeric"
                            value={totals[quote.id] ?? ""}
                            onChange={(event) => setTotals((current) => ({ ...current, [quote.id]: event.target.value }))}
                            placeholder="e.g. 480000"
                          />
                        </label>
                        <label className="manual-review-note" style={{ flex: "1 1 320px" }}>
                          Quote note (terms, delivery, validity)
                          <textarea
                            value={notes[quote.id] ?? ""}
                            onChange={(event) => setNotes((current) => ({ ...current, [quote.id]: event.target.value }))}
                            maxLength={600}
                            placeholder="e.g. 50kg rice at ₦72,000 per bag, delivery within 5 working days, quote valid 14 days"
                          />
                        </label>
                      </div>

                      <div className="manual-review-actions">
                        <button type="button" className="manual-review-reject" disabled={busyId === quote.id} onClick={() => void update(quote, "declined")}>
                          {busyId === quote.id ? "Saving…" : "Decline"}
                        </button>
                        <button type="button" className="manual-review-approve" disabled={busyId === quote.id} onClick={() => void update(quote, "quoted")}>
                          {busyId === quote.id ? "Saving…" : "Send quote"}
                        </button>
                        <button type="button" className="manual-review-approve" disabled={busyId === quote.id} onClick={() => void update(quote, "confirmed")}>
                          {busyId === quote.id ? "Saving…" : "Mark confirmed"}
                        </button>
                      </div>
                    </article>
                  ))}
                </section>
              )}
    </main>
  );
}
