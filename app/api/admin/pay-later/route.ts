import { authenticatedUser, isStaff } from "@/lib/auth/server";
import { adminDb } from "@/lib/firebase/admin";
import { payLaterDocumentDownloadUrl } from "@/lib/cloudinary-server";
import { jsonError } from "@/lib/http";

export const runtime = "nodejs";

function documentLinks(documents: unknown) {
  if (!documents || typeof documents !== "object" || Array.isArray(documents)) return [];
  return Object.entries(documents as Record<string, unknown>).flatMap(([type, publicId]) => {
    if (typeof publicId !== "string" || !publicId) return [];
    try {
      return [{ type, url: payLaterDocumentDownloadUrl(publicId) }];
    } catch (error) {
      console.error("Could not create a Pay Later document link.", error);
      return [];
    }
  });
}

export async function GET(request: Request) {
  const user = await authenticatedUser(request);
  if (!user || !isStaff(user.role)) return jsonError("Staff access is required.", 403);

  try {
    const snapshot = await adminDb().collection("payLaterApplications")
      .where("status", "==", "submitted")
      .limit(100)
      .get();
    const applications = snapshot.docs.map((document) => {
      const data = document.data();
      return {
        id: document.id,
        reference: `PL-${document.id.slice(0, 6).toUpperCase()}`,
        status: String(data.status ?? "submitted"),
        applicantType: String(data.applicantType ?? ""),
        fullName: String(data.fullName ?? ""),
        email: String(data.email ?? ""),
        accountEmail: String(data.accountEmail ?? ""),
        phone: String(data.phone ?? ""),
        address: String(data.address ?? ""),
        business: {
          name: String(data.business?.name ?? ""),
          registrationNumber: String(data.business?.registrationNumber ?? ""),
          address: String(data.business?.address ?? ""),
        },
        employment: {
          employer: String(data.employment?.employer ?? ""),
          employeeNumber: String(data.employment?.employeeNumber ?? ""),
          governmentLevel: String(data.employment?.governmentLevel ?? ""),
        },
        referees: Array.isArray(data.referees)
          ? data.referees.map((referee: Record<string, unknown>) => ({
              name: String(referee?.name ?? ""),
              phone: String(referee?.phone ?? ""),
              relationship: String(referee?.relationship ?? ""),
            }))
          : [],
        documents: documentLinks(data.documents),
        submittedAt: data.submittedAt?.toDate?.().toISOString() ?? null,
      };
    });
    return Response.json({ applications });
  } catch (error) {
    console.error("Could not load the Pay Later queue.", error);
    return jsonError("We could not load Pay Later applications.", 500);
  }
}
