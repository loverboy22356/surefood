import { readFileSync } from "node:fs";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { v2 as cloudinary } from "cloudinary";

const BASE_URL = process.env.SMOKE_BASE_URL ?? "http://localhost:3000";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((line) => line.includes("=") && !line.trimStart().startsWith("#"))
    .map((line) => {
      const index = line.indexOf("=");
      return [line.slice(0, index).trim(), line.slice(index + 1).trim()];
    }),
);

const serviceAccount = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON);

const app = getApps()[0] ?? initializeApp({
  credential: cert({
    projectId: serviceAccount.project_id,
    clientEmail: serviceAccount.client_email,
    privateKey: serviceAccount.private_key.replace(/\\n/g, "\n"),
  }),
  projectId: serviceAccount.project_id,
});
const auth = getAuth(app);
const db = getFirestore(app);

const runId = Date.now().toString(36);
const uids = {
  buyer: `smoke-buyer-${runId}`,
  vendor: `smoke-vendor-${runId}`,
  supplier: `smoke-supplier-${runId}`,
  staff: `smoke-staff-${runId}`,
};
const tokens = {};
const created = { orders: [], products: [], users: [], authUsers: [], activities: [] };
const results = [];

function record(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

function check(name, ok, detail) {
  record(name, ok, detail);
  return ok;
}

async function api(path, { method = "GET", role, body, form, expect } = {}) {
  const headers = {};
  if (role) headers.authorization = `Bearer ${tokens[role]}`;
  if (body !== undefined) headers["content-type"] = "application/json";
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    ...(form ? { body: form } : {}),
  });
  const text = await response.text();
  let payload;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = { raw: text.slice(0, 300) };
  }
  const ok = expect === undefined ? response.ok : response.status === expect;
  if (!ok) {
    console.log(`      ${method} ${path} -> ${response.status} ${text.slice(0, 400)}`);
  }
  return { status: response.status, ok, payload };
}

async function mintToken(role) {
  const customToken = await auth.createCustomToken(uids[role], { role });
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${env.NEXT_PUBLIC_FIREBASE_API_KEY}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: customToken, returnSecureToken: true }),
    },
  );
  const result = await response.json();
  if (!response.ok) throw new Error(`Could not mint a ${role} token: ${result.error?.message ?? response.status}`);
  tokens[role] = result.idToken;
}

function tinyPdf() {
  return Buffer.from(
    "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[]/Count 0>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n",
    "utf8",
  );
}

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

async function uploadDocument(role, documentType, bytes, type, filename) {
  const form = new FormData();
  form.append("documentType", documentType);
  form.append("file", new Blob([bytes], { type }), filename);
  return api("/api/onboarding/documents", { method: "POST", role, form });
}

