import { authenticatedUser } from "@/lib/auth/server";
import { completeApprovalFee } from "@/lib/approval-fees";
import { jsonError, readJson } from "@/lib/http";
import { paystackConfigured } from "@/lib/paystack";

export async function POST(request: Request) {
  const user = await authenticatedUser(request);
  if (!user) return jsonError("Sign in to verify your approval fee.", 401);
  if (user.role !== "vendor" && user.role !== "supplier") {
    return jsonError("Only vendor and supplier accounts pay an approval fee.", 403);
  }
  if (!paystackConfigured()) return jsonError("Approval-fee verification is not configured on the server.", 503);
  const body = await readJson(request);
  const reference = typeof body?.reference === "string" ? body.reference : "";
  if (!reference.startsWith("sf_fee_") || !/^[A-Za-z0-9_-]{16,120}$/.test(reference)) {
    return jsonError("Invalid approval-fee payment reference.", 400);
  }

  try {
    const result = await completeApprovalFee(reference, user.uid);
    return Response.json({ verified: true, approvalFeeStatus: "paid", ...result });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "APPROVAL_FEE_PROFILE_NOT_FOUND") return jsonError("No account matches this approval-fee payment.", 404);
    if (code === "APPROVAL_FEE_NOT_CONFIRMED") return jsonError("Paystack has not confirmed this approval-fee payment.", 409);
    console.error("Could not verify an approval fee payment.", error);
    return jsonError("We could not verify your approval-fee payment. Check your account before trying again.", 502);
  }
}
