import { Timestamp } from "firebase-admin/firestore";
import { authenticatedUser, isStaff } from "@/lib/auth/server";
import { adminDb, firebaseAdminConfigured } from "@/lib/firebase/admin";
import { cleanString, jsonError, readJson } from "@/lib/http";
import {
  basketPlans as defaultPlans,
  frequencyLabels,
  type BasketFrequency,
  type BasketPlan,
  type BasketTier,
} from "@/lib/baskets";
import { PUBLIC_CACHE_HEADERS } from "@/lib/server-cache";

function defaultTier(): BasketTier {
  return { id: "standard", label: "Standard", priceMinor: 5_000_000, note: "Everyday value" };
}

function defaultPlan(): BasketPlan {
  return {
    id: "",
    name: "New basket plan",
    audience: "Tell shoppers who this basket is for.",
    emoji: "🧺",
    accent: "#6d28d9",
    items: ["Staple food items"],
    tiers: [defaultTier()],
  };
}

/** Public shelf: every visitor sees the same basket plans, cached at the edge. */
export async function GET() {
  if (!firebaseAdminConfigured()) {
    return Response.json({ plans: defaultPlans }, { headers: PUBLIC_CACHE_HEADERS });
  }
  try {
    const snapshot = await adminDb()
      .collection("basketPlans")
      .orderBy("createdAt", "desc")
      .limit(100)
      .get();
    const plans = snapshot.docs.map((document) => {
      const data = document.data() ?? {};
      return {
        id: document.id,
        name: typeof data.name === "string" ? data.name : "Basket plan",
        audience: typeof data.audience === "string" ? data.audience : "",
        emoji: typeof data.emoji === "string" ? data.emoji : "🧺",
        accent: typeof data.accent === "string" && /^#[0-9a-fA-F]{6}$/.test(data.accent)
          ? data.accent
          : "#6d28d9",
        items: Array.isArray(data.items) ? data.items : ["Staple food items"],
        tiers: Array.isArray(data.tiers) ? data.tiers : [defaultTier()],
        popular: Boolean(data.popular),
      } as BasketPlan;
    });
    return Response.json({ plans: plans.length ? plans : defaultPlans }, { headers: PUBLIC_CACHE_HEADERS });
  } catch (error) {
    console.error("Could not load basket plans.", error);
    return Response.json({ plans: defaultPlans }, { headers: PUBLIC_CACHE_HEADERS });
  }
}

