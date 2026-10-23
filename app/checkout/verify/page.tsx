"use client";

import Link from "next/link";
import { onAuthStateChanged } from "firebase/auth";
import { useEffect, useState } from "react";
import { firebaseAuth, firebaseConfigured } from "@/lib/firebase/client";

type PaymentState = "checking" | "verified" | "failed" | "signed-out";

export default function VerifyCheckoutPage() {
  const [state, setState] = useState<PaymentState>("checking");
  const [message, setMessage] = useState("Checking your payment with Paystack…");

  useEffect(() => {
    if (!firebaseConfigured()) {
      setState("failed");
      setMessage("Your payment could not be checked because SureFood authentication is unavailable.");
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
        setMessage("Sign in to check this payment. Paystack will also notify SureFood automatically.");
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

  return (
    <main className="payment-result-page">
      <section className="payment-result-card" role="status">
        <span className={`payment-result-icon ${state}`}>{state === "verified" ? "✓" : state === "failed" ? "!" : "…"}</span>
        <span className="account-kicker">SUREFOOD CHECKOUT</span>
        <h1>{state === "verified" ? "Payment confirmed" : state === "checking" ? "Verifying your payment" : state === "signed-out" ? "Sign in to check payment" : "Payment not confirmed yet"}</h1>
        <p>{message}</p>
        {state === "signed-out" && <Link className="account-save-button payment-result-link" href="/login">Sign in</Link>}
        <Link className="account-shop-link" href="/account?orders=1">View your orders</Link>
        <Link className="payment-result-back" href="/">Continue shopping</Link>
      </section>
    </main>
  );
}
