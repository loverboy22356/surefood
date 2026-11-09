import { jsonError } from "@/lib/http";

export const runtime = "nodejs";

type RatesPayload = {
  base: "NGN";
  updatedAt: string;
  rates: Record<string, number>;
};

let cached: { data: RatesPayload; at: number } | null = null;
const CACHE_MS = 6 * 60 * 60 * 1000;

// Currency moves slowly and is identical for every visitor, so the edge holds it
// too: a page load otherwise waits on a round trip through the server.
const RATES_CACHE_HEADERS = { "cache-control": "public, max-age=60, s-maxage=600, stale-while-revalidate=3600" } as const;

export async function GET() {
  if (cached && Date.now() - cached.at < CACHE_MS) {
    return Response.json(cached.data, { headers: RATES_CACHE_HEADERS });
  }
  try {
    const response = await fetch("https://open.er-api.com/v6/latest/NGN", {
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
    const data = await response.json();
    if (data.result !== "success" || typeof data.rates !== "object" || !data.rates) {
      throw new Error("The exchange-rate service returned an unexpected response.");
    }
    const rates = Object.fromEntries(
      Object.entries(data.rates as Record<string, unknown>)
        .map(([code, value]) => [code.toUpperCase(), Number(value)])
        .filter(([code, value]) => /^[A-Z]{3}$/.test(String(code)) && Number.isFinite(value) && Number(value) > 0),
    );
    const payload: RatesPayload = {
      base: "NGN",
      updatedAt: String(data.time_last_update_utc ?? new Date().toUTCString()),
      rates: { NGN: 1, ...rates },
    };
    cached = { data: payload, at: Date.now() };
    return Response.json(payload, { headers: RATES_CACHE_HEADERS });
  } catch (error) {
    console.error("Could not load exchange rates.", error);
    if (cached) return Response.json(cached.data);
    return jsonError("Exchange rates are temporarily unavailable.", 502);
  }
}
