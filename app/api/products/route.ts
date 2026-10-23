import { Timestamp } from "firebase-admin/firestore";
import { authenticatedUser } from "@/lib/auth/server";
import { createActivity } from "@/lib/activity";
import { adminDb, firebaseAdminConfigured } from "@/lib/firebase/admin";
import { sellerCanManageListings } from "@/lib/auth/seller-verification";
import { cleanString, jsonError, readJson } from "@/lib/http";
import { categoryId, DEFAULT_PRODUCT_CATEGORIES } from "@/lib/product-categories";
import { getLocalTestProducts, isLocalTestSeller, saveLocalTestProduct } from "@/lib/test-products";
import { randomUUID } from "node:crypto";

export async function GET(request: Request) {
  if (!firebaseAdminConfigured()) {
    return jsonError("Live products are unavailable until Firebase Admin is configured on the server.", 503);
  }
  try {
    const ownProducts = new URL(request.url).searchParams.get("mine") === "true";
    const user = ownProducts ? await authenticatedUser(request) : null;
    let snapshot;
    if (ownProducts) {
      if (!user) return jsonError("Sign in to view your products.", 401);
      if (user.role !== "vendor" && user.role !== "supplier") return jsonError("Only sellers can view their product listings.", 403);
      snapshot = await adminDb().collection("products")
        .where("sellerId", "==", user.uid)
        .orderBy("createdAt", "desc")
        .limit(100)
        .get();
    } else {
      snapshot = await adminDb().collection("products")
        .where("status", "==", "active")
        .orderBy("createdAt", "desc")
        .limit(100)
        .get();
    }
    const firestoreProducts: ({ id: string } & Record<string, unknown>)[] = snapshot.docs.map((document) => ({
      id: document.id,
      ...document.data(),
    }));
    if (ownProducts && user) {
      const products = isLocalTestSeller(user.email)
        ? [...getLocalTestProducts(user.uid), ...firestoreProducts]
        : firestoreProducts;
      return Response.json({ products });
    }
    const products = firestoreProducts;

    const sellerIds = [...new Set(products.map((product) => String(product.sellerId ?? "")).filter(Boolean))];
    const sellerProfiles = await Promise.all(sellerIds.map((sellerId) => adminDb().collection("users").doc(sellerId).get()));
    const sellers = new Map(sellerProfiles.filter((profile) => profile.exists).map((profile) => [profile.id, profile.data()!]));
    const activeProducts = products.flatMap((product) => {
      const seller = sellers.get(String(product.sellerId));
      const unpaidApprovalFee = Boolean(seller?.approvalFeeStatus) && seller?.approvalFeeStatus !== "paid";
      if (!seller || seller.verificationStatus !== "approved" || unpaidApprovalFee) return [];
      const expiryDate = typeof product.expiryDate === "string" ? product.expiryDate : "";
      if (expiryDate && expiryDate < new Date().toISOString().slice(0, 10)) return [];
      const business = seller.business ?? {};
      return [{
        ...product,
        sellerName: typeof business.businessName === "string" && business.businessName
          ? business.businessName
          : String(seller.displayName ?? "SureFood seller"),
        sellerRole: seller.role,
        sellerVerified: true,
        sellerCity: String(business.city ?? ""),
        sellerRegion: String(business.region ?? ""),
        sellerLocation: [business.city, business.region].filter((value) => typeof value === "string" && value.trim()).join(", "),
      }];
    });
    return Response.json({ products: activeProducts });
  } catch (error) {
    console.error("Could not load the SureFood product catalog.", error);
    return jsonError("The product catalog is temporarily unavailable.", 500);
  }
}

