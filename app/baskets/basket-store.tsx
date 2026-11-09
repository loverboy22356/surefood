"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ShopFooter, ShopHeader } from "@/app/components/shop-chrome";
import {
  basketFrequencies,
  basketPlans,
  deliveryDays,
  formatNaira,
  frequencyDiscount,
  frequencyLabels,
  priceForFrequency,
  type BasketFrequency,
  type BasketPlan,
} from "@/lib/baskets";
import { SubscribeForm, type BasketIntent } from "./subscribe-form";
import "./baskets.css";

const steps = [
  { n: "01", title: "Pick a basket", copy: "Ready-made or built from the products you actually use." },
  { n: "02", title: "Choose a rhythm", copy: "Weekly, every two weeks or monthly — change it whenever you like." },
  { n: "03", title: "We source and pack", copy: "Verified sellers pack your basket fresh, and we check every delivery." },
  { n: "04", title: "Delivered to you", copy: "Fixed delivery day, one clear price, no last-minute market runs." },
];

export function BasketStore() {
  const [frequency, setFrequency] = useState<BasketFrequency>("monthly");
  const [tiers, setTiers] = useState<Record<string, string>>(() => Object.fromEntries(
    basketPlans.map((plan) => [plan.id, plan.tiers[1]?.id ?? plan.tiers[0].id]),
  ));
  const [intent, setIntent] = useState<BasketIntent | null>(null);
  const [done, setDone] = useState<{ planName: string; nextDelivery: string } | null>(null);

  const savings = Math.round(frequencyDiscount.weekly * 100);

  const summary = useMemo(() => {
    return basketPlans.map((plan) => {
      const tier = plan.tiers.find((item) => item.id === tiers[plan.id]) ?? plan.tiers[0];
      return { plan, tier, price: priceForFrequency(tier.priceMinor, frequency) };
    });
  }, [tiers, frequency]);

  function choose(plan: BasketPlan, tierId: string) {
    const tier = plan.tiers.find((item) => item.id === tierId) ?? plan.tiers[0];
    setIntent({
      type: "plan",
      planId: plan.id,
      planName: plan.name,
      tier: tier.id,
      frequency,
      amountMinor: priceForFrequency(tier.priceMinor, frequency),
    });
  }

  return (
    <div className="sf-page">
      <ShopHeader />
      <main className="sf-shell bsk-main">
        <section className="bsk-hero">
          <div className="bsk-hero-copy">
            <span className="bsk-kicker">Sure Foodz Basket</span>
            <h1>Your food, on a schedule.<br /><em>Never run out again.</em></h1>
            <p>
              A basket of household staples delivered every week, every two weeks or every month.
              Pick a ready-made basket or build one around the way your home actually eats.
            </p>
            <div className="bsk-hero-actions">
              <a className="bsk-primary" href="#plans">Choose a basket</a>
              <Link className="bsk-ghost" href="/baskets/build">Build your own →</Link>
            </div>
            <ul className="bsk-hero-points">
              <li><b>From ₦18,500</b><span>per delivery</span></li>
              <li><b>{savings}% off</b><span>on weekly plans</span></li>
              <li><b>Skip or pause</b><span>any time</span></li>
            </ul>
          </div>
          <div className="bsk-hero-art" aria-hidden="true">
            <div className="bsk-art-card is-back">🧺</div>
            <div className="bsk-art-card is-mid">🥬</div>
            <div className="bsk-art-card is-front">🍚</div>
            <div className="bsk-art-badge">Free delivery on baskets</div>
          </div>
        </section>

        <section className="bsk-controls" aria-label="Basket options">
          <div>
            <span className="bsk-label">How often should it arrive?</span>
            <div className="bsk-chips">
              {basketFrequencies.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={frequency === option ? "bsk-chip is-on" : "bsk-chip"}
                  aria-pressed={frequency === option}
                  onClick={() => setFrequency(option)}
                >
                  {frequencyLabels[option]}
                  {frequencyDiscount[option] > 0 && <em>save {Math.round(frequencyDiscount[option] * 100)}%</em>}
                </button>
              ))}
            </div>
          </div>
          <p className="bsk-note">
            Baskets arrive on your chosen day between {deliveryDays[0]} and {deliveryDays[deliveryDays.length - 1]}.
            You can skip a delivery or pause the plan from your dashboard.
          </p>
        </section>

        <section id="plans" className="bsk-plans">
          {summary.map(({ plan, tier, price }) => (
            <article key={plan.id} className={plan.popular ? "bsk-plan is-popular" : "bsk-plan"}>
              {plan.popular && <span className="bsk-flag">Most popular</span>}
              <div className="bsk-plan-top">
                <span className="bsk-plan-emoji" style={{ background: `${plan.accent}1a`, color: plan.accent }} aria-hidden="true">{plan.emoji}</span>
                <div>
                  <h2>{plan.name}</h2>
                  <p>{plan.audience}</p>
                </div>
              </div>

              <ul className="bsk-items">
                {plan.items.slice(0, 5).map((item) => <li key={item}>{item}</li>)}
                {plan.items.length > 5 && <li className="is-more">+ {plan.items.length - 5} more essentials</li>}
              </ul>

              <div className="bsk-tiers" role="group" aria-label={`${plan.name} package size`}>
                {plan.tiers.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className={tiers[plan.id] === option.id ? "bsk-tier is-on" : "bsk-tier"}
                    aria-pressed={tiers[plan.id] === option.id}
                    onClick={() => setTiers((current) => ({ ...current, [plan.id]: option.id }))}
                  >
                    <b>{option.label}</b>
                    <small>{formatNaira(priceForFrequency(option.priceMinor, frequency))}</small>
                  </button>
                ))}
              </div>

              <p className="bsk-tier-note">{tier.note}</p>

              <div className="bsk-plan-foot">
                <div>
                  <strong>{formatNaira(price)}</strong>
                  <small>{frequencyLabels[frequency].toLowerCase()} · per delivery</small>
                </div>
                <button type="button" className="bsk-primary" onClick={() => choose(plan, tier.id)}>
                  Choose {tier.label}
                </button>
              </div>
            </article>
          ))}
        </section>

        <section className="bsk-builder">
          <div>
            <span className="bsk-kicker">Your kitchen, your list</span>
            <h2>Build your own basket</h2>
            <p>
              Choose rice, beans, garri, oil, crayfish, fish — whatever your household actually
              uses. We price it live and deliver it on repeat.
            </p>
          </div>
          <Link className="bsk-primary is-light" href="/baskets/build">Start building →</Link>
        </section>

        <section className="bsk-steps" aria-label="How the basket service works">
          {steps.map((step) => (
            <article key={step.n}>
              <span aria-hidden="true">{step.n}</span>
              <h3>{step.title}</h3>
              <p>{step.copy}</p>
            </article>
          ))}
        </section>

        <section className="bsk-faq">
          <h2>Questions people ask</h2>
          <details>
            <summary>When do I pay?</summary>
            <p>Nothing is charged when you start. We confirm the basket with our sellers and send a payment link before each delivery — or you can prepay several deliveries at once.</p>
          </details>
          <details>
            <summary>Can I change what is inside?</summary>
            <p>Yes. Ready-made baskets can be swapped for a custom basket at any time, and custom baskets can be edited from your dashboard before the cut-off for the next delivery.</p>
          </details>
          <details>
            <summary>What if I travel?</summary>
            <p>Skip a single delivery, pause the whole plan, or change your delivery day. Your next delivery date updates immediately.</p>
          </details>
          <details>
            <summary>Do you deliver to businesses?</summary>
            <p>Yes — canteens, restaurants, offices and resellers use the Business Basket. For contract pricing, <Link href="/business#quote">request a quotation</Link>.</p>
          </details>
        </section>
      </main>
      <ShopFooter />

      {intent && (
        <SubscribeForm
          intent={intent}
          onClose={() => setIntent(null)}
          onSubscribed={(result) => {
            setIntent(null);
            setDone(result);
          }}
        />
      )}

      {done && (
        <div className="bsk-done" role="status">
          <div>
            <strong>{done.planName} is saved.</strong>
            <span>
              First delivery: {done.nextDelivery ? new Date(`${done.nextDelivery}T09:00:00`).toDateString() : "we will confirm shortly"}.
            </span>
          </div>
          <Link href="/baskets/dashboard">Open my basket plan</Link>
          <button type="button" aria-label="Dismiss" onClick={() => setDone(null)}>×</button>
        </div>
      )}
    </div>
  );
}
