import { Timestamp } from "firebase-admin/firestore";
import { authenticatedUser } from "@/lib/auth/server";
import { adminDb, firebaseAdminConfigured } from "@/lib/firebase/admin";
import { cleanString, jsonError } from "@/lib/http";
import {
  AFFILIATE_COMMISSION_RATE,
  AFFILIATE_MIN_PAYOUT_MINOR,
  buildAffiliateCode,
  commissionOn,
  normaliseAffiliateCode,
} from "@/lib/affiliates";

export const runtime = "nodejs";

type OrderLike = Record<string, unknown>;

function toMillis(value: unknown) {
  return (value as { toMillis?: () => number } | undefined)?.toMillis?.() ?? 0;
}

/** Orders already paid for earn commission; unpaid or cancelled ones do not. */
function earnsCommission(order: OrderLike) {
  const payment = String(order.paymentStatus ?? "");
  const status = String(order.status ?? "").toLowerCase();
  return payment === "paid" && !status.includes("cancel") && !status.includes("refund");
}

async function buildSummary(uid: string, code: string) {
  const db = adminDb();
  const affiliateSnapshot = await db.collection("affiliates").doc(uid).get();
  if (!affiliateSnapshot.exists) return null;
  const affiliate = affiliateSnapshot.data() ?? {};

  const [ordersSnapshot, payoutsSnapshot] = await Promise.all([
    db.collection("orders").where("affiliateCode", "==", code).limit(200).get(),
    db.collection("affiliatePayouts").where("uid", "==", uid).limit(50).get(),
  ]);

  const orders = ordersSnapshot.docs.map((document) => document.data());
  const paidOrders = orders.filter(earnsCommission);
  const earnedMinor = paidOrders.reduce(
    (total, order) => total + commissionOn(Number(order.subtotalMinor ?? 0)),
    0,
  );

  const payouts = payoutsSnapshot.docs
    .map((document) => ({
      id: document.id,
      amountMinor: Number(document.data().amountMinor ?? 0),
      status: String(document.data().status ?? "requested"),
      requestedAt: new Date(toMillis(document.data().requestedAt) || Date.now()).toISOString(),
      paidAt: toMillis(document.data().paidAt) ? new Date(toMillis(document.data().paidAt)).toISOString() : null,
      note: String(document.data().note ?? ""),
    }))
    .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));

  const paidOutMinor = payouts
    .filter((payout) => payout.status === "paid")
    .reduce((total, payout) => total + payout.amountMinor, 0);
  const requestedMinor = payouts
    .filter((payout) => payout.status === "requested")
    .reduce((total, payout) => total + payout.amountMinor, 0);

  return {
    affiliate: {
      code: String(affiliate.code ?? code),
      name: String(affiliate.name ?? ""),
      email: String(affiliate.email ?? ""),
      status: String(affiliate.status ?? "active"),
      commissionRate: Number(affiliate.commissionRate ?? AFFILIATE_COMMISSION_RATE),
    },
    stats: {
      referredOrders: orders.length,
      paidOrders: paidOrders.length,
      earnedMinor,
      paidOutMinor,
      requestedMinor,
      availableMinor: Math.max(0, earnedMinor - paidOutMinor - requestedMinor),
    },
    payouts,
    orders: orders
      .map((order) => ({
        id: String(order.checkoutId ?? ""),
        subtotalMinor: Number(order.subtotalMinor ?? 0),
        commissionMinor: earnsCommission(order) ? commissionOn(Number(order.subtotalMinor ?? 0)) : 0,
        createdAt: new Date(toMillis(order.createdAt) || Date.now()).toISOString(),
      }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 60),
    minPayoutMinor: AFFILIATE_MIN_PAYOUT_MINOR,
  };
}

export async function GET(request: Request) {
  if (!firebaseAdminConfigured()) {
    return jsonError("The affiliate programme is not configured on this server yet.", 503);
  }
  const user = await authenticatedUser(request);
  if (!user) return jsonError("Sign in to open your affiliate dashboard.", 401);

  try {
    const snapshot = await adminDb().collection("affiliates").doc(user.uid).get();
    if (!snapshot.exists) return Response.json({ affiliate: null });
    const summary = await buildSummary(user.uid, String(snapshot.data()?.code ?? ""));
    return Response.json(summary ?? { affiliate: null }, { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    console.error("Could not load the affiliate dashboard.", error);
    return jsonError("We could not load your affiliate dashboard.", 500);
  }
}

export async function POST(request: Request) {
  if (!firebaseAdminConfigured()) {
    return jsonError("The affiliate programme is not configured on this server yet.", 503);
  }
  const user = await authenticatedUser(request);
  if (!user) return jsonError("Sign in to join the affiliate programme.", 401);
  if (user.role === "staff" || user.role === "admin") {
    return jsonError("Staff accounts cannot join the affiliate programme.", 403);
  }

  const db = adminDb();
  const affiliateRef = db.collection("affiliates").doc(user.uid);
  try {
    const existing = await affiliateRef.get();
    if (existing.exists) {
      const summary = await buildSummary(user.uid, String(existing.data()?.code ?? ""));
      return Response.json(summary ?? { affiliate: null });
    }

    const profile = await db.collection("users").doc(user.uid).get();
    const profileName = cleanString(profile.data()?.displayName, 120);
    const name = profileName || cleanString(user.name, 120) || "SureFood affiliate";
    const email = String(user.email ?? profile.data()?.email ?? "").toLowerCase();

    // Make sure the code is unique before it goes on a link.
    let code = buildAffiliateCode(name, user.uid);
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const clash = await db.collection("affiliates").where("code", "==", code).limit(1).get();
      if (clash.empty) break;
      code = buildAffiliateCode(name, `${user.uid}${Math.floor(Math.random() * 9999)}`);
    }
    code = normaliseAffiliateCode(code);

    await affiliateRef.set({
      uid: user.uid,
      code,
      name,
      email,
      status: "active",
      commissionRate: AFFILIATE_COMMISSION_RATE,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });

    const summary = await buildSummary(user.uid, code);
    return Response.json(summary ?? { affiliate: null }, { status: 201 });
  } catch (error) {
    console.error("Could not join the affiliate programme.", error);
    return jsonError("We could not create your affiliate account.", 500);
  }
}
