import { authenticatedUser } from "@/lib/auth/server";
import { adminDb, firebaseAdminConfigured } from "@/lib/firebase/admin";
import { jsonError } from "@/lib/http";
import { serializeBasket } from "@/lib/basket-records";

/** The signed-in customer's basket plans. Personal data, so never cached. */
export async function GET(request: Request) {
  if (!firebaseAdminConfigured()) return jsonError("Basket subscriptions are not available yet.", 503);
  const user = await authenticatedUser(request);
  if (!user) return jsonError("Sign in to see your basket plans.", 401);

  try {
    const snapshot = await adminDb().collection("basketSubscriptions")
      .where("uid", "==", user.uid)
      .orderBy("createdAt", "desc")
      .limit(50)
      .get();
    return Response.json({ subscriptions: snapshot.docs.map(serializeBasket) });
  } catch (error) {
    console.error("Could not load basket subscriptions.", error);
    return jsonError("We could not load your basket plans right now.", 500);
  }
}
