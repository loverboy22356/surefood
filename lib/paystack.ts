import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

const paystackBaseUrl = "https://api.paystack.co";

type PaystackEnvelope<T> = {
  status: boolean;
  message?: string;
  data?: T;
};

export type PaystackTransaction = {
  status: string;
  reference: string;
  amount: number;
  currency: string;
  metadata?: { orderId?: string; customerId?: string };
};

function secretKey() {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) throw new Error("PAYSTACK_NOT_CONFIGURED");
  return secret;
}

export function paystackConfigured() {
  return Boolean(process.env.PAYSTACK_SECRET_KEY);
}

export async function paystackRequest<T>(path: string, init: RequestInit = {}) {
  const response = await fetch(`${paystackBaseUrl}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${secretKey()}`,
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...init.headers,
    },
    signal: AbortSignal.timeout(15_000),
  });
  const result = await response.json() as PaystackEnvelope<T>;
  if (!response.ok || result.status !== true || result.data === undefined) {
    throw new Error(`PAYSTACK_REQUEST_FAILED:${result.message || response.status}`);
  }
  return result.data;
}

export function validPaystackSignature(rawBody: string, signature: string | null) {
  if (!signature) return false;
  const expected = createHmac("sha512", secretKey()).update(rawBody).digest();
  let received: Buffer;
  try {
    received = Buffer.from(signature, "hex");
  } catch {
    return false;
  }
  return received.length === expected.length && timingSafeEqual(received, expected);
}

export function paystackAppBaseUrl() {
  const value = process.env.APP_BASE_URL?.trim();
  if (!value) throw new Error("APP_BASE_URL_NOT_CONFIGURED");
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("APP_BASE_URL_INVALID");
  }
  if (!["http:", "https:"].includes(url.protocol) ||
      (url.protocol === "http:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1")) {
    throw new Error("APP_BASE_URL_INVALID");
  }
  return url.origin;
}
