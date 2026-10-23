import { Timestamp } from "firebase-admin/firestore";
import { createActivity } from "@/lib/activity";
import { adminDb } from "@/lib/firebase/admin";
import { normalizeBusinessRegistryNumber, verifySmileSignature } from "@/lib/smile-id";

export const runtime = "nodejs";

type SmileBusinessResult = {
  timestamp?: unknown;
  signature?: unknown;
  ResultCode?: unknown;
  ResultText?: unknown;
  success?: unknown;
  Actions?: { Verify_Business?: unknown };
  PartnerParams?: { job_id?: unknown; user_id?: unknown };
  company_information?: {
    registration_number?: unknown;
    legal_name?: unknown;
    status?: unknown;
  };
};

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 1_500_000) return Response.json({ error: "Callback payload is too large." }, { status: 413 });

  let result: SmileBusinessResult;
  try {
    result = await request.json() as SmileBusinessResult;
  } catch {
    return Response.json({ error: "Invalid verification callback." }, { status: 400 });
  }

  if (typeof result.timestamp !== "string" || typeof result.signature !== "string") {
    return Response.json({ error: "Invalid verification callback signature." }, { status: 401 });
  }
  try {
    if (!verifySmileSignature(result.timestamp, result.signature)) {
      return Response.json({ error: "Invalid verification callback signature." }, { status: 401 });
    }
  } catch (error) {
    console.error("Smile ID callback verification is not configured.", error);
    return Response.json({ error: "Automated verification is not configured." }, { status: 503 });
  }

  const userId = result.PartnerParams?.user_id;
  const jobId = result.PartnerParams?.job_id;
  if (typeof userId !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(userId) ||
      typeof jobId !== "string" || jobId.length > 200) {
    return Response.json({ error: "Invalid verification job reference." }, { status: 400 });
  }

  try {
    const db = adminDb();
    const profileRef = db.collection("users").doc(userId);
    const outcome = await db.runTransaction(async (transaction) => {
      const profile = await transaction.get(profileRef);
      const data = profile.data();
      if (!profile.exists || data?.registryJobId !== jobId) return "stale";
      if (!["submitting", "pending"].includes(String(data.registryStatus))) return "duplicate";
      if (data.role !== "vendor" && data.role !== "supplier") return "stale";

      const business = data.business ?? {};
      const registryBusiness = result.company_information;
      const registrationMatches = normalizeBusinessRegistryNumber(
        String(business.country ?? ""),
        business.registrationNumber,
      ) === normalizeBusinessRegistryNumber(
        String(business.country ?? ""),
        registryBusiness?.registration_number,
      );
      const nameMatches = normalizeBusinessName(business.businessName) !== "" &&
        normalizeBusinessName(business.businessName) === normalizeBusinessName(registryBusiness?.legal_name);
      const verified = result.ResultCode === "1012" &&
        result.Actions?.Verify_Business === "Verified" &&
        result.success === true &&
        String(registryBusiness?.status ?? "").toUpperCase() === "ACTIVE" &&
        registrationMatches &&
        nameMatches;

      transaction.set(profileRef, {
        verificationStatus: verified ? "pending_review" : "rejected",
        registryStatus: verified ? "verified" : "rejected",
        registryCheck: {
          resultCode: typeof result.ResultCode === "string" ? result.ResultCode : "",
          registrationMatches,
          businessNameMatches: nameMatches,
          active: String(registryBusiness?.status ?? "").toUpperCase() === "ACTIVE",
          checkedAt: Timestamp.now(),
        },
        verificationReviewNote: verified
          ? "The official business registry confirmed the registration number and registered name. Identity and address checks are still pending."
          : "The automatic business registry check could not confirm an active registration matching the submitted number and business name. Check your details and resubmit.",
        updatedAt: Timestamp.now(),
      }, { merge: true });
      createActivity(transaction, {
        actorUid: userId,
        actorRole: String(data.role),
        targetUserId: userId,
        action: verified ? "verification_registry_passed" : "verification_registry_failed",
        targetType: "business_verification",
        targetId: userId,
        summary: verified
          ? "Automatic business registry verification passed."
          : "Automatic business registry verification did not confirm the submitted details.",
      });
      return verified ? "verified" : "rejected";
    });

    if (outcome === "stale") return Response.json({ received: true, ignored: true });
    if (outcome === "duplicate") return Response.json({ received: true, duplicate: true });
    return Response.json({ received: true, registryStatus: outcome });
  } catch (error) {
    console.error("Could not process Smile ID business verification callback.", error);
    return Response.json({ error: "Could not process verification result." }, { status: 500 });
  }
}

function normalizeBusinessName(value: unknown) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\b(LIMITED|LTD|PLC|LLC)\b/g, "")
    .replace(/[^A-Z0-9]/g, "");
}
