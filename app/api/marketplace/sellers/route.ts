import { adminDb, firebaseAdminConfigured } from "@/lib/firebase/admin";
import { jsonError } from "@/lib/http";

export const runtime = "nodejs";

const sellerRoles = ["vendor", "supplier", "producer", "manufacturer"] as const;
type SellerRole = typeof sellerRoles[number];

const roleDetails: Record<SellerRole, { label: string; emoji: string }> = {
  vendor: { label: "Approved vendor", emoji: "🏪" },
  supplier: { label: "Approved supplier", emoji: "📦" },
  producer: { label: "Approved producer", emoji: "🌱" },
  manufacturer: { label: "Approved manufacturer", emoji: "🏭" },
};

export async function GET(request: Request) {
  const role = new URL(request.url).searchParams.get("role") as SellerRole | null;
  if (!role || !sellerRoles.includes(role)) return jsonError("Choose a valid marketplace seller type.", 400);
  if (!firebaseAdminConfigured()) {
    return jsonError("Approved seller listings are unavailable until Firebase Admin is configured on the server.", 503);
  }

  try {
    const snapshot = await adminDb().collection("users")
      .where("role", "==", role)
      .where("verificationStatus", "==", "approved")
      .orderBy("updatedAt", "desc")
      .limit(50)
      .get();
    const detail = roleDetails[role];
    const sellers = snapshot.docs.map((document) => {
      const profile = document.data();
      const business = profile.business ?? {};
      const location = [business.city, business.region].filter((part) => typeof part === "string" && part).join(", ");
      const businessName = typeof business.businessName === "string" && business.businessName
        ? business.businessName
        : typeof profile.displayName === "string" ? profile.displayName : "Sure Foodz seller";
      return {
        id: document.id,
        role,
        name: businessName,
        businessName,
        displayName: typeof profile.displayName === "string" ? profile.displayName : "",
        // The logo the seller uploaded in their workspace, shown on the buyer side.
        logoUrl: typeof profile.businessLogoUrl === "string" ? profile.businessLogoUrl : "",
        detail: location || "Sure Foodz verified business",
        city: typeof business.city === "string" ? business.city : "",
        region: typeof business.region === "string" ? business.region : "",
        emoji: detail.emoji,
        badge: detail.label,
        route: `/store/${document.id}`,
      };
    });
    return Response.json({ sellers });
  } catch (error) {
    console.error("Could not load approved Sure Foodz sellers.", error);
    return jsonError("Approved sellers are temporarily unavailable.", 500);
  }
}
