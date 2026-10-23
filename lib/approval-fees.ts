import "server-only";

import { randomUUID } from "node:crypto";
import { Timestamp } from "firebase-admin/firestore";
import { createActivity } from "@/lib/activity";
import { adminDb } from "@/lib/firebase/admin";
import { paystackAppBaseUrl, paystackRequest, type PaystackTransaction } from "@/lib/paystack";

export const approvalFeeMinorByRole: Record<"vendor" | "supplier", number> = {
  vendor: 2_000_00,
  supplier: 5_000_00,
};

export const approvalFeeReferencePrefix = "sf_fee_";

type FeeProfile = {
  uid: string;
  role?: string;
  email?: string;
  verificationStatus?: string;
  approvalFeeMinor?: number | string;
  approvalFee?: number | string;
  approvalFeeStatus?: string;
  approvalFeeReference?: string;
  approvalFeeAuthorizationUrl?: string;
};

export function approvalFeeLabel(role: unknown, amountMinor: number) {
  return `${role === "supplier" ? "supplier" : "vendor"} approval fee of ₦${(amountMinor / 100).toLocaleString("en-NG")}`;
}

export function isApprovalFeePaid(profile: { approvalFeeStatus?: unknown } | null | undefined) {
  // Accounts approved before the fee went live have no fee record; they stay grandfathered.
  return !profile?.approvalFeeStatus || profile.approvalFeeStatus === "paid";
}

function feeAmount(profile: FeeProfile) {
  const storedMinor = Number(profile.approvalFeeMinor);
  if (Number.isSafeInteger(storedMinor) && storedMinor > 0) return storedMinor;
  // Applications approved before fees were stored in kobo kept the amount in naira.
  const legacyNaira = Number(profile.approvalFee);
  if (Number.isSafeInteger(legacyNaira) && legacyNaira > 0) return legacyNaira * 100;
  return profile.role === "supplier" ? approvalFeeMinorByRole.supplier : approvalFeeMinorByRole.vendor;
}

export async function initializeApprovalFee(user: { uid: string; email?: string }) {
  const db = adminDb();
  const profileRef = db.collection("users").doc(user.uid);
  const reference = `${approvalFeeReferencePrefix}${user.uid.slice(0, 12)}_${randomUUID().replaceAll("-", "")}`;
  let amountMinor = 0;
  let email = "";

  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(profileRef);
    if (!snapshot.exists) throw new Error("PROFILE_NOT_FOUND");
    const profile = snapshot.data() as FeeProfile;
    if (profile.role !== "vendor" && profile.role !== "supplier") throw new Error("FEE_NOT_REQUIRED");
    if (profile.verificationStatus !== "approved") throw new Error("APPROVAL_REQUIRED");
    if (profile.approvalFeeStatus === "paid") throw new Error("FEE_ALREADY_PAID");
    amountMinor = feeAmount(profile);
    email = String(profile.email ?? user.email ?? "");
    if (!email.includes("@")) throw new Error("BILLING_EMAIL_REQUIRED");
    transaction.update(profileRef, {
      approvalFeeMinor: amountMinor,
      approvalFeeCurrency: "NGN",
      approvalFeeReference: reference,
      approvalFeeStatus: "initializing",
      approvalFeeAuthorizationUrl: "",
      updatedAt: Timestamp.now(),
    });
  });

  try {
    const initialized = await paystackRequest<{ authorization_url?: string; reference?: string }>(
      "/transaction/initialize",
      {
        method: "POST",
        body: JSON.stringify({
          email,
          amount: amountMinor,
          currency: "NGN",
          reference,
          callback_url: `${paystackAppBaseUrl()}/onboarding`,
          metadata: { type: "approval_fee", uid: user.uid, feeMinor: amountMinor },
        }),
      },
    );
    if (!initialized.authorization_url || initialized.reference !== reference) {
      throw new Error("PAYSTACK_RESPONSE_INVALID");
    }
    await profileRef.update({
      approvalFeeStatus: "pending",
      approvalFeeAuthorizationUrl: initialized.authorization_url,
      updatedAt: Timestamp.now(),
    });
    return { authorizationUrl: initialized.authorization_url, amountMinor };
  } catch (error) {
    try {
      const snapshot = await profileRef.get();
      if (snapshot.data()?.approvalFeeReference === reference &&
          snapshot.data()?.approvalFeeStatus === "initializing") {
        await profileRef.update({
          approvalFeeStatus: "pending",
          approvalFeeReference: "",
          approvalFeeAuthorizationUrl: "",
          updatedAt: Timestamp.now(),
        });
      }
    } catch (resetError) {
      console.error("Could not reset a failed approval-fee initialization.", resetError);
    }
    if (error instanceof Error && /valid email/i.test(error.message)) {
      throw new Error("BILLING_EMAIL_REQUIRED");
    }
    throw error;
  }
}

export async function completeApprovalFee(reference: string, uid?: string) {
  if (!reference.startsWith(approvalFeeReferencePrefix)) throw new Error("APPROVAL_FEE_REFERENCE_INVALID");
  const db = adminDb();
  const snapshot = await db.collection("users").where("approvalFeeReference", "==", reference).limit(2).get();
  if (snapshot.size !== 1) throw new Error("APPROVAL_FEE_PROFILE_NOT_FOUND");
  const profileRef = snapshot.docs[0].ref;
  const profile = snapshot.docs[0].data() as FeeProfile;
  if (uid && profile.uid !== uid) throw new Error("APPROVAL_FEE_PROFILE_NOT_FOUND");
  if (profile.approvalFeeStatus === "paid") return { uid: profileRef.id, alreadyPaid: true };

  const transaction = await paystackRequest<PaystackTransaction & { metadata?: Record<string, unknown> }>(
    `/transaction/verify/${encodeURIComponent(reference)}`,
  );
  const expectedAmount = feeAmount(profile);
  if (
    transaction.status !== "success" ||
    transaction.reference !== reference ||
    transaction.currency !== "NGN" ||
    transaction.amount !== expectedAmount ||
    (transaction.metadata?.type !== undefined && transaction.metadata.type !== "approval_fee") ||
    (transaction.metadata?.uid !== undefined && transaction.metadata.uid !== profile.uid)
  ) {
    throw new Error("APPROVAL_FEE_NOT_CONFIRMED");
  }

  return db.runTransaction(async (writer) => {
    const current = await writer.get(profileRef);
    if (!current.exists || current.data()?.approvalFeeReference !== reference) {
      throw new Error("APPROVAL_FEE_PROFILE_NOT_FOUND");
    }
    if (current.data()?.approvalFeeStatus === "paid") return { uid: profileRef.id, alreadyPaid: true };
    const now = Timestamp.now();
    writer.update(profileRef, {
      approvalFeeStatus: "paid",
      approvalFeeMinor: expectedAmount,
      approvalFeeCurrency: "NGN",
      approvalFeePaidAt: now,
      approvalFeePaystackReference: reference,
      approvalFeeAuthorizationUrl: "",
      updatedAt: now,
    });
    createActivity(writer, {
      actorUid: profileRef.id,
      actorRole: String(profile.role ?? "vendor"),
      targetUserId: profileRef.id,
      action: "approval_fee_paid",
      targetType: "business_verification",
      targetId: profileRef.id,
      summary: `Paid the ${approvalFeeLabel(profile.role, expectedAmount)}.`,
    });
    return { uid: profileRef.id, alreadyPaid: false };
  });
}