async function main() {
  const health = await fetch(BASE_URL).catch(() => null);
  if (!health?.ok) throw new Error(`Dev server is not responding at ${BASE_URL}`);
  console.log(`Smoke test ${runId} against ${BASE_URL}\n`);

  for (const [role, uid] of Object.entries(uids)) {
    await auth.createUser({ uid, email: `${uid}@example.com`, emailVerified: true });
    created.authUsers.push(uid);
  }
  await mintToken("buyer");
  await mintToken("vendor");
  await mintToken("supplier");
  await mintToken("staff");
  record("Mint Firebase ID tokens for four roles", Object.keys(tokens).length === 4);

  const now = Timestamp.now();
  const profiles = {
    buyer: {
      uid: uids.buyer, role: "buyer", email: `${uids.buyer}@example.com`, displayName: "Smoke Buyer",
      phone: "+2348012345678", location: "12 Marina Road, Lagos Island, Lagos",
      verificationStatus: "not_required", createdAt: now, updatedAt: now,
    },
    vendor: {
      uid: uids.vendor, role: "vendor", email: `${uids.vendor}@example.com`, displayName: "Smoke Vendor",
      phone: "+2348023456789", location: "5 Allen Avenue, Ikeja, Lagos",
      verificationStatus: "incomplete", business: { businessName: "Smoke Vendor Foods Ltd", country: "NG", city: "Lagos", region: "Lagos", address: "5 Allen Avenue", postalCode: "100001" },
      payoutAccount: { accountNumber: "0123456789", bankCode: "058", accountName: "Smoke Vendor Foods Ltd", verifiedAt: now },
      createdAt: now, updatedAt: now,
    },
    supplier: {
      uid: uids.supplier, role: "supplier", email: `${uids.supplier}@example.com`, displayName: "Smoke Supplier",
      phone: "+2348034567890", location: "9 Warehouse Close, Apapa, Lagos",
      verificationStatus: "approved", approvalFeeMinor: 500_000, approvalFeeCurrency: "NGN", approvalFeeStatus: "paid",
      business: { businessName: "Smoke Supplier Wholesale", country: "NG", city: "Lagos", region: "Lagos", address: "9 Warehouse Close", postalCode: "100002" },
      payoutAccount: { accountNumber: "0123456789", bankCode: "058", accountName: "Smoke Supplier Wholesale", verifiedAt: now },
      createdAt: now, updatedAt: now,
    },
    staff: {
      uid: uids.staff, role: "staff", email: `${uids.staff}@example.com`, displayName: "Smoke Staff",
      verificationStatus: "approved", createdAt: now, updatedAt: now,
    },
  };
  for (const [role, profile] of Object.entries(profiles)) {
    await db.collection("users").doc(uids[role]).set(profile);
    created.users.push(uids[role]);
  }
  record("Create four Firestore test profiles", true);

  const profileCheck = await api("/api/profile", { role: "vendor" });
  check("GET /api/profile returns the vendor profile", profileCheck.status === 200 && profileCheck.payload?.profile?.role === "vendor", `status ${profileCheck.status}`);

  const buyerPatch = await api("/api/profile", { method: "PATCH", role: "buyer", body: { phone: "+2348012345678", location: "12 Marina Road, Lagos Island, Lagos" } });
  check("PATCH /api/profile saves buyer delivery details", buyerPatch.status === 200 && buyerPatch.payload?.profile?.location, `status ${buyerPatch.status}`);

  const supplierSettings = await api("/api/profile", {
    method: "PATCH", role: "supplier",
    body: { notificationPreferences: { newOrders: true, shipmentUpdates: false, lowStockAlerts: true, marketingEmails: false } },
  });
  check("PATCH /api/profile saves supplier notification settings", supplierSettings.status === 200, `status ${supplierSettings.status}`);

  const uploads = [
    ["business-registration", tinyPdf(), "application/pdf", "cac.pdf"],
    ["proof-of-address", png, "image/png", "bill.png"],
    ["nin", png, "image/png", "nin.png"],
  ];
  for (const [documentType, bytes, type, filename] of uploads) {
    const upload = await uploadDocument("vendor", documentType, bytes, type, filename);
    check(`Upload ${documentType} document to private Cloudinary storage`, upload.status === 201 && upload.payload?.uploaded === true, `status ${upload.status} ${upload.payload?.error ?? ""}`);
  }

  const onboardingAfterUpload = await api("/api/onboarding", { role: "vendor" });
  const documents = onboardingAfterUpload.payload?.documents ?? {};
  check(
    "GET /api/onboarding reports all three documents as stored",
    documents.businessRegistration === true && documents.proofOfAddress === true && documents.nin === true,
    JSON.stringify(documents),
  );

  const submission = await api("/api/onboarding", {
    method: "POST", role: "vendor",
    body: {
      businessName: "Smoke Vendor Foods Ltd", registrationNumber: "RC1234567", country: "NG", businessType: "co",
      address: "5 Allen Avenue", city: "Lagos", region: "Lagos", postalCode: "100001",
    },
  });
  check("POST /api/onboarding submits the application for review", submission.status === 202, `status ${submission.status} ${submission.payload?.error ?? ""}`);

  const queue = await api("/api/admin/accounts/verification", { role: "staff" });
  const application = (queue.payload?.applications ?? []).find((item) => item.uid === uids.vendor);
  check("Staff verification queue lists the application", queue.status === 200 && Boolean(application), `status ${queue.status}, ${(queue.payload?.applications ?? []).length} entries`);
  if (application) {
    check(
      "Staff queue includes working links to all three documents",
      Boolean(application.business.registrationDocumentUrl && application.business.addressProofUrl && application.business.ninDocumentUrl),
      JSON.stringify({
        registration: Boolean(application.business.registrationDocumentUrl),
        address: Boolean(application.business.addressProofUrl),
        nin: Boolean(application.business.ninDocumentUrl),
      }),
    );
    if (application.business.registrationDocumentUrl) {
      const download = await fetch(application.business.registrationDocumentUrl);
      check("Staff can download the private registration document", download.ok, `status ${download.status}`);
    }
  }

  // Applications created by earlier releases stored registryStatus as not_checked;
  // staff must still be able to approve them after confirming the registry.
  await db.collection("users").doc(uids.vendor).update({ registryStatus: "not_checked" });
  record("Simulate a legacy not_checked application", true);

  const approval = await api(`/api/admin/accounts/${uids.vendor}/verification`, {
    method: "PATCH", role: "staff",
    body: {
      status: "approved",
      note: "Smoke test approval",
      documentChecks: { businessRegistrationValid: true, registryNumberVerified: true, proofOfAddressValid: true, ninMatchesApplicant: true },
    },
  });
  check("Staff approve the vendor application", approval.status === 200, `status ${approval.status} ${approval.payload?.error ?? ""}`);

  const onboardingApproved = await api("/api/onboarding", { role: "vendor" });
  check(
    "Approved vendor sees the ₦2,000 approval fee due",
    onboardingApproved.payload?.verificationStatus === "approved" &&
      onboardingApproved.payload?.approvalFeeMinor === 200_000 &&
      onboardingApproved.payload?.approvalFeeStatus === "pending",
    JSON.stringify({
      status: onboardingApproved.payload?.verificationStatus,
      fee: onboardingApproved.payload?.approvalFeeMinor,
      feeStatus: onboardingApproved.payload?.approvalFeeStatus,
    }),
  );

  const productImage = `https://res.cloudinary.com/${env.CLOUDINARY_CLOUD_NAME}/image/upload/surefood/test-${runId}.png`;
  const expiryDate = new Date(Date.now() + 90 * 86_400_000).toISOString().slice(0, 10);
  const blockedProduct = await api("/api/products", {
    method: "POST", role: "vendor",
    body: { name: "Smoke test yams", category: "Fresh vegetables", productKind: "farmer", expiryDate, priceMinor: 500_00, stock: 10, imageUrl: productImage, currency: "NGN" },
  });
  check("Listings stay locked while the approval fee is unpaid", blockedProduct.status === 403, `status ${blockedProduct.status}`);

  const feeCheckout = await api("/api/payments/approval-fee", { method: "POST", role: "vendor" });
  check("Vendor approval fee starts a Paystack checkout", feeCheckout.status === 200 && typeof feeCheckout.payload?.authorizationUrl === "string", `status ${feeCheckout.status} ${feeCheckout.payload?.error ?? ""}`);

  // Paystack cannot be charged from a script, so the paid state is simulated to exercise the unlock.
  await db.collection("users").doc(uids.vendor).update({ approvalFeeStatus: "paid", approvalFeePaidAt: Timestamp.now() });
  record("Simulate a confirmed approval-fee payment", true);

  const vendorProduct = await api("/api/products", {
    method: "POST", role: "vendor",
    body: { name: "Smoke test yams", category: "Fresh vegetables", productKind: "farmer", expiryDate, priceMinor: 500_00, stock: 10, imageUrl: productImage, currency: "NGN" },
  });
  if (vendorProduct.payload?.product?.id) created.products.push(vendorProduct.payload.product.id);
  check("Vendor can list products after the approval fee is paid", vendorProduct.status === 201, `status ${vendorProduct.status} ${vendorProduct.payload?.error ?? ""}`);

  const supplierProduct = await api("/api/products", {
    method: "POST", role: "supplier",
    body: { name: "Smoke test rice (50kg)", category: "Pantry essentials", productKind: "producer", expiryDate, priceMinor: 45_000_00, stock: 20, imageUrl: productImage, currency: "NGN" },
  });
  if (supplierProduct.payload?.product?.id) created.products.push(supplierProduct.payload.product.id);
  check("Supplier can list wholesale products", supplierProduct.status === 201, `status ${supplierProduct.status} ${supplierProduct.payload?.error ?? ""}`);

  const catalog = await api("/api/products");
  const visibleProducts = catalog.payload?.products ?? [];
  check(
    "Public catalog shows both approved sellers",
    visibleProducts.some((product) => product.id === vendorProduct.payload?.product?.id) &&
      visibleProducts.some((product) => product.id === supplierProduct.payload?.product?.id),
    `${visibleProducts.length} products`,
  );

  if (vendorProduct.payload?.product?.id) {
    const checkout = await api("/api/orders", {
      method: "POST", role: "buyer",
      body: { checkoutId: crypto.randomUUID(), items: [{ productId: vendorProduct.payload.product.id, quantity: 2 }] },
    });
    const order = checkout.payload?.orders?.[0];
    if (order?.id) created.orders.push(order.id);
    check("Buyer places an order with a vendor", checkout.status === 201 && Boolean(order), `status ${checkout.status} ${checkout.payload?.error ?? ""}`);

    const buyerOrders = await api("/api/orders", { role: "buyer" });
    check("Buyer sees the new order", (buyerOrders.payload?.orders ?? []).some((item) => item.id === order?.id), `status ${buyerOrders.status} ${buyerOrders.payload?.error ?? ""}`);

    const sellerOrders = await api("/api/orders", { role: "vendor" });
    check("Vendor sees the incoming order", (sellerOrders.payload?.orders ?? []).some((item) => item.id === order?.id), `status ${sellerOrders.status} ${sellerOrders.payload?.error ?? ""}`);

    if (order?.id) {
      const quote = await api(`/api/orders/${order.id}`, { method: "PATCH", role: "vendor", body: { deliveryFeeMinor: 1500_00 } });
      check("Vendor confirms the seller-handled delivery fee", quote.status === 200 && quote.payload?.order?.status === "Awaiting buyer payment", `status ${quote.status} ${quote.payload?.error ?? ""}`);

      const payment = await api("/api/payments/initialize", { method: "POST", role: "buyer", body: { orderId: order.id } });
      check("Buyer checkout starts a Paystack payment", payment.status === 200 && typeof payment.payload?.authorizationUrl === "string", `status ${payment.status} ${payment.payload?.error ?? ""}`);
    }
  }

  if (supplierProduct.payload?.product?.id) {
    const wholesale = await api("/api/orders", {
      method: "POST", role: "vendor",
      body: { checkoutId: crypto.randomUUID(), items: [{ productId: supplierProduct.payload.product.id, quantity: 3 }] },
    });
    const order = wholesale.payload?.orders?.[0];
    if (order?.id) created.orders.push(order.id);
    check("Vendor orders wholesale stock from a supplier", wholesale.status === 201 && order?.orderChannel === "wholesale", `status ${wholesale.status} ${wholesale.payload?.error ?? ""}`);

    const purchases = await api("/api/orders?mine=purchases", { role: "vendor" });
    check("Vendor sees their supplier orders", (purchases.payload?.orders ?? []).some((item) => item.id === order?.id), `status ${purchases.status} ${purchases.payload?.error ?? ""}`);

    const supplierOrders = await api("/api/orders", { role: "supplier" });
    check("Supplier sees the wholesale order", (supplierOrders.payload?.orders ?? []).some((item) => item.id === order?.id), `status ${supplierOrders.status} ${supplierOrders.payload?.error ?? ""}`);
  }

  const activity = await api("/api/activity", { role: "vendor" });
  check("Vendor activity feed is readable", activity.status === 200 && Array.isArray(activity.payload?.activities), `status ${activity.status} ${activity.payload?.error ?? ""}`);
}

