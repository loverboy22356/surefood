import { languageForCountry } from "@/lib/geo";

export const runtime = "nodejs";

const COUNTRY_HEADERS = ["x-vercel-ip-country", "cf-ipcountry", "x-country-code", "x-geo-country"];
const CITY_HEADERS = ["x-vercel-ip-city", "cf-ipcity", "x-geo-city"];
const REGION_HEADERS = ["x-vercel-ip-country-region", "x-vercel-ip-region", "cf-region-code", "cf-region"];

function firstHeader(headers: Headers, names: string[]) {
  for (const name of names) {
    const value = headers.get(name)?.trim();
    if (value) return value;
  }
  return "";
}

function decode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * Reads the visitor's location in the background from the edge/CDN geolocation headers.
 * No permission prompt and no GPS: the browser falls back to its own timezone/locale
 * when the site is served without a geolocation-aware CDN.
 */
export async function GET(request: Request) {
  const country = firstHeader(request.headers, COUNTRY_HEADERS).toUpperCase();
  const city = decode(firstHeader(request.headers, CITY_HEADERS));
  const region = decode(firstHeader(request.headers, REGION_HEADERS));
  const validCountry = /^[A-Z]{2}$/.test(country) ? country : "";

  return Response.json(
    {
      country: validCountry,
      city: validCountry ? city : "",
      region: validCountry ? region : "",
      language: validCountry ? languageForCountry(validCountry) : "",
    },
    { headers: { "cache-control": "private, no-store" } },
  );
}
