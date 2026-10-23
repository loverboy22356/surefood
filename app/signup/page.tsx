import Link from "next/link";
import SignupForm from "./signup-form";

export default function SignupPage() {
  return (
    <main className="auth-page signup-page">
      <Link href="/" className="auth-back">← <span>Back to shop</span></Link>
      <section className="auth-art signup-art" aria-label="Join SureFood">
        <div className="auth-art-shade" />
        <div className="auth-art-caption"><span>A SEAT AT OUR TABLE</span><h1>Good food.<br /><em>Good days.</em></h1><p>Fresh finds, feel-good favourites, and a little more good in every day.</p><div className="signup-perks"><span>✳ Always fresh</span><span>♡ Sourced with care</span></div></div>
        <div className="auth-art-footer"><span>sure<span>food</span></span><small>Little choices. A whole lot of good.</small></div>
      </section>
      <section className="auth-form-side">
        <Link href="/" className="auth-logo"><span className="brand-mark">s</span><span>sure<span>food</span></span></Link>
        <SignupForm />
        <div className="auth-legal">Fresh food, fair prices, delivered with care.</div>
      </section>
    </main>
  );
}
