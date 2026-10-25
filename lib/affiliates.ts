// SureFood affiliate programme.
//
// Anyone can refer buyers and earn a share of the goods value on the orders that
// come from their link. Nothing is paid automatically: the affiliate requests a
// payout, and the SureFood team pays it by hand (bank transfer) and marks it paid.
// That keeps us honest about the money while there is no automated payout rail.

export const AFFILIATE_COMMISSION_RATE = 0.05;

/** Smallest payout the team will send by hand, in minor units (₦5,000). */
export const AFFILIATE_MIN_PAYOUT_MINOR = 500_000;

export const AFFILIATE_COOKIE = "surefood_ref";
export const AFFILIATE_COOKIE_MAX_AGE = 60 * 60 * 24 * 90;

export const affiliateStatuses = ["active", "paused"] as const;
export type AffiliateStatus = (typeof affiliateStatuses)[number];

export const affiliatePayoutStatuses = ["requested", "paid", "cancelled"] as const;
export type AffiliatePayoutStatus = (typeof affiliatePayoutStatuses)[number];

/** Referral codes are uppercase and easy to say out loud. */
export function normaliseAffiliateCode(value: unknown) {
  return String(value ?? "").trim().toUpperCase();
}

export function isAffiliateCode(value: string) {
  return /^[A-Z0-9]{5,16}$/.test(value);
}

/** A readable code from the affiliate's name, with random digits for uniqueness. */
export function buildAffiliateCode(name: string, seed: string) {
  const base = name
    .normalize("NFKD")
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase()
    .slice(0, 8) || "SUREFOOD";
  const digits = seed.replace(/\D/g, "").slice(0, 4).padEnd(4, "7");
  return normaliseAffiliateCode(`${base}${digits}`);
}

export function commissionOn(subtotalMinor: number) {
  if (!Number.isFinite(subtotalMinor) || subtotalMinor <= 0) return 0;
  return Math.round(subtotalMinor * AFFILIATE_COMMISSION_RATE);
}

export function formatMinor(minor: number, currency = "NGN") {
  try {
    return new Intl.NumberFormat("en-NG", { style: "currency", currency, maximumFractionDigits: 0 }).format(minor / 100);
  } catch {
    return `${currency} ${(minor / 100).toFixed(0)}`;
  }
}
