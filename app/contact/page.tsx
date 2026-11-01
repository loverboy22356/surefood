import type { Metadata } from "next";
import Link from "next/link";
import { InfoPage } from "../components/info-page";

export const metadata: Metadata = {
  title: "Contact us | Sure Foodz",
  description: "Reach the Sure Foodz team about orders, deliveries, Pay Later, event orders, selling on Sure Foodz or affiliate payouts.",
};

export default function ContactPage() {
  return (
    <InfoPage
      kicker="Contact"
      title="We are here to help."
      lede="Whether it is an order that needs a hand, a Pay Later question or a business you want to list, our team reads every message and replies in the order they arrive."
    >
      <h2>Reach us</h2>
      <div className="info-cards">
        <div className="info-card">
          <strong>Customer support</strong>
          <small>Orders, delivery and payments.</small>
          <a href="mailto:surefoodglobal@gmail.com">surefoodglobal@gmail.com</a>
        </div>
        <div className="info-card">
          <strong>Pay Later desk</strong>
          <small>Applications, documents and repayments.</small>
          <a href="mailto:surefoodglobal@gmail.com?subject=Pay%20Later%20enquiry">surefoodglobal@gmail.com</a>
        </div>
        <div className="info-card">
          <strong>Vendors & suppliers</strong>
          <small>Onboarding, verification and listings.</small>
          <Link href="/signup?role=vendor">Become a vendor →</Link>
        </div>
        <div className="info-card">
          <strong>Affiliates</strong>
          <small>Codes, commissions and payouts.</small>
          <Link href="/affiliate">Open the affiliate dashboard →</Link>
        </div>
      </div>

      <h2>Opening hours</h2>
      <p>
        Monday to Saturday, <strong>9:00am – 6:00pm WAT</strong>. Messages sent outside those hours are answered the next
        working morning. Orders already placed are not affected — sellers see them immediately.
      </p>

      <h2>Faster answers</h2>
      <ul>
        <li><strong>Where is my order?</strong> Open <Link href="/account">your account</Link> to see the live status of each order and the seller handling it.</li>
        <li><strong>Pay Later</strong> — read <Link href="/pay-later">how applications work</Link> before applying; you will need documents that prove your income.</li>
        <li><strong>Event order</strong> — the earlier you book, the bigger the discount. See <Link href="/special-orders">special & event orders</Link>.</li>
        <li><strong>Selling on Sure Foodz</strong> — sign up as a vendor or supplier and complete verification so your store can go live.</li>
      </ul>

      <h2>When you write to us</h2>
      <p>
        Include your order reference (it starts with <strong>SF</strong>) and the email or phone number used at checkout.
        For Pay Later, add your application reference. It helps us find your record on the first reply instead of asking
        you twice.
      </p>

      <div className="info-callout">
        We will never ask for your password, your bank card PIN or a one-time code. Ignore any message that does.
        Our team only writes from an address ending in <strong>@surefoodz.com</strong>.
      </div>

      <div className="info-cta-row">
        <a className="info-cta" href="mailto:surefoodglobal@gmail.com">Email support</a>
        <Link className="info-cta is-quiet" href="/account">Your orders</Link>
      </div>
    </InfoPage>
  );
}
