import { firebaseAdminConfigured } from "@/lib/firebase/admin";
import { loadApprovedSellers, sellerRoles, type SellerRole } from "@/lib/catalog";
import { PUBLIC_CACHE_HEADERS } from "@/lib/server-cache";
import { jsonError } from "@/lib/http";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const role = new URL(request.url).searchParams.get("role") as SellerRole | null;
  if (!role || !sellerRoles.includes(role)) return jsonError("Choose a valid marketplace seller type.", 400);
  if (!firebaseAdminConfigured()) {
    return jsonError("Approved seller listings are unavailable until Firebase Admin is configured on the server.", 503);
  }

  try {
    const sellers = await loadApprovedSellers(role);
    return Response.json({ sellers }, { headers: PUBLIC_CACHE_HEADERS });
  } catch (error) {
    console.error("Could not load approved Sure Foodz sellers.", error);
    return jsonError("Approved sellers are temporarily unavailable.", 500);
  }
}
