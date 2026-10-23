import { authenticatedUser, isStaff } from "@/lib/auth/server";
import { adminDb } from "@/lib/firebase/admin";
import { verificationDocumentDownloadUrl } from "@/lib/cloudinary-server";
import { jsonError } from "@/lib/http";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const user = await authenticatedUser(request);
  if (!user || !isStaff(user.role)) return jsonError("Staff access is required.", 403);

  try {
    const snapshot = await adminDb().collection("users")
      .where("verificationStatus", "in", ["pending_review", "manual_review", "registry_check_pending", "registry_check_submitting", "submission_failed"])
      .limit(100)
      .get();
    const applications = await Promise.all(snapshot.docs.map(async (document) => {
      const data = document.data();
      const business = data.business ?? {};
      const documentPaths = business.documentPaths ?? {};
      const registrationPath = documentPaths["business-registration"];
      const addressProofPath = documentPaths["proof-of-address"];
      const ninPath = documentPaths.nin;
      const registrationUrl = typeof registrationPath === "string" && registrationPath.startsWith(`surefood/kyb/${document.id}/`)
        ? verificationDocumentDownloadUrl(registrationPath)
        : "";
      const addressProofUrl = typeof addressProofPath === "string" && addressProofPath.startsWith(`surefood/kyb/${document.id}/`)
        ? verificationDocumentDownloadUrl(addressProofPath)
        : "";
      const ninDocumentUrl = typeof ninPath === "string" && ninPath.startsWith(`surefood/kyb/${document.id}/`)
        ? verificationDocumentDownloadUrl(ninPath)
        : "";
      return {
        uid: document.id,
        displayName: data.displayName ?? "",
        email: data.email ?? "",
        role: data.role,
        phone: data.phone ?? "",
        verificationStatus: data.verificationStatus,
        registryStatus: data.registryStatus ?? "not_checked",
        registryCheck: data.registryCheck ?? null,
        submittedAt: data.submittedAt?.toDate?.().toISOString() ?? null,
        business: {
          businessName: business.businessName ?? "",
          registrationNumber: business.registrationNumber ?? "",
          country: business.country ?? "",
          address: business.address ?? "",
          city: business.city ?? "",
          region: business.region ?? "",
          postalCode: business.postalCode ?? "",
          registrationDocumentUrl: registrationUrl,
          addressProofUrl: addressProofUrl,
          ninDocumentUrl,
        },
      };
    }));
    return Response.json({ applications });
  } catch (error) {
    console.error("Could not load manual business verification queue.", error);
    return jsonError("We could not load the verification queue.", 500);
  }
}
