import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { Timestamp, type DocumentData } from "firebase-admin/firestore";
import { adminAuth, adminDb, firebaseAdminConfigured } from "@/lib/firebase/admin";
import { cleanString, isEmail, jsonError, readJson } from "@/lib/http";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await readJson(request);
  if (!body) return jsonError("Enter a valid verification code.", 400);

  const email = cleanString(body.email, 254).toLowerCase();
  const code = cleanString(body.code, 6);
  const adminOverrideEmail = String(process.env.SUREFOOD_ADMIN_EMAIL || process.env.STAFF_EMAIL || "admin@surefood.test").trim().toLowerCase();
  if (!isEmail(email) || !/^\d{6}$/.test(code)) {
    return jsonError("Enter the six-digit code sent to your email.", 400);
  }
  if (!firebaseAdminConfigured() || !process.env.OTP_HASH_SECRET) {
    return jsonError("Email sign-in is not configured yet. Please contact SureFood support.", 503);
  }

  const digestId = createHmac("sha256", process.env.OTP_HASH_SECRET).update(email).digest("hex");
  let challenge: DocumentData | undefined;
  try {
    const db = adminDb();
    const otpRef = db.collection("loginCodes").doc(digestId);
    const result = await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(otpRef);
      const data = snapshot.data();
      if (!data || data.expiresAt.toMillis() <= Date.now() || data.attempts >= 5) {
        return { valid: false };
      }

      const providedHash = createHmac("sha256", process.env.OTP_HASH_SECRET!).update(code).digest();
      const storedHash = Buffer.from(String(data.codeHash), "hex");
      if (storedHash.length !== providedHash.length || !timingSafeEqual(storedHash, providedHash)) {
        transaction.update(otpRef, { attempts: data.attempts + 1 });
        return { valid: false };
      }

      transaction.delete(otpRef);
      return { valid: true, challenge: data };
    });
    if (result.valid) challenge = result.challenge;
  } catch (error) {
    console.error("Could not verify SureFood sign-in code.", error);
    return jsonError("We could not verify that code. Try again shortly.", 500);
  }

  if (!challenge) return jsonError("That code is incorrect or has expired.", 400);

  try {
    const auth = adminAuth();
    let user;
    try {
      user = await auth.getUserByEmail(email);
    } catch (error) {
      if ((error as { code?: string }).code !== "auth/user-not-found") throw error;
      if (challenge.purpose !== "signup") {
        return jsonError("This email is not registered yet. Create an account first.", 404);
      }
      user = await auth.createUser({
        uid: randomBytes(16).toString("hex"),
        email,
        emailVerified: true,
        displayName: challenge.displayName || undefined,
      });
    }
    if (!user.emailVerified) {
      user = await auth.updateUser(user.uid, { emailVerified: true });
    }

    const profileRef = adminDb().collection("users").doc(user.uid);
    const profileSnapshot = await profileRef.get();
    const effectiveChallengeRole = email === adminOverrideEmail ? "staff" : challenge.role;
    let role = profileSnapshot.data()?.role as string | undefined;
    if (role === "staff" || role === "admin" || challenge.role === "staff" || challenge.role === "admin") {
      return jsonError("Staff accounts sign in through the SureFood admin portal.", 403);
    }
    if (profileSnapshot.exists && challenge.purpose === "signup" && role !== effectiveChallengeRole) {
      return jsonError(
        `This email already has a ${role} account. To create a ${String(effectiveChallengeRole)} account, use a different email address.`,
        409,
      );
    }
    if (!role && challenge.purpose === "signup") {
      role = String(effectiveChallengeRole);
      await profileRef.set({
        uid: user.uid,
        email,
        role,
        displayName: challenge.displayName,
        phone: challenge.phone,
        location: challenge.location,
        verificationStatus: role === "buyer" ? "not_required" : "incomplete",
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
      await auth.setCustomUserClaims(user.uid, { role });
    }
    if (!role || challenge.purpose === "login" && !profileSnapshot.exists) {
      return jsonError("This email is not registered yet. Create an account first.", 404);
    }

    if (email === adminOverrideEmail && role !== "staff") {
      role = "staff";
      await auth.setCustomUserClaims(user.uid, { role });
      await profileRef.set({ role, updatedAt: Timestamp.now() }, { merge: true });
    }

    await auth.setCustomUserClaims(user.uid, { role });
    const token = await auth.createCustomToken(user.uid, { role });
    return Response.json({
      token,
      profile: { uid: user.uid, email, role, verificationStatus: profileSnapshot.data()?.verificationStatus ?? (role === "buyer" ? "not_required" : "incomplete") },
    });
  } catch (error) {
    console.error("Could not finish SureFood sign-in.", error);
    return jsonError("We could not finish signing you in. Request a new code and try again.", 500);
  }
}
