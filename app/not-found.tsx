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
            <h1>404, Page not found</h1>
            <p>
              Something went wrong. It looks like your requested page could not be found.
              It may be broken or the page has been removed.
            </p>
            <div className="sf-success-actions">
              <Link className="sf-btn is-pay" href="/shop">Go back</Link>
              <Link className="sf-btn is-ghost" href="/">Go to home</Link>
            </div>
          </div>
        </div>
      </main>
      <ShopFooter />
    </div>
  );
}
