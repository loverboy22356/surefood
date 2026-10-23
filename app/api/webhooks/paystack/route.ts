import { NextResponse } from "next/server";
import { completeApprovalFee, approvalFeeReferencePrefix } from "@/lib/approval-fees";
import { completePaystackOrder } from "@/lib/paystack-orders";
import { paystackConfigured, validPaystackSignature } from "@/lib/paystack";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!paystackConfigured()) return NextResponse.json({ error: "Webhook is not configured." }, { status: 503 });
  const rawBody = await request.text();
  try {
    if (!validPaystackSignature(rawBody, request.headers.get("x-paystack-signature"))) {
      return NextResponse.json({ error: "Invalid webhook signature." }, { status: 401 });
    }
    const event = JSON.parse(rawBody) as {
      event?: string;
      data?: { reference?: string; metadata?: { orderId?: string; type?: string; uid?: string } };
    };
    if (event.event !== "charge.success") return NextResponse.json({ received: true });
    const reference = event.data?.reference;
    if (!reference) return NextResponse.json({ error: "Payment reference is missing." }, { status: 400 });
    if (reference.startsWith(approvalFeeReferencePrefix) || event.data?.metadata?.type === "approval_fee") {
      await completeApprovalFee(reference, event.data?.metadata?.uid);
    } else {
      await completePaystackOrder(reference, event.data?.metadata?.orderId);
    }
    return NextResponse.json({ received: true });
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ error: "Invalid webhook payload." }, { status: 400 });
    console.error("Could not process a Paystack webhook.", error);
    return NextResponse.json({ error: "Payment confirmation could not be processed." }, { status: 500 });
  }
}
