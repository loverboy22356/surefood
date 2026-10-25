import { Timestamp } from "firebase-admin/firestore";
import { authenticatedUser, isStaff } from "@/lib/auth/server";
import { createActivity } from "@/lib/activity";
import { adminDb } from "@/lib/firebase/admin";
import { cleanString, jsonError, readJson } from "@/lib/http";
import { specialOrderStatuses } from "@/lib/requests";

export const runtime = "nodejs";

const openStatuses = new Set<string>(specialOrderStatuses);

export async function PATCH(request: Request, context: { params: Promise<{ requestId: string }> }) {
  const user = await authenticatedUser(request);
  if (!user || !isStaff(user.role)) return jsonError("Staff access is required.", 403);

  const body = await readJson(request);
  const status = cleanString(body?.status, 20);
  const quoteNote = cleanString(body?.quoteNote, 600);
  if (!openStatuses.has(status)) return jsonError("Choose a valid status for this request.", 400);
  if (status === "declined" && !quoteNote) {
    return jsonError("Add a note explaining why this event order cannot be taken.", 400);
  }

  const { requestId } = await context.params;
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(requestId)) return jsonError("Invalid request reference.", 400);

  try {
    const db = adminDb();
    const requestRef = db.collection("specialOrders").doc(requestId);
    const existing = await requestRef.get();
    if (!existing.exists) return jsonError("Event order request not found.", 404);

    const batch = db.batch();
    batch.set(requestRef, {
      status,
      quoteNote,
      reviewedBy: user.uid,
      reviewedAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    }, { merge: true });
    createActivity(batch, {
      actorUid: user.uid,
      actorRole: String(user.role ?? "staff"),
      targetUserId: String(existing.data()?.uid ?? ""),
      action: `special_order_${status}`,
      targetType: "special_order",
      targetId: requestId,
      summary: `Event order request marked ${status}.`,
    });
    await batch.commit();

    return Response.json({ requestId, status });
  } catch (error) {
    console.error("Could not update a special order request.", error);
    return jsonError("We could not save this update.", 500);
  }
}
