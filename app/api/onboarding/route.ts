import { Timestamp } from "firebase-admin/firestore";
import { Country } from "country-state-city";
import { authenticatedUser } from "@/lib/auth/server";
import { createActivity } from "@/lib/activity";
import { adminDb } from "@/lib/firebase/admin";
import { requiredSellerDocuments, sellerNeedsBusinessRegistration, type SellerDocumentType } from "@/lib/auth/seller-verification";
import { findVerificationDocument } from "@/lib/cloudinary-server";
import { cleanString, jsonError, readJson } from "@/lib/http";
import { smileIdBusinessVerificationConfigured, submitBusinessCheck } from "@/lib/smile-id";

export const runtime = "nodejs";

const businessTypes = new Set(["bn", "co", "it"]);
const registryCountries = new Set(["NG", "ZA", "KE"]);
const countries = new Set(Country.getAllCountries().map(({ isoCode }) => isoCode));
const documentTypes: SellerDocumentType[] = ["business-registration", "proof-of-address", "nin"];

function documentLabel(documentType: SellerDocumentType) {
  return documentType === "business-registration"
    ? "business registration"
    : documentType === "proof-of-address"
      ? "proof of address"
      : "NIN";
}

export async function POST(request: Request) {
  const user = await authenticatedUser(request);
  if (!user) return jsonError("Sign in to submit business verification.", 401);
  if (user.role !== "vendor" && user.role !== "supplier") {
    return jsonError("Only vendor and supplier accounts can submit business verification.", 403);
  }

  const body = await readJson(request);
  if (!body) return jsonError("Enter valid business details.", 400);
  const requiresRegistration = sellerNeedsBusinessRegistration(user.role);
  const businessName = cleanString(body.businessName, 150);
  const registrationNumber = requiresRegistration ? cleanString(body.registrationNumber, 80).toUpperCase() : "";
  const country = cleanString(body.country, 5).toUpperCase();
  const businessType = cleanString(body.businessType, 2);
  const skipAutomaticRegistryCheck = body.skipAutomaticRegistryCheck === true;
  const address = cleanString(body.address, 240);
  const city = cleanString(body.city, 100);
  const region = cleanString(body.region, 100);
  const postalCode = cleanString(body.postalCode, 20);
  const latitude = Number(body.latitude);
  const longitude = Number(body.longitude);
  const hasCoordinates = Number.isFinite(latitude) && Number.isFinite(longitude) &&
    Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180;
  if (!businessName || !countries.has(country) || !address || !city || !region) {
    return jsonError("Business name, valid country, and full business address are required.", 400);
  }
  if (requiresRegistration && !registrationNumber) {
    return jsonError("Enter your business registration number.", 400);
  }
  const automaticRegistryAvailable = requiresRegistration &&
    registryCountries.has(country) &&
    smileIdBusinessVerificationConfigured() &&
    !skipAutomaticRegistryCheck;
  if (automaticRegistryAvailable && country === "NG" && !/^(?:(?:RC|BN)\s*)?\d{5,12}$/i.test(registrationNumber)) {
    return jsonError("Enter a valid CAC registration number using digits, with an optional RC or BN prefix.", 400);
  }
  if (automaticRegistryAvailable && country === "NG" && !businessTypes.has(businessType)) {
    return jsonError("Choose a valid Nigerian business registration type.", 400);
  }
  if (automaticRegistryAvailable && country === "KE" && !/^\d{5}$/.test(postalCode)) {
    return jsonError("Enter the 5-digit postal code required to check a Kenyan business registration.", 400);
  }

  try {
    const db = adminDb();
    const profileRef = db.collection("users").doc(user.uid);
    const profileSnapshot = await profileRef.get();
    if (!profileSnapshot.exists || profileSnapshot.data()?.role !== user.role) {
      return jsonError("Complete your account profile before business verification.", 409);
    }
    const currentStatus = String(profileSnapshot.data()?.verificationStatus ?? "");
    if (currentStatus === "approved") return jsonError("This business account is already approved.", 409);
    if (["pending_review", "manual_review", "registry_check_pending", "registry_check_submitting"].includes(currentStatus)) {
      return jsonError("Your application is already waiting for staff review.", 409);
    }

    const documentPaths = profileSnapshot.data()?.business?.documentPaths as Record<string, string> | undefined;
    const missingDocuments = requiredSellerDocuments(user.role).filter((documentType) => !documentPaths?.[documentType]);
    if (missingDocuments.length) {
      return jsonError(
        `Upload your ${missingDocuments.map(documentLabel).join(", ")} before submitting your application.`,
        400,
      );
    }

    const jobId = `surefood-${user.uid}-${crypto.randomUUID()}`;
    const business = {
      businessName,
      registrationNumber,
      country,
      businessType,
      address,
      city,
      region,
      postalCode,
      documentPaths,
      ...(hasCoordinates ? { latitude, longitude } : {}),
    };
    if (!automaticRegistryAvailable) {
      await profileRef.set({
        business,
        verificationStatus: "manual_review",
        verificationReviewNote: requiresRegistration
          ? "This application requires staff to verify the business registration against the official registry and review all submitted documents."
          : "Vendor application: staff review the proof of address and NIN document. No business registration is required for vendors.",
        registryStatus: requiresRegistration ? "manual_review" : "not_required",
        registryJobId: "",
        addressReviewStatus: "pending",
        submittedAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      }, { merge: true });
      return Response.json({
        verificationStatus: "manual_review",
        registryStatus: requiresRegistration ? "manual_review" : "not_required",
        message: requiresRegistration
          ? "Your application was submitted for manual review. Staff will verify the registration with the official registry and review all documents. You cannot list products until approved."
          : "Your application was submitted for manual review. Staff will review your proof of address and NIN document. You cannot list products until approved.",
      }, { status: 202 });
    }

    await profileRef.set({
      business,
      verificationStatus: "registry_check_submitting",
      verificationReviewNote: "",
      registryStatus: "submitting",
      registryJobId: jobId,
      addressReviewStatus: "pending",
      submittedAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    }, { merge: true });

    try {
      const acknowledgment = await submitBusinessCheck({
        userId: user.uid,
        jobId,
        country: country as "NG" | "KE" | "ZA",
        registrationNumber,
        ...(country === "NG" ? { businessType: businessType as "bn" | "co" | "it" } : {}),
        ...(country === "KE" ? { postalCode, postalAddress: address } : {}),
      });
      await db.runTransaction(async (transaction) => {
        const latest = await transaction.get(profileRef);
        const data = latest.data();
        if (data?.registryJobId !== jobId || data.registryStatus !== "submitting") return;
        transaction.set(profileRef, {
          verificationStatus: "registry_check_pending",
          registryStatus: "pending",
          smileJobId: acknowledgment.smileJobId,
          updatedAt: Timestamp.now(),
        }, { merge: true });
      });
      return Response.json({
        verificationStatus: "registry_check_pending",
        registryStatus: "pending",
        message: "Your business registration number is being checked against the official registry. We will update your application when the automated check finishes.",
      }, { status: 202 });
    } catch (error) {
      console.error("Could not submit automatic business registry verification.", error);
      await profileRef.set({
        verificationStatus: "submission_failed",
        registryStatus: "submission_failed",
        verificationReviewNote: "The automatic registry check could not be started. Please try again later.",
        updatedAt: Timestamp.now(),
      }, { merge: true });
      return jsonError("The automatic business registry check could not be started. No application was approved; please try again later.", 502);
    }
  } catch (error) {
    console.error("Could not submit business verification.", error);
    return jsonError(error instanceof Error ? error.message : "We could not submit business verification.", 502);
  }
}

