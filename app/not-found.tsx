import Link from "next/link";
import { ShopFooter, ShopHeader } from "@/app/components/shop-chrome";

export const metadata = {
  title: "Page not found | Sure Foodz",
};

export default function NotFound() {
  return (
    <div className="sf-page">
      <ShopHeader />
      <main className="sf-shell" style={{ flex: "1 1 auto" }}>
        <div className="sf-lost">
          <div className="sf-lost-art" aria-hidden="true">404</div>
          <div className="sf-lost-copy">
            <div className="sf-check-mark" style={{ borderColor: "#e23b3b", color: "#e23b3b" }} aria-hidden="true">✕</div>
            <h1>Page not found</h1>
            <p>
              The page you&rsquo;re looking for isn&rsquo;t here &mdash; it may have moved or been removed.
              The shelves are still open, though.
            </p>
            <div className="sf-lost-actions">
              <Link className="sf-btn" href="/">Go to home</Link>
              <Link className="sf-btn is-ghost" href="/shop">Browse the shop</Link>
            </div>
            <div className="sf-lost-quick">
              <span>Or jump straight to:</span>
              <div className="sf-lost-chips">
                <Link className="sf-chip" href="/baskets">Sure Foodz Basket</Link>
                <Link className="sf-chip" href="/business">Business portal</Link>
                <Link className="sf-chip" href="/categories">Categories</Link>
              </div>
            </div>
          </div>
        </div>
      </main>
      <ShopFooter />
    </div>
  );
}
