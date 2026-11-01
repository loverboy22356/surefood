import Image from "next/image";
import Link from "next/link";
import LoginForm from "./login-form";
import { ShopFooter, ShopHeader } from "@/app/components/shop-chrome";

export default function LoginPage() {
  return (
    <div className="sf-page">
      <ShopHeader />
      <main className="sf-shell" style={{ flex: "1 1 auto" }}>
        <div className="sf-auth">
          <section className="sf-auth-copy">
            <Link href="/" className="sf-back sf-auth-back" aria-label="Back to the shop">←</Link>
            <h1>Welcome Back</h1>
            <p>Login to your account</p>
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
            <LoginForm />
            <div className="sf-auth-legal">
              By continuing you agree to our <Link href="/terms">Terms</Link> and <Link href="/privacy">Privacy Policy</Link>.
            </div>
          </section>
        </div>
      </main>
      <ShopFooter />
    </div>
  );
}
