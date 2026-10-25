import { Timestamp } from "firebase-admin/firestore";
import { authenticatedUser, isStaff } from "@/lib/auth/server";
import { createActivity } from "@/lib/activity";
import { adminDb } from "@/lib/firebase/admin";
import { cleanString, jsonError, readJson } from "@/lib/http";

export const runtime = "nodejs";

const decisions = new Set(["approved", "declined"]);

export async function PATCH(request: Request, context: { params: Promise<{ applicationId: string }> }) {
  const user = await authenticatedUser(request);
  if (!user || !isStaff(user.role)) return jsonError("Staff access is required.", 403);

  const body = await readJson(request);
  const status = cleanString(body?.status, 20);
  const note = cleanString(body?.note, 500);
  if (!decisions.has(status)) return jsonError("Choose approved or declined.", 400);
  if (status === "declined" && !note) {
    return jsonError("Add a note explaining what the applicant needs to correct.", 400);
  }

  const { applicationId } = await context.params;
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(applicationId)) return jsonError("Invalid application reference.", 400);

  try {
    const db = adminDb();
    const applicationRef = db.collection("payLaterApplications").doc(applicationId);
    const application = await applicationRef.get();
    if (!application.exists) return jsonError("Application not found.", 404);
    if (application.data()?.status !== "submitted") {
      return jsonError("This application is no longer waiting for a decision.", 409);
    }

    const batch = db.batch();
    batch.set(applicationRef, {
      status,
      reviewNote: note,
      reviewedBy: user.uid,
      reviewedAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    }, { merge: true });
    createActivity(batch, {
      actorUid: user.uid,
      actorRole: String(user.role ?? "staff"),
      targetUserId: String(application.data()?.uid ?? ""),
      action: `pay_later_${status}`,
      targetType: "pay_later_application",
      targetId: applicationId,
      summary: status === "approved" ? "Pay Later application approved." : "Pay Later application declined.",
    });
    await batch.commit();

    return Response.json({ applicationId, status });
  } catch (error) {
    console.error("Could not review a Pay Later application.", error);
    return jsonError("We could not save this decision.", 500);
  }
}
