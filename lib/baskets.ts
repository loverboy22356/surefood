/**
 * The Sure Foodz Basket: recurring food packages. Plans live in code so a fresh
 * deployment always has a shelf to sell, and subscriptions live in Firestore.
 * This module is shared by the API routes and the client pages, so keep it free
 * of server-only imports.
 */

export const basketFrequencies = ["weekly", "biweekly", "monthly"] as const;
export type BasketFrequency = (typeof basketFrequencies)[number];

export const frequencyLabels: Record<BasketFrequency, string> = {
  weekly: "Every week",
  biweekly: "Every two weeks",
  monthly: "Every month",
};

/** Paying ahead for a regular supply costs a little less than one-off shopping. */
export const frequencyDiscount: Record<BasketFrequency, number> = {
  weekly: 0.07,
  biweekly: 0.04,
  monthly: 0,
};

export const deliveryDays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
export type DeliveryDay = (typeof deliveryDays)[number];

export type BasketTier = {
  id: string;
  label: string;
  priceMinor: number;
  note: string;
};

export type BasketPlan = {
  id: string;
  name: string;
  audience: string;
  emoji: string;
  accent: string;
  items: string[];
  tiers: BasketTier[];
  popular?: boolean;
};

export const basketPlans: BasketPlan[] = [
  {
    id: "student",
    name: "Student Basket",
    audience: "Affordable food supplies for students.",
    emoji: "🎓",
    accent: "#f4a524",
    items: ["5kg rice", "2kg beans", "1 litre vegetable oil", "Spaghetti", "Seasoning", "Sachet tomato paste"],
    tiers: [
      { id: "basic", label: "Basic", priceMinor: 1_850_000, note: "One person, one week of staples" },
      { id: "standard", label: "Standard", priceMinor: 2_600_000, note: "Adds garri, milk and eggs" },
      { id: "premium", label: "Premium", priceMinor: 3_400_000, note: "Adds noodles, biscuits and drinks" },
    ],
  },
  {
    id: "personal",
    name: "Personal Basket",
    audience: "For individuals and single households.",
    emoji: "🧑🏽",
    accent: "#2f9e6b",
    items: ["5kg rice", "3kg beans", "2 litres vegetable oil", "1kg garri", "Eggs", "Tomato paste", "Seasoning"],
    tiers: [
      { id: "basic", label: "Basic", priceMinor: 3_200_000, note: "Everyday cooking for one" },
      { id: "standard", label: "Standard", priceMinor: 4_500_000, note: "Adds chicken, fish and fruit" },
      { id: "premium", label: "Premium", priceMinor: 5_800_000, note: "Adds snacks, drinks and dairy" },
    ],
  },
  {
    id: "family",
    name: "Family Basket",
    audience: "For regular household consumption.",
    emoji: "👨‍👩‍👧‍👦",
    accent: "#6d28d9",
    items: ["10kg rice", "5kg beans", "5kg garri", "2 litres palm oil", "2 litres vegetable oil", "Spaghetti", "Seasoning"],
    tiers: [
      { id: "basic", label: "Basic", priceMinor: 6_500_000, note: "Feeds a household for a week" },
      { id: "standard", label: "Standard", priceMinor: 8_500_000, note: "Adds fish, chicken and eggs" },
      { id: "premium", label: "Premium", priceMinor: 11_000_000, note: "Adds fruit, dairy and drinks" },
    ],
    popular: true,
  },
  {
    id: "business",
    name: "Business Basket",
    audience: "Bulk supplies for canteens, offices and resellers.",
    emoji: "🏢",
    accent: "#1b6cff",
    items: ["50kg rice", "25kg beans", "25kg garri", "10 litres palm oil", "10 litres vegetable oil", "Bulk seasoning", "Wholesale invoice"],
    tiers: [
      { id: "small", label: "Small", priceMinor: 15_000_000, note: "Small canteen, one week" },
      { id: "medium", label: "Medium", priceMinor: 26_000_000, note: "Growing kitchen, two weeks" },
      { id: "large", label: "Large", priceMinor: 42_000_000, note: "Full kitchen or reseller restock" },
    ],
  },
];

export type BasketStatus = "active" | "paused" | "cancelled";

export type BasketSubscription = {
  id: string;
  customerName: string;
  email: string;
  phone: string;
  type: "plan" | "custom";
  planId: string;
  planName: string;
  tier: string;
  frequency: BasketFrequency;
  amountMinor: number;
  baseMinor: number;
  currency: "NGN";
  address: string;
  city: string;
  region: string;
  deliveryDay: DeliveryDay;
  nextDelivery: string;
  items: { label: string; productId?: string; quantity?: number }[];
  status: BasketStatus;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

/** Money in kobo → "₦12,500" (no decimals when the amount is whole naira). */
export function formatNaira(minor: number) {
  const naira = Math.round(minor / 100);
  return `₦${naira.toLocaleString("en-NG")}`;
}

/** The price a subscriber pays for one delivery of a tier at a given rhythm. */
export function priceForFrequency(priceMinor: number, frequency: BasketFrequency) {
  return Math.round(priceMinor * (1 - frequencyDiscount[frequency]));
}

/** How far ahead the next delivery lands, counted from today. */
export function nextDeliveryFor(frequency: BasketFrequency, from = new Date()) {
  const days = frequency === "weekly" ? 7 : frequency === "biweekly" ? 14 : 30;
  const next = new Date(from.getTime() + days * 86_400_000);
  return next.toISOString().slice(0, 10);
}

/** The same period, used to "skip" a delivery. */
export function advanceDelivery(current: string, frequency: BasketFrequency) {
  const from = new Date(`${current}T09:00:00Z`);
  const days = frequency === "weekly" ? 7 : frequency === "biweekly" ? 14 : 30;
  return new Date(from.getTime() + days * 86_400_000).toISOString().slice(0, 10);
}

export function isBasketFrequency(value: unknown): value is BasketFrequency {
  return typeof value === "string" && (basketFrequencies as readonly string[]).includes(value);
}

export function isDeliveryDay(value: unknown): value is DeliveryDay {
  return typeof value === "string" && (deliveryDays as readonly string[]).includes(value);
}

export function findPlan(planId: string) {
  return basketPlans.find((plan) => plan.id === planId);
}
