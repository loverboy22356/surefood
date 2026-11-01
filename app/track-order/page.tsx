"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { formatMarketMoney } from "@/app/components/marketplace-product";
import { ShopFooter, ShopHeader } from "@/app/components/shop-chrome";

type TrackedOrder = {
  id: string;
  status: string;
  paymentStatus: string;
  sellerName: string;
  currency: string;
  subtotalMinor: number;
  deliveryFeeMinor: number;
  totalMinor: number;
  placedAt: string;
  updatedAt: string;
  deliveryAddress: string;
  items: { name: string; quantity: number; lineTotalMinor: number; currency: string }[];
};

const milestones = ["Order Placed", "Packaging", "On The Road", "Delivered"];

/** Which milestone the order has reached, from its real status. */
function reached(status: string) {
  const value = status.toLowerCase();
  if (value.includes("deliver") && !value.includes("assigned")) return 3;
  if (value.includes("road") || value.includes("assigned") || value.includes("shipping")) return 2;
  if (value.includes("processing") || value.includes("ready") || value.includes("confirm") || value.includes("pack")) return 1;
  return 0;
}

function formatWhen(value: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-NG", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
}

function formatDay(value: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
}

function StepIcon({ name }: { name: "order" | "box" | "truck" | "check" }) {
  if (name === "order") {
    return (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M7 4h7l4 4v12H7z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
        <path d="M10 12h5M10 16h5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    );
  }
  if (name === "box") {
    return (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="m12 3 8 4.2v9.6L12 21l-8-4.2V7.2z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        <path d="m4 7.2 8 4.3 8-4.3M12 21v-9.5" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    );
  }
  if (name === "truck") {
    return (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M3 7h10v9H3zM13 10h4l3 3v3h-7z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        <circle cx="7" cy="18" r="1.7" stroke="currentColor" strokeWidth="1.6" />
        <circle cx="17" cy="18" r="1.7" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    );
  }
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="m5 12.5 4.5 4.5L19 7" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const stepIcons: ("order" | "box" | "truck" | "check")[] = ["order", "box", "truck", "check"];

function TrackOrderForm() {
  const params = useSearchParams();
  const [orderId, setOrderId] = useState(params.get("id") ?? "");
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [order, setOrder] = useState<TrackedOrder | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function track(event?: React.FormEvent) {
    event?.preventDefault();
    setError("");
    setOrder(null);
    if (!orderId.trim()) { setError("Enter your order ID."); return; }
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) { setError("Enter the email used on the order."); return; }
    setBusy(true);
    try {
      const response = await fetch(
        `/api/orders/track?id=${encodeURIComponent(orderId.trim())}&email=${encodeURIComponent(email.trim())}`,
        { signal: AbortSignal.timeout(15_000) },
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "We could not find that order.");
      setOrder(result.order as TrackedOrder);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "We could not find that order.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (params.get("id") && params.get("email")) void track();
    // The lookup runs once for a shared link; the form takes over afterwards.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const step = order ? reached(order.status) : 0;
  const doneShare = `${(step / (milestones.length - 1)) * 100}%`;

  return (
    <>
      <nav className="sf-flow-steps" aria-label="Breadcrumb">
        <Link href="/">Home</Link><i>/</i>
        <Link href="/account">My account</Link><i>/</i>
        <span className="is-on">Track order</span>
      </nav>

      <div className="trk-head">
        <Link href="/account" className="trk-back" aria-label="Back to your account">←</Link>
        <button
          type="button"
          className="trk-share"
          aria-label="Share this tracking page"
          onClick={() => {
            const url = window.location.href;
            if (navigator.share) void navigator.share({ title: "Track my Sure Foodz order", url }).catch(() => {});
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

      <h1 className="trk-title">Track Order</h1>
      <p className="trk-lede">
        To track your order, enter your order ID in the field below and press “Track Order”. That ID is on your
        receipt and in the confirmation email we sent you.
      </p>

      <form className="sf-track-form" onSubmit={track}>
        <div className="sf-field" style={{ margin: 0 }}>
          <label htmlFor="track-id">Order ID</label>
          <input id="track-id" value={orderId} onChange={(event) => setOrderId(event.target.value)} placeholder="ID..." />
        </div>
        <div className="sf-field" style={{ margin: 0 }}>
          <label htmlFor="track-email">Billing Email</label>
          <input id="track-email" value={email} onChange={(event) => setEmail(event.target.value)} type="email" placeholder="Email address" />
        </div>
      </form>

      <p className="sf-track-hint">
        <span className="trk-info" aria-hidden="true">i</span>
        Find the order ID in the email we sent you when you checked out.
      </p>

      <button className="trk-submit" type="button" onClick={() => track()} disabled={busy}>
        {busy ? "Looking up…" : "Track order"}
        <span aria-hidden="true">→</span>
      </button>

      {error && <p className="sf-auth-error" role="alert" style={{ marginTop: 16 }}>{error}</p>}

      {order && (
        <section className="trk-result">
          <div className="trk-card">
            <div className="trk-card-head">
              <span>
                <b>#{order.id}</b>
                <small>
                  {order.items.reduce((total, item) => total + item.quantity, 0)} products · Order placed{" "}
                  {formatWhen(order.placedAt) || "recently"} · {order.sellerName}
                </small>
              </span>
              <span className="trk-total">{formatMarketMoney(order.totalMinor, order.currency)}</span>
            </div>

            <div className="trk-expect">
              <span>
                {step >= 3 ? "Delivered" : "Order expected"} on{" "}
                <b>{formatDay(order.updatedAt || order.placedAt) || "a date the seller will confirm"}</b>
              </span>
              <span className={`trk-pay-pill ${order.paymentStatus === "paid" ? "is-paid" : ""}`}>
                {order.paymentStatus === "paid" ? "Paid" : "Payment pending"}
              </span>
            </div>

            <div className="sf-progress" style={{ ["--done" as string]: doneShare }}>
              {milestones.map((label, index) => (
                <div key={label} className={index <= step ? "sf-progress-step is-done" : "sf-progress-step"}>
                  <i aria-hidden="true">
                    <StepIcon name={index < step ? "check" : stepIcons[index]} />
                  </i>
                  <span>{label}</span>
                </div>
              ))}
            </div>

            <div className="trk-activity">
              <h2>Order activity</h2>

              <div className="sf-activity-row">
                <i aria-hidden="true">
                  <StepIcon name={step >= 3 ? "check" : stepIcons[step]} />
                </i>
                <div>
                  <b>{order.status}</b>
                  <small>
                    {order.paymentStatus === "paid"
                      ? "Payment received — the seller is preparing this order."
                      : "Payment opens once the seller confirms the delivery fee."}
                  </small>
                </div>
                <span className="trk-when">{formatWhen(order.updatedAt) || formatWhen(order.placedAt)}</span>
              </div>

              <div className="sf-activity-row">
                <i aria-hidden="true"><StepIcon name="order" /></i>
                <div>
                  <b>Order placed with {order.sellerName || "the seller"}</b>
                  <small>
                    {order.items.reduce((total, item) => total + item.quantity, 0)} products ·{" "}
                    {formatMarketMoney(order.subtotalMinor, order.currency)} items
                    {order.deliveryFeeMinor > 0 ? ` · ${formatMarketMoney(order.deliveryFeeMinor, order.currency)} delivery` : ""}
                  </small>
                </div>
                <span className="trk-when">{formatWhen(order.placedAt)}</span>
              </div>

              <div className="sf-activity-row">
                <i aria-hidden="true">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M12 21s7-6.1 7-11a7 7 0 1 0-14 0c0 4.9 7 11 7 11Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
                    <circle cx="12" cy="10" r="2.4" stroke="currentColor" strokeWidth="1.7" />
                  </svg>
                </i>
                <div>
                  <b>Delivering to</b>
                  <small>{order.deliveryAddress || "Address on file"}</small>
                </div>
                <span className="trk-when">{order.currency}</span>
              </div>
            </div>
          </div>

          <div className="trk-items">
            <h2>Items in this order</h2>
            {order.items.map((item, index) => (
              <div className="trk-item-row" key={`${item.name}-${index}`}>
                <span>{item.quantity} × {item.name}</span>
                <b>{formatMarketMoney(item.lineTotalMinor, item.currency)}</b>
              </div>
            ))}
            <div className="trk-item-row is-total">
              <span>Order total</span>
              <b>{formatMarketMoney(order.totalMinor, order.currency)}</b>
            </div>
          </div>
        </section>
      )}
    </>
  );
}

export default function TrackOrderPage() {
  return (
    <div className="sf-page">
      <ShopHeader />
      <main className="sf-shell" style={{ flex: "1 1 auto", paddingBottom: 60 }}>
        <Suspense fallback={<div style={{ minHeight: "40vh" }} />}>
          <TrackOrderForm />
        </Suspense>
      </main>
      <ShopFooter />
    </div>
  );
}
