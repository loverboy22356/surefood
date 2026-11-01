import type { Metadata } from "next";
import Link from "next/link";
import { InfoPage } from "../components/info-page";

export const metadata: Metadata = {
  title: "About us | Sure Foodz",
  description: "Sure Foodz connects shoppers with verified local farmers, vendors and suppliers across Nigeria — with pay later and event ordering built in.",
};

export default function AboutPage() {
  return (
    <InfoPage
      kicker="About Sure Foodz"
      title="Good food, from people you can trust."
      lede="Sure Foodz is a Nigerian food marketplace. We bring verified farmers, vendors and suppliers together in one place, so families can buy fresh food at a fair price — and businesses can reach customers they could never reach alone."
    >
      <h2>Why we exist</h2>
      <p>
        Buying food in Nigeria usually means a long trip to a crowded market, prices that change depending on who is asking,
        and no way to know who actually grew or packed what you are buying. We built Sure Foodz to remove that guesswork.
        Every seller on the platform is checked before they can list a single product, and every price you see is the price
        you pay at checkout.
      </p>

      <h2>What you can do here</h2>
      <div className="info-cards">
        <div className="info-card">
          <strong>Shop verified sellers</strong>
          <small>Buy from approved vendors and suppliers, filtered to your city so delivery stays short and food stays fresh.</small>
        </div>
        <div className="info-card">
          <strong>Buy now, pay later</strong>
          <small>Get your food today and pay over an agreed period. No bank card required — we review your documents instead.</small>
        </div>
        <div className="info-card">
          <strong>Special & event orders</strong>
          <small>Plan a wedding, party or corporate event ahead of time and lock in a discount the earlier you order.</small>
        </div>
        <div className="info-card">
          <strong>Earn with referrals</strong>
          <small>Share products with your network through the affiliate programme and earn commission on paid orders.</small>
        </div>
      </div>

      <h2>How we verify sellers</h2>
      <p>
        Vendors and suppliers submit their business registration, address and identity documents before they are approved.
        Our team reviews each application by hand. Approved accounts carry a <strong>Verified</strong> badge on their store
        and on every product they list, so you always know who you are buying from.
      </p>
      <p>
        If a seller ever fails to meet our standards, we suspend the account and stop new orders. Verification is not a
        one-off: sellers are re-checked as their records change.
      </p>

      <h2>Payments and protection</h2>
      <p>
        Payments are processed securely by our payment partner. Buyers are charged in naira (₦); prices shown in other
        currencies are estimates for reference only, converted with a live rate before you order.
      </p>
      <div className="info-callout">
        Pay Later applications, event orders and affiliate payouts are reviewed by our team. We only approve what we can
        verify — this keeps honest buyers protected and keeps the platform fair for everyone.
      </div>

      <h2>Where we are</h2>
      <p>
        We operate from Nigeria with sellers in Lagos, Abuja, Port Harcourt, Ibadan, Kano, Enugu, Benin City and Kaduna.
        New cities are added as verified sellers join, so the list keeps growing.
      </p>

      <h2>Talk to us</h2>
      <p>
        Questions, partnerships or a problem with an order — our team answers every message. Reach us at{" "}
        <a href="mailto:surefoodglobal@gmail.com">surefoodglobal@gmail.com</a> or through the contact page.
      </p>
      <div className="info-cta-row">
        <Link className="info-cta" href="/contact">Contact us</Link>
        <Link className="info-cta is-quiet" href="/search">Start shopping</Link>
      </div>
    </InfoPage>
  );
}