export async function GET(request: Request) {
  const user = await authenticatedUser(request);
  if (!user) return jsonError("Sign in to view verification status.", 401);
  try {
    const snapshot = await adminDb().collection("users").doc(user.uid).get();
    if (!snapshot.exists) return jsonError("Account profile not found.", 404);
    const data = snapshot.data()!;
    const rawDocumentPaths = (data.business?.documentPaths ?? {}) as Record<string, string>;
    const validDocumentPaths: Record<string, string> = {};
    for (const documentType of documentTypes) {
      const publicId = rawDocumentPaths[documentType];
      if (publicId && await findVerificationDocument(user.uid, documentType, publicId)) {
        validDocumentPaths[documentType] = publicId;
      }
    }
    if (JSON.stringify(rawDocumentPaths) !== JSON.stringify(validDocumentPaths)) {
      await snapshot.ref.set({
        business: {
          ...(data.business ?? {}),
          documentPaths: validDocumentPaths,
        },
        updatedAt: Timestamp.now(),
      }, { merge: true });
    }
    return Response.json({
      role: data.role === "supplier" ? "supplier" : "vendor",
      approvalFeeMinor: Number(data.approvalFeeMinor ?? Number(data.approvalFee) * 100) || 0,
      approvalFeeCurrency: data.approvalFeeCurrency ?? "NGN",
      approvalFeeStatus: data.approvalFeeStatus ?? (data.verificationStatus === "approved" ? "paid" : "not_required"),
      verificationStatus: data.verificationStatus ?? "incomplete",
      registryStatus: data.registryStatus ?? "not_checked",
      automaticVerificationConfigured: smileIdBusinessVerificationConfigured(),
      verificationReviewNote: data.verificationReviewNote ?? "",
      documents: {
        businessRegistration: Boolean(validDocumentPaths["business-registration"]),
        proofOfAddress: Boolean(validDocumentPaths["proof-of-address"]),
        nin: Boolean(validDocumentPaths.nin),
      },
      business: data.business ? {
        businessName: data.business.businessName,
        registrationNumber: data.business.registrationNumber,
        country: data.business.country,
        businessType: data.business.businessType,
        address: data.business.address,
        city: data.business.city,
        region: data.business.region,
        postalCode: data.business.postalCode,
      } : null,
    });
  } catch (error) {
    console.error("Could not read verification status.", error);
    return jsonError("We could not load verification status.", 500);
  }
}
