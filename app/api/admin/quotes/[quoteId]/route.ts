import { Timestamp } from "firebase-admin/firestore";
import { authenticatedUser, isStaff } from "@/lib/auth/server";
import { adminDb, firebaseAdminConfigured } from "@/lib/firebase/admin";
import { cleanString, jsonError, readJson } from "@/lib/http";
import { quoteStatuses } from "@/lib/business";

type Params = { params: Promise<{ quoteId: string }> };

/** Staff price a request, confirm it, or decline it — always with a written note. */
export async function PATCH(request: Request, { params }: Params) {
  if (!firebaseAdminConfigured()) return jsonError("Quotations are not available yet.", 503);
  const user = await authenticatedUser(request);
  if (!user || !isStaff(user.role)) return jsonError("Staff access is required.", 403);

  const { quoteId } = await params;
  const body = await readJson(request);
  if (!body) return jsonError("Enter the changes for this quotation.", 400);

  const reference = adminDb().collection("quotationRequests").doc(quoteId);
  const snapshot = await reference.get();
  if (!snapshot.exists) return jsonError("That quotation no longer exists.", 404);

  const updates: Record<string, unknown> = { updatedAt: Timestamp.now(), reviewedBy: user.uid, reviewedAt: Timestamp.now() };
  const status = cleanString(body.status, 20);
  if (status) {
    if (!(quoteStatuses as string[]).includes(status)) return jsonError("Unknown quotation status.", 400);
    updates.status = status;
  }
  if (body.quoteNote !== undefined) {
    const note = cleanString(body.quoteNote, 600);
    if (status === "quoted" && note.length < 5) return jsonError("Add a note explaining the quotation.", 400);
    updates.quoteNote = note;
  }
  if (body.quotedTotalMinor !== undefined) {
    const total = Number(body.quotedTotalMinor);
    if (!Number.isSafeInteger(total) || total < 0) return jsonError("Enter the quoted total in kobo.", 400);
    updates.quotedTotalMinor = total;
  }

  try {
    await reference.update(updates);
    return Response.json({ ok: true });
  } catch (error) {
    console.error("Could not update a quotation request.", error);
    return jsonError("We could not update that quotation.", 500);
  }
}
