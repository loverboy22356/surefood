import { Timestamp } from "firebase-admin/firestore";
import { authenticatedUser } from "@/lib/auth/server";
import { adminDb, firebaseAdminConfigured } from "@/lib/firebase/admin";
import { cleanString, jsonError, readJson } from "@/lib/http";
import { isValidPhone } from "@/lib/requests";
import { serializeBasket } from "@/lib/basket-records";
import {
  advanceDelivery,
  isBasketFrequency,
  isDeliveryDay,
  nextDeliveryFor,
  priceForFrequency,
} from "@/lib/baskets";

type Params = { params: Promise<{ subscriptionId: string }> };

/** Pause, resume, skip, cancel — or change the rhythm and the delivery details. */
export async function PATCH(request: Request, { params }: Params) {
  if (!firebaseAdminConfigured()) return jsonError("Basket subscriptions are not available yet.", 503);
  const user = await authenticatedUser(request);
  if (!user) return jsonError("Sign in to manage your basket plan.", 401);

  const { subscriptionId } = await params;
  const body = await readJson(request);
  if (!body) return jsonError("Choose what to change on this basket.", 400);
  const action = cleanString(body.action, 20);

  const reference = adminDb().collection("basketSubscriptions").doc(subscriptionId);
  const snapshot = await reference.get();
  if (!snapshot.exists) return jsonError("That basket plan no longer exists.", 404);
  const current = snapshot.data() ?? {};
  if (current.uid !== user.uid) return jsonError("That basket belongs to another account.", 403);
  if (current.status === "cancelled") return jsonError("This basket plan has already been cancelled.", 409);

  const updates: Record<string, unknown> = { updatedAt: Timestamp.now() };
  const frequency = isBasketFrequency(current.frequency) ? current.frequency : "monthly";

  switch (action) {
    case "pause":
      updates.status = "paused";
      break;
    case "resume":
      updates.status = "active";
      updates.nextDelivery = nextDeliveryFor(frequency);
      break;
    case "skip":
      updates.nextDelivery = advanceDelivery(String(current.nextDelivery ?? nextDeliveryFor(frequency)), frequency);
      break;
    case "cancel":
      updates.status = "cancelled";
      break;
    case "update": {
      const nextFrequency = isBasketFrequency(body.frequency) ? body.frequency : frequency;
      const address = cleanString(body.address, 240) || String(current.address ?? "");
      const city = cleanString(body.city, 80) || String(current.city ?? "");
      const region = cleanString(body.region, 80) || String(current.region ?? "");
      const phone = cleanString(body.phone, 20) || String(current.phone ?? "");
      const deliveryDay = isDeliveryDay(body.deliveryDay) ? body.deliveryDay : current.deliveryDay;
      if (address.length < 10) return jsonError("Enter the full delivery address, including street and landmark.", 400);
      if (!isValidPhone(phone)) return jsonError("Enter a phone number the rider can reach you on.", 400);
      updates.frequency = nextFrequency;
      updates.address = address;
      updates.city = city;
      updates.region = region;
      updates.phone = phone;
      updates.deliveryDay = deliveryDay;
      const baseMinor = Number(current.baseMinor ?? current.amountMinor ?? 0);
      updates.amountMinor = priceForFrequency(baseMinor, nextFrequency);
      updates.nextDelivery = nextDeliveryFor(nextFrequency);
      break;
    }
    default:
      return jsonError("Unknown basket action.", 400);
  }

  try {
    await reference.update(updates);
    const updated = await reference.get();
    return Response.json({ subscription: serializeBasket(updated) });
  } catch (error) {
    console.error("Could not update a basket subscription.", error);
    return jsonError("We could not update your basket plan. Please try again.", 500);
  }
}
