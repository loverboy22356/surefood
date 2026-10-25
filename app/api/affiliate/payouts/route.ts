import { Timestamp } from "firebase-admin/firestore";
import { authenticatedUser } from "@/lib/auth/server";
import { adminDb, firebaseAdminConfigured } from "@/lib/firebase/admin";
import { cleanString, jsonError, readJson } from "@/lib/http";
import { AFFILIATE_MIN_PAYOUT_MINOR, commissionOn } from "@/lib/affiliates";

export const runtime = "nodejs";

function toMillis(value: unknown) {
  return (value as { toMillis?: () => number } | undefined)?.toMillis?.() ?? 0;
}

/**
 * Payout requests. Nothing leaves the account automatically: the request lands in
 * the staff queue and the team pays it by hand, then marks it paid.
 */
export async function GET(request: Request) {
  const user = await authenticatedUser(request);
  if (!user) return jsonError("Sign in to see your payouts.", 401);
  try {
    const snapshot = await adminDb().collection("affiliatePayouts")
      .where("uid", "==", user.uid)
      .limit(50)
      .get();
    const payouts = snapshot.docs
      .map((document) => ({
        id: document.id,
        amountMinor: Number(document.data().amountMinor ?? 0),
        status: String(document.data().status ?? "requested"),
        requestedAt: new Date(toMillis(document.data().requestedAt) || Date.now()).toISOString(),
        paidAt: toMillis(document.data().paidAt) ? new Date(toMillis(document.data().paidAt)).toISOString() : null,
        note: String(document.data().note ?? ""),
      }))
      .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
    return Response.json({ payouts }, { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    console.error("Could not load affiliate payouts.", error);
    return jsonError("We could not load your payouts.", 500);
  }
}

export async function POST(request: Request) {
  if (!firebaseAdminConfigured()) {
    return jsonError("The affiliate programme is not configured on this server yet.", 503);
  }
  const user = await authenticatedUser(request);
  if (!user) return jsonError("Sign in to request a payout.", 401);

  const body = await readJson(request);
  const note = cleanString(body?.note, 240);
  const bankDetails = cleanString(body?.bankDetails, 240);
  if (bankDetails.length < 10) {
    return jsonError("Add the account name, bank and account number we should pay into.", 400);
  }

  const db = adminDb();
  try {
    const affiliateSnapshot = await db.collection("affiliates").doc(user.uid).get();
    if (!affiliateSnapshot.exists) return jsonError("Join the affiliate programme before requesting a payout.", 404);
    const affiliate = affiliateSnapshot.data() ?? {};
    if (String(affiliate.status ?? "active") !== "active") {
      return jsonError("Your affiliate account is paused. Contact SureFood support.", 403);
    }
    const code = String(affiliate.code ?? "");

    const [ordersSnapshot, payoutsSnapshot] = await Promise.all([
      db.collection("orders").where("affiliateCode", "==", code).limit(200).get(),
      db.collection("affiliatePayouts").where("uid", "==", user.uid).limit(50).get(),
    ]);

    const earnedMinor = ordersSnapshot.docs
      .map((document) => document.data())
      .filter((order) => String(order.paymentStatus ?? "") === "paid" && !String(order.status ?? "").toLowerCase().includes("cancel"))
      .reduce((total, order) => total + commissionOn(Number(order.subtotalMinor ?? 0)), 0);

    const payouts = payoutsSnapshot.docs.map((document) => ({
      status: String(document.data().status ?? "requested"),
      amountMinor: Number(document.data().amountMinor ?? 0),
    }));
    if (payouts.some((payout) => payout.status === "requested")) {
      return jsonError("You already have a payout waiting to be paid. It is being handled by hand.", 409);
    }
    const paidOutMinor = payouts
      .filter((payout) => payout.status === "paid")
      .reduce((total, payout) => total + payout.amountMinor, 0);
    const availableMinor = Math.max(0, earnedMinor - paidOutMinor);

    if (availableMinor < AFFILIATE_MIN_PAYOUT_MINOR) {
      return jsonError(
        `You can request a payout once you have earned at least ${(AFFILIATE_MIN_PAYOUT_MINOR / 100).toLocaleString("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 })} in confirmed commission.`,
        400,
      );
    }

    const created = await db.collection("affiliatePayouts").add({
      uid: user.uid,
      code,
      name: String(affiliate.name ?? ""),
      email: String(affiliate.email ?? user.email ?? ""),
      amountMinor: availableMinor,
      currency: "NGN",
      bankDetails,
      note,
      status: "requested",
      requestedAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });

    return Response.json(
      { payout: { id: created.id, amountMinor: availableMinor, status: "requested" }, message: "Payout requested. The SureFood team pays affiliate earnings by hand and will confirm once it is sent." },
      { status: 201 },
    );
  } catch (error) {
    console.error("Could not request an affiliate payout.", error);
    return jsonError("We could not save your payout request.", 500);
  }
}