/** Staff only: create or update a basket plan. */
export async function POST(request: Request) {
  if (!firebaseAdminConfigured()) return jsonError("Basket plans are not available yet.", 503);
  const user = await authenticatedUser(request);
  if (!user || !isStaff(user.role)) return jsonError("Staff access is required.", 403);

  const body = await readJson(request);
  if (!body) return jsonError("Enter valid basket plan details.", 400);

  const name = cleanString(body?.name, 80);
  const audience = cleanString(body?.audience, 160);
  const emoji = cleanString(body?.emoji, 10) || "🧺";
  const accent = cleanString(body?.accent, 20) || "#6d28d9";
  const items = Array.isArray(body?.items)
    ? body.items.filter((item: unknown) => typeof item === "string" && item.trim()).map((item: string) => item.trim()).slice(0, 12)
    : ["Staple food items"];
  const tiers = Array.isArray(body?.tiers) && body.tiers.length
    ? body.tiers.map((tier: Record<string, unknown>) => ({
        id: cleanString(tier.id, 40) || "standard",
        label: cleanString(tier.label, 40) || "Standard",
        priceMinor: Number(tier.priceMinor) || 0,
        note: cleanString(tier.note, 120) || "",
      }))
    : [defaultTier()];
  const popular = body.popular === true;

  if (!name || !audience || !items.length || !tiers.length || tiers.some((t) => !t.priceMinor || t.priceMinor <= 0)) {
    return jsonError("A plan needs a name, audience, items, and at least one priced tier.", 400);
  }
  if (!/^#[0-9a-fA-F]{6}$/.test(accent)) return jsonError("Pick a valid accent colour (hex).", 400);

  try {
    const now = Timestamp.now();
    const plan = {
      name,
      audience,
      emoji,
      accent,
      items,
      tiers,
      popular,
      createdBy: user.uid,
      createdAt: now,
      updatedAt: now,
    };
    const ref = adminDb().collection("basketPlans").doc();
    await ref.set(plan);
    return Response.json({ plan: { id: ref.id, ...plan } }, { status: 201 });
  } catch (error) {
    console.error("Could not create basket plan.", error);
    return jsonError("We could not save this basket plan.", 500);
  }
}

/** Staff only: replace a basket plan. */
export async function PATCH(request: Request) {
  if (!firebaseAdminConfigured()) return jsonError("Basket plans are not available yet.", 503);
  const user = await authenticatedUser(request);
  if (!user || !isStaff(user.role)) return jsonError("Staff access is required.", 403);

  const body = await readJson(request);
  if (!body) return jsonError("Enter valid basket plan changes.", 400);

  const planId = cleanString(body?.id, 80);
  if (!planId || !/^[A-Za-z0-9_-]{1,150}$/.test(planId)) return jsonError("Invalid plan reference.", 400);

  const updates: Record<string, unknown> = { updatedAt: Timestamp.now() };
  if (body.name !== undefined) updates.name = cleanString(body.name, 80);
  if (body.audience !== undefined) updates.audience = cleanString(body.audience, 160);
  if (body.emoji !== undefined) updates.emoji = cleanString(body.emoji, 10) || "🧺";
  if (body.accent !== undefined) {
    const accentValue = cleanString(body.accent, 20);
    if (!/^#[0-9a-fA-F]{6}$/.test(accentValue)) return jsonError("Pick a valid accent colour (hex).", 400);
    updates.accent = accentValue;
  }
  if (body.items !== undefined) {
    if (!Array.isArray(body.items)) return jsonError("Items must be a list.", 400);
    updates.items = body.items.filter((item: unknown) => typeof item === "string" && item.trim()).map((item: string) => item.trim()).slice(0, 12);
  }
  if (body.tiers !== undefined) {
    if (!Array.isArray(body.tiers) || !body.tiers.length) return jsonError("A plan needs at least one tier.", 400);
    updates.tiers = body.tiers.map((tier: Record<string, unknown>) => ({
      id: cleanString(tier.id, 40) || "standard",
      label: cleanString(tier.label, 40) || "Standard",
      priceMinor: Number(tier.priceMinor) || 0,
      note: cleanString(tier.note, 120) || "",
    }));
  }
  if (body.popular !== undefined) updates.popular = Boolean(body.popular);

  if (Object.keys(updates).length === 1) return jsonError("Add at least one plan change.", 400);

  try {
    const ref = adminDb().collection("basketPlans").doc(planId);
    const snapshot = await ref.get();
    if (!snapshot.exists) return jsonError("Basket plan not found.", 404);
    await ref.update(updates);
    return Response.json({ plan: { id: planId, ...snapshot.data(), ...updates } });
  } catch (error) {
    console.error("Could not update basket plan.", error);
    return jsonError("We could not update this basket plan.", 500);
  }
}

/** Staff only: delete a basket plan. */
export async function DELETE(request: Request) {
  if (!firebaseAdminConfigured()) return jsonError("Basket plans are not available yet.", 503);
  const user = await authenticatedUser(request);
  if (!user || !isStaff(user.role)) return jsonError("Staff access is required.", 403);

  const planId = new URL(request.url).searchParams.get("id");
  if (!planId || !/^[A-Za-z0-9_-]{1,150}$/.test(planId)) return jsonError("Invalid plan reference.", 400);

  try {
    const ref = adminDb().collection("basketPlans").doc(planId);
    const snapshot = await ref.get();
    if (!snapshot.exists) return jsonError("Basket plan not found.", 404);
    await ref.delete();
    return Response.json({ deleted: planId });
  } catch (error) {
    console.error("Could not delete basket plan.", error);
    return jsonError("We could not delete this basket plan.", 500);
  }
}