try {
  await main();
} catch (error) {
  record("Smoke test crashed", false, error instanceof Error ? error.message : String(error));
} finally {
  console.log("\nCleaning up test data…");
  for (const orderId of created.orders) await db.collection("orders").doc(orderId).delete().catch(() => {});
  for (const productId of created.products) await db.collection("products").doc(productId).delete().catch(() => {});
  for (const uid of created.users) {
    const activities = await db.collection("activities").where("actorUid", "==", uid).get().catch(() => null);
    for (const document of activities?.docs ?? []) await document.ref.delete().catch(() => {});
    const targeted = await db.collection("activities").where("targetUserId", "==", uid).get().catch(() => null);
    for (const document of targeted?.docs ?? []) await document.ref.delete().catch(() => {});
    await db.collection("users").doc(uid).delete().catch(() => {});
  }
  for (const uid of created.authUsers) await auth.deleteUser(uid).catch(() => {});
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
  });
  for (const uid of created.users) {
    for (const documentType of ["business-registration", "proof-of-address", "nin"]) {
      for (const extension of ["pdf", "png", "jpg"]) {
        await cloudinary.uploader
          .destroy(`surefood/kyb/${uid}/${documentType}/document.${extension}`, { resource_type: "raw", type: "private", invalidate: true })
          .catch(() => {});
      }
    }
  }
  const failures = results.filter((result) => !result.ok);
  console.log(`\n${results.length - failures.length}/${results.length} checks passed`);
  if (failures.length) {
    console.log("Failures:");
    for (const failure of failures) console.log(` - ${failure.name}: ${failure.detail ?? ""}`);
    process.exitCode = 1;
  }
}
