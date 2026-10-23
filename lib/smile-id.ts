import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

export type BusinessCheckInput = {
  userId: string;
  jobId: string;
  country: "NG" | "KE" | "ZA";
  registrationNumber: string;
  businessType?: "bn" | "co" | "it";
  postalCode?: string;
  postalAddress?: string;
};

export function normalizeBusinessRegistryNumber(country: string, value: unknown) {
  const registrationNumber = String(value ?? "").toUpperCase();
  if (country === "NG") return registrationNumber.replace(/^(RC|BN)\s*/i, "").replace(/\D/g, "");
  return registrationNumber.replace(/[^A-Z0-9]/g, "");
}

function smileCredentials() {
  const partnerId = process.env.SMILE_ID_PARTNER_ID;
  const apiKey = process.env.SMILE_ID_API_KEY;
  const callbackUrl = process.env.SMILE_ID_CALLBACK_URL;
  if (!partnerId || !apiKey || !callbackUrl || !isPublicHttpsUrl(callbackUrl)) {
    throw new Error("Smile ID is not configured. Set its partner ID, API key, and callback URL.");
  }
  return { partnerId, apiKey, callbackUrl };
}

function isPublicHttpsUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1";
  } catch {
    return false;
  }
}

export function smileIdBusinessVerificationConfigured() {
  const environment = process.env.SMILE_ID_ENVIRONMENT ?? "sandbox";
  return Boolean(
    process.env.SMILE_ID_PARTNER_ID &&
    process.env.SMILE_ID_API_KEY &&
    process.env.SMILE_ID_CALLBACK_URL &&
    isPublicHttpsUrl(process.env.SMILE_ID_CALLBACK_URL) &&
    (environment === "sandbox" || environment === "production"),
  );
}

export async function submitBusinessCheck(input: BusinessCheckInput) {
  const { partnerId, apiKey, callbackUrl } = smileCredentials();
  const timestamp = new Date().toISOString();
  const signature = createHmac("sha256", apiKey)
    .update(`${timestamp}${partnerId}sid_request`, "utf8")
    .digest("base64");
  const { jobId } = input;
  const body = {
    partner_id: partnerId,
    source_sdk: "rest_api",
    source_sdk_version: "1.0.0",
    signature,
    timestamp,
    callback_url: callbackUrl,
    country: input.country,
    id_type: "BUSINESS_REGISTRATION",
    id_number: normalizeBusinessRegistryNumber(input.country, input.registrationNumber),
    ...(input.country === "NG" ? { business_type: input.businessType ?? "co" } : {}),
    ...(input.country === "KE" && input.postalCode ? { postal_code: input.postalCode } : {}),
    ...(input.country === "KE" && input.postalAddress ? { postal_address: input.postalAddress } : {}),
    partner_params: {
      job_id: jobId,
      job_type: 7,
      user_id: input.userId,
    },
  };
  const environment = process.env.SMILE_ID_ENVIRONMENT ?? "sandbox";
  if (environment !== "sandbox" && environment !== "production") {
    throw new Error("SMILE_ID_ENVIRONMENT must be sandbox or production.");
  }
  const url = environment === "production"
    ? "https://api.smileidentity.com/v1/async_business_verification"
    : "https://testapi.smileidentity.com/v1/async_business_verification";
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const responseText = await response.text();
  if (!response.ok) {
    console.error("Smile ID rejected a business verification request.", response.status);
    throw new Error("The business registry verification request was not accepted.");
  }
  let acknowledgment: { SmileJobID?: string };
  try {
    acknowledgment = JSON.parse(responseText);
  } catch (error) {
    console.error("Smile ID returned an invalid business verification acknowledgement.", error);
    throw new Error("The business registry returned an invalid response.");
  }
  if (!acknowledgment.SmileJobID) {
    throw new Error("The business registry returned an invalid acknowledgement.");
  }
  return { jobId, smileJobId: acknowledgment.SmileJobID };
}

export function verifySmileSignature(timestamp: string, signature: string) {
  const { partnerId, apiKey } = smileCredentials();
  if (!timestamp || !signature) return false;
  const expected = createHmac("sha256", apiKey)
    .update(`${timestamp}${partnerId}sid_response`, "utf8")
    .digest();
  let provided: Buffer;
  try {
    provided = Buffer.from(signature, "base64");
  } catch {
    return false;
  }
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}