export async function POST(request: Request) {
  const user = await authenticatedUser(request);
  if (!user) return jsonError("Sign in to list a product.", 401);
  if (user.role !== "vendor" && user.role !== "supplier") return jsonError("Only vendors and suppliers can list products.", 403);

  const body = await readJson(request);
  if (!body) return jsonError("Enter valid product details.", 400);
  const name = cleanString(body.name, 120);
  const description = cleanString(body.description, 500);
  const category = cleanString(body.category, 80);
  const productKind = cleanString(body.productKind, 20);
  const expiryDate = cleanString(body.expiryDate, 10);
  const nafdacNumber = cleanString(body.nafdacNumber, 40).toUpperCase();
  const imageUrl = cleanString(body.imageUrl, 1000);
  const priceMinor = Number(body.priceMinor);
  const compareAtMinor = body.compareAtMinor === undefined || body.compareAtMinor === null || body.compareAtMinor === ""
    ? undefined
    : Number(body.compareAtMinor);
  const stock = Number(body.stock);
  const currency = cleanString(body.currency, 3).toUpperCase() || "NGN";
  const parsedExpiryDate = new Date(`${expiryDate}T00:00:00.000Z`);
  const validExpiryDate = /^\d{4}-\d{2}-\d{2}$/.test(expiryDate) &&
    !Number.isNaN(parsedExpiryDate.getTime()) &&
    parsedExpiryDate.toISOString().slice(0, 10) === expiryDate;
  if (!name || !category || !expiryDate || !validExpiryDate ||
      !["supplier", "farmer", "producer", "manufacturer"].includes(productKind) ||
      !Number.isSafeInteger(priceMinor) || priceMinor <= 0 || priceMinor > 100_000_000_000 ||
      !Number.isSafeInteger(stock) || stock < 0 || stock > 1_000_000 || !imageUrl) {
    return jsonError("A product needs a name, category, product source, expiry date, image, positive price, and non-negative stock.", 400);
  }
  if (expiryDate <= new Date().toISOString().slice(0, 10)) return jsonError("The expiry date must be in the future.", 400);
  if (productKind === "manufacturer" && !/^[A-Z0-9/-]{4,40}$/.test(nafdacNumber)) {
    return jsonError("Enter a valid NAFDAC number for manufacturer products.", 400);
  }
  if (!["NGN", "GHS", "ZAR", "USD"].includes(currency)) {
    return jsonError("Choose a supported product currency.", 400);
  }
  if (compareAtMinor !== undefined && (!Number.isSafeInteger(compareAtMinor) || compareAtMinor <= priceMinor || compareAtMinor > 100_000_000_000)) {
    return jsonError("The original price must be a valid amount greater than the sale price.", 400);
  }
  if (!process.env.CLOUDINARY_CLOUD_NAME ||
      !imageUrl.startsWith(`https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/`)) {
    return jsonError("Product images must be uploaded to SureFood Cloudinary storage.", 400);
  }

  try {
    const profile = await adminDb().collection("users").doc(user.uid).get();
    const localTestSeller = isLocalTestSeller(user.email);
    if (!sellerCanManageListings(profile.data()) && !localTestSeller) {
      return jsonError("Your business account must be approved and the approval fee paid before you can list products.", 403);
    }
    const isDefaultCategory = DEFAULT_PRODUCT_CATEGORIES.some((item) => item.toLowerCase() === category.toLowerCase());
    const customCategory = await adminDb().collection("productCategories").doc(categoryId(category)).get();
    if (!isDefaultCategory && (!customCategory.exists || customCategory.data()?.active !== true)) {
      return jsonError("Choose an existing category or create one before listing.", 400);
    }
    const business = profile.data()?.business ?? {};
    const productDetails = {
      sellerId: user.uid,
      sellerRole: user.role,
      name,
      description,
      category,
      productKind,
      expiryDate,
      ...(nafdacNumber ? { nafdacNumber } : {}),
      sellerCity: String(business.city ?? ""),
      sellerRegion: String(business.region ?? ""),
      imageUrl,
      priceMinor,
      ...(compareAtMinor !== undefined ? { compareAtMinor } : {}),
      currency,
      stock,
    };
    if (localTestSeller) {
      const createdAt = new Date().toISOString();
      const product = {
        id: randomUUID(),
        ...productDetails,
        status: "test",
        createdAt,
        updatedAt: createdAt,
      };
      saveLocalTestProduct(product);
      return Response.json({ product }, { status: 201 });
    }
    const productRef = adminDb().collection("products").doc();
    const product = {
      ...productDetails,
      status: "active",
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };
    const batch = adminDb().batch();
    batch.set(productRef, product);
    createActivity(batch, {
      actorUid: user.uid,
      actorRole: user.role,
      targetUserId: user.uid,
      action: "product_created",
      targetType: "product",
      targetId: productRef.id,
      summary: `Listed product: ${name}.`,
    });
    await batch.commit();
    return Response.json({ product: { id: productRef.id, ...product } }, { status: 201 });
  } catch (error) {
    console.error("Could not create a SureFood product.", error);
    return jsonError("We could not save this product.", 500);
  }
}
