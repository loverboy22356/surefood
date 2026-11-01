import type { Metadata } from "next";
import Link from "next/link";
import { InfoPage } from "../components/info-page";

export const metadata: Metadata = {
  title: "Privacy policy | Sure Foodz",
  description: "What Sure Foodz collects, why we collect it, who we share it with and the choices you have over your data.",
};

export default function PrivacyPage() {
  return (
    <InfoPage
      kicker="Legal"
      title="Privacy policy"
      lede="We collect what we need to take your order, deliver it, verify sellers and decide Pay Later applications — nothing more than that."
      updated="30 October 2026"
    >
      <h2>1. What we collect</h2>
      <ul>
        <li><strong>Account details</strong> — your name, email, phone number, password sign-in or Google sign-in, and your role (buyer, vendor, supplier, staff).</li>
        <li><strong>Order details</strong> — the products you buy, delivery address, delivery phone number and order history.</li>
        <li><strong>Payment details</strong> — handled by our payment partner. We receive confirmation and a reference, never your full card number.</li>
        <li><strong>Verification documents</strong> — for sellers: business registration, address and identity documents. For Pay Later: employment or business evidence, NIN, utility bill and referee contacts.</li>
        <li><strong>Location</strong> — if you allow it, your device location is used to show sellers near you. You can switch it off in your browser at any time.</li>
        <li><strong>Technical data</strong> — browser type, approximate region and basic usage events that keep you signed in and help us fix faults.</li>
      </ul>

      <h2>2. Why we use it</h2>
      <ul>
        <li>To create and secure your account, and to sign you in.</li>
        <li>To take, route and deliver your orders, and to answer support questions.</li>
        <li>To assess Pay Later applications, event orders and seller verification — this is a decision that affects you, so we do it by hand and explain the outcome.</li>
        <li>To pay sellers and affiliates correctly.</li>
        <li>To detect fraud, prevent abuse and meet legal obligations.</li>
        <li>To improve the marketplace — using aggregated information, not by selling your data.</li>
      </ul>

      <h2>3. Who we share it with</h2>
      <div className="info-cards">
        <div className="info-card"><strong>Your seller</strong><small>Only the name, phone and address needed to deliver your order.</small></div>
        <div className="info-card"><strong>Payment partner</strong><small>Processes your payment and confirms the result to us.</small></div>
        <div className="info-card"><strong>Identity checks</strong><small>Verification partners confirm a document is genuine when we review it.</small></div>
        <div className="info-card"><strong>Hosting &amp; email</strong><small>Service providers that run the site, store files and send your sign-in codes.</small></div>
      </div>
      <p>
        We do not sell your personal data. We share it only with the providers above, and only as far as the job requires,
        or where the law compels us.
      </p>

      <h2>4. Pay Later and seller documents</h2>
      <p>
        Documents you upload for verification are stored in our controlled file storage and are visible only to the staff
        who review applications. They are never shown to other buyers or sellers. If an application is declined, we keep
        the decision record but we do not use the documents for anything else.
      </p>

      <h2>5. Cookies and local storage</h2>
      <p>
        We use local storage in your browser for things that must survive a page reload: your cart, your favourites, your
        chosen currency and theme, and your sign-in session. We do not use advertising trackers. Clearing your browser
        storage removes these, and you will need to sign in again.
      </p>

      <h2>6. How long we keep it</h2>
      <ul>
        <li>Account and order records: while your account is open, and afterwards for as long as tax and consumer-protection rules require.</li>
        <li>Verification and Pay Later documents: for the life of the facility plus the record-keeping period that applies to it.</li>
        <li>Technical logs: a short rolling window, used for security and fault-finding.</li>
      </ul>

      <h2>7. Your choices and rights</h2>
      <p>
        Under the Nigeria Data Protection Act you can ask to see the personal data we hold about you, correct anything
        wrong, ask us to delete what we no longer need, object to a particular use, or ask for a copy in a portable
        format. Write to <a href="mailto:surefoodglobal@gmail.com">surefoodglobal@gmail.com</a> from the email address on your
        account and we will respond within the period the law allows.
      </p>
      <p>
        You can also withdraw location permission, unsubscribe from non-essential messages, and close your account at any
        time. Some records must be kept even after closure where the law requires it.
      </p>

      <h2>8. Security</h2>
      <p>
        Access to your data is limited to staff who need it, connections to the site are encrypted, and uploads are stored
        in private buckets with signed access. No system is perfect — if a breach ever affects your data, we will tell you
        and the regulator as required.
      </p>

      <h2>9. Children</h2>
      <p>
        Sure Foodz is for adults. Accounts are not intended for anyone under 18, and we do not knowingly collect
        children&apos;s data. If you believe a child has created an account, contact us and we will remove it.
      </p>

      <h2>10. Changes and contact</h2>
      <p>
        If this policy changes, the date at the top of the page changes with it. Questions, requests or complaints go to{" "}
        <a href="mailto:surefoodglobal@gmail.com">surefoodglobal@gmail.com</a> or through the{" "}
        <Link href="/contact">contact page</Link>.
      </p>
      <div className="info-cta-row">
        <Link className="info-cta" href="/terms">Read the terms</Link>
        <Link className="info-cta is-quiet" href="/contact">Contact us</Link>
      </div>
    </InfoPage>
  );
}
