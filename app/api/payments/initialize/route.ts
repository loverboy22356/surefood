import { randomUUID } from "node:crypto";
import { Timestamp } from "firebase-admin/firestore";
import { authenticatedUser } from "@/lib/auth/server";
import { adminDb } from "@/lib/firebase/admin";
import { jsonError, readJson } from "@/lib/http";
import { paystackAppBaseUrl, paystackConfigured, paystackRequest } from "@/lib/paystack";

type InitializationResponse = {
  authorization_url?: string;
  reference?: string;
};

export async function POST(request: Request) {
  const user = await authenticatedUser(request);
  if (!user) return jsonError("Sign in to pay for this order.", 401);
  if (user.role !== "buyer" && user.role !== "vendor") return jsonError("Only the buyer can pay for this order.", 403);
  if (!paystackConfigured()) return jsonError("Paystack checkout is not configured on the server.", 503);
  const body = await readJson(request);
  const orderId = typeof body?.orderId === "string" ? body.orderId : "";
  if (!/^[A-Za-z0-9_-]{1,150}$/.test(orderId)) return jsonError("Choose a valid order to pay for.", 400);

  let baseUrl: string;
  try {
    baseUrl = paystackAppBaseUrl();
  } catch (error) {
    return jsonError(error instanceof Error && error.message === "APP_BASE_URL_NOT_CONFIGURED"
      ? "Checkout callback URL is not configured on the server."
      : "Checkout callback URL configuration is invalid.", 503);
  }

  const db = adminDb();
  const orderRef = db.collection("orders").doc(orderId);
  const reference = `sf_${orderId.slice(0, 12)}_${randomUUID().replaceAll("-", "")}`;
  let totalMinor = 0;
  let email = "";

  try {
    await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(orderRef);
      if (!snapshot.exists) throw new Error("ORDER_NOT_FOUND");
      const order = snapshot.data()!;
      if (order.customerId !== user.uid) throw new Error("ORDER_FORBIDDEN");
      if (order.status !== "Awaiting buyer payment" ||
          !Number.isSafeInteger(order.totalMinor) ||
          !Number.isSafeInteger(order.deliveryFeeMinor) ||
          order.deliveryHandledBy !== "seller") {
        throw new Error("ORDER_NOT_READY");
      }
      const sellerSnapshot = await transaction.get(db.collection("users").doc(String(order.sellerId)));
      const seller = sellerSnapshot.data();
      const payoutAccount = seller?.payoutAccount;
      if (!sellerSnapshot.exists || seller?.verificationStatus !== "approved" ||
          !payoutAccount || !/^\d{10}$/.test(String(payoutAccount.accountNumber ?? "")) ||
          !String(payoutAccount.bankCode ?? "") || !payoutAccount.verifiedAt) {
        throw new Error("SELLER_PAYOUT_REQUIRED");
      }
      const paymentUpdatedAt = order.updatedAt instanceof Timestamp ? order.updatedAt.toMillis() : 0;
      const staleInitialization = ["initializing", "pending"].includes(String(order.paymentStatus)) &&
        typeof order.paymentAuthorizationUrl !== "string" &&
        paymentUpdatedAt > 0 && Date.now() - paymentUpdatedAt >= 120_000;
      if (order.paymentStatus === "pending" && typeof order.paymentAuthorizationUrl === "string") {
        throw new Error("PAYMENT_ALREADY_INITIALIZED");
      }
      if (order.paymentStatus !== "unpaid" && !staleInitialization) throw new Error("PAYMENT_ALREADY_INITIALIZED");
      if (order.totalMinor <= 0) throw new Error("INVALID_AMOUNT");
      totalMinor = order.totalMinor;
      email = String(order.customerEmail ?? user.email ?? "");
      if (!email.includes("@")) throw new Error("CUSTOMER_EMAIL_REQUIRED");
      transaction.update(orderRef, {
        paymentStatus: "initializing",
        paymentReference: reference,
        updatedAt: Timestamp.now(),
      });
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "ORDER_NOT_FOUND") return jsonError("Order not found.", 404);
    if (code === "ORDER_FORBIDDEN") return jsonError("You can only pay for your own order.", 403);
    if (code === "ORDER_NOT_READY") return jsonError("The seller must confirm the delivery fee before you can pay.", 409);
    if (code === "SELLER_PAYOUT_REQUIRED") return jsonError("This seller must verify a business bank account before you can pay. Please contact the seller or SureFood support.", 409);
    if (code === "PAYMENT_ALREADY_INITIALIZED") return jsonError("Payment is already starting or has already been submitted. Refresh your orders before trying again.", 409);
    if (code === "INVALID_AMOUNT") return jsonError("This order has an invalid payment total.", 400);
    if (code === "CUSTOMER_EMAIL_REQUIRED") return jsonError("Add a valid email address to your account before paying.", 409);
    console.error("Could not prepare a SureFood payment.", error);
    return jsonError("We could not prepare payment for this order.", 500);
  }

  try {
    const initialized = await paystackRequest<InitializationResponse>("/transaction/initialize", {
      method: "POST",
      body: JSON.stringify({
        email,
        amount: totalMinor,
        currency: "NGN",
        reference,
        callback_url: `${baseUrl}/checkout/verify`,
        metadata: { orderId, customerId: user.uid },
      }),
    });
    if (!initialized.authorization_url || initialized.reference !== reference) {
      throw new Error("PAYSTACK_RESPONSE_INVALID");
    }
    await orderRef.update({
      paymentStatus: "pending",
      paymentAuthorizationUrl: initialized.authorization_url,
      updatedAt: Timestamp.now(),
    });
    return Response.json({ authorizationUrl: initialized.authorization_url });
  } catch (error) {
    try {
      const snapshot = await orderRef.get();
      if (snapshot.exists && snapshot.data()?.paymentReference === reference &&
          snapshot.data()?.paymentStatus === "initializing") {
        await orderRef.update({
          paymentStatus: "unpaid",
          paymentReference: "",
          updatedAt: Timestamp.now(),
        });
      }
    } catch (resetError) {
      console.error("Could not reset a failed Paystack initialization.", resetError);
    }
    console.error("Could not initialize Paystack checkout.", error);
    return jsonError(error instanceof Error && error.message === "PAYSTACK_NOT_CONFIGURED"
      ? "Paystack checkout is not configured on the server."
      : "Paystack could not start checkout. Please try again.", 502);
  }
}
