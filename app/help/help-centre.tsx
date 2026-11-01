"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ShopFooter, ShopHeader } from "@/app/components/shop-chrome";

type IconName = "truck" | "heart" | "lock" | "card" | "receipt" | "cart" | "user" | "bell" | "phone" | "chat" | "store";

function Glyph({ name }: { name: IconName }) {
  const common = { width: 17, height: 17, viewBox: "0 0 24 24", fill: "none", "aria-hidden": true } as const;
  const stroke = { stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (name) {
    case "truck":
      return (
        <svg {...common}>
          <path d="M3 7h10v9H3zM13 10h4l3 3v3h-7z" {...stroke} />
          <circle cx="7" cy="18" r="1.7" {...stroke} />
          <circle cx="17" cy="18" r="1.7" {...stroke} />
        </svg>
      );
    case "heart":
      return (
        <svg {...common}>
          <path d="M12 20s-7-4.4-7-9.3A4 4 0 0 1 12 8a4 4 0 0 1 7 2.7c0 4.9-7 9.3-7 9.3Z" {...stroke} />
        </svg>
      );
    case "lock":
      return (
        <svg {...common}>
          <rect x="4.5" y="10" width="15" height="10" rx="2.4" {...stroke} />
          <path d="M8 10V7.5a4 4 0 0 1 8 0V10" {...stroke} />
        </svg>
      );
    case "card":
      return (
        <svg {...common}>
          <rect x="3" y="6" width="18" height="12" rx="2.4" {...stroke} />
          <path d="M3 10.5h18" {...stroke} />
        </svg>
      );
    case "receipt":
      return (
        <svg {...common}>
          <path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" {...stroke} />
          <path d="M9.5 9h5M9.5 13h5" {...stroke} />
        </svg>
      );
    case "cart":
      return (
        <svg {...common}>
          <path d="M3 5h2.2l2.3 10h10l2-7H6.3" {...stroke} />
          <circle cx="9.5" cy="19" r="1.5" {...stroke} />
          <circle cx="17" cy="19" r="1.5" {...stroke} />
        </svg>
      );
    case "user":
      return (
        <svg {...common}>
          <circle cx="12" cy="8.5" r="3.6" {...stroke} />
          <path d="M5 20a7 7 0 0 1 14 0" {...stroke} />
        </svg>
      );
    case "bell":
      return (
        <svg {...common}>
          <path d="M6 17V11a6 6 0 0 1 12 0v6l1.6 2H4.4z" {...stroke} />
          <path d="M10 21h4" {...stroke} />
        </svg>
      );
    case "phone":
      return (
        <svg {...common}>
          <path d="M6 3.5h3l1.4 3.6-2 1.4a11 11 0 0 0 5.1 5.1l1.4-2L18.5 13v3.4a2 2 0 0 1-2.2 2A14.2 14.2 0 0 1 4 6.1 2 2 0 0 1 6 3.5Z" {...stroke} />
        </svg>
      );
    case "chat":
      return (
        <svg {...common}>
          <path d="M4 5h16v11H9l-5 4z" {...stroke} />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <path d="M4 9.5 12 4l8 5.5V20H4z" {...stroke} />
          <path d="M9.5 20v-5.5h5V20" {...stroke} />
        </svg>
      );
  }
}

const topics: { href: string; label: string; icon: IconName }[] = [
  { href: "/track-order", label: "Track Order", icon: "truck" },
  { href: "/favorites", label: "Wishlist & Compare", icon: "heart" },
  { href: "/login", label: "Reset Password", icon: "lock" },
  { href: "/contact", label: "Shipping & Billing", icon: "card" },
  { href: "/account", label: "Payment Status", icon: "receipt" },
  { href: "/cart", label: "Cart & Wallet", icon: "cart" },
  { href: "/account", label: "User & Account", icon: "user" },
  { href: "/contact", label: "Report a Problem", icon: "bell" },
];

const faqs: { question: string; answer: React.ReactNode; tag: string }[] = [
  {
    tag: "orders",
    question: "How do I track my order?",
    answer: (
      <>
        Open <Link href="/track-order">Track order</Link> and enter the order ID from your receipt plus the email you
        used at checkout. You will see the four stages — order placed, packaging, on the road, delivered — and every
        update the seller posts.
      </>
    ),
  },
  {
    tag: "pay later",
    question: "What is Pay Later and who can apply?",
    answer: (
      <>
        Pay Later lets you take foodstuff now and pay in instalments at a low interest rate — no card, no bank app.
        Applicants must be a registered business or a salaried worker. Businesses submit a registration number and
        business address; workers submit an employment letter, their level, and whether the employer is government or
        private. Everyone uploads a NIN and a recent utility bill, and gives two guarantors we can call.
        Start at <Link href="/pay-later">Pay later</Link>.
      </>
    ),
  },
  {
    tag: "payments",
    question: "How do I pay for an order?",
    answer: (
      <>
        Checkout takes a card or bank transfer through Paystack. Bank transfers are confirmed by our team, so an order
        can sit at “payment pending” for a short while — you do not need to pay twice.
      </>
    ),
  },
  {
    tag: "event orders",
    question: "How do event and special orders work?",
    answer: (
      <>
        Event orders are placed ahead of the date at a discount that grows with how early you book: two months ahead
        earns a bigger discount than one month. You plan the event and pay for the food before the day.
        See <Link href="/special-orders">Special &amp; event orders</Link>.
      </>
    ),
  },
  {
    tag: "sellers",
    question: "How do I become a vendor or supplier?",
    answer: (
      <>
        Sign up as a vendor or supplier, then finish verification in <Link href="/onboarding">onboarding</Link> —
        business details, address and documents. Approved stores go live and can list products the same day.
      </>
    ),
  },
  {
    tag: "verification",
    question: "Why do you ask for documents?",
    answer: (
      <>
        Documents prove the account belongs to a real business or worker before credit or a storefront is approved.
        Uploads are stored privately and only reviewed by the verification team.
      </>
    ),
  },
  {
    tag: "affiliate",
    question: "How does the affiliate programme pay?",
    answer: (
      <>
        Share your affiliate code, and every completed order it brings in earns a commission. Payouts are processed
        manually after the minimum balance is reached — track it all in the{" "}
        <Link href="/affiliate">affiliate dashboard</Link>.
      </>
    ),
  },
  {
    tag: "delivery",
    question: "Where do you deliver, and how long does it take?",
    answer: (
      <>
        Sellers deliver across Lagos and to the rest of Nigeria through delivery partners. The delivery fee and the
        expected date appear on the order once the seller confirms them, and you can follow it from{" "}
        <Link href="/track-order">Track order</Link>.
      </>
    ),
  },
  {
    tag: "refunds",
    question: "What if something arrives damaged or wrong?",
    answer: (
      <>
        Report it within 24 hours of delivery with photos of the items. Message us from{" "}
        <Link href="/contact">Contact us</Link> with the order ID and the seller will replace or refund the item.
      </>
    ),
  },
];

export function HelpCentre() {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<string | null>(faqs[0].question);

  const term = query.trim().toLowerCase();

  const visibleTopics = useMemo(
    () => (term ? topics.filter((topic) => topic.label.toLowerCase().includes(term)) : topics),
    [term],
  );

  const visibleFaqs = useMemo(
    () =>
      term
        ? faqs.filter((faq) => `${faq.question} ${faq.tag}`.toLowerCase().includes(term))
        : faqs,
    [term],
  );

  return (
    <div className="sf-page">
      <ShopHeader />
      <main className="sf-shell" style={{ flex: "1 1 auto", paddingBottom: 56 }}>
        <nav className="sf-flow-steps" aria-label="Breadcrumb">
          <Link href="/">Home</Link><i>/</i>
          <span className="is-on">Help centre</span>
        </nav>

        <div className="hp-head">
          <Link href="/" className="hp-back" aria-label="Back to the shop">←</Link>
          <button
            type="button"
            className="hp-share"
            aria-label="Share the help centre"
            onClick={() => {
              const url = window.location.href;
              if (navigator.share) void navigator.share({ title: "Sure Foodz help centre", url }).catch(() => {});
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

        <span className="hp-kicker">Support</span>
        <h1 className="hp-title">How can we help you?</h1>

        <form
          className="hp-search"
          onSubmit={(event) => {
            event.preventDefault();
            document.getElementById("faq")?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
        >
          <span className="hp-search-icon" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
              <path d="m16.5 16.5 4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Enter your question or keyword"
            aria-label="Search the help centre"
          />
          <button type="submit">Search</button>
        </form>

        {visibleTopics.length > 0 && (
          <div className="hp-grid">
            {visibleTopics.map((topic) => (
              <Link key={topic.label} href={topic.href} className="hp-tile">
                <span className="hp-tile-icon" aria-hidden="true"><Glyph name={topic.icon} /></span>
                <span>{topic.label}</span>
                <svg className="hp-tile-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="m9 5 7 7-7 7" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
            ))}
          </div>
        )}

        {term && !visibleTopics.length && !visibleFaqs.length && (
          <p className="hp-none">Nothing matched “{query}”. Try a shorter word, or write to us below.</p>
        )}

        <section className="hp-contact">
          <h2>Don’t find your answer?<br /><span>Contact with us</span></h2>
          <div className="hp-contact-cards">
            <div className="hp-contact-card">
              <span className="hp-contact-icon is-call" aria-hidden="true"><Glyph name="phone" /></span>
              <div>
                <b>Call us now</b>
                <p>9:00am – 6:00pm, Monday to Saturday.</p>
                <a href="tel:+2343040100108">+234 304 010 0108</a>
              </div>
              <a className="hp-contact-btn" href="tel:+2343040100108">Call now</a>
            </div>
            <div className="hp-contact-card">
              <span className="hp-contact-icon is-chat" aria-hidden="true"><Glyph name="chat" /></span>
              <div>
                <b>Chat with us</b>
                <p>Send a message and we reply in the order they arrive.</p>
                <a href="mailto:surefoodglobal@gmail.com">surefoodglobal@gmail.com</a>
              </div>
              <a className="hp-contact-btn is-green" href="mailto:surefoodglobal@gmail.com">Chat now</a>
            </div>
          </div>
        </section>

        <section className="hp-faq" id="faq">
          <div className="hp-faq-intro">
            <h2>Frequently<br />Asked Questions</h2>
            <p>Everything about ordering, Pay Later, event orders and selling on Sure Foodz.</p>
            <Link href="/contact" className="hp-faq-btn">Need help? Contact us</Link>
            <div className="hp-faq-art" aria-hidden="true">
              <span className="hp-faq-screen">✓</span>
              <span className="hp-faq-cart">🛒</span>
              <span className="hp-faq-bag">🛍️</span>
            </div>
          </div>

          <div className="hp-faq-list">
            {visibleFaqs.map((faq) => {
              const isOpen = open === faq.question;
              return (
                <div className={`hp-faq-item ${isOpen ? "is-open" : ""}`} key={faq.question}>
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() => setOpen(isOpen ? null : faq.question)}
                  >
                    <span>{faq.question}</span>
                    <i aria-hidden="true">{isOpen ? "−" : "+"}</i>
                  </button>
                  {isOpen && <div className="hp-faq-answer">{faq.answer}</div>}
                </div>
              );
            })}
            {!visibleFaqs.length && (
              <div className="hp-faq-item">
                <button type="button" aria-expanded={false} onClick={() => setQuery("")}>
                  <span>No answer matched “{query}”. Clear the search.</span>
                  <i aria-hidden="true">+</i>
                </button>
              </div>
            )}
          </div>
        </section>

        <section className="hp-popular">
          <h2>Popular topics</h2>
          <div className="hp-popular-cols">
            <ul>
              <li><Link href="/track-order">How do I track my order?</Link></li>
              <li><Link href="/account">How do I change my password?</Link></li>
              <li><Link href="/terms">What is the returns policy?</Link></li>
            </ul>
            <ul>
              <li><Link href="/pay-later">How does Pay Later work?</Link></li>
              <li><Link href="/special-orders">How do event orders work?</Link></li>
              <li><Link href="/contact">How do I contact a seller?</Link></li>
            </ul>
            <ul>
              <li><Link href="/onboarding">How do I get verified as a vendor?</Link></li>
              <li><Link href="/affiliate">How are affiliate payouts made?</Link></li>
              <li><Link href="/privacy">How is my data used?</Link></li>
            </ul>
          </div>
        </section>
      </main>
      <ShopFooter />
    </div>
  );
}
