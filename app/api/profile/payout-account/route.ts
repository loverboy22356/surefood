import { Timestamp } from "firebase-admin/firestore";
import { authenticatedUser } from "@/lib/auth/server";
import { adminDb } from "@/lib/firebase/admin";
import { jsonError, readJson } from "@/lib/http";
import { paystackConfigured, paystackRequest } from "@/lib/paystack";

type BankResolution = { account_name?: string; account_number?: string };
type Bank = { name: string; code: string };

function normalizeAccountName(value: string) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

export async function GET(request: Request) {
  const user = await authenticatedUser(request);
  if (!user) return jsonError("Sign in to view payout account details.", 401);
  if (user.role !== "vendor" && user.role !== "supplier") return jsonError("Only sellers can view payout account details.", 403);
  try {
    const snapshot = await adminDb().collection("users").doc(user.uid).get();
    const profile = snapshot.data();
    if (!snapshot.exists || !profile || profile.role !== user.role) return jsonError("Seller account not found.", 404);
    if (profile.verificationStatus !== "approved") return jsonError("Payout account setup is available after business verification.", 403);
    const payout = profile.payoutAccount;
    if (!payout) return Response.json({ payoutAccount: null });
    return Response.json({
      payoutAccount: {
        bankName: String(payout.bankName ?? ""),
        accountName: String(payout.accountName ?? ""),
        accountLast4: String(payout.accountNumber ?? "").slice(-4),
        verifiedAt: payout.verifiedAt?.toDate?.().toISOString?.() ?? null,
      },
    });
  } catch (error) {
    console.error("Could not load seller payout account.", error);
    return jsonError("We could not load payout account details.", 500);
  }
}

export async function POST(request: Request) {
  const user = await authenticatedUser(request);
  if (!user) return jsonError("Sign in to save payout account details.", 401);
  if (user.role !== "vendor" && user.role !== "supplier") return jsonError("Only sellers can add payout account details.", 403);
  if (!paystackConfigured()) return jsonError("Bank account verification is not configured on the server.", 503);
  const body = await readJson(request);
  const bankCode = typeof body?.bankCode === "string" ? body.bankCode.trim() : "";
  const accountNumber = typeof body?.accountNumber === "string" ? body.accountNumber.trim() : "";
  if (!/^[A-Za-z0-9_-]{2,20}$/.test(bankCode) || !/^\d{10}$/.test(accountNumber)) {
    return jsonError("Select a bank and enter a valid 10-digit account number.", 400);
  }

  try {
    const db = adminDb();
    const userRef = db.collection("users").doc(user.uid);
    const profileSnapshot = await userRef.get();
    const profile = profileSnapshot.data();
    if (!profileSnapshot.exists || !profile || profile.role !== user.role) return jsonError("Seller account not found.", 404);
    if (profile.verificationStatus !== "approved") return jsonError("Payout account setup is available only to approved sellers.", 403);
    const businessName = String(profile.business?.businessName ?? "").trim();
    if (!businessName) return jsonError("Your approved business name is missing from your account.", 409);

    const banks = await paystackRequest<Bank[]>("/bank?country=nigeria&perPage=100");
    const bank = banks.find((candidate) => candidate.code === bankCode);
    if (!bank) return jsonError("Choose a bank from the current Nigerian bank directory.", 400);
    const resolved = await paystackRequest<BankResolution>(
      `/bank/resolve?account_number=${encodeURIComponent(accountNumber)}&bank_code=${encodeURIComponent(bankCode)}`,
    );
    if (!resolved.account_name || resolved.account_number !== accountNumber) {
      return jsonError("The bank could not confirm the account details. Check the bank and account number.", 400);
    }
    if (normalizeAccountName(resolved.account_name) !== normalizeAccountName(businessName)) {
      return jsonError("The bank account holder name must match the approved business name exactly.", 409);
    }

    await userRef.update({
      payoutAccount: {
        bankCode,
        bankName: bank.name,
        accountNumber,
        accountName: resolved.account_name,
        verifiedAt: Timestamp.now(),
      },
      updatedAt: Timestamp.now(),
    });
    return Response.json({
      payoutAccount: {
        bankName: bank.name,
        accountName: resolved.account_name,
        accountLast4: accountNumber.slice(-4),
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "PAYSTACK_NOT_CONFIGURED") {
      return jsonError("Bank account verification is not configured on the server.", 503);
    }
    console.error("Could not verify seller payout account.", error);
    return jsonError("We could not verify this bank account. Check your details and try again.", 502);
  }
}
