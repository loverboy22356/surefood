import { createHash } from "node:crypto";
import { Timestamp } from "firebase-admin/firestore";
import { authenticatedUser } from "@/lib/auth/server";
import { createActivity } from "@/lib/activity";
import { adminDb } from "@/lib/firebase/admin";
import { jsonError, readJson } from "@/lib/http";

type RequestedItem = { productId: string; quantity: number };

export async function GET(request: Request) {
  const user = await authenticatedUser(request);
  if (!user) return jsonError("Sign in to view orders.", 401);
  const collection = adminDb().collection("orders");
  try {
    const purchasesOnly = new URL(request.url).searchParams.get("mine") === "purchases";
    const snapshot = purchasesOnly
      ? await collection.where("customerId", "==", user.uid).orderBy("createdAt", "desc").limit(100).get()
      : user.role === "buyer"
      ? await collection.where("customerId", "==", user.uid).orderBy("createdAt", "desc").limit(100).get()
      : user.role === "vendor" || user.role === "supplier"
        ? await collection.where("sellerId", "==", user.uid).orderBy("createdAt", "desc").limit(100).get()
        : user.role === "staff" || user.role === "admin"
          ? await collection.orderBy("createdAt", "desc").limit(100).get()
          : null;
    if (!snapshot) return jsonError("Your account cannot view orders.", 403);
    const orders = snapshot.docs.map((document) => {
      const order: Record<string, unknown> = { id: document.id, ...document.data() };
      if (user.role === "buyer" || user.role === "admin" || user.role === "staff") return order;
      const {
        customerEmail: _customerEmail,
        paymentAuthorizationUrl: _paymentAuthorizationUrl,
        paymentReference: _paymentReference,
        checkoutHash: _checkoutHash,
        ...sellerOrder
      } = order;
      return sellerOrder;
    });
    return Response.json({ orders });
  } catch (error) {
    console.error("Could not load SureFood orders.", error);
    return jsonError("We could not load orders.", 500);
  }
}

