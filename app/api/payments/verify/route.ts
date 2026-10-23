import { authenticatedUser } from "@/lib/auth/server";
import { jsonError, readJson } from "@/lib/http";
import { completePaystackOrder, findOrderByPaymentReference } from "@/lib/paystack-orders";
import { paystackConfigured } from "@/lib/paystack";

export async function POST(request: Request) {
  const user = await authenticatedUser(request);
  if (!user) return jsonError("Sign in to verify your payment.", 401);
  if (user.role !== "buyer" && user.role !== "vendor") return jsonError("Only the buyer can verify this payment.", 403);
  if (!paystackConfigured()) return jsonError("Paystack payment verification is not configured.", 503);
  const body = await readJson(request);
  const reference = typeof body?.reference === "string" ? body.reference : "";
  if (!/^[A-Za-z0-9_-]{8,120}$/.test(reference)) return jsonError("Invalid payment reference.", 400);

  try {
    const order = await findOrderByPaymentReference(reference);
    if (order.data.customerId !== user.uid) return jsonError("You cannot verify another buyer's payment.", 403);
    await completePaystackOrder(reference, order.id);
    return Response.json({ verified: true, orderId: order.id });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "PAYMENT_ORDER_NOT_FOUND") return jsonError("No SureFood order matches this payment reference.", 404);
    if (code === "PAYMENT_NOT_CONFIRMED") return jsonError("Paystack has not confirmed this payment. You have not been marked as paid.", 409);
    if (code === "ORDER_NOT_PAYABLE" || code === "PAYMENT_ORDER_MISMATCH") return jsonError("This order is no longer awaiting this payment.", 409);
    console.error("Could not verify a SureFood payment.", error);
    return jsonError("We could not verify your payment right now. Check your order status before trying again.", 502);
  }
}
