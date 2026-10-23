import "server-only";

import { Timestamp } from "firebase-admin/firestore";
import { createActivity } from "@/lib/activity";
import { adminDb } from "@/lib/firebase/admin";
import { paystackRequest, type PaystackTransaction } from "@/lib/paystack";

export async function findOrderByPaymentReference(reference: string) {
  const snapshot = await adminDb().collection("orders")
    .where("paymentReference", "==", reference)
    .limit(2)
    .get();
  if (snapshot.size !== 1) throw new Error("PAYMENT_ORDER_NOT_FOUND");
  return { id: snapshot.docs[0].id, data: snapshot.docs[0].data() };
}

export async function completePaystackOrder(reference: string, orderId?: string) {
  const db = adminDb();
  const found = orderId
    ? { id: orderId, data: (await db.collection("orders").doc(orderId).get()).data() }
    : await findOrderByPaymentReference(reference);
  const resolvedOrder = found.data;
  if (!resolvedOrder) throw new Error("PAYMENT_ORDER_NOT_FOUND");

  const transaction = await paystackRequest<PaystackTransaction>(
    `/transaction/verify/${encodeURIComponent(reference)}`,
  );
  if (transaction.status !== "success" ||
      transaction.reference !== reference ||
      transaction.currency !== "NGN" ||
      transaction.amount !== Number(resolvedOrder.totalMinor) ||
      (transaction.metadata?.orderId && transaction.metadata.orderId !== found.id) ||
      (transaction.metadata?.customerId && transaction.metadata.customerId !== String(resolvedOrder.customerId))) {
    throw new Error("PAYMENT_NOT_CONFIRMED");
  }

  const ref = db.collection("orders").doc(found.id);
  return db.runTransaction(async (writer) => {
    const snapshot = await writer.get(ref);
    if (!snapshot.exists) throw new Error("PAYMENT_ORDER_NOT_FOUND");
    const order = snapshot.data()!;
    if (order.customerId !== resolvedOrder.customerId ||
        order.paymentReference !== reference ||
        Number(order.totalMinor) !== transaction.amount) {
      throw new Error("PAYMENT_ORDER_MISMATCH");
    }
    if (order.paymentStatus === "paid" && order.paymentReference === reference) {
      return { id: snapshot.id, alreadyPaid: true };
    }
    if (order.status !== "Awaiting buyer payment" || order.paymentStatus !== "pending") {
      throw new Error("ORDER_NOT_PAYABLE");
    }
    const now = Timestamp.now();
    writer.update(ref, {
      status: "Paid",
      paymentStatus: "paid",
      paidAt: now,
      paystackTransactionId: String(transaction.reference),
      updatedAt: now,
    });
    createActivity(writer, {
      actorUid: "paystack",
      actorRole: "system",
      targetUserId: String(order.sellerId),
      action: "order_paid",
      targetType: "order",
      targetId: snapshot.id,
      summary: `Order ${snapshot.id.slice(0, 8)} has been paid by the buyer and is ready to prepare.`,
    });
    createActivity(writer, {
      actorUid: "paystack",
      actorRole: "system",
      targetUserId: String(order.customerId),
      action: "payment_confirmed",
      targetType: "order",
      targetId: snapshot.id,
      summary: `Payment confirmed for order ${snapshot.id.slice(0, 8)}.`,
    });
    return { id: snapshot.id, alreadyPaid: false };
  });
}