export async function POST(request: Request) {
  const user = await authenticatedUser(request);
  if (!user) return jsonError("Sign in to place an order.", 401);
  if (user.role !== "buyer" && user.role !== "vendor") {
    return jsonError("Only buyer and vendor accounts can place orders.", 403);
  }
  const body = await readJson(request);
  const checkoutId = typeof body?.checkoutId === "string" ? body.checkoutId : "";
  const rawItems = body?.items;
  if (!/^[A-Za-z0-9-]{16,80}$/.test(checkoutId) || !Array.isArray(rawItems) || rawItems.length < 1 || rawItems.length > 30) {
    return jsonError("Your cart is empty or could not be validated. Please try again.", 400);
  }

  const items: RequestedItem[] = [];
  for (const item of rawItems) {
    if (!item || typeof item.productId !== "string" || !/^[A-Za-z0-9_-]{1,150}$/.test(item.productId) ||
        !Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > 1000) {
      return jsonError("Your cart contains an invalid product or quantity.", 400);
    }
    items.push({ productId: item.productId, quantity: item.quantity });
  }
  if (new Set(items.map((item) => item.productId)).size !== items.length) {
    return jsonError("Your cart has duplicate product entries. Refresh it and try again.", 400);
  }

  // Contact details can be entered directly in the cart so the buyer does not have to
  // leave checkout to complete their profile first.
  const requestedPhone = typeof body?.phone === "string" ? body.phone.trim() : "";
  const requestedAddress = typeof body?.deliveryAddress === "string" ? body.deliveryAddress.trim() : "";

  const checkoutHash = createHash("sha256")
    .update(JSON.stringify([...items].sort((a, b) => a.productId.localeCompare(b.productId))))
    .digest("hex");
  const db = adminDb();
  const profileRef = db.collection("users").doc(user.uid);
  const productRefs = items.map((item) => db.collection("products").doc(item.productId));
  const ordersCollection = db.collection("orders");

  try {
    const result = await db.runTransaction(async (transaction) => {
      const groups = new Map<string, typeof items>();
      const orderRefs = new Map<string, FirebaseFirestore.DocumentReference>();
      for (const item of items) {
        const productId = item.productId;
        const productSnapshot = await transaction.get(db.collection("products").doc(productId));
        if (!productSnapshot.exists) throw new Error("PRODUCT_UNAVAILABLE");
        const sellerId = String(productSnapshot.data()?.sellerId ?? "");
        if (!sellerId) throw new Error("PRODUCT_UNAVAILABLE");
        const currentGroup = groups.get(sellerId) ?? [];
        currentGroup.push(item);
        groups.set(sellerId, currentGroup);
      }

      if (groups.size > 10) throw new Error("TOO_MANY_SELLERS");
      for (const sellerId of groups.keys()) {
        const orderId = createHash("sha256").update(`${user.uid}:${checkoutId}:${sellerId}`).digest("hex").slice(0, 40);
        orderRefs.set(sellerId, ordersCollection.doc(orderId));
      }

      const [profileSnapshot, existingOrderSnapshots, productSnapshots] = await Promise.all([
        transaction.get(profileRef),
        Promise.all([...orderRefs.values()].map((ref) => transaction.get(ref))),
        Promise.all(productRefs.map((ref) => transaction.get(ref))),
      ]);
      const profile = profileSnapshot.data();
      if (!profileSnapshot.exists || (profile?.role !== "buyer" && profile?.role !== "vendor")) {
        throw new Error("BUYER_PROFILE_REQUIRED");
      }
      const purchaserRole = String(profile.role);
      const business = (profile.business ?? {}) as Record<string, unknown>;
      const customerPhone = requestedPhone || String(profile.phone ?? "").trim();
      const profileAddress = String(profile.location ?? "").trim() ||
        [business.address, business.city, business.region].filter((part) => typeof part === "string" && part).join(", ");
      const deliveryAddress = (requestedAddress || profileAddress).slice(0, 240);
      if (!/^[+()\d\s.-]{7,24}$/.test(customerPhone) || deliveryAddress.length < 5) {
        throw new Error("BUYER_CONTACT_REQUIRED");
      }

      const existing = existingOrderSnapshots.filter((snapshot) => snapshot.exists);
      if (existing.length) {
        if (existing.length !== existingOrderSnapshots.length ||
            existing.some((snapshot) => snapshot.data()?.checkoutHash !== checkoutHash)) {
          throw new Error("CHECKOUT_ID_CONFLICT");
        }
        return existing.map((snapshot) => ({ id: snapshot.id, ...snapshot.data() }));
      }

      const productsById = new Map(productSnapshots.map((snapshot) => [snapshot.id, snapshot]));
      const sellerIds = [...groups.keys()];
      const sellerSnapshots = await Promise.all(sellerIds.map((sellerId) => transaction.get(db.collection("users").doc(sellerId))));
      const sellersById = new Map(sellerSnapshots.map((snapshot) => [snapshot.id, snapshot]));
      const now = Timestamp.now();
      const createdOrders: Record<string, unknown>[] = [];

      for (const [sellerId, sellerItems] of groups) {
        const seller = sellersById.get(sellerId)?.data();
        const sellerNeedsFee = Boolean(seller?.approvalFeeStatus) && seller?.approvalFeeStatus !== "paid";
        const allowedSellerRoles = purchaserRole === "vendor" ? ["supplier"] : ["vendor", "supplier"];
        if (!seller || seller.verificationStatus !== "approved" || sellerNeedsFee ||
            !allowedSellerRoles.includes(String(seller.role)) || sellerId === user.uid) {
          throw new Error("SELLER_UNAVAILABLE");
        }
        const orderItems = sellerItems.map(({ productId, quantity }) => {
          const snapshot = productsById.get(productId);
          const product = snapshot?.data();
          if (!snapshot?.exists || !product || product.sellerId !== sellerId ||
              product.status !== "active" ||
              (typeof product.expiryDate === "string" && product.expiryDate < new Date().toISOString().slice(0, 10))) {
            throw new Error("PRODUCT_UNAVAILABLE");
          }
          if (product.currency !== "NGN") throw new Error("UNSUPPORTED_CURRENCY");
          const stock = Number(product.stock);
          const priceMinor = Number(product.priceMinor);
          if (!Number.isSafeInteger(stock) || stock < quantity) throw new Error("INSUFFICIENT_STOCK");
          if (!Number.isSafeInteger(priceMinor) || priceMinor <= 0) throw new Error("PRODUCT_UNAVAILABLE");
          transaction.update(snapshot.ref, { stock: stock - quantity, updatedAt: now });
          return {
            productId,
            name: String(product.name ?? "SureFood product"),
            quantity,
            unitPriceMinor: priceMinor,
            lineTotalMinor: priceMinor * quantity,
            currency: "NGN",
          };
        });
        const subtotalMinor = orderItems.reduce((sum, item) => sum + item.lineTotalMinor, 0);
        if (!Number.isSafeInteger(subtotalMinor) || subtotalMinor > 100_000_000_000) throw new Error("ORDER_TOTAL_INVALID");
        const orderRef = orderRefs.get(sellerId)!;
        const order = {
          customerId: user.uid,
          customerName: String(profile.displayName ?? user.name ?? "SureFood buyer"),
          customerEmail: user.email ?? String(profile.email ?? ""),
          customerPhone,
          deliveryAddress,
          sellerId,
          sellerName: String(seller.business?.businessName ?? seller.displayName ?? "SureFood seller"),
          sellerRole: String(seller.role),
          items: orderItems,
          subtotalMinor,
          deliveryFeeMinor: null,
          totalMinor: subtotalMinor,
          currency: "NGN",
          deliveryHandledBy: "seller",
          orderChannel: purchaserRole === "vendor" ? "wholesale" : "retail",
          purchaserRole,
          status: "Pending seller confirmation",
          paymentStatus: "unpaid",
          inventoryReleased: false,
          checkoutId,
          checkoutHash,
          createdAt: now,
          updatedAt: now,
        };
        transaction.create(orderRef, order);
        createActivity(transaction, {
          actorUid: user.uid,
          actorRole: String(profile.role ?? "buyer"),
          targetUserId: sellerId,
          action: "new_order",
          targetType: "order",
          targetId: orderRef.id,
          summary: `New order from ${order.customerName}: ${orderItems.map((item) => `${item.quantity} × ${item.name}`).join(", ")}.`,
        });
        createdOrders.push({ id: orderRef.id, ...order });
      }
      return createdOrders;
    });
    return Response.json({ orders: result }, { status: 201 });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "BUYER_PROFILE_REQUIRED") return jsonError("Complete your buyer profile before ordering.", 409);
    if (code === "BUYER_CONTACT_REQUIRED") return jsonError("Add a valid phone number and delivery address in your cart before ordering.", 409);
    if (code === "PRODUCT_UNAVAILABLE") return jsonError("A product in your cart is no longer available. Refresh your cart and try again.", 409);
    if (code === "SELLER_UNAVAILABLE") return jsonError("A seller in your cart is no longer approved. Refresh your cart and try again.", 409);
    if (code === "INSUFFICIENT_STOCK") return jsonError("There is not enough stock for a product in your cart. Refresh your cart and adjust the quantity.", 409);
    if (code === "UNSUPPORTED_CURRENCY") return jsonError("Paystack checkout is currently available for NGN orders only.", 400);
    if (code === "TOO_MANY_SELLERS") return jsonError("A single checkout can include products from up to 10 sellers.", 400);
    if (code === "CHECKOUT_ID_CONFLICT") return jsonError("This checkout request was already used for a different cart. Refresh and try again.", 409);
    if (code === "ORDER_TOTAL_INVALID") return jsonError("The order total is invalid.", 400);
    console.error("Could not create SureFood orders.", error);
    return jsonError("We could not place your order. Please try again.", 500);
  }
}
