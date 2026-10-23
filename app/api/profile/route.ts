import { Timestamp } from "firebase-admin/firestore";
import { authenticatedUser } from "@/lib/auth/server";
import { adminAuth, adminDb, firebaseAdminConfigured } from "@/lib/firebase/admin";
import { cleanString, jsonError, readJson } from "@/lib/http";

const selectableRoles = ["buyer", "vendor", "supplier", "staff", "admin"] as const;

function isNotificationPreferences(value: unknown): value is Record<string, boolean> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const preferences = value as Record<string, unknown>;
  const allowed = ["newOrders", "shipmentUpdates", "lowStockAlerts", "marketingEmails"];
  return Object.keys(preferences).length === allowed.length &&
    allowed.every((key) => typeof preferences[key] === "boolean");
}

export async function GET(request: Request) {
  if (!firebaseAdminConfigured()) {
    return jsonError("Account APIs are not configured. Set FIREBASE_SERVICE_ACCOUNT_JSON on the server.", 503);
  }
  const user = await authenticatedUser(request);
  if (!user) return jsonError("Sign in to continue.", 401);

  try {
    const snapshot = await adminDb().collection("users").doc(user.uid).get();
    if (!snapshot.exists) return jsonError("Complete account setup to continue.", 404);
    return Response.json({ profile: snapshot.data() });
  } catch (error) {
    console.error("Could not load the account profile.", error);
    return jsonError("We could not load your account.", 500);
  }
}

export async function PATCH(request: Request) {
  if (!firebaseAdminConfigured()) {
    return jsonError("Account APIs are not configured. Set up Firebase Admin on the server.", 503);
  }
  const user = await authenticatedUser(request);
  if (!user) return jsonError("Sign in to update your profile.", 401);

  const body = await readJson(request);
  if (!body) return jsonError("Enter profile details to update.", 400);
  const isSeller = user.role === "vendor" || user.role === "supplier";
  if (isSeller && body.notificationPreferences !== undefined) {
    const preferences = body.notificationPreferences;
    if (!isNotificationPreferences(preferences)) {
      return jsonError("Choose valid notification preferences.", 400);
    }
    try {
      const userRef = adminDb().collection("users").doc(user.uid);
      const snapshot = await userRef.get();
      if (!snapshot.exists || snapshot.data()?.role !== user.role) {
        return jsonError("Seller account profile not found.", 404);
      }
      await userRef.update({ notificationPreferences: preferences, updatedAt: Timestamp.now() });
      return Response.json({ notificationPreferences: preferences });
    } catch (error) {
      console.error("Could not update seller notification preferences.", error);
      return jsonError("We could not save notification preferences.", 500);
    }
  }
  if (user.role !== "buyer" && user.role !== "vendor") {
    return jsonError("Only buyer and vendor accounts can update contact details here.", 403);
  }
  if (body.phone === undefined && body.location === undefined) {
    return jsonError("Enter a phone number or delivery address to update.", 400);
  }
  const phone = body.phone === undefined ? undefined : cleanString(body.phone, 24);
  const location = body.location === undefined ? undefined : cleanString(body.location, 240);
  if (phone !== undefined && !/^[+()\d\s.-]{7,24}$/.test(phone)) {
    return jsonError("Enter a valid phone number.", 400);
  }
  if (location !== undefined && location.length < 5) {
    return jsonError("Enter a full delivery address.", 400);
  }

  try {
    const userRef = adminDb().collection("users").doc(user.uid);
    const snapshot = await userRef.get();
    if (!snapshot.exists || !["buyer", "vendor"].includes(String(snapshot.data()?.role))) {
      return jsonError("Buyer account profile not found.", 404);
    }
    const updates = {
      ...(phone !== undefined ? { phone } : {}),
      ...(location !== undefined ? { location } : {}),
      updatedAt: Timestamp.now(),
    };
    await userRef.update(updates);
    return Response.json({
      profile: {
        ...snapshot.data(),
        ...updates,
      },
    });
  } catch (error) {
    console.error("Could not update the buyer profile.", error);
    return jsonError("We could not save your contact details.", 500);
  }
}

export async function POST(request: Request) {
  if (!firebaseAdminConfigured()) {
    return jsonError("Google sign-in needs Firebase Admin credentials. Set FIREBASE_SERVICE_ACCOUNT_JSON on the server.", 503);
  }
  const user = await authenticatedUser(request);
  if (!user || !user.email || user.email_verified !== true) {
    return jsonError("Verify your email before creating an account.", 401);
  }
  const body = await readJson(request);
  const adminOverrideEmail = String(process.env.SUREFOOD_ADMIN_EMAIL || process.env.STAFF_EMAIL || "admin@surefood.test").trim().toLowerCase();
  const requestedRole = body && typeof body.role === "string" ? body.role : "";
  if (!body || !selectableRoles.includes(requestedRole as (typeof selectableRoles)[number])) {
    return jsonError("Choose buyer, vendor, supplier, or staff.", 400);
  }
  if ((requestedRole === "staff" || requestedRole === "admin") && user.email.toLowerCase() !== adminOverrideEmail) {
    return jsonError("Only the configured SureFood admin account can create a staff profile.", 403);
  }

  const role = (user.email && user.email.toLowerCase() === adminOverrideEmail ? "staff" : (requestedRole as (typeof selectableRoles)[number]));
  const requestedName = cleanString(body.displayName, 100);
  const phone = cleanString(body.phone, 24);
  const location = cleanString(body.location, 180);

  const userRef = adminDb().collection("users").doc(user.uid);
  try {
    const existing = await userRef.get();
    if (existing.exists && existing.data()?.role !== role) {
      return jsonError(
        `This Google account is already registered as a ${String(existing.data()?.role)}. To create a ${role} account, sign out and use a different email address.`,
        409,
      );
    }
    const existingProfile = existing.data();
    const displayName = requestedName || existingProfile?.displayName || cleanString(user.name, 100);
    if (!displayName) return jsonError("Your Google account must include a name to create a SureFood profile.", 400);
    const profile = {
      uid: user.uid,
      email: user.email,
      role: existingProfile?.role ?? role,
      displayName,
      phone: phone || existingProfile?.phone || "",
      location: location || existingProfile?.location || "",
      verificationStatus: role === "buyer" ? "not_required" : role === "staff" || role === "admin" ? "approved" : existingProfile?.verificationStatus ?? "incomplete",
      updatedAt: Timestamp.now(),
      ...(existing.exists ? {} : { createdAt: Timestamp.now() }),
    };
    await userRef.set(profile, { merge: true });
    await adminAuth().setCustomUserClaims(user.uid, { role });
    return Response.json({ profile });
  } catch (error) {
    console.error("Could not create the account profile.", error);
    return jsonError("We could not save your account details.", 500);
  }
}
