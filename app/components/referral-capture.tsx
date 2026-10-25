"use client";

import { useEffect } from "react";
import { AFFILIATE_COOKIE, AFFILIATE_COOKIE_MAX_AGE, isAffiliateCode, normaliseAffiliateCode } from "@/lib/affiliates";

/**
 * Remembers ?ref=CODE from an affiliate link for ninety days, so an order placed
 * later in the visit (or after a sign-in) is still credited to that affiliate.
 * The cookie is what the order API reads; localStorage keeps it for browsers that
 * block first-party cookies.
 */
export function ReferralCapture() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const supplied = normaliseAffiliateCode(params.get("ref"));
    const stored = normaliseAffiliateCode(window.localStorage.getItem("surefood-ref"));
    const code = isAffiliateCode(supplied) ? supplied : isAffiliateCode(stored) ? stored : "";
    if (!code) return;

    window.localStorage.setItem("surefood-ref", code);
    document.cookie = `${AFFILIATE_COOKIE}=${encodeURIComponent(code)}; path=/; max-age=${AFFILIATE_COOKIE_MAX_AGE}; samesite=lax`;
  }, []);

  return null;
}
