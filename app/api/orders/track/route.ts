import { adminDb, firebaseAdminConfigured } from "@/lib/firebase/admin";
import { jsonError } from "@/lib/http";

export const runtime = "nodejs";

/**
 * Public order tracking. An order reference on its own is guessable, so the
 * lookup only answers when the reference and the email on the order agree.
 */
export async function GET(request: Request) {
  if (!firebaseAdminConfigured()) {
    return jsonError("Order tracking is unavailable until Firebase Admin is configured.", 503);
  }
  const params = new URL(request.url).searchParams;
  const orderId = (params.get("id") ?? "").trim();
  const email = (params.get("email") ?? "").trim().toLowerCase();
  if (!/^[A-Za-z0-9_-]{1,150}$/.test(orderId)) return jsonError("Enter a valid order ID.", 400);
  if (!/^\S+@\S+\.\S+$/.test(email)) return jsonError("Enter the email used on the order.", 400);

  try {
    const snapshot = await adminDb().collection("orders").doc(orderId).get();
    if (!snapshot.exists) return jsonError("We could not find an order with that ID.", 404);
    const order = snapshot.data() ?? {};
    if (String(order.customerEmail ?? "").trim().toLowerCase() !== email) {
      return jsonError("That email does not match this order.", 403);
    }

    const toIso = (value: unknown) => {
      if (value && typeof value === "object" && "toDate" in value && typeof (value as { toDate: () => Date }).toDate === "function") {
        return (value as { toDate: () => Date }).toDate().toISOString();
      }
      return typeof value === "string" ? value : "";
    };

    const items = Array.isArray(order.items)
      ? order.items.map((item: Record<string, unknown>) => ({
          name: String(item.name ?? "Item"),
          quantity: Number(item.quantity ?? 0),
          lineTotalMinor: Number(item.lineTotalMinor ?? 0),
          currency: String(item.currency ?? "NGN"),
        }))
      : [];

    return Response.json({
      order: {
        id: snapshot.id,
        status: String(order.status ?? "Pending payment"),
        paymentStatus: String(order.paymentStatus ?? "unpaid"),
        sellerName: String(order.sellerName ?? "Sure Foodz seller"),
        currency: String(order.currency ?? "NGN"),
        subtotalMinor: Number(order.subtotalMinor ?? 0),
        deliveryFeeMinor: Number(order.deliveryFeeMinor ?? 0),
        totalMinor: Number(order.totalMinor ?? order.subtotalMinor ?? 0),
        placedAt: toIso(order.createdAt),
        updatedAt: toIso(order.updatedAt),
        deliveryAddress: String(order.deliveryAddress ?? ""),
        items,
      },
    }, { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    console.error("Could not track this Sure Foodz order.", error);
    return jsonError("We could not look up that order right now.", 500);
  }
}
