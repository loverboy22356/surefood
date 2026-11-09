/** Shared vocabulary for the business / bulk-buying portal. Client-safe. */

export const businessTypes = ["restaurant", "canteen", "retailer", "office", "event", "other"] as const;
export type BusinessType = (typeof businessTypes)[number];

export const businessTypeLabels: Record<BusinessType, string> = {
  restaurant: "Restaurant or food business",
  canteen: "Canteen or staff kitchen",
  retailer: "Retailer or reseller",
  office: "Office or organisation",
  event: "Event or catering",
  other: "Something else",
};

export const orderRhythms = ["one-off", "weekly", "biweekly", "monthly"] as const;
export type OrderRhythm = (typeof orderRhythms)[number];

export const orderRhythmLabels: Record<OrderRhythm, string> = {
  "one-off": "One-off purchase",
  weekly: "Every week",
  biweekly: "Every two weeks",
  monthly: "Every month",
};

export type QuoteStatus = "requested" | "quoted" | "confirmed" | "declined";

export const quoteStatuses: QuoteStatus[] = ["requested", "quoted", "confirmed", "declined"];

export type BusinessQuote = {
  id: string;
  reference: string;
  businessName: string;
  contactName: string;
  email: string;
  phone: string;
  businessType: BusinessType;
  needs: string;
  quantity: string;
  rhythm: OrderRhythm;
  address: string;
  city: string;
  region: string;
  notes: string;
  status: QuoteStatus;
  quoteNote: string;
  quotedTotalMinor: number | null;
  createdAt: string;
  updatedAt: string;
};

export function isBusinessType(value: unknown): value is BusinessType {
  return typeof value === "string" && (businessTypes as readonly string[]).includes(value);
}

export function isOrderRhythm(value: unknown): value is OrderRhythm {
  return typeof value === "string" && (orderRhythms as readonly string[]).includes(value);
}

export function quoteFor(minor: number | null) {
  if (!minor) return "—";
  return `₦${Math.round(minor / 100).toLocaleString("en-NG")}`;
}
