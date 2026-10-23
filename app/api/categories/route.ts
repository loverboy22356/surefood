import { Timestamp } from "firebase-admin/firestore";
import { authenticatedUser, isStaff } from "@/lib/auth/server";
import { adminDb, firebaseAdminConfigured } from "@/lib/firebase/admin";
import { sellerCanManageListings } from "@/lib/auth/seller-verification";
import { categoryId, DEFAULT_PRODUCT_CATEGORIES } from "@/lib/product-categories";
import { cleanString, jsonError, readJson } from "@/lib/http";

export const runtime = "nodejs";

export async function GET() {
  if (!firebaseAdminConfigured()) {
    return Response.json({ categories: [...DEFAULT_PRODUCT_CATEGORIES] });
  }
  try {
    const snapshot = await adminDb().collection("productCategories").where("active", "==", true).get();
    const names = snapshot.docs.map((document) => String(document.data().name ?? ""));
    return Response.json({ categories: [...new Set([...DEFAULT_PRODUCT_CATEGORIES, ...names])].sort((a, b) => a.localeCompare(b)) });
  } catch (error) {
    console.error("Could not load product categories.", error);
    return jsonError("Product categories are temporarily unavailable.", 500);
  }
}

export async function POST(request: Request) {
  const user = await authenticatedUser(request);
  if (!user) return jsonError("Sign in to add a product category.", 401);
  if (!isStaff(user.role)) {
    if (user.role !== "vendor" && user.role !== "supplier") {
      return jsonError("Only approved sellers and staff can add product categories.", 403);
    }
    try {
      const profile = await adminDb().collection("users").doc(user.uid).get();
      if (!sellerCanManageListings(profile.data())) {
        return jsonError("Your seller account must be approved before adding categories.", 403);
      }
    } catch (error) {
      console.error("Could not verify category permissions.", error);
      return jsonError("We could not verify permission to add a category.", 500);
    }
  }

  const body = await readJson(request);
  const name = cleanString(body?.name, 60);
  const id = categoryId(name);
  if (!name || name.length < 2 || !id) return jsonError("Enter a valid category name.", 400);
  if (DEFAULT_PRODUCT_CATEGORIES.some((item) => item.toLowerCase() === name.toLowerCase())) {
    return jsonError("That category already exists.", 409);
  }

  try {
    const ref = adminDb().collection("productCategories").doc(id);
    await adminDb().runTransaction(async (transaction) => {
      const existing = await transaction.get(ref);
      if (existing.exists) throw new Error("CATEGORY_EXISTS");
      transaction.create(ref, {
        name,
        active: true,
        createdBy: user.uid,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
    });
    return Response.json({ category: name }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "CATEGORY_EXISTS") {
      return jsonError("That category already exists.", 409);
    }
    console.error("Could not create a product category.", error);
    return jsonError("We could not save this category.", 500);
  }
}
