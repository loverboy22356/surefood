"use client";

import Link from "next/link";
import { onAuthStateChanged, type User } from "firebase/auth";
import { useCallback, useEffect, useState } from "react";
import { firebaseAuth, firebaseConfigured } from "@/lib/firebase/client";
import { eventTypeLabels, type EventType } from "@/lib/requests";
import "../../requests.css";

type EventRequest = {
  id: string;
  reference: string;
  status: string;
  fullName: string;
  email: string;
  phone: string;
  eventType: string;
  eventDate: string;
  guestCount: number;
  deliveryAddress: string;
  items: string;
  notes: string;
  tierLabel: string;
  tierDays: number;
  quoteNote: string;
  createdAt: string | null;
};

const statusLabels: Record<string, string> = {
  requested: "Awaiting quote",
  quoted: "Quote sent",
  confirmed: "Confirmed",
  declined: "Declined",
};

export default function SpecialOrderQueuePage() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [staff, setStaff] = useState(false);
  const [requests, setRequests] = useState<EventRequest[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadQueue = useCallback(async (currentUser: User) => {
    setLoading(true);
    setError("");
    try {
      const token = await currentUser.getIdToken();
      const response = await fetch("/api/admin/special-orders", { headers: { authorization: `Bearer ${token}` } });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not load event order requests.");
      setRequests(result.requests);
      setNotes(Object.fromEntries((result.requests as EventRequest[]).map((request) => [request.id, request.quoteNote])));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load event order requests.");
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
      setRequests([]);
      if (!currentUser) return;
      try {
        const token = await currentUser.getIdTokenResult();
        const isStaffUser = token.claims.role === "staff" || token.claims.role === "admin";
        setStaff(isStaffUser);
        if (!isStaffUser) {
          setError("A SureFood staff or admin account is required to manage event orders.");
          return;
        }
        await loadQueue(currentUser);
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "Could not verify staff access.");
      }
    });
  }, [loadQueue]);

  async function update(request: EventRequest, status: string) {
    if (!user) return;
    const quoteNote = notes[request.id]?.trim() ?? "";
    if (status === "declined" && !quoteNote) {
      setError("Add a note explaining why this event order cannot be taken.");
      return;
    }
    setBusyId(request.id);
    setError("");
    setNotice("");
    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/admin/special-orders/${encodeURIComponent(request.id)}`, {
        method: "PATCH",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ status, quoteNote }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not update this request.");
      setRequests((current) => current.map((item) => item.id === request.id ? { ...item, status, quoteNote } : item));
      setNotice(`${request.reference} marked ${statusLabels[status] ?? status}.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not update this request.");
    } finally {
      setBusyId("");
    }
  }

  return (
    <main className="manual-review-page">
      <header className="manual-review-header">
        <Link href="/" className="brand"><span className="brand-mark">s</span><span>sure<span>food</span></span></Link>
        <div>
          <span>STAFF WORKSPACE</span>
          <h1>Special &amp; event orders</h1>
          <p>Event requests arrive with the planning band already worked out from the lead time. Confirm availability, add the quote note with the discount and total, then mark the request quoted or confirmed.</p>
        </div>
        {staff && <button type="button" onClick={() => user && void loadQueue(user)} disabled={loading}>{loading ? "Refreshing…" : "Refresh queue"}</button>}
        <nav className="admin-queue-nav">
          <Link href="/admin/verification">Business verification</Link>
          <Link href="/admin/pay-later">Pay Later</Link>
          <Link className="is-current" href="/admin/special-orders">Event orders</Link>
          <Link href="/admin/categories">Categories</Link>
        </nav>
      </header>

      {error && <p className="manual-review-alert" role="alert">{error}</p>}
      {notice && <p className="manual-review-notice" role="status">{notice}</p>}

      {!authReady ? <p className="manual-review-empty">Checking staff access…</p>
        : !user ? <p className="manual-review-empty">Sign in with a SureFood staff account to manage event orders. <Link href="/login">Sign in →</Link></p>
          : staff && loading && requests.length === 0 ? <p className="manual-review-empty">Loading event order requests…</p>
            : staff && requests.length === 0 ? <section className="manual-review-empty">No event order requests have been sent yet.</section>
              : staff && (
                <section className="manual-review-list" aria-label="Event order requests">
                  {requests.map((request) => (
                    <article className="manual-review-card" key={request.id}>
                      <div className="manual-review-card-heading">
                        <div>
                          <span className="manual-review-role">
                            {statusLabels[request.status] ?? request.status} · {request.reference} · {eventTypeLabels[request.eventType as EventType] ?? request.eventType}
                          </span>
                          <h2>{request.fullName}</h2>
                          <p>{request.email} · {request.phone}</p>
                          <small>
                            Event {request.eventDate} · {request.guestCount} guests · {request.tierLabel}
                            {request.tierDays ? ` (${request.tierDays} days ahead)` : ""}
                          </small>
                        </div>
                      </div>

                      <dl className="manual-review-details">
                        <div className="manual-review-address"><dt>Delivery</dt><dd>{request.deliveryAddress || "Not provided"}</dd></div>
                        <div className="manual-review-address"><dt>Items requested</dt><dd>{request.items || "Not provided"}</dd></div>
                        {request.notes && <div className="manual-review-address"><dt>Customer notes</dt><dd>{request.notes}</dd></div>}
                        <div><dt>Sent</dt><dd>{request.createdAt ? new Date(request.createdAt).toLocaleString() : "Date unavailable"}</dd></div>
                      </dl>

                      <label className="manual-review-note">
                        Quote note (discount, total and payment date)
                        <textarea
                          value={notes[request.id] ?? ""}
                          onChange={(event) => setNotes((current) => ({ ...current, [request.id]: event.target.value }))}
                          maxLength={600}
                          placeholder="e.g. 12% event discount applied, total ₦480,000, payment due 14 days before the event"
                        />
                      </label>

                      <div className="manual-review-actions">
                        <button type="button" className="manual-review-reject" disabled={busyId === request.id} onClick={() => void update(request, "declined")}>
                          {busyId === request.id ? "Saving…" : "Decline request"}
                        </button>
                        <button type="button" className="manual-review-approve" disabled={busyId === request.id} onClick={() => void update(request, "quoted")}>
                          {busyId === request.id ? "Saving…" : "Mark quote sent"}
                        </button>
                        <button type="button" className="manual-review-approve" disabled={busyId === request.id} onClick={() => void update(request, "confirmed")}>
                          {busyId === request.id ? "Saving…" : "Mark confirmed"}
                        </button>
                      </div>
                    </article>
                  ))}
                </section>
              )}
    </main>
  );
}
