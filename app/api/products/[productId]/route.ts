import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { authenticatedUser } from "@/lib/auth/server";
import { createActivity } from "@/lib/activity";
import { adminDb } from "@/lib/firebase/admin";
import { sellerCanManageListings } from "@/lib/auth/seller-verification";
import { cleanString, jsonError, readJson } from "@/lib/http";
import { categoryId, DEFAULT_PRODUCT_CATEGORIES } from "@/lib/product-categories";

export async function PATCH(request: Request, context: { params: Promise<{ productId: string }> }) {
  const user = await authenticatedUser(request);
  if (!user) return jsonError("Sign in to update a product.", 401);
  if (user.role !== "vendor" && user.role !== "supplier") return jsonError("Only sellers can update products.", 403);
  const { productId } = await context.params;
  if (!/^[A-Za-z0-9_-]{1,150}$/.test(productId)) return jsonError("Invalid product reference.", 400);
  const body = await readJson(request);
  if (!body) return jsonError("Enter valid product changes.", 400);

  const updates: Record<string, unknown> = { updatedAt: Timestamp.now() };
  let clearsCompareAt = false;
  if (body.name !== undefined) {
    const name = cleanString(body.name, 120);
    if (!name) return jsonError("Product name cannot be empty.", 400);
    updates.name = name;
  }
  if (body.description !== undefined) updates.description = cleanString(body.description, 500);
  if (body.productKind !== undefined) {
    const productKind = cleanString(body.productKind, 20);
    if (!["supplier", "farmer", "producer", "manufacturer"].includes(productKind)) return jsonError("Choose supplier, farmer, producer, or manufacturer.", 400);
    updates.productKind = productKind;
  }
  if (body.expiryDate !== undefined) {
    const expiryDate = cleanString(body.expiryDate, 10);
    const parsedExpiryDate = new Date(`${expiryDate}T00:00:00.000Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(expiryDate) || Number.isNaN(parsedExpiryDate.getTime()) ||
        parsedExpiryDate.toISOString().slice(0, 10) !== expiryDate ||
        expiryDate <= new Date().toISOString().slice(0, 10)) {
      return jsonError("Enter a future product expiry date.", 400);
    }
    updates.expiryDate = expiryDate;
  }
  if (body.nafdacNumber !== undefined) {
    const nafdacNumber = cleanString(body.nafdacNumber, 40).toUpperCase();
    if (nafdacNumber && !/^[A-Z0-9/-]{4,40}$/.test(nafdacNumber)) return jsonError("Enter a valid NAFDAC number.", 400);
    updates.nafdacNumber = nafdacNumber;
  }
  if (body.category !== undefined) {
    const category = cleanString(body.category, 80);
    if (!category) return jsonError("Product category cannot be empty.", 400);
    const isDefaultCategory = DEFAULT_PRODUCT_CATEGORIES.some((item) => item.toLowerCase() === category.toLowerCase());
    const customCategory = await adminDb().collection("productCategories").doc(categoryId(category)).get();
    if (!isDefaultCategory && (!customCategory.exists || customCategory.data()?.active !== true)) {
      return jsonError("Choose an existing category or create one before listing.", 400);
    }
    updates.category = category;
  }
  if (body.priceMinor !== undefined) {
    const priceMinor = Number(body.priceMinor);
    if (!Number.isSafeInteger(priceMinor) || priceMinor <= 0 || priceMinor > 100_000_000_000) {
      return jsonError("Enter a valid product price.", 400);
    }
    updates.priceMinor = priceMinor;
  }
  if (body.compareAtMinor !== undefined) {
    if (body.compareAtMinor === null || body.compareAtMinor === "") {
      updates.compareAtMinor = FieldValue.delete();
      clearsCompareAt = true;
    } else {
      const compareAtMinor = Number(body.compareAtMinor);
      if (!Number.isSafeInteger(compareAtMinor) || compareAtMinor <= 0 || compareAtMinor > 100_000_000_000) {
        return jsonError("Enter a valid original price.", 400);
      }
      updates.compareAtMinor = compareAtMinor;
    }
  }
  if (body.stock !== undefined) {
    const stock = Number(body.stock);
    if (!Number.isSafeInteger(stock) || stock < 0 || stock > 1_000_000) return jsonError("Enter a valid stock count.", 400);
    updates.stock = stock;
  }
  if (body.imageUrl !== undefined) {
    const imageUrl = cleanString(body.imageUrl, 1000);
    if (!process.env.CLOUDINARY_CLOUD_NAME ||
        !imageUrl.startsWith(`https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/`)) {
      return jsonError("Product images must be uploaded to SureFood Cloudinary storage.", 400);
    }
    updates.imageUrl = imageUrl;
  }
  if (body.status !== undefined) {
    if (body.status !== "active" && body.status !== "inactive") return jsonError("Choose active or inactive product status.", 400);
    updates.status = body.status;
  }
  if (Object.keys(updates).length === 1) return jsonError("Add at least one product change.", 400);

  try {
    const db = adminDb();
    const profileRef = db.collection("users").doc(user.uid);
    const productRef = db.collection("products").doc(productId);
    const product = await db.runTransaction(async (transaction) => {
      const [profile, snapshot] = await Promise.all([
        transaction.get(profileRef),
        transaction.get(productRef),
      ]);
      if (!sellerCanManageListings(profile.data())) throw new Error("SELLER_NOT_APPROVED");
      if (!snapshot.exists) throw new Error("PRODUCT_NOT_FOUND");
      const existingProduct = snapshot.data()!;
      if (existingProduct.sellerId !== user.uid) throw new Error("PRODUCT_FORBIDDEN");
      const nextProductKind = updates.productKind ?? existingProduct.productKind;
      const nextNafdacNumber = updates.nafdacNumber ?? existingProduct.nafdacNumber;
      if (typeof updates.compareAtMinor === "number") {
        const nextPrice = typeof updates.priceMinor === "number" ? updates.priceMinor : Number(existingProduct.priceMinor ?? 0);
        if (updates.compareAtMinor <= nextPrice) throw new Error("COMPARE_AT_INVALID");
      }
      if (nextProductKind === "manufacturer" &&
          (typeof nextNafdacNumber !== "string" || !/^[A-Z0-9/-]{4,40}$/.test(nextNafdacNumber))) {
        throw new Error("NAFDAC_REQUIRED");
      }
      transaction.update(productRef, updates);
      const fieldLabels: Record<string, string> = {
        name: "name",
        description: "description",
        category: "category",
        productKind: "product type",
        expiryDate: "expiry date",
        nafdacNumber: "NAFDAC number",
        priceMinor: "price",
        compareAtMinor: "original price",
        stock: "inventory",
        imageUrl: "photo",
        status: "listing status",
      };
      createActivity(transaction, {
        actorUid: user.uid,
        actorRole: user.role,
        targetUserId: user.uid,
        action: "product_updated",
        targetType: "product",
        targetId: productId,
        summary: `Updated ${existingProduct.name}: ${Object.keys(updates).filter((field) => field !== "updatedAt").map((field) => fieldLabels[field]).join(", ")}.`,
      });
      const saved = { id: productId, ...existingProduct, ...updates } as Record<string, unknown>;
      if (clearsCompareAt) delete saved.compareAtMinor;
      return saved;
    });
    return Response.json({ product });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "SELLER_NOT_APPROVED") return jsonError("Your business account must be approved and the approval fee paid to update listings.", 403);
      if (error.message === "PRODUCT_NOT_FOUND") return jsonError("Product not found.", 404);
      if (error.message === "PRODUCT_FORBIDDEN") return jsonError("You cannot update another seller's product.", 403);
      if (error.message === "NAFDAC_REQUIRED") return jsonError("Enter a valid NAFDAC number for manufacturer products.", 400);
      if (error.message === "COMPARE_AT_INVALID") return jsonError("The original price must be higher than the sale price.", 400);
    }
    console.error("Could not update a SureFood product.", error);
    return jsonError("We could not update this product.", 500);
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ productId: string }> }) {
  const user = await authenticatedUser(request);
  if (!user) return jsonError("Sign in to delete a product.", 401);
  if (user.role !== "vendor" && user.role !== "supplier") return jsonError("Only sellers can delete products.", 403);
  const { productId } = await context.params;
  if (!/^[A-Za-z0-9_-]{1,150}$/.test(productId)) return jsonError("Invalid product reference.", 400);

  try {
    const db = adminDb();
    const productRef = db.collection("products").doc(productId);
    await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(productRef);
      if (!snapshot.exists) throw new Error("PRODUCT_NOT_FOUND");
      const product = snapshot.data()!;
      if (product.sellerId !== user.uid) throw new Error("PRODUCT_FORBIDDEN");
      transaction.delete(productRef);
      createActivity(transaction, {
        actorUid: user.uid,
        actorRole: user.role,
        targetUserId: user.uid,
        action: "product_deleted",
        targetType: "product",
        targetId: productId,
        summary: `Deleted product: ${String(product.name ?? productId)}.`,
      });
    });
    return Response.json({ deleted: productId });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "PRODUCT_NOT_FOUND") return jsonError("Product not found.", 404);
      if (error.message === "PRODUCT_FORBIDDEN") return jsonError("You cannot delete another seller's product.", 403);
    }
    console.error("Could not delete a SureFood product.", error);
    return jsonError("We could not delete this product.", 500);
  }
}
