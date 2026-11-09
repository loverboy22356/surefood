"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { firebaseAuth, firebaseConfigured } from "@/lib/firebase/client";
import {
  deliveryDays,
  formatNaira,
  frequencyLabels,
  type BasketFrequency,
  type DeliveryDay,
} from "@/lib/baskets";

export type BasketIntent =
  | {
      type: "plan";
      planId: string;
      planName: string;
      tier: string;
      frequency: BasketFrequency;
      amountMinor: number;
    }
  | {
      type: "custom";
      items: { productId: string; quantity: number }[];
      frequency: BasketFrequency;
      amountMinor: number;
    };

type Props = {
  intent: BasketIntent;
  onClose: () => void;
  onSubscribed: (result: { planName: string; nextDelivery: string }) => void;
};

const emptyForm = {
  customerName: "",
  phone: "",
  address: "",
  city: "",
  region: "",
  deliveryDay: "Saturday" as DeliveryDay,
  notes: "",
  consent: false,
};

/** The one form both the ready-made shelf and the basket builder use. */
export function SubscribeForm({ intent, onClose, onSubscribed }: Props) {
  const router = useRouter();
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const title = intent.type === "plan" ? intent.planName : "Your custom basket";
  const frequency = intent.frequency;

  function update<K extends keyof typeof emptyForm>(key: K, value: (typeof emptyForm)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (!firebaseConfigured()) {
      setError("Basket subscriptions are not available yet.");
      return;
    }
    if (!form.consent) {
      setError("Confirm that we may contact you about this basket.");
      return;
    }
    const user = firebaseAuth().currentUser;
    if (!user) {
      router.push(`/login?next=${encodeURIComponent(window.location.pathname)}`);
      return;
    }

    setBusy(true);
    try {
      const token = await user.getIdToken();
      const body = {
        type: intent.type,
        frequency,
        customerName: form.customerName,
        phone: form.phone,
        address: form.address,
        city: form.city,
        region: form.region,
        deliveryDay: form.deliveryDay,
        notes: form.notes,
        ...(intent.type === "plan"
          ? { planId: intent.planId, tier: intent.tier }
          : { items: intent.items }),
      };
      const response = await fetch("/api/baskets", {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(typeof result.error === "string" ? result.error : "We could not start this basket. Please try again.");
        return;
      }
      onSubscribed({
        planName: String(result?.subscription?.planName ?? title),
        nextDelivery: String(result?.subscription?.nextDelivery ?? ""),
      });
    } catch {
      setError("We could not reach Sure Foodz. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bsk-sheet" role="dialog" aria-modal="true" aria-label={`Start ${title}`}>
      <button type="button" className="bsk-sheet-scrim" aria-label="Close" onClick={onClose} />
      <div className="bsk-sheet-panel">
        <header className="bsk-sheet-head">
          <div>
            <span className="bsk-kicker">Start your plan</span>
            <h2>{title}</h2>
            <p>
              {frequencyLabels[frequency]} · {formatNaira(intent.amountMinor)} per delivery
            </p>
          </div>
          <button type="button" className="bsk-sheet-close" aria-label="Close" onClick={onClose}>×</button>
        </header>

        <form className="bsk-form" onSubmit={submit}>
          <div className="bsk-form-grid">
            <label>
              <span>Name</span>
              <input
                value={form.customerName}
                onChange={(event) => update("customerName", event.target.value)}
                autoComplete="name"
                placeholder="Who should we deliver to?"
              />
            </label>
            <label>
              <span>Phone</span>
              <input
                value={form.phone}
                onChange={(event) => update("phone", event.target.value)}
                autoComplete="tel"
                inputMode="tel"
                placeholder="0803 000 0000"
                required
              />
            </label>
          </div>

          <label className="bsk-wide">
            <span>Delivery address</span>
            <input
              value={form.address}
              onChange={(event) => update("address", event.target.value)}
              autoComplete="street-address"
              placeholder="Street, building, landmark"
              required
            />
          </label>

          <div className="bsk-form-grid">
            <label>
              <span>City</span>
              <input value={form.city} onChange={(event) => update("city", event.target.value)} autoComplete="address-level2" required />
            </label>
            <label>
              <span>State</span>
              <input value={form.region} onChange={(event) => update("region", event.target.value)} autoComplete="address-level1" required />
            </label>
          </div>

          <div className="bsk-form-grid">
            <label>
              <span>Delivery day</span>
              <select value={form.deliveryDay} onChange={(event) => update("deliveryDay", event.target.value as DeliveryDay)}>
                {deliveryDays.map((day) => <option key={day} value={day}>{day}</option>)}
              </select>
            </label>
            <label>
              <span>Notes (optional)</span>
              <input value={form.notes} onChange={(event) => update("notes", event.target.value)} placeholder="Gate code, preferred time…" />
            </label>
          </div>

          <label className="bsk-check">
            <input type="checkbox" checked={form.consent} onChange={(event) => update("consent", event.target.checked)} />
            <span>Sure Foodz may contact me on this number to confirm my basket and delivery.</span>
          </label>

          {error && <p className="bsk-error" role="alert">{error}</p>}

          <div className="bsk-form-foot">
            <p>
              Nothing is charged now. We confirm stock with our sellers, then send you a payment
              link before the first delivery.
            </p>
            <button type="submit" className="bsk-primary" disabled={busy}>
              {busy ? "Saving…" : "Confirm basket plan"}
            </button>
          </div>

          <p className="bsk-small">
            Prefer to talk it through? <Link href="/contact">Speak to our team</Link>.
          </p>
        </form>
      </div>
    </div>
  );
}
