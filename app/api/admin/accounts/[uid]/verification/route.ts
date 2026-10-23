import { Timestamp } from "firebase-admin/firestore";
import { authenticatedUser, isStaff } from "@/lib/auth/server";
import { createActivity } from "@/lib/activity";
import { adminDb } from "@/lib/firebase/admin";
import { requiredSellerDocuments, sellerNeedsBusinessRegistration } from "@/lib/auth/seller-verification";
import { findVerificationDocument, type VerificationDocumentType } from "@/lib/cloudinary-server";
import { cleanString, jsonError, readJson } from "@/lib/http";

const reviewStatuses = new Set(["approved", "rejected"]);
// Staff may confirm the official registry themselves whenever automation has not
// produced a verified result, including legacy applications stored as not_checked.
const manualRegistryStatuses = ["manual_review", "submission_failed", "not_checked"];

function registryClearedByStaff(registryStatus: unknown, checks: unknown) {
  return manualRegistryStatuses.includes(String(registryStatus)) &&
    (checks as Record<string, unknown> | undefined)?.registryNumberVerified === true;
}

export async function PATCH(request: Request, context: { params: Promise<{ uid: string }> }) {
  const user = await authenticatedUser(request);
  if (!user || !isStaff(user.role)) return jsonError("Staff access is required.", 403);
  const body = await readJson(request);
  const status = cleanString(body?.status, 30);
  const note = cleanString(body?.note, 500);
  const checks = body?.documentChecks;
  if (!reviewStatuses.has(status)) return jsonError("Choose approved or rejected.", 400);
  if (status === "rejected" && !note) return jsonError("Add a review note explaining what needs to be corrected.", 400);

  const { uid } = await context.params;
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(uid)) return jsonError("Invalid account reference.", 400);
  try {
    const db = adminDb();
    const accountRef = db.collection("users").doc(uid);
    if (status === "approved") {
      const account = await accountRef.get();
      if (!account.exists) return jsonError("Vendor or supplier account not found.", 404);
      // Vendors are verified on identity and address only; suppliers must also prove a registered business.
      const requiresRegistration = sellerNeedsBusinessRegistration(account.data()?.role);
      if (!checks || typeof checks !== "object" || Array.isArray(checks)) {
        return jsonError("Complete all required document checks before approving.", 400);
      }
      const documentChecks = checks as Record<string, unknown>;
      const unconfirmed = [
        ...(requiresRegistration && documentChecks.businessRegistrationValid !== true ? ["business registration"] : []),
        ...(documentChecks.proofOfAddressValid !== true ? ["proof of address"] : []),
        ...(documentChecks.ninMatchesApplicant !== true ? ["NIN document"] : []),
      ];
      if (unconfirmed.length) {
        return jsonError(`Confirm the ${unconfirmed.join(", ")} before approving.`, 400);
      }
      const registryStatus = account.data()?.registryStatus;
      if (requiresRegistration && registryStatus !== "verified" && !registryClearedByStaff(registryStatus, checks)) {
        return jsonError("A successful automatic check or a staff-confirmed official registry check is required before approval.", 409);
      }
      const documentPaths = account.data()?.business?.documentPaths as Record<string, string> | undefined;
      const documentTypes = requiredSellerDocuments(account.data()?.role) as VerificationDocumentType[];
      const documentsAreValid = (await Promise.all(documentTypes.map(async (documentType) => {
        const publicId = documentPaths?.[documentType];
        return Boolean(publicId && await findVerificationDocument(uid, documentType, publicId));
      }))).every(Boolean);
      if (!documentsAreValid) {
        return jsonError(
          `${requiresRegistration ? "Business registration, proof of address, and NIN" : "Proof of address and NIN"} must be available in private Cloudinary storage before approval.`,
          409,
        );
      }
    }
    await db.runTransaction(async (transaction) => {
      const account = await transaction.get(accountRef);
      if (!account.exists || !["vendor", "supplier"].includes(String(account.data()?.role))) {
        throw new Error("ACCOUNT_NOT_FOUND");
      }
      const accountData = account.data()!;
      if (!["pending_review", "manual_review", "registry_check_pending", "registry_check_submitting", "submission_failed"].includes(String(accountData.verificationStatus))) {
        throw new Error("APPLICATION_NOT_PENDING");
      }
      if (status === "approved" && sellerNeedsBusinessRegistration(accountData.role) &&
          accountData.registryStatus !== "verified" &&
          !registryClearedByStaff(accountData.registryStatus, checks)) {
        throw new Error("REGISTRY_CHECK_REQUIRED");
      }
      transaction.set(accountRef, {
        verificationStatus: status,
        addressReviewStatus: status === "approved" ? "approved" : "rejected",
        ...(status === "approved" ? {
          approvalFee: accountData.role === "supplier" ? 5000 : accountData.role === "vendor" ? 2000 : 0,
          approvalFeeMinor: accountData.role === "supplier" ? 5000_00 : accountData.role === "vendor" ? 2000_00 : 0,
          approvalFeeReference: "",
          approvalFeeAuthorizationUrl: "",
          approvalFeeCurrency: "NGN",
          approvalFeeStatus: "pending",
          verificationDocumentChecks: {
            ...(sellerNeedsBusinessRegistration(accountData.role) ? { businessRegistrationValid: true } : {}),
            registryNumberVerified: (checks as Record<string, unknown>).registryNumberVerified === true,
            proofOfAddressValid: true,
            ninMatchesApplicant: true,
            checkedBy: user.uid,
            checkedAt: Timestamp.now(),
          },
        } : {}),
        verificationReviewNote: note,
        reviewedBy: user.uid,
        reviewedAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      }, { merge: true });
      createActivity(transaction, {
        actorUid: user.uid,
        actorRole: String(user.role ?? "staff"),
        targetUserId: uid,
        action: `verification_${status}`,
        targetType: "business_verification",
        targetId: uid,
        summary: status === "approved"
          ? "Business verification application approved."
          : "Business verification application rejected.",
      });
    });
    return Response.json({ uid, verificationStatus: status });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "ACCOUNT_NOT_FOUND") return jsonError("Vendor or supplier account not found.", 404);
      if (error.message === "APPLICATION_NOT_PENDING") return jsonError("This application is not waiting for review.", 409);
      if (error.message === "REGISTRY_CHECK_REQUIRED") return jsonError("A successful automatic check or a staff-confirmed official registry check is required before approval.", 409);
    }
    console.error("Could not update a business verification review.", error);
    return jsonError("We could not update this verification.", 500);
  }
}
