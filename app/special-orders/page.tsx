"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  eventPlanningTiers,
  eventTypeLabels,
  eventTypes,
  planningTierFor,
  type EventType,
} from "@/lib/requests";
import "../requests.css";

type Result = {
  reference: string;
  tierLabel: string;
  eventDate: string;
};

function tomorrow() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return date.toISOString().slice(0, 10);
}

export default function SpecialOrdersPage() {
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    eventType: "wedding" as EventType,
    eventDate: "",
    guestCount: "",
    deliveryAddress: "",
    items: "",
    notes: "",
  });
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [presetItem, setPresetItem] = useState("");
  const tier = useMemo(() => (form.eventDate ? planningTierFor(form.eventDate) : null), [form.eventDate]);
  const minDate = useMemo(() => tomorrow(), []);

  // A product picked from the shop arrives here as ?items=1 × Fresh tomatoes.
  useEffect(() => {
    const preset = new URLSearchParams(window.location.search).get("items");
    if (!preset) return;
    setPresetItem(preset);
    setForm((current) => (current.items ? current : { ...current, items: preset }));
  }, []);

  function update(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/special-orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...form, guestCount: Number(form.guestCount), consent }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not send your event order request.");
      setResult({ reference: data.reference, tierLabel: data.tierLabel, eventDate: data.eventDate });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not send your event order request.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="service-page">
      <header className="service-topbar">
        <Link className="service-brand" href="/">
          <span className="mark">s</span>
          <span><strong>SureFood</strong><small>Fresh Food · Better Life</small></span>
        </Link>
        <div className="service-top-actions">
          <Link href="/pay-later">Pay later</Link>
          <Link className="strong" href="/login">Sign in</Link>
        </div>
      </header>

      <section className="service-hero">
        <div className="service-hero-inner">
          <span className="service-eyebrow">SPECIAL &amp; EVENT ORDERS</span>
          <h1>Plan your event food early,<br />and pay a <em>better price</em>.</h1>
          <p>
            Weddings, birthdays, corporate lunches, festivals — send us the list ahead of the date. The earlier you
            order, the deeper the planning discount we can give you, so you can pay for the food before the day itself.
          </p>
          <ul className="service-hero-points">
            <li>Order weeks or months ahead</li>
            <li>Discount band set by your lead time</li>
            <li>Everything confirmed in writing before you pay</li>
          </ul>
        </div>
      </section>

      <div className="service-shell">
        <div className="service-grid">
          <div>
            {error && <p className="service-alert" role="alert">{error}</p>}

            {result ? (
              <section className="service-status" aria-live="polite">
                <span className="badge">Request received</span>
                <h2>Your event order request is with our team</h2>
                <p>
                  We will come back to you with the itemised quote, the discount for your planning band and the payment
                  date for your event. Nothing is charged yet.
                </p>
                <dl>
                  <div><dt>Reference</dt><dd>{result.reference}</dd></div>
                  <div><dt>Event date</dt><dd>{new Date(`${result.eventDate}T00:00:00`).toLocaleDateString(undefined, { dateStyle: "long" })}</dd></div>
                  <div><dt>Planning band</dt><dd>{result.tierLabel}</dd></div>
                </dl>
                <p style={{ marginTop: 6 }}>
                  <Link className="auth-service-link" href="/" style={{ fontSize: 12 }}>Back to shopping →</Link>
                </p>
                <button type="button" className="auth-service-link" style={{ background: "none", border: 0, padding: 0, cursor: "pointer", fontSize: 12 }} onClick={() => setResult(null)}>
                  Send another request
                </button>
              </section>
            ) : (
              <section className="service-card">
                <h2>Tell us about the event</h2>
                <p>The more detail you give about quantities, the tighter the quote we can send back.</p>
                <form className="service-form" onSubmit={submit}>
                  <fieldset className="service-fieldset">
                    <legend>Who should we contact?</legend>
                    <div className="service-row">
                      <label className="service-field"><span>Full name</span><input value={form.fullName} onChange={(event) => update("fullName", event.target.value)} required minLength={2} maxLength={120} autoComplete="name" /></label>
                      <label className="service-field"><span>Phone number</span><input type="tel" value={form.phone} onChange={(event) => update("phone", event.target.value)} required placeholder="0803 000 0000" autoComplete="tel" /></label>
                    </div>
                    <label className="service-field"><span>Email address</span><input type="email" value={form.email} onChange={(event) => update("email", event.target.value)} required autoComplete="email" /></label>
                  </fieldset>

                  <fieldset className="service-fieldset">
                    <legend>The event</legend>
                    <div className="service-row">
                      <label className="service-field">
                        <span>Event type</span>
                        <select value={form.eventType} onChange={(event) => update("eventType", event.target.value)}>
                          {eventTypes.map((type) => <option key={type} value={type}>{eventTypeLabels[type]}</option>)}
                        </select>
                      </label>
                      <label className="service-field">
                        <span>Event date</span>
                        <input type="date" value={form.eventDate} min={minDate} max={`${new Date().getFullYear() + 1}-12-31`} onChange={(event) => update("eventDate", event.target.value)} required />
                      </label>
                    </div>
                    <div className="service-row">
                      <label className="service-field"><span>Number of guests</span><input type="number" inputMode="numeric" min={10} max={10000} value={form.guestCount} onChange={(event) => update("guestCount", event.target.value)} required placeholder="150" /></label>
                      <label className="service-field"><span>Delivery city or address</span><input value={form.deliveryAddress} onChange={(event) => update("deliveryAddress", event.target.value)} required minLength={2} maxLength={240} placeholder="Street, city, state" /></label>
                    </div>
                  </fieldset>

                  <fieldset className="service-fieldset">
                    <legend>What do you need?</legend>
                    <label className="service-field">
                      <span>Items and quantities</span>
                      <textarea
                        value={form.items}
                        onChange={(event) => update("items", event.target.value)}
                        required
                        minLength={10}
                        maxLength={2000}
                        placeholder="e.g. 5 bags of rice (50kg), 3 cartons of tomatoes, 2 crates of eggs, 40kg chicken, 20 litres of oil…"
                      />
                      {presetItem && (
                        <small className="service-help">Added from the product you selected — change the quantity or add the rest of your list.</small>
                      )}
                    </label>
                    <label className="service-field">
                      <span>Anything else we should know? (optional)</span>
                      <textarea value={form.notes} onChange={(event) => update("notes", event.target.value)} maxLength={600} placeholder="Serving style, packaging, delivery time, budget ceiling…" />
                    </label>
                  </fieldset>

                  {tier && (
                    <p className="service-notice" role="status">
                      <strong>{tier.label}.</strong> {tier.detail} That is {tier.days} day{tier.days === 1 ? "" : "s"} from today.
                    </p>
                  )}

                  <label className="service-consent">
                    <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} required />
                    <span>
                      I understand this is a request, not a paid order. SureFood will confirm the item list, the discount for
                      my planning band, delivery and the payment date before anything is charged.
                    </span>
                  </label>

                  <button className="service-submit" type="submit" disabled={busy}>
                    {busy ? "Sending your request…" : "Send event order request"} <span aria-hidden="true">→</span>
                  </button>
                </form>
              </section>
            )}
          </div>

          <aside style={{ display: "grid", gap: 16 }}>
            <section className="service-card">
              <h2>Discount by planning band</h2>
              <p>These are the bands we price event orders by. Your quote states the exact discount for your date.</p>
              <ul className="service-tiers">
                {eventPlanningTiers.map((band) => (
                  <li className={tier?.id === band.id ? "service-tier is-active" : "service-tier"} key={band.id}>
                    <b>{band.label}</b>
                    <small>{band.detail}</small>
                  </li>
                ))}
              </ul>
            </section>

            <section className="service-card">
              <h2>How event orders work</h2>
              <ol className="service-steps">
                <li><strong>Send the list.</strong> Tell us the date, the guests and what you need.</li>
                <li><strong>Get a quote.</strong> We confirm availability, the discount band and the total.</li>
                <li><strong>Pay ahead.</strong> Settle the invoice before the event date.</li>
                <li><strong>We deliver.</strong> Your food arrives on the agreed day, packaged for the event.</li>
              </ol>
            </section>

            <section className="service-card">
              <h2>Need credit for an event?</h2>
              <p>Pay Later applications are reviewed separately, and need a business or employment check with two referees.</p>
              <Link className="auth-service-link" href="/pay-later" style={{ fontSize: 11.5 }}>See if you qualify →</Link>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
