import Link from "next/link";
import LoginForm from "./login-form";

export default function LoginPage() {
  return (
    <main className="auth-page login-page">
      <Link href="/" className="auth-back">← <span>Back to shop</span></Link>
      <section className="auth-art login-art" aria-label="SureFood fresh food">
        <div className="auth-art-shade" />
        <div className="auth-art-caption"><span>THE GOOD STUFF, GROWN CLOSE</span><h1>A little more<br /><em>fresh</em> in every day.</h1><p>Good food starts with good ingredients.</p></div>
        <div className="auth-art-footer"><span>sure<span>food</span></span><small>Good food. Good days.</small></div>
      </section>
      <section className="auth-form-side">
        <Link href="/" className="auth-logo"><span className="brand-mark">s</span><span>sure<span>food</span></span></Link>
        <LoginForm />
        <div className="auth-legal">By continuing, you agree to our <Link href="#terms">Terms</Link> and <Link href="#privacy">Privacy Policy</Link>.</div>
      </section>
    </main>
  );
}
