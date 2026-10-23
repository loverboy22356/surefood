import { authenticatedUser } from "@/lib/auth/server";
import { initializeApprovalFee } from "@/lib/approval-fees";
import { jsonError } from "@/lib/http";
import { paystackConfigured } from "@/lib/paystack";

export async function POST(request: Request) {
  const user = await authenticatedUser(request);
  if (!user) return jsonError("Sign in to pay your business approval fee.", 401);
  if (user.role !== "vendor" && user.role !== "supplier") {
    return jsonError("Only vendor and supplier accounts pay an approval fee.", 403);
  }
  if (!paystackConfigured()) return jsonError("Approval-fee checkout is not configured on the server.", 503);

  try {
    const result = await initializeApprovalFee({ uid: user.uid, email: user.email });
    return Response.json(result);
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "PROFILE_NOT_FOUND") return jsonError("Complete your business profile before paying the approval fee.", 404);
    if (code === "FEE_NOT_REQUIRED") return jsonError("This account does not pay an approval fee.", 403);
    if (code === "APPROVAL_REQUIRED") return jsonError("Your business must be approved before the fee can be paid.", 409);
    if (code === "FEE_ALREADY_PAID") return jsonError("Your approval fee has already been paid.", 409);
    if (code === "BILLING_EMAIL_REQUIRED") return jsonError("Add an email address to your account before paying.", 409);
    console.error("Could not initialize the approval fee payment.", error);
    return jsonError(
      code === "PAYSTACK_NOT_CONFIGURED"
        ? "Approval-fee checkout is not configured on the server."
        : "Paystack could not start the approval-fee checkout. Please try again.",
      502,
    );
  }
}
