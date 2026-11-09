"use client";

import Link from "next/link";
import { useState } from "react";
import { ShopFooter, ShopHeader } from "@/app/components/shop-chrome";
import {
  businessTypeLabels,
  businessTypes,
  orderRhythmLabels,
  orderRhythms,
  type BusinessType,
  type OrderRhythm,
} from "@/lib/business";
import "./business.css";

const benefits = [
  { icon: "📉", title: "Wholesale pricing", copy: "Unit prices drop as volume grows — confirmed in writing before you pay." },
  { icon: "📦", title: "Bulk quantities", copy: "50kg bags, 25-litre jerrycans, full cartons. Order the case, not the sachet." },
  { icon: "🔁", title: "Repeat orders", copy: "Reorder last month's list in one tap, with the same prices and terms." },
  { icon: "🗓", title: "Scheduled deliveries", copy: "Pick a weekday and a window. Your kitchen gets stocked on a rhythm." },
  { icon: "🧾", title: "One clear invoice", copy: "VAT-ready invoices, bank transfer or Paystack, and a named account manager." },
  { icon: "🏢", title: "Business account", copy: "Add your team, keep purchase records, and track every purchase in one place." },
];

const steps = [
  { n: "01", title: "Tell us what you buy", copy: "Send your weekly or monthly list — rice, oil, beans, protein, dry goods, packaging." },
  { n: "02", title: "We price it", copy: "We compare verified sellers locally, apply the wholesale band, and send a written quote." },
  { n: "03", title: "Confirm and schedule", copy: "Approve the quote, choose a delivery day, and we repeat it for as long as you need." },
];

const emptyForm = {
  businessName: "",
  contactName: "",
  email: "",
  phone: "",
  businessType: "restaurant" as BusinessType,
  needs: "",
  quantity: "",
  rhythm: "weekly" as OrderRhythm,
  address: "",
  city: "",
  region: "",
  notes: "",
  consent: false,
};

