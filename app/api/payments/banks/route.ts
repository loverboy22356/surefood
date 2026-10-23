import { authenticatedUser } from "@/lib/auth/server";
import { jsonError } from "@/lib/http";
import { paystackConfigured, paystackRequest } from "@/lib/paystack";

type Bank = { name: string; code: string };

export async function GET(request: Request) {
  const user = await authenticatedUser(request);
  if (!user) return jsonError("Sign in to view payout banks.", 401);
  if (!paystackConfigured()) return jsonError("Bank account verification is not configured on the server.", 503);
  try {
    const banks = await paystackRequest<Bank[]>("/bank?country=nigeria&perPage=100");
    return Response.json({
      banks: banks.filter((bank) => typeof bank.name === "string" && typeof bank.code === "string"),
    });
  } catch (error) {
    console.error("Could not load Paystack bank directory.", error);
    return jsonError("We could not load bank options. Please try again later.", 502);
  }
}
