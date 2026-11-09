import { Timestamp } from "firebase-admin/firestore";
import { authenticatedUser, isStaff } from "@/lib/auth/server";
import { adminDb, firebaseAdminConfigured } from "@/lib/firebase/admin";
import { cleanString, jsonError, readJson } from "@/lib/http";
import { serializeBasket } from "@/lib/basket-records";
import { isDeliveryDay } from "@/lib/baskets";

type Params = { params: Promise<{ subscriptionId: string }> };

/** Staff move a subscription along, leave a note, or correct the next delivery. */
export async function PATCH(request: Request, { params }: Params) {
  if (!firebaseAdminConfigured()) return jsonError("Basket subscriptions are not available yet.", 503);
  const user = await authenticatedUser(request);
  if (!user || !isStaff(user.role)) return jsonError("Staff access is required.", 403);

  const { subscriptionId } = await params;
  const body = await readJson(request);
  if (!body) return jsonError("Enter the changes for this subscription.", 400);

  const reference = adminDb().collection("basketSubscriptions").doc(subscriptionId);
  const snapshot = await reference.get();
  if (!snapshot.exists) return jsonError("That basket plan no longer exists.", 404);

  const updates: Record<string, unknown> = { updatedAt: Timestamp.now() };
  const status = cleanString(body.status, 20);
  if (status) {
    if (!["active", "paused", "cancelled"].includes(status)) return jsonError("Unknown basket status.", 400);
    updates.status = status;
  }
  if (body.notes !== undefined) updates.notes = cleanString(body.notes, 400);
  const nextDelivery = cleanString(body.nextDelivery, 10);
  if (nextDelivery) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(nextDelivery) || Number.isNaN(new Date(`${nextDelivery}T00:00:00Z`).getTime())) {
      return jsonError("Enter the next delivery as a date (YYYY-MM-DD).", 400);
    }
    updates.nextDelivery = nextDelivery;
  }
  if (body.deliveryDay !== undefined) {
    if (!isDeliveryDay(body.deliveryDay)) return jsonError("Choose a delivery day.", 400);
    updates.deliveryDay = body.deliveryDay;
  }
  updates.reviewedBy = user.uid;
  updates.reviewedAt = Timestamp.now();

  try {
    await reference.update(updates);
    const updated = await reference.get();
    return Response.json({ subscription: serializeBasket(updated) });
  } catch (error) {
    console.error("Could not update a basket subscription.", error);
    return jsonError("We could not update that basket plan.", 500);
  }
}
