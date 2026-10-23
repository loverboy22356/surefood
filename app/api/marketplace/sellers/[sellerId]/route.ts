import { adminDb, firebaseAdminConfigured } from "@/lib/firebase/admin";
import { jsonError } from "@/lib/http";

export const runtime = "nodejs";

const sellerRoles = new Set(["vendor", "supplier", "producer", "manufacturer"]);

function isRegistryVerified(profile: Record<string, unknown>) {
  if (profile.registryStatus === "verified") return true;
  const checks = profile.verificationDocumentChecks as Record<string, unknown> | undefined;
  return checks?.registryNumberVerified === true;
}

export async function GET(_request: Request, context: { params: Promise<{ sellerId: string }> }) {
  const { sellerId } = await context.params;
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(sellerId)) return jsonError("Invalid store reference.", 400);
  if (!firebaseAdminConfigured()) {
    return jsonError("Seller storefronts are unavailable until Firebase Admin is configured on the server.", 503);
  }

  try {
    const db = adminDb();
    const profileSnapshot = await db.collection("users").doc(sellerId).get();
    if (!profileSnapshot.exists) return jsonError("This store could not be found.", 404);
    const profile = profileSnapshot.data()!;
    const role = String(profile.role ?? "");
    if (!sellerRoles.has(role) || profile.verificationStatus !== "approved") {
      return jsonError("This store could not be found.", 404);
    }
    if (profile.approvalFeeStatus && profile.approvalFeeStatus !== "paid") {
      return jsonError("This store is not open yet.", 404);
    }

    const productsSnapshot = await db.collection("products")
      .where("sellerId", "==", sellerId)
      .where("status", "==", "active")
      .orderBy("createdAt", "desc")
      .limit(60)
      .get();
    const today = new Date().toISOString().slice(0, 10);
    const products = productsSnapshot.docs
      .map((document) => ({ id: document.id, ...document.data() }) as Record<string, unknown>)
      .filter((product) => {
        const expiryDate = typeof product.expiryDate === "string" ? product.expiryDate : "";
        return !expiryDate || expiryDate >= today;
      })
      .map((product) => ({
        id: product.id,
        name: String(product.name ?? "SureFood product"),
        description: String(product.description ?? ""),
        category: String(product.category ?? ""),
        priceMinor: Number(product.priceMinor ?? 0),
        ...(product.compareAtMinor ? { compareAtMinor: Number(product.compareAtMinor) } : {}),
        currency: String(product.currency ?? "NGN"),
        stock: Number(product.stock ?? 0),
        imageUrl: String(product.imageUrl ?? ""),
        productKind: String(product.productKind ?? ""),
        expiryDate: String(product.expiryDate ?? ""),
        nafdacNumber: String(product.nafdacNumber ?? ""),
      }));

    const business = (profile.business ?? {}) as Record<string, unknown>;
    const country = String(business.country ?? "").toUpperCase();
    return Response.json({
      seller: {
        id: profileSnapshot.id,
        role,
        name: String(business.businessName || profile.displayName || "SureFood business"),
        displayName: String(profile.displayName ?? ""),
        city: String(business.city ?? ""),
        region: String(business.region ?? ""),
        location: [business.city, business.region].filter((part) => typeof part === "string" && part.trim()).join(", "),
        country,
        registryVerified: isRegistryVerified(profile),
        verified: true,
      },
      products,
    });
  } catch (error) {
    console.error("Could not load a SureFood seller storefront.", error);
    return jsonError("This store is temporarily unavailable.", 500);
  }
}
