import "server-only";

import { Timestamp, type DocumentData, type DocumentSnapshot } from "firebase-admin/firestore";
import { adminDb, firebaseAdminConfigured } from "@/lib/firebase/admin";
import { CATALOG_TTL_MS, CATEGORIES_TTL_MS, cached } from "@/lib/server-cache";
import { DEFAULT_PRODUCT_CATEGORIES } from "@/lib/product-categories";
import type { ApiProduct } from "@/app/components/marketplace-product";

/**
 * The buyer-facing reads, shared by the API routes and by pages that prerender
 * them straight into the HTML. One implementation, so what a page renders and
 * what the API returns can never drift apart.
 */

export const sellerRoles = ["vendor", "supplier", "producer", "manufacturer"] as const;
export type SellerRole = (typeof sellerRoles)[number];

export type ApprovedSeller = {
  id: string;
  role: SellerRole;
  name: string;
  businessName: string;
  displayName: string;
  logoUrl: string;
  detail: string;
  city: string;
  region: string;
  emoji: string;
  badge: string;
  route: string;
};

type RoleDetail = { label: string; emoji: string };

const roleDetails: Record<SellerRole, RoleDetail> = {
  vendor: { label: "Approved vendor", emoji: "🏪" },
  supplier: { label: "Approved supplier", emoji: "📦" },
  producer: { label: "Approved producer", emoji: "🌱" },
  manufacturer: { label: "Approved manufacturer", emoji: "🏭" },
};

/** Reads every seller on the shelf in as few Firestore round trips as the API allows. */
async function sellerProfilesById(sellerIds: string[]): Promise<Map<string, DocumentData>> {
  if (!sellerIds.length) return new Map<string, DocumentData>();
  const references = sellerIds.map((sellerId) => adminDb().collection("users").doc(sellerId));
  const profiles: DocumentSnapshot[] = [];
  // BatchGetDocuments caps a single call, so long seller lists are read in chunks.
  for (let index = 0; index < references.length; index += 100) {
    profiles.push(...(await adminDb().getAll(...references.slice(index, index + 100))));
  }
  return new Map(profiles.filter((profile) => profile.exists).map((profile) => [profile.id, profile.data()!]));
}

/**
 * Firestore hands back `Timestamp` instances, which `Response.json()` turns into
 * ISO strings but React refuses to pass across the server→client boundary.
 * Rendering the shelf in the HTML needs plain JSON, so both paths get it here.
 */
function jsonSafe(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (Array.isArray(value)) return value.map(jsonSafe);
  if (value && typeof value === "object" && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)) {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, jsonSafe(entry)]));
  }
  return value;
}

/**
 * The buyer-facing catalogue: every visitor sees the same shelf, so the whole
 * read (query plus the seller profiles it joins) is memoised between requests.
 */
export async function loadBuyerCatalog(): Promise<ApiProduct[]> {
  if (!firebaseAdminConfigured()) {
    throw new Error("Firebase Admin is not configured.");
  }
  const products = await cached("catalog:active-products", CATALOG_TTL_MS, async () => {
    const snapshot = await adminDb().collection("products")
      .where("status", "==", "active")
      .orderBy("createdAt", "desc")
      .limit(100)
      .get();
    const listings: ({ id: string } & Record<string, unknown>)[] = snapshot.docs.map((document) => ({
      id: document.id,
      ...(jsonSafe(document.data()) as Record<string, unknown>),
    }));

    const sellerIds = [...new Set(listings.map((product) => String(product.sellerId ?? "")).filter(Boolean))];
    const sellers = await sellerProfilesById(sellerIds);

    return listings.flatMap((product) => {
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
          : String(seller.displayName ?? "Sure Foodz seller"),
        sellerLogoUrl: typeof seller.businessLogoUrl === "string" ? seller.businessLogoUrl : "",
        sellerRole: seller.role,
        sellerVerified: true,
        sellerCity: String(business.city ?? ""),
        sellerRegion: String(business.region ?? ""),
        sellerLocation: [business.city, business.region].filter((value) => typeof value === "string" && value.trim()).join(", "),
      }];
    });
  });

  return products as ApiProduct[];
}

/** The approved directory for one kind of seller, shared by every visitor. */
export async function loadApprovedSellers(role: SellerRole): Promise<ApprovedSeller[]> {
  if (!firebaseAdminConfigured()) {
    throw new Error("Firebase Admin is not configured.");
  }
  const detail = roleDetails[role];
  return cached(`catalog:sellers:${role}`, CATALOG_TTL_MS, async () => {
    const snapshot = await adminDb().collection("users")
      .where("role", "==", role)
      .where("verificationStatus", "==", "approved")
      .orderBy("updatedAt", "desc")
      .limit(50)
      .get();
    return snapshot.docs.map((document): ApprovedSeller => {
      const profile = document.data();
      const business = profile.business ?? {};
      const location = [business.city, business.region].filter((part) => typeof part === "string" && part).join(", ");
      const businessName = typeof business.businessName === "string" && business.businessName
        ? business.businessName
        : typeof profile.displayName === "string" ? profile.displayName : "Sure Foodz seller";
      return {
        id: document.id,
        role,
        name: businessName,
        businessName,
        displayName: typeof profile.displayName === "string" ? profile.displayName : "",
        // The logo the seller uploaded in their workspace, shown on the buyer side.
        logoUrl: typeof profile.businessLogoUrl === "string" ? profile.businessLogoUrl : "",
        detail: location || "Sure Foodz verified business",
        city: typeof business.city === "string" ? business.city : "",
        region: typeof business.region === "string" ? business.region : "",
        emoji: detail.emoji,
        badge: detail.label,
        route: `/store/${document.id}`,
      };
    });
  });
}

/** The aisles a buyer can browse: the defaults plus anything sellers have added. */
export async function loadProductCategories(): Promise<string[]> {
  return cached("catalog:categories", CATEGORIES_TTL_MS, async () => {
    if (!firebaseAdminConfigured()) return [...DEFAULT_PRODUCT_CATEGORIES];
    const snapshot = await adminDb().collection("productCategories").where("active", "==", true).get();
    const names = snapshot.docs.map((document) => String(document.data().name ?? ""));
    return [...new Set([...DEFAULT_PRODUCT_CATEGORIES, ...names])].sort((a, b) => a.localeCompare(b));
  });
}
