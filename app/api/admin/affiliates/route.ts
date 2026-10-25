import { Timestamp } from "firebase-admin/firestore";
import { authenticatedUser, isStaff } from "@/lib/auth/server";
import { adminDb } from "@/lib/firebase/admin";
import { cleanString, jsonError, readJson } from "@/lib/http";

export const runtime = "nodejs";

function toMillis(value: unknown) {
  return (value as { toMillis?: () => number } | undefined)?.toMillis?.() ?? 0;
}

export async function GET(request: Request) {
  const user = await authenticatedUser(request);
  if (!user || !isStaff(user.role)) return jsonError("Staff access is required.", 403);

  try {
    const db = adminDb();
    const [affiliatesSnapshot, payoutsSnapshot] = await Promise.all([
      db.collection("affiliates").limit(200).get(),
      db.collection("affiliatePayouts").limit(200).get(),
    ]);
    const affiliates = affiliatesSnapshot.docs.map((document) => {
      const data = document.data();
      return {
        uid: document.id,
        code: String(data.code ?? ""),
        name: String(data.name ?? ""),
        email: String(data.email ?? ""),
        status: String(data.status ?? "active"),
        commissionRate: Number(data.commissionRate ?? 0.05),
        createdAt: new Date(toMillis(data.createdAt) || Date.now()).toISOString(),
      };
    });
    const payouts = payoutsSnapshot.docs
      .map((document) => {
        const data = document.data();
        return {
          id: document.id,
          uid: String(data.uid ?? ""),
          code: String(data.code ?? ""),
          name: String(data.name ?? ""),
          email: String(data.email ?? ""),
          amountMinor: Number(data.amountMinor ?? 0),
          bankDetails: String(data.bankDetails ?? ""),
          note: String(data.note ?? ""),
          status: String(data.status ?? "requested"),
          requestedAt: new Date(toMillis(data.requestedAt) || Date.now()).toISOString(),
          paidAt: toMillis(data.paidAt) ? new Date(toMillis(data.paidAt)).toISOString() : null,
        };
      })
      .sort((a, b) => a.requestedAt.localeCompare(b.requestedAt));
    return Response.json({ affiliates, payouts }, { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    console.error("Could not load affiliates.", error);
    return jsonError("We could not load the affiliate list.", 500);
  }
}

/** Marks a hand-paid payout as sent, or cancels one that should not be paid. */
export async function PATCH(request: Request) {
  const user = await authenticatedUser(request);
  if (!user || !isStaff(user.role)) return jsonError("Staff access is required.", 403);

  const body = await readJson(request);
  const payoutId = cleanString(body?.payoutId, 120);
  const status = cleanString(body?.status, 20);
  const note = cleanString(body?.note, 240);
  if (!payoutId) return jsonError("Choose a payout to update.", 400);
  if (status !== "paid" && status !== "cancelled") return jsonError("Choose paid or cancelled.", 400);

  try {
    const payoutRef = adminDb().collection("affiliatePayouts").doc(payoutId);
    const snapshot = await payoutRef.get();
    if (!snapshot.exists) return jsonError("That payout no longer exists.", 404);
    await payoutRef.update({
      status,
      note: note || String(snapshot.data()?.note ?? ""),
      ...(status === "paid" ? { paidAt: Timestamp.now(), paidBy: user.uid } : {}),
      updatedAt: Timestamp.now(),
    });
    return Response.json({ id: payoutId, status });
  } catch (error) {
    console.error("Could not update an affiliate payout.", error);
    return jsonError("We could not update that payout.", 500);
  }
}