export function BusinessHub() {
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reference, setReference] = useState("");

  function update<K extends keyof typeof emptyForm>(key: K, value: (typeof emptyForm)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (!form.consent) {
      setError("Please agree to be contacted about this quotation.");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/business/quotes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(typeof result.error === "string" ? result.error : "We could not send your request. Please try again.");
        return;
      }
      setReference(String(result.reference ?? ""));
      setForm(emptyForm);
    } catch {
      setError("We could not reach Sure Foodz. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="sf-page">
      <ShopHeader />
      <main className="sf-shell biz-main">
        <section className="biz-hero">
          <div className="biz-hero-copy">
            <span className="biz-kicker">Sure Foodz for business</span>
            <h1>Buy food in bulk.<br /><em>Pay wholesale prices.</em></h1>
            <p>
              Restaurants, canteens, offices, caterers and resellers buy from verified sellers
              through one account — with written quotations, scheduled deliveries and invoices
              your accountant will accept.
            </p>
            <div className="biz-hero-actions">
              <a className="biz-primary" href="#quote">Request a quotation</a>
              <Link className="biz-ghost" href="/signup?role=vendor">Create a business account →</Link>
            </div>
            <ul className="biz-hero-badges">
              <li>Quotes within 24 hours</li>
              <li>From ₦150,000 per delivery</li>
              <li>Pay later available</li>
            </ul>
          </div>
          <div className="biz-hero-card" aria-hidden="true">
            <div className="biz-mini-row"><span>50kg rice</span><b>₦72,000</b></div>
            <div className="biz-mini-row"><span>25L palm oil</span><b>₦48,500</b></div>
            <div className="biz-mini-row"><span>25kg beans</span><b>₦61,200</b></div>
            <div className="biz-mini-total"><span>Weekly kitchen restock</span><b>₦181,700</b><small>Quoted price · delivered Thursdays</small></div>
          </div>
        </section>

        <section className="biz-benefits" aria-label="What business buyers get">
          {benefits.map((benefit) => (
            <article key={benefit.title}>
              <span className="biz-benefit-icon" aria-hidden="true">{benefit.icon}</span>
              <h2>{benefit.title}</h2>
              <p>{benefit.copy}</p>
            </article>
          ))}
        </section>

        <section className="biz-steps" aria-label="How business ordering works">
          <div className="biz-section-head">
            <span className="biz-kicker">How it works</span>
            <h2>From list to delivery in three steps</h2>
          </div>
          <div className="biz-step-grid">
            {steps.map((step) => (
              <article key={step.n}>
                <span aria-hidden="true">{step.n}</span>
                <h3>{step.title}</h3>
                <p>{step.copy}</p>
              </article>
            ))}
          </div>
          <p className="biz-fineprint">
            Bulk pricing is quotation-based: the more you order and the more regular the order,
            the lower the unit price. Every quote is written down, so nothing changes at the till.
          </p>
        </section>

        <section id="quote" className="biz-quote">
          <div className="biz-quote-copy">
            <span className="biz-kicker">Request a quotation</span>
            <h2>Tell us what your business needs</h2>
            <p>
              Send your list and quantities. A Sure Foodz business agent replies within one working
              day with prices, delivery days and payment terms.
            </p>
            <ul className="biz-quote-points">
              <li>No account needed to ask</li>
              <li>Quantities from one carton to a full truck</li>
              <li>Weekly, fortnightly or monthly supply</li>
            </ul>
            <div className="biz-quote-links">
              <Link href="/pay-later">Pay later for business →</Link>
              <Link href="/special-orders">Catering and events →</Link>
              <Link href="/baskets">Recurring baskets →</Link>
            </div>
          </div>

          {reference ? (
            <div className="biz-success" role="status">
              <span aria-hidden="true">✓</span>
              <h3>Request received</h3>
              <p>
                Your reference is <strong>{reference}</strong>. We will call or email within one
                working day with the quotation.
              </p>
              <button type="button" className="biz-ghost" onClick={() => setReference("")}>Send another list</button>
            </div>
          ) : (
            <form className="biz-form" onSubmit={submit}>
              <div className="biz-form-grid">
                <label>
                  <span>Business name</span>
                  <input value={form.businessName} onChange={(event) => update("businessName", event.target.value)} required autoComplete="organization" />
                </label>
                <label>
                  <span>Contact name</span>
                  <input value={form.contactName} onChange={(event) => update("contactName", event.target.value)} required autoComplete="name" />
                </label>
              </div>

              <div className="biz-form-grid">
                <label>
                  <span>Email</span>
                  <input type="email" value={form.email} onChange={(event) => update("email", event.target.value)} required autoComplete="email" />
                </label>
                <label>
                  <span>Phone</span>
                  <input value={form.phone} onChange={(event) => update("phone", event.target.value)} required autoComplete="tel" inputMode="tel" placeholder="0803 000 0000" />
                </label>
              </div>

              <div className="biz-form-grid">
                <label>
                  <span>Business type</span>
                  <select value={form.businessType} onChange={(event) => update("businessType", event.target.value as BusinessType)}>
                    {businessTypes.map((type) => <option key={type} value={type}>{businessTypeLabels[type]}</option>)}
                  </select>
                </label>
                <label>
                  <span>How often</span>
                  <select value={form.rhythm} onChange={(event) => update("rhythm", event.target.value as OrderRhythm)}>
                    {orderRhythms.map((rhythm) => <option key={rhythm} value={rhythm}>{orderRhythmLabels[rhythm]}</option>)}
                  </select>
                </label>
              </div>

              <label>
                <span>What do you need?</span>
                <textarea
                  value={form.needs}
                  onChange={(event) => update("needs", event.target.value)}
                  rows={3}
                  maxLength={600}
                  placeholder="e.g. rice, beans, palm oil, vegetable oil, tomato paste, seasoning"
                  required
                />
              </label>

              <label>
                <span>Quantities (optional)</span>
                <input value={form.quantity} onChange={(event) => update("quantity", event.target.value)} placeholder="e.g. 10 bags of 50kg rice, 4 jerrycans of 25L oil" />
              </label>

              <div className="biz-form-grid">
                <label className="biz-wide">
                  <span>Delivery address</span>
                  <input value={form.address} onChange={(event) => update("address", event.target.value)} autoComplete="street-address" />
                </label>
                <label>
                  <span>City</span>
                  <input value={form.city} onChange={(event) => update("city", event.target.value)} autoComplete="address-level2" />
                </label>
                <label>
                  <span>State</span>
                  <input value={form.region} onChange={(event) => update("region", event.target.value)} autoComplete="address-level1" />
                </label>
              </div>

              <label>
                <span>Anything else? (optional)</span>
                <input value={form.notes} onChange={(event) => update("notes", event.target.value)} placeholder="Invoicing details, delivery window, packaging…" />
              </label>

              <label className="biz-check">
                <input type="checkbox" checked={form.consent} onChange={(event) => update("consent", event.target.checked)} />
                <span>Sure Foodz may contact me about this quotation.</span>
              </label>

              {error && <p className="biz-error" role="alert">{error}</p>}

              <button type="submit" className="biz-primary" disabled={busy}>
                {busy ? "Sending…" : "Send quotation request"}
              </button>
              <p className="biz-small">No payment is taken now. Quotations are free.</p>
            </form>
          )}
        </section>

        <section className="biz-close">
          <div>
            <h2>Already buying for a household?</h2>
            <p>The Sure Foodz Basket delivers the same quality on a weekly, fortnightly or monthly rhythm.</p>
          </div>
          <Link className="biz-primary" href="/baskets">Explore baskets →</Link>
        </section>
      </main>
      <ShopFooter />
    </div>
  );
}
