import { authenticatedUser, isStaff } from "@/lib/auth/server";
import { adminDb, firebaseAdminConfigured } from "@/lib/firebase/admin";
import { jsonError } from "@/lib/http";
import { serializeBasket } from "@/lib/basket-records";

/** Every basket subscription, newest first, for the staff queue. */
export async function GET(request: Request) {
  if (!firebaseAdminConfigured()) return jsonError("Basket subscriptions are not available yet.", 503);
  const user = await authenticatedUser(request);
  if (!user || !isStaff(user.role)) return jsonError("Staff access is required.", 403);

  const status = new URL(request.url).searchParams.get("status");
  try {
    let query = adminDb().collection("basketSubscriptions").orderBy("createdAt", "desc").limit(200);
    if (status === "active" || status === "paused" || status === "cancelled") {
      query = adminDb().collection("basketSubscriptions").where("status", "==", status).orderBy("createdAt", "desc").limit(200);
    }
    const snapshot = await query.get();
    return Response.json({ subscriptions: snapshot.docs.map(serializeBasket) });
  } catch (error) {
    console.error("Could not load the basket queue.", error);
    return jsonError("We could not load basket subscriptions.", 500);
  }
}
