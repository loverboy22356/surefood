import { Timestamp } from "firebase-admin/firestore";
import { authenticatedUser } from "@/lib/auth/server";
import { createActivity } from "@/lib/activity";
import { adminDb } from "@/lib/firebase/admin";
import { requiredSellerDocuments, sellerNeedsBusinessRegistration } from "@/lib/auth/seller-verification";
import { findVerificationDocument } from "@/lib/cloudinary-server";
import { jsonError } from "@/lib/http";

export const runtime = "nodejs";

const reviewableStatuses = new Set([
  "pending_review",
  "manual_review",
  "registry_check_pending",
  "registry_check_submitting",
  "submission_failed",
]);

export async function POST(request: Request) {
  const user = await authenticatedUser(request);
  if (!user) return jsonError("Sign in to resubmit your application.", 401);
  if (user.role !== "vendor" && user.role !== "supplier") {
    return jsonError("Only vendor and supplier accounts can resubmit verification.", 403);
  }

  try {
    const db = adminDb();
    const profileRef = db.collection("users").doc(user.uid);
    const profile = await profileRef.get();
    if (!profile.exists || profile.data()?.role !== user.role) {
      return jsonError("Business account profile not found.", 404);
    }

    const profileData = profile.data()!;
    if (!reviewableStatuses.has(String(profileData.verificationStatus))) {
      return jsonError("This application is not waiting for staff review.", 409);
    }

    const documentPaths = profileData.business?.documentPaths as Record<string, string> | undefined;
    const requiredDocuments = requiredSellerDocuments(user.role);
    const availableDocuments = await Promise.all(requiredDocuments.map(async (documentType) => {
      const publicId = documentPaths?.[documentType];
      return Boolean(publicId && await findVerificationDocument(user.uid, documentType, publicId));
    }));
    const missingDocuments = requiredDocuments.filter((_, index) => !availableDocuments[index]);
    if (missingDocuments.length) {
      return Response.json({
        error: "Some documents are no longer available in secure storage. Re-upload the documents marked missing, then submit again.",
        missingDocuments,
      }, { status: 409 });
    }

    const now = Timestamp.now();
    const batch = db.batch();
    batch.set(profileRef, {
      submittedAt: now,
      verificationReviewNote: sellerNeedsBusinessRegistration(user.role)
        ? "Supplier uploaded the required documents and requested another review."
        : "Vendor uploaded the required documents and requested another review.",
      updatedAt: now,
    }, { merge: true });
    createActivity(batch, {
      actorUid: user.uid,
      actorRole: user.role,
      targetUserId: user.uid,
      action: "verification_resubmitted",
      targetType: "business_verification",
      targetId: user.uid,
      summary: sellerNeedsBusinessRegistration(user.role)
        ? "Supplier resubmitted verification documents for staff review."
        : "Vendor resubmitted verification documents for staff review.",
    });
    await batch.commit();
    return Response.json({ submittedAt: now.toDate().toISOString(), message: "Your documents are submitted. SureFood staff can now review your application." });
  } catch (error) {
    console.error("Could not resubmit business verification.", error);
    return jsonError("We could not submit your updated documents. Please try again.", 500);
  }
}