import Link from "next/link";
import type { ReactNode } from "react";
import { ShopFooter, ShopHeader } from "./shop-chrome";
import "../info.css";

const sideLinks = [
  { href: "/about", label: "About us" },
  { href: "/contact", label: "Contact us" },
  { href: "/pay-later", label: "Buy now, pay later" },
  { href: "/special-orders", label: "Event & special orders" },
  { href: "/affiliate", label: "Affiliate programme" },
  { href: "/terms", label: "Terms & conditions" },
  { href: "/privacy", label: "Privacy policy" },
];

/**
 * Shared frame for the informational pages (about, contact, terms, privacy) so
 * they sit inside the same shop chrome as every other buyer screen.
 */
export function InfoPage({
  kicker,
  title,
  lede,
  updated,
  children,
}: {
  kicker: string;
  title: string;
  lede: string;
  updated?: string;
  children: ReactNode;
}) {
  return (
    <div className="sf-page">
      <ShopHeader />
      <main className="sf-shell" style={{ flex: "1 1 auto", paddingBottom: 60 }}>
        <nav className="sf-flow-steps" aria-label="Breadcrumb">
          <Link href="/">Home</Link><i>/</i>
          <span className="is-on">{kicker}</span>
        </nav>

        <header className="info-hero">
          <span className="info-kicker">{kicker}</span>
          <h1>{title}</h1>
          <p className="info-lede">{lede}</p>
          {updated && <small className="info-updated">Last updated {updated}</small>}
        </header>

        <div className="info-layout">
          <article className="info-article">{children}</article>
          <aside className="info-aside">
            <h2>More from Sure Foodz</h2>
            <nav aria-label="Related pages">
              {sideLinks.map((link) => (
                <Link key={link.href} href={link.href}>{link.label}<span aria-hidden="true">→</span></Link>
              ))}
            </nav>
            <div className="info-aside-help">
              <strong>Need a hand?</strong>
              <p>Our team answers Monday to Saturday, 9am–6pm WAT.</p>
              <a href="mailto:surefoodglobal@gmail.com">surefoodglobal@gmail.com</a>
            </div>
          </aside>
        </div>
      </main>
      <ShopFooter />
    </div>
  );
}
