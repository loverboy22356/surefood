import type { Metadata } from "next";
import Link from "next/link";
import { InfoPage } from "../components/info-page";

export const metadata: Metadata = {
  title: "Terms & conditions | Sure Foodz",
  description: "The terms that apply when you shop, sell, take Pay Later credit, book an event order or earn affiliate commission on Sure Foodz.",
};

export default function TermsPage() {
  return (
    <InfoPage
      kicker="Legal"
      title="Terms & conditions"
      lede="These terms apply whenever you use Sure Foodz — whether you are shopping, selling, applying for Pay Later credit, booking an event order or earning affiliate commission."
      updated="30 October 2026"
    >
      <h2>1. Who we are</h2>
      <p>
        Sure Foodz (&quot;we&quot;, &quot;us&quot;) operates the marketplace at surefoodz.com, where approved vendors and
        suppliers (&quot;sellers&quot;) list food and related products for buyers across Nigeria. We provide the platform,
        the payment flow and the verification; the seller provides the goods.
      </p>

      <h2>2. Your account</h2>
      <ul>
        <li>You must give accurate details — your real name, a working email and phone number, and a delivery address you control.</li>
        <li>You are responsible for activity on your account. Do not share your sign-in code with anyone.</li>
        <li>Vendor, supplier and staff accounts are additionally verified before they can list products or receive orders.</li>
        <li>We may suspend an account that gives false information, abuses the platform or attempts fraud.</li>
      </ul>

      <h2>3. Placing an order</h2>
      <p>
        An order becomes binding when you confirm checkout. Because food is perishable, orders can only be changed or
        cancelled before the seller accepts and starts preparing them. Once preparation has started, an order can no
        longer be cancelled, but you can still raise a problem with us.
      </p>
      <p>
        Availability, weights and appearance of fresh produce can vary slightly. If a seller cannot supply what you
        ordered, we will contact you to substitute or refund the affected item.
      </p>

      <h2>4. Prices, currency and delivery</h2>
      <ul>
        <li>All orders are charged in Nigerian naira (₦).</li>
        <li>Prices shown in other currencies are estimates converted at a live rate for convenience; the naira amount at checkout is the amount you pay.</li>
        <li>Delivery fees are set per order by the seller and shown before you pay.</li>
        <li>Delivery windows are estimates. Weather, traffic and road conditions can move them.</li>
      </ul>

      <h2>5. Buy now, pay later (&quot;Pay Later&quot;)</h2>
      <p>
        Pay Later lets an approved buyer receive food now and pay over an agreed period at a low interest rate.
        It is a credit facility, not a discount, and it is only available to buyers who complete our checks.
      </p>
      <h3>Eligibility and documents</h3>
      <ul>
        <li>You must be at least 18 and able to show a verifiable income.</li>
        <li><strong>Business owners</strong> submit business registration details, business address, and evidence of trading.</li>
        <li><strong>Employed applicants</strong> submit an employment letter, employer name and staff number, and whether the employer is government or private.</li>
        <li><strong>Address proof</strong> — a recent utility bill and your national identity number (NIN) are required to confirm your location.</li>
        <li>You must provide <strong>two contactable referees</strong> we can reach for confirmation.</li>
      </ul>
      <h3>Approval, repayment and defaults</h3>
      <ul>
        <li>Approval, the credit amount and the repayment period are decided by our team after review. Applying does not guarantee approval.</li>
        <li>Repayment dates and amounts are confirmed in writing before the credit is used.</li>
        <li>Late repayment may attract the charges stated in your approval, and may suspend your Pay Later limit.</li>
        <li>Documents you upload are used only to assess your application and are handled as described in our <Link href="/privacy">privacy policy</Link>.</li>
        <li>Giving false documents is fraud. We will close the account and may report the matter.</li>
      </ul>

      <h2>6. Special and event orders</h2>
      <p>
        Event orders are placed ahead of a date you choose. The earlier you book, the larger the discount we can apply.
      </p>
      <ul>
        <li>An event order is confirmed once the deposit is paid; the balance is due before the delivery date.</li>
        <li>Discounts depend on how far ahead you order and are confirmed in your quotation.</li>
        <li>Changes to quantity or date are possible while the seller can still source the goods. Changes close to the event may not be possible.</li>
        <li>Cancellations made well before the event are refunded less any cost already committed. Cancellations close to the date may not be refundable.</li>
      </ul>

      <h2>7. Payments</h2>
      <p>
        Card and transfer payments are processed by our payment partner. We never see or store your full card details.
        Where a payment is taken but an order fails, the amount is reversed to your original payment method within the
        period your bank requires.
      </p>

      <h2>8. Selling on Sure Foodz</h2>
      <ul>
        <li>Sellers must be verified before listing, and must keep the products, prices and stock levels they publish accurate.</li>
        <li>Products must be safe, correctly described and legally sold in Nigeria.</li>
        <li>Buyer payments are collected by Sure Foodz. Seller payouts are reviewed and paid manually to the verified bank account on file.</li>
        <li>We may remove a listing, pause a store or withhold a payout where there is a complaint under investigation.</li>
      </ul>

      <h2>9. Affiliate programme</h2>
      <ul>
        <li>Commission is earned on paid orders that arrive through your referral link or code, at the rate shown in your dashboard.</li>
        <li>Self-referrals, fake accounts and cancelled or refunded orders do not earn commission.</li>
        <li>Payouts are made manually once the balance reaches the published minimum.</li>
        <li>We may adjust rates or close the programme, but never on commission already earned.</li>
      </ul>

      <h2>10. Acceptable use</h2>
      <p>
        Do not scrape the site, attempt to break its security, post unlawful content, impersonate another person, or use
        the platform to launder money or commit fraud. We may suspend access where we see this.
      </p>

      <h2>11. Our responsibility</h2>
      <p>
        We work to keep the marketplace accurate and available, but we do not grow, pack or transport the food ourselves.
        Our responsibility for a product problem is limited to helping you resolve it with the seller, refunding where
        appropriate, and taking action against a seller who repeatedly fails. Nothing in these terms removes rights you
        have under Nigerian consumer law.
      </p>

      <h2>12. Changes to these terms</h2>
      <p>
        We may update these terms as the platform changes. The date at the top of this page shows the current version, and
        continued use after a change means you accept it.
      </p>

      <h2>13. Governing law and contact</h2>
      <p>
        These terms are governed by the laws of the Federal Republic of Nigeria. Questions about them go to{" "}
        <a href="mailto:surefoodglobal@gmail.com">surefoodglobal@gmail.com</a> or through our{" "}
        <Link href="/contact">contact page</Link>.
      </p>
      <div className="info-cta-row">
        <Link className="info-cta" href="/privacy">Read the privacy policy</Link>
        <Link className="info-cta is-quiet" href="/contact">Ask a question</Link>
      </div>
    </InfoPage>
  );
}
