import { createHmac, randomInt, randomUUID } from "node:crypto";
import { Timestamp } from "firebase-admin/firestore";
import { adminAuth, adminDb, firebaseAdminConfigured } from "@/lib/firebase/admin";
import { cleanString, isEmail, jsonError, readJson } from "@/lib/http";

export const runtime = "nodejs";

const signupRoles = ["buyer", "vendor", "supplier"] as const;

function getAdminOverrideEmail() {
  return String(process.env.SUREFOOD_ADMIN_EMAIL || process.env.STAFF_EMAIL || "admin@surefood.test").trim().toLowerCase();
}

export async function POST(request: Request) {
  const body = await readJson(request);
  if (!body) return jsonError("Enter valid request details.", 400);

  const email = cleanString(body.email, 254).toLowerCase();
  const purpose = body.purpose;
  const role = cleanString(body.role, 20);
  const displayName = cleanString(body.displayName, 100);
  const phone = cleanString(body.phone, 24);
  const location = cleanString(body.location, 180);
  const effectiveRole = email === getAdminOverrideEmail() ? "staff" : role;

  if (!isEmail(email)) return jsonError("Enter a valid email address.", 400);
  if (purpose !== "signup" && purpose !== "login") return jsonError("Choose signup or login.", 400);
  if (purpose === "signup" && email === getAdminOverrideEmail()) {
    return jsonError("Create or access the SureFood admin account from the admin portal.", 403);
  }
  if (purpose === "signup" && (!signupRoles.includes(effectiveRole as (typeof signupRoles)[number]) || !displayName || !phone || !location)) {
    return jsonError("Sign-up requires a role, name, phone number, and location.", 400);
  }
  const otpHashSecret = process.env.OTP_HASH_SECRET;
  const brevoApiKey = process.env.BREVO_API_KEY;
  const brevoSenderEmail = process.env.BREVO_SENDER_EMAIL;
  if (!firebaseAdminConfigured() || !otpHashSecret || !brevoApiKey || !brevoSenderEmail) {
    const missingConfiguration = [
      ["Firebase Admin service account", firebaseAdminConfigured() ? "configured" : ""],
      ["OTP_HASH_SECRET", otpHashSecret],
      ["BREVO_API_KEY", brevoApiKey],
      ["BREVO_SENDER_EMAIL", brevoSenderEmail],
    ].filter(([, value]) => !value).map(([name]) => name);
    console.error("Email sign-in is missing server configuration.", missingConfiguration);
    return jsonError(`Email sign-in is not configured. Missing server setting${missingConfiguration.length === 1 ? "" : "s"}: ${missingConfiguration.join(", ")}.`, 503);
  }

  if (purpose === "login") {
    try {
      const user = await adminAuth().getUserByEmail(email);
      const profile = await adminDb().collection("users").doc(user.uid).get();
      if (profile.data()?.role === "staff" || profile.data()?.role === "admin") {
        return jsonError("Staff accounts sign in through the SureFood admin portal.", 403);
      }
    } catch (error) {
      // A missing account is fine — the code is still sent and verify-code rejects
      // unknown emails. Any other lookup failure (a slow or unhappy Admin API) must
      // not lock a real customer out of signing in: verify-code re-checks the role
      // from the stored profile before issuing a session.
      if ((error as { code?: string }).code !== "auth/user-not-found") {
        console.error("Could not check the sign-in account role; continuing without it.", error);
      }
    }
  }

  const digestId = createHmac("sha256", otpHashSecret).update(email).digest("hex");
  const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
  const sentAt = Date.now();
  const emailBody = {
    sender: {
      name: process.env.BREVO_SENDER_NAME || "SureFood",
      email: brevoSenderEmail,
    },
    to: [{ email }],
    subject: purpose === "signup" ? "Your SureFood sign-up code" : "Your SureFood sign-in code",
    textContent: `Your SureFood verification code is ${code}. It expires in 10 minutes. If you did not request this code, ignore this email.`,
  };

  try {
    const otpRef = adminDb().collection("loginCodes").doc(digestId);
    await adminDb().runTransaction(async (transaction) => {
      const existing = await transaction.get(otpRef);
      const previousSentAt = existing.data()?.sentAt ?? 0;
      if (sentAt - previousSentAt < 60_000) {
        throw new Error("CODE_RATE_LIMIT");
      }
      const requestCount = existing.data()?.requestCount ?? 0;
      const hourAgo = sentAt - 60 * 60 * 1000;
      const requestsThisHour = existing.data()?.windowStartedAt >= hourAgo
        ? requestCount
        : 0;
      if (requestsThisHour >= 5) throw new Error("CODE_RATE_LIMIT");

      transaction.set(otpRef, {
        codeHash: createHmac("sha256", otpHashSecret).update(code).digest("hex"),
        purpose,
        role: purpose === "signup" ? effectiveRole : null,
        displayName: purpose === "signup" ? displayName : null,
        phone: purpose === "signup" ? phone : null,
        location: purpose === "signup" ? location : null,
        attempts: 0,
        requestCount: requestsThisHour + 1,
        windowStartedAt: requestsThisHour ? existing.data()?.windowStartedAt : sentAt,
        sentAt,
        expiresAt: Timestamp.fromMillis(sentAt + 10 * 60 * 1000),
      });
    });

    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        accept: "application/json",
        "api-key": brevoApiKey,
        "content-type": "application/json",
      },
      body: JSON.stringify(emailBody),
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });

    if (!response.ok) {
      console.error("Brevo rejected a verification email.", response.status);
      await adminDb().runTransaction(async (transaction) => {
        const latest = await transaction.get(otpRef);
        if (latest.data()?.codeHash === createHmac("sha256", otpHashSecret).update(code).digest("hex")) {
          transaction.delete(otpRef);
        }
      });
      return jsonError("We could not send the verification code. Try again shortly.", 502);
    }

    return Response.json({ ok: true, message: "Check your email for a verification code." });
  } catch (error) {
    if (error instanceof Error && error.message === "CODE_RATE_LIMIT") {
      return jsonError("Please wait before requesting another code.", 429);
    }
    console.error("Could not send a SureFood verification email.", error);
    if (error instanceof DOMException && error.name === "TimeoutError") {
      return jsonError("The email provider did not respond in time. Please try again shortly.", 504);
    }
    return jsonError("We could not send the verification code. Try again shortly.", 500);
  }
}
