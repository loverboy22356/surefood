import { timingSafeEqual } from "node:crypto";
import { Timestamp } from "firebase-admin/firestore";
import { adminAuth, adminDb, firebaseAdminConfigured } from "@/lib/firebase/admin";
import { cleanString, isEmail, jsonError, readJson } from "@/lib/http";

export const runtime = "nodejs";

function matchesSecret(provided: string, expected: string) {
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);
  return providedBuffer.length === expectedBuffer.length && timingSafeEqual(providedBuffer, expectedBuffer);
}

export async function POST(request: Request) {
  if (!firebaseAdminConfigured()) {
    return jsonError("Admin account setup is not configured. Set up Firebase Admin on the server.", 503);
  }

  const setupKey = process.env.SUREFOOD_ADMIN_SETUP_KEY;
  if (!setupKey || setupKey.length < 32) {
    return jsonError("Admin account setup is disabled. Configure a setup key with at least 32 characters.", 503);
  }

  const body = await readJson(request);
  if (!body) return jsonError("Enter admin account details.", 400);
  const email = cleanString(body.email, 254).toLowerCase();
  const password = typeof body.password === "string" ? body.password : "";
  const providedKey = typeof body.setupKey === "string" ? body.setupKey : "";
  const adminEmail = String(process.env.SUREFOOD_ADMIN_EMAIL || process.env.STAFF_EMAIL || "admin@surefood.test").trim().toLowerCase();

  if (providedKey.length !== setupKey.length || !matchesSecret(providedKey, setupKey)) {
    return jsonError("The admin setup key is incorrect.", 403);
  }
  if (!isEmail(email) || email !== adminEmail) {
    return jsonError("Use the configured SureFood admin email address.", 403);
  }
  if (password.length < 8 || password.length > 128) {
    return jsonError("Use a password between 8 and 128 characters.", 400);
  }

  try {
    const auth = adminAuth();
    let user;
    try {
      user = await auth.getUserByEmail(email);
      const existingProfile = await adminDb().collection("users").doc(user.uid).get();
      const existingRole = existingProfile.data()?.role;
      if (existingProfile.exists && existingRole !== "staff" && existingRole !== "admin") {
        return jsonError("This email already belongs to a non-admin account.", 409);
      }
      user = await auth.updateUser(user.uid, { password });
    } catch (error) {
      if ((error as { code?: string }).code !== "auth/user-not-found") throw error;
      user = await auth.createUser({ email, password, emailVerified: false });
    }

    const userRef = adminDb().collection("users").doc(user.uid);
    const existingProfile = await userRef.get();
    const profile = {
      uid: user.uid,
      email,
      role: "staff",
      displayName: cleanString(user.displayName || email.split("@")[0], 100),
      phone: existingProfile.data()?.phone || "",
      location: existingProfile.data()?.location || "",
      verificationStatus: "approved",
      updatedAt: Timestamp.now(),
      ...(existingProfile.exists ? {} : { createdAt: Timestamp.now() }),
    };
    await userRef.set(profile, { merge: true });
    await auth.setCustomUserClaims(user.uid, { role: "staff" });
    const token = await auth.createCustomToken(user.uid, { role: "staff" });
    return Response.json({ token, profile });
  } catch (error) {
    console.error("Could not create the admin account.", error);
    return jsonError("We could not create the admin account. Check Firebase Admin setup and try again.", 500);
  }
}