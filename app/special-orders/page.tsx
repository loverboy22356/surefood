"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ShopFooter, ShopHeader } from "@/app/components/shop-chrome";
import {
  eventPlanningTiers,
  eventTypeLabels,
  eventTypes,
  planningTierFor,
  type EventType,
} from "@/lib/requests";
import "@/app/services.css";
import "@/app/services-premium.css";

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
    <div className="sf-page">
      <ShopHeader />

      <main className="sf-shell" style={{ flex: "1 1 auto", paddingBottom: 60 }}>
        <nav className="sf-flow-steps" aria-label="Breadcrumb">
          <Link href="/">Home</Link><i>/</i>
          <Link href="/shop">Shop</Link><i>/</i>
          <span className="is-on">Special orders</span>
        </nav>

        <header className="svc-hero">
          <div className="svc-hero-copy">
            <div className="svc-head">
              <Link href="/shop" className="svc-back" aria-label="Back to the shop">←</Link>
              <button
                type="button"
                className="svc-share"
                aria-label="Share this page"
                onClick={() => {
                  const url = window.location.href;
                  if (navigator.share) void navigator.share({ title: "Sure Foodz event orders", url }).catch(() => {});
                  else void navigator.clipboard?.writeText(url);
                }}
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle cx="18" cy="5" r="2.6" stroke="currentColor" strokeWidth="1.8" />
                  <circle cx="6" cy="12" r="2.6" stroke="currentColor" strokeWidth="1.8" />
                  <circle cx="18" cy="19" r="2.6" stroke="currentColor" strokeWidth="1.8" />
                  <path d="m8.5 10.8 7-4.2M8.5 13.2l7 4.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <span className="svc-kicker">Special &amp; event orders</span>
            <h1 className="svc-title">Event orders</h1>
            <p className="svc-lede">
              Weddings, birthdays, corporate lunches, festivals — send us the list ahead of the date. The earlier you order,
              the deeper the planning discount we can give you, so you can pay for the food before the day itself.
            </p>
            <ul className="svc-points">
              <li>Order weeks or months ahead</li>
              <li>Discount band set by your lead time</li>
              <li>Everything confirmed in writing before you pay</li>
            </ul>
          </div>

          <div className="svc-hero-art" aria-hidden="true">
            <img src="/images/hero-produce.webp" alt="" />
          </div>
        </header>

        <div className="svc-layout">
          <div className="svc-main">
            {error && <p className="svc-alert" role="alert">{error}</p>}

            {result ? (
              <section className="svc-card svc-status" aria-live="polite">
                <span className="svc-badge">Request received</span>
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
                <p style={{ marginTop: 16 }}>
                  <Link className="svc-link" href="/shop">Back to shopping →</Link>
                  <button type="button" className="svc-link" style={{ marginLeft: 16 }} onClick={() => setResult(null)}>
                    Send another request
                  </button>
                </p>
              </section>
            ) : (
              <section className="svc-card">
                <h2>Tell us about the event</h2>
                <p>The more detail you give about quantities, the tighter the quote we can send back.</p>
                <form className="svc-form" onSubmit={submit}>
                  <fieldset className="svc-fieldset">
                    <legend>Who should we contact?</legend>
                    <div className="svc-row">
                      <label className="svc-field"><span>Full name</span><input value={form.fullName} onChange={(event) => update("fullName", event.target.value)} required minLength={2} maxLength={120} autoComplete="name" /></label>
                      <label className="svc-field"><span>Phone number</span><input type="tel" value={form.phone} onChange={(event) => update("phone", event.target.value)} required placeholder="0803 000 0000" autoComplete="tel" /></label>
                    </div>
                    <label className="svc-field"><span>Email address</span><input type="email" value={form.email} onChange={(event) => update("email", event.target.value)} required autoComplete="email" /></label>
                  </fieldset>

                  <fieldset className="svc-fieldset">
                    <legend>The event</legend>
                    <div className="svc-row">
                      <label className="svc-field">
                        <span>Event type</span>
                        <select value={form.eventType} onChange={(event) => update("eventType", event.target.value)}>
                          {eventTypes.map((type) => <option key={type} value={type}>{eventTypeLabels[type]}</option>)}
                        </select>
                      </label>
                      <label className="svc-field">
                        <span>Event date</span>
                        <input type="date" value={form.eventDate} min={minDate} max={`${new Date().getFullYear() + 1}-12-31`} onChange={(event) => update("eventDate", event.target.value)} required />
                      </label>
                    </div>
                    <div className="svc-row">
                      <label className="svc-field"><span>Number of guests</span><input type="number" inputMode="numeric" min={10} max={10000} value={form.guestCount} onChange={(event) => update("guestCount", event.target.value)} required placeholder="150" /></label>
                      <label className="svc-field"><span>Delivery city or address</span><input value={form.deliveryAddress} onChange={(event) => update("deliveryAddress", event.target.value)} required minLength={2} maxLength={240} placeholder="Street, city, state" /></label>
                    </div>
                  </fieldset>

                  <fieldset className="svc-fieldset">
                    <legend>What do you need?</legend>
                    <label className="svc-field">
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
                        <small className="svc-help">Added from the product you selected — change the quantity or add the rest of your list.</small>
                      )}
                    </label>
                    <label className="svc-field" style={{ marginTop: 12 }}>
                      <span>Anything else we should know? (optional)</span>
                      <textarea value={form.notes} onChange={(event) => update("notes", event.target.value)} maxLength={600} placeholder="Serving style, packaging, delivery time, budget ceiling…" />
                    </label>
                  </fieldset>

                  {tier && (
                    <p className="svc-notice" role="status">
                      <strong>{tier.label}.</strong> {tier.detail} That is {tier.days} day{tier.days === 1 ? "" : "s"} from today.
                    </p>
                  )}

                  <label className="svc-consent">
                    <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} required />
                    <span>
                      I understand this is a request, not a paid order. Sure Foodz will confirm the item list, the discount for
                      my planning band, delivery and the payment date before anything is charged.
                    </span>
                  </label>

                  <button className="svc-submit" type="submit" disabled={busy}>
                    {busy ? "Sending your request…" : "Send event order request"} <span aria-hidden="true">→</span>
                  </button>
                </form>
              </section>
            )}
          </div>

          <aside className="svc-side">
            <section className="svc-card">
              <div className="svc-card-head"><span aria-hidden="true">%</span><h2>Discount by planning band</h2></div>
              <p style={{ marginBottom: 12 }}>These are the bands we price event orders by. Your quote states the exact discount for your date.</p>
              <ul className="svc-tiers">
                {eventPlanningTiers.map((band) => (
                  <li className={tier?.id === band.id ? "svc-tier is-active" : "svc-tier"} key={band.id}>
                    <b>{band.label}</b>
                    <small>{band.detail}</small>
                    <em>{band.minDays === 0 ? "Any lead time" : `${band.minDays}+ days ahead`}</em>
                  </li>
                ))}
              </ul>
            </section>

            <section className="svc-card">
              <div className="svc-card-head"><span aria-hidden="true">✓</span><h2>How event orders work</h2></div>
              <ol className="svc-steps">
                <li><strong>Send the list.</strong> Tell us the date, the guests and what you need.</li>
                <li><strong>Get a quote.</strong> We confirm availability, the discount band and the total.</li>
                <li><strong>Pay ahead.</strong> Settle the invoice before the event date.</li>
                <li><strong>We deliver.</strong> Your food arrives on the agreed day, packaged for the event.</li>
              </ol>
            </section>

            <section className="svc-card">
              <div className="svc-card-head"><span aria-hidden="true">🗓</span><h2>Need credit for an event?</h2></div>
              <p>Pay Later applications are reviewed separately, and need a business or employment check with two referees.</p>
              <Link className="svc-link" href="/pay-later">See if you qualify →</Link>
            </section>
          </aside>
        </div>
      </main>

      <ShopFooter />
    </div>
  );
}
