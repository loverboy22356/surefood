"use client";

import Link from "next/link";
import { onAuthStateChanged } from "firebase/auth";
import { useEffect, useState } from "react";
import { firebaseAuth, firebaseConfigured } from "@/lib/firebase/client";
import { ShopFooter, ShopHeader } from "@/app/components/shop-chrome";

type PaymentState = "checking" | "verified" | "failed" | "signed-out";

export default function VerifyCheckoutPage() {
  const [state, setState] = useState<PaymentState>("checking");
  const [message, setMessage] = useState("Checking your payment with Paystack…");

  useEffect(() => {
    if (!firebaseConfigured()) {
      setState("failed");
      setMessage("Your payment could not be checked because Sure Foodz authentication is unavailable.");
      return;
    }
    const reference = new URLSearchParams(window.location.search).get("reference")
      || new URLSearchParams(window.location.search).get("trxref");
    if (!reference) {
      setState("failed");
      setMessage("Paystack did not return a payment reference. Check your order status before trying again.");
      return;
    }

    let active = true;
    let started = false;
    const unsubscribe = onAuthStateChanged(firebaseAuth(), async (user) => {
      if (!active || started) return;
      if (!user) {
        setState("signed-out");
        setMessage("Sign in to check this payment. Paystack will also notify Sure Foodz automatically.");
        return;
      }
      started = true;
      try {
        const token = await user.getIdToken();
        const response = await fetch("/api/payments/verify", {
          method: "POST",
          headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
          body: JSON.stringify({ reference }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "We could not confirm this payment.");
        if (!active) return;
        setState("verified");
        setMessage("Payment confirmed. The seller has been notified and can prepare your order.");
      } catch (reason) {
        if (!active) return;
        setState("failed");
        setMessage(reason instanceof Error ? reason.message : "We could not confirm this payment. Check your orders before retrying.");
      }
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const tone = state === "verified" ? "is-ok" : state === "checking" ? "is-pending" : "is-failed";

  return (
    <div className="sf-page">
      <ShopHeader />
      <main className="sf-shell" style={{ flex: "1 1 auto", paddingBottom: 60 }}>
        <nav className="sf-flow-steps" aria-label="Breadcrumb">
          <Link href="/">Home</Link><i>/</i>
          <Link href="/cart">Cart</Link><i>/</i>
          <span className="is-on">Payment</span>
        </nav>

        <section className="sf-success is-single" role="status" aria-live="polite">
          <div className="sf-success-copy">
            <span className={`sf-check-mark ${tone}`} aria-hidden="true">
              {state === "verified" ? "✓" : state === "checking" ? "…" : "!"}
            </span>
            <h1>
              {state === "verified"
                ? "Payment confirmed"
                : state === "checking"
                  ? "Verifying your payment"
                  : state === "signed-out"
                    ? "Sign in to check payment"
                    : "Payment not confirmed yet"}
            </h1>
            <p>{message}</p>
            <div className="sf-success-actions">
              {state === "signed-out" && (
                <Link className="sf-btn is-pay" href="/login">Sign in</Link>
              )}
              {state === "verified" && (
                <Link className="sf-btn is-pay" href="/account?orders=1">View your orders</Link>
              )}
              {state === "failed" && (
                <Link className="sf-btn is-pay" href="/account?orders=1">Check my orders</Link>
              )}
              <Link className="sf-btn is-ghost" href="/shop">Continue shopping</Link>
            </div>
          </div>
        </section>
      </main>
      <ShopFooter />
    </div>
  );
}
