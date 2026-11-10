import { Timestamp } from "firebase-admin/firestore";
import { authenticatedUser } from "@/lib/auth/server";
import { adminDb, firebaseAdminConfigured } from "@/lib/firebase/admin";
import { cleanString, jsonError, readJson } from "@/lib/http";
import { isValidPhone } from "@/lib/requests";
import { PUBLIC_CACHE_HEADERS } from "@/lib/server-cache";
import {
  basketPlans as defaultPlans,
  findPlan,
  isBasketFrequency,
  isDeliveryDay,
  nextDeliveryFor,
  priceForFrequency,
} from "@/lib/baskets";

const MINIMUM_BASKET_MINOR = 500_000;

/** The shelf of ready-made baskets. Identical for every visitor, so it caches well. */
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
        tiers: Array.isArray(data.tiers) ? data.tiers : [{ id: "standard", label: "Standard", priceMinor: 5_000_000, note: "Everyday value" }],
        popular: Boolean(data.popular),
      };
    });
    return Response.json({ plans: plans.length ? plans : defaultPlans }, { headers: PUBLIC_CACHE_HEADERS });
  } catch (error) {
    console.error("Could not load basket plans.", error);
    return Response.json({ plans: defaultPlans }, { headers: PUBLIC_CACHE_HEADERS });
  }
}

export async function POST(request: Request) {
  if (!firebaseAdminConfigured()) {
    return jsonError("Basket subscriptions are unavailable until Firebase Admin is configured.", 503);
  }
  const user = await authenticatedUser(request);
  if (!user) return jsonError("Sign in to start a basket subscription.", 401);

  const body = await readJson(request);
  if (!body) return jsonError("Enter valid basket details.", 400);

  const type = body.type === "custom" ? "custom" : "plan";
  const frequency = body.frequency;
  const deliveryDay = body.deliveryDay;
  const phone = cleanString(body.phone, 20);
  const address = cleanString(body.address, 240);
  const city = cleanString(body.city, 80);
  const region = cleanString(body.region, 80);
  const customerName = cleanString(body.customerName, 120);
  const notes = cleanString(body.notes, 400);

  if (!isBasketFrequency(frequency)) return jsonError("Choose how often your basket should arrive.", 400);
  if (!isDeliveryDay(deliveryDay)) return jsonError("Choose a delivery day.", 400);
  if (!isValidPhone(phone)) return jsonError("Enter a phone number the rider can reach you on.", 400);
  if (address.length < 10) return jsonError("Enter the full delivery address, including street and landmark.", 400);
  if (!city || !region) return jsonError("Tell us the city and state for delivery.", 400);

  try {
    let planId = "custom";
    let planName = "Custom basket";
    let tier = "custom";
    let items: { label: string; productId?: string; quantity?: number }[] = [];
    let baseMinor = 0;

    if (type === "plan") {
      const plan = findPlan(cleanString(body.planId, 40));
      const tierId = cleanString(body.tier, 40);
      if (!plan) return jsonError("That basket is no longer available. Pick another one.", 400);
      const chosen = plan.tiers.find((item) => item.id === tierId);
      if (!chosen) return jsonError("Choose a package size for this basket.", 400);
      planId = plan.id;
      planName = plan.name;
      tier = chosen.id;
      baseMinor = chosen.priceMinor;
      items = plan.items.map((label) => ({ label }));
    } else {
      const requested = Array.isArray(body.items) ? body.items : [];
      if (!requested.length || requested.length > 30) return jsonError("Choose between 1 and 30 products for your basket.", 400);
      const quantities = new Map<string, number>();
      for (const entry of requested) {
        const item = (entry ?? {}) as Record<string, unknown>;
        const productId = cleanString(item.productId, 120);
        const quantity = Number(item.quantity);
        if (!productId || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 999) {
          return jsonError("Each basket item needs a product and a quantity.", 400);
        }
        quantities.set(productId, (quantities.get(productId) ?? 0) + quantity);
      }

      const ids = [...quantities.keys()];
      const references = ids.map((id) => adminDb().collection("products").doc(id));
      const snapshots = [];
      for (let index = 0; index < references.length; index += 100) {
        snapshots.push(...(await adminDb().getAll(...references.slice(index, index + 100))));
      }
      const today = new Date().toISOString().slice(0, 10);
      for (const snapshot of snapshots) {
        const product = snapshot.data();
        const quantity = quantities.get(snapshot.id) ?? 0;
        if (!snapshot.exists || product?.status !== "active") {
          return jsonError("One of the products in your basket is no longer listed. Please review it.", 400);
        }
        if (typeof product.expiryDate === "string" && product.expiryDate && product.expiryDate < today) {
          return jsonError(`${String(product.name ?? "A product")} has expired and cannot be delivered.`, 400);
        }
        const unitPriceMinor = Number(product.priceMinor);
        if (!Number.isSafeInteger(unitPriceMinor) || unitPriceMinor <= 0) {
          return jsonError("One of the products in your basket has no price. Please review it.", 400);
        }
        if (Number(product.stock) < quantity) {
          return jsonError(`Only ${Number(product.stock) || 0} of ${String(product.name ?? "an item")} are available right now.`, 400);
        }
        items.push({ label: String(product.name ?? "Product"), productId: snapshot.id, quantity });
        baseMinor += unitPriceMinor * quantity;
      }
    }

    if (baseMinor < MINIMUM_BASKET_MINOR) {
      return jsonError("A basket should be worth at least ₦5,000. Add a few more items.", 400);
    }

    const amountMinor = priceForFrequency(baseMinor, frequency);
    const now = Timestamp.now();
    const subscription = {
      uid: user.uid,
      customerName: customerName || "Sure Foodz customer",
      email: String(user.email ?? ""),
      phone,
      type,
      planId,
      planName,
      tier,
      frequency,
      amountMinor,
      baseMinor,
      currency: "NGN" as const,
      address,
      city,
      region,
      deliveryDay,
      nextDelivery: nextDeliveryFor(frequency),
      items,
      status: "active" as const,
      notes,
      createdAt: now,
      updatedAt: now,
    };

    const reference = adminDb().collection("basketSubscriptions").doc();
    await reference.set(subscription);
    return Response.json({
      subscription: {
        id: reference.id,
        planName,
        tier,
        frequency,
        amountMinor,
        nextDelivery: subscription.nextDelivery,
        status: "active",
      },
    }, { status: 201 });
  } catch (error) {
    console.error("Could not start a Sure Foodz basket subscription.", error);
    return jsonError("We could not save your basket plan. Please try again.", 500);
  }
}
