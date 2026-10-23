import { Timestamp } from "firebase-admin/firestore";
import { authenticatedUser, isStaff } from "@/lib/auth/server";
import { createActivity } from "@/lib/activity";
import { adminDb } from "@/lib/firebase/admin";
import { jsonError, readJson } from "@/lib/http";

const allowedTransitions: Record<string, string[]> = {
  Paid: ["Processing", "Cancelled/Refund"],
  Processing: ["Ready", "Cancelled/Refund"],
  Ready: ["Delivered", "Cancelled/Refund"],
  "Pending seller confirmation": ["Cancelled/Refund"],
  "Awaiting buyer payment": ["Cancelled/Refund"],
};

export async function PATCH(request: Request, context: { params: Promise<{ orderId: string }> }) {
  const user = await authenticatedUser(request);
  if (!user) return jsonError("Sign in to update an order.", 401);
  const body = await readJson(request);
  if (!body) return jsonError("Enter valid order changes.", 400);
  const { orderId } = await context.params;
  if (!/^[A-Za-z0-9_-]{1,150}$/.test(orderId)) return jsonError("Invalid order reference.", 400);

  const isDeliveryQuote = body.deliveryFeeMinor !== undefined;
  const status = body.status;
  if (!isDeliveryQuote && (typeof status !== "string" || !Object.hasOwn(allowedTransitions, status))) {
    return jsonError("Choose a valid order status or provide a delivery-fee quote.", 400);
  }
  if (isDeliveryQuote && (!Number.isSafeInteger(body.deliveryFeeMinor) ||
      Number(body.deliveryFeeMinor) < 0 || Number(body.deliveryFeeMinor) > 100_000_000)) {
    return jsonError("Enter a valid delivery fee in naira.", 400);
  }
  if (isDeliveryQuote && user.role !== "vendor" && user.role !== "supplier" && !isStaff(user.role)) {
    return jsonError("Only the seller can confirm delivery for this order.", 403);
  }

  try {
    const db = adminDb();
    const orderRef = db.collection("orders").doc(orderId);
    const result = await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(orderRef);
      if (!snapshot.exists) throw new Error("ORDER_NOT_FOUND");
      const order = snapshot.data()!;
      if (!isStaff(user.role) && user.uid !== order.sellerId) throw new Error("ORDER_FORBIDDEN");
      if (isDeliveryQuote) {
        const sellerSnapshot = await transaction.get(db.collection("users").doc(String(order.sellerId)));
        const seller = sellerSnapshot.data();
        const payoutAccount = seller?.payoutAccount;
        if (!sellerSnapshot.exists || seller?.verificationStatus !== "approved" ||
            !payoutAccount || !/^\d{10}$/.test(String(payoutAccount.accountNumber ?? "")) ||
            !String(payoutAccount.bankCode ?? "") || !payoutAccount.verifiedAt) {
          throw new Error("SELLER_PAYOUT_REQUIRED");
        }
      }

      const now = Timestamp.now();
      let nextStatus = String(status ?? "");
      const updates: Record<string, unknown> = { updatedAt: now };

      if (isDeliveryQuote) {
        if (order.status !== "Pending seller confirmation" || order.paymentStatus !== "unpaid") {
          throw new Error("QUOTE_NOT_ALLOWED");
        }
        const subtotalMinor = Number(order.subtotalMinor);
        const deliveryFeeMinor = Number(body.deliveryFeeMinor);
        if (!Number.isSafeInteger(subtotalMinor) || subtotalMinor <= 0 ||
            !Number.isSafeInteger(subtotalMinor + deliveryFeeMinor) ||
            subtotalMinor + deliveryFeeMinor > 100_000_000_000) {
          throw new Error("INVALID_TOTAL");
        }
        nextStatus = "Awaiting buyer payment";
        updates.deliveryFeeMinor = deliveryFeeMinor;
        updates.totalMinor = subtotalMinor + deliveryFeeMinor;
        updates.status = nextStatus;
      } else {
        if (!allowedTransitions[String(order.status)]?.includes(nextStatus)) throw new Error("INVALID_TRANSITION");
        if (nextStatus === "Processing" && order.paymentStatus !== "paid") throw new Error("PAYMENT_NOT_CONFIRMED");
        if (nextStatus === "Cancelled/Refund" && order.paymentStatus === "paid") throw new Error("REFUND_UNAVAILABLE");
        if (nextStatus === "Cancelled/Refund" && order.paymentStatus !== "unpaid" && order.paymentStatus !== "cancelled") {
          throw new Error("PAYMENT_IN_PROGRESS");
        }
        updates.status = nextStatus;
      }

      const inventoryUpdates: { ref: FirebaseFirestore.DocumentReference; stock: number }[] = [];
      if (nextStatus === "Cancelled/Refund" && order.inventoryReleased !== true) {
        const items = order.items as { productId: string; quantity: number }[];
        const products = await Promise.all(items.map((item) => transaction.get(db.collection("products").doc(item.productId))));
        products.forEach((product, index) => {
          if (!product.exists) return;
          const currentStock = Number(product.data()?.stock ?? 0);
          const restoredStock = currentStock + Number(items[index].quantity);
          if (!Number.isSafeInteger(restoredStock)) throw new Error("INVALID_STOCK");
          inventoryUpdates.push({ ref: product.ref, stock: restoredStock });
        });
        updates.paymentStatus = "cancelled";
        updates.inventoryReleased = true;
      }
      for (const inventory of inventoryUpdates) {
        transaction.update(inventory.ref, { stock: inventory.stock, updatedAt: now });
      }
      transaction.update(orderRef, updates);
      createActivity(transaction, {
        actorUid: user.uid,
        actorRole: String(user.role ?? "unknown"),
        targetUserId: String(order.customerId),
        action: isDeliveryQuote ? "delivery_fee_confirmed" : "order_status_changed",
        targetType: "order",
        targetId: orderId,
        summary: isDeliveryQuote
          ? `Delivery is arranged by ${String(order.sellerName ?? "your seller")}. Delivery fee: NGN ${(Number(body.deliveryFeeMinor) / 100).toLocaleString("en-NG", { minimumFractionDigits: 2 })}. Your order is ready for payment.`
          : `Your order ${orderId.slice(0, 8)} is now ${nextStatus}.`,
      });
      return { id: snapshot.id, ...order, ...updates, status: nextStatus };
    });
    return Response.json({ order: result });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "ORDER_NOT_FOUND") return jsonError("Order not found.", 404);
    if (code === "ORDER_FORBIDDEN") return jsonError("You cannot update this order.", 403);
    if (code === "QUOTE_NOT_ALLOWED") return jsonError("This order can no longer receive a delivery quote.", 409);
    if (code === "SELLER_PAYOUT_REQUIRED") return jsonError("Verify your business bank account in Payouts before confirming delivery.", 409);
    if (code === "INVALID_TRANSITION") return jsonError("This order cannot move to that status.", 409);
    if (code === "PAYMENT_NOT_CONFIRMED") return jsonError("The buyer must pay before you start preparing the order.", 409);
    if (code === "REFUND_UNAVAILABLE") return jsonError("Paid-order refunds are not enabled yet. Contact SureFood support before cancelling.", 409);
    if (code === "INVALID_STOCK") return jsonError("Order stock could not be safely restored.", 500);
    if (code === "INVALID_TOTAL") return jsonError("The product and delivery total is invalid.", 400);
    if (code === "PAYMENT_IN_PROGRESS") return jsonError("This order cannot be cancelled while payment is being processed.", 409);
    console.error("Could not update a SureFood order.", error);
    return jsonError("We could not update the order.", 500);
  }
}
