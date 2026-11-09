import "server-only";

import { Timestamp, type DocumentSnapshot } from "firebase-admin/firestore";
import type { BasketFrequency, BasketStatus, BasketSubscription, DeliveryDay } from "@/lib/baskets";

export type StoredBasket = BasketSubscription & { uid: string };

/**
 * Firestore documents carry Timestamp instances; every basket response is JSON
 * all the way down so the client can render dates without guessing.
 */
export function serializeBasket(document: DocumentSnapshot): StoredBasket {
  const data = document.data() ?? {};
  return {
    id: document.id,
    uid: typeof data.uid === "string" ? data.uid : "",
    customerName: typeof data.customerName === "string" ? data.customerName : "",
    email: typeof data.email === "string" ? data.email : "",
    phone: typeof data.phone === "string" ? data.phone : "",
    type: data.type === "custom" ? "custom" : "plan",
    planId: typeof data.planId === "string" ? data.planId : "",
    planName: typeof data.planName === "string" ? data.planName : "",
    tier: typeof data.tier === "string" ? data.tier : "",
    frequency: (typeof data.frequency === "string" ? data.frequency : "monthly") as BasketFrequency,
    amountMinor: typeof data.amountMinor === "number" ? data.amountMinor : 0,
    baseMinor: typeof data.baseMinor === "number" ? data.baseMinor : 0,
    currency: "NGN",
    address: typeof data.address === "string" ? data.address : "",
    city: typeof data.city === "string" ? data.city : "",
    region: typeof data.region === "string" ? data.region : "",
    deliveryDay: (typeof data.deliveryDay === "string" ? data.deliveryDay : "Monday") as DeliveryDay,
    nextDelivery: typeof data.nextDelivery === "string" ? data.nextDelivery : "",
    items: Array.isArray(data.items) ? data.items : [],
    status: (typeof data.status === "string" ? data.status : "active") as BasketStatus,
    notes: typeof data.notes === "string" ? data.notes : "",
    createdAt: isoString(data.createdAt),
    updatedAt: isoString(data.updatedAt),
  };
}

function isoString(value: unknown) {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  return typeof value === "string" ? value : "";
}
