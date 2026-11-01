import Image from "next/image";
import Link from "next/link";
import SignupForm from "./signup-form";
import { ShopFooter, ShopHeader } from "@/app/components/shop-chrome";

export default function SignupPage() {
  return (
    <div className="sf-page">
      <ShopHeader />
      <main className="sf-shell" style={{ flex: "1 1 auto" }}>
        <div className="sf-auth">
          <section className="sf-auth-copy">
            <Link href="/" className="sf-back sf-auth-back" aria-label="Back to the shop">←</Link>
            <h1>Create an account</h1>
            <p>Let&apos;s create your account</p>
            <div className="sf-auth-art">
              <Image
                src="/images/auth-hero.webp"
                alt="Sure Foodz fresh produce, delivered to your door"
                fill
                sizes="(max-width: 900px) 100vw, 430px"
                priority
              />
            </div>
          </section>
          <section className="sf-auth-panel">
            <SignupForm />
            <div className="sf-auth-legal">
              Fresh food, fair prices, delivered with care.
            </div>
          </section>
        </div>
      </main>
      <ShopFooter />
    </div>
  );
}
