import { Timestamp } from "firebase-admin/firestore";
import { authenticatedUser, isStaff } from "@/lib/auth/server";
import { adminDb, firebaseAdminConfigured } from "@/lib/firebase/admin";
import { jsonError } from "@/lib/http";
import { quoteStatuses } from "@/lib/business";

/** The business quotation queue, newest first. */
export async function GET(request: Request) {
  if (!firebaseAdminConfigured()) return jsonError("Quotations are not available yet.", 503);
  const user = await authenticatedUser(request);
  if (!user || !isStaff(user.role)) return jsonError("Staff access is required.", 403);

  const status = new URL(request.url).searchParams.get("status");
  try {
    const base = adminDb().collection("quotationRequests");
    const query = status && (quoteStatuses as string[]).includes(status)
      ? base.where("status", "==", status).orderBy("createdAt", "desc").limit(200)
      : base.orderBy("createdAt", "desc").limit(200);
    const snapshot = await query.get();
    return Response.json({
      quotes: snapshot.docs.map((document) => {
        const data = document.data();
        return {
          id: document.id,
          ...data,
          createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : String(data.createdAt ?? ""),
          updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate().toISOString() : String(data.updatedAt ?? ""),
        };
      }),
    });
  } catch (error) {
    console.error("Could not load the quotation queue.", error);
    return jsonError("We could not load quotation requests.", 500);
  }
}
