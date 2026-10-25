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

type NominatimAddress = {
  city?: string;
  town?: string;
  village?: string;
  suburb?: string;
  municipality?: string;
  county?: string;
  district?: string;
  state?: string;
  country_code?: string;
};

/**
 * Naming the city for a GPS fix. The browser only gives coordinates, so the
 * coordinates are resolved to a place through OpenStreetMap's public geocoder.
 */
async function reverseGeocode(latitude: number, longitude: number) {
  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("zoom", "10");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("lat", String(latitude));
  url.searchParams.set("lon", String(longitude));

  const response = await fetch(url, {
    headers: {
      // Nominatim asks every client to identify itself.
      "user-agent": "SureFood/1.0 (https://surefoodz.com)",
      accept: "application/json",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`Geocoder returned ${response.status}`);

  const payload = await response.json() as { address?: NominatimAddress };
  const address = payload.address ?? {};
  const region = (address.state ?? "").trim();
  const rawCity = (address.city || address.town || address.village || address.municipality || address.county || address.suburb || region).trim();
  const country = (address.country_code ?? "").trim().toUpperCase();
  return { city: cityName(rawCity, region), country: /^[A-Z]{2}$/.test(country) ? country : "", region };
}

// Places whose geocoded name is administrative rather than the name buyers use.
const CITY_ALIASES: Record<string, string> = {
  "Federal Capital Territory": "Abuja",
  "FCT": "Abuja",
  "Municipal Area Council": "Abuja",
  "Abuja Municipal": "Abuja",
};

function cityName(rawCity: string, region: string) {
  for (const candidate of [rawCity, region]) {
    const alias = CITY_ALIASES[candidate];
    if (alias) return alias;
  }
  return rawCity;
}

/**
 * Reads the visitor's location. Without coordinates it uses the edge/CDN
 * geolocation headers; with ?lat&lon (the browser's GPS fix) it names that place.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const latitude = Number(url.searchParams.get("lat"));
  const longitude = Number(url.searchParams.get("lon"));

  if (Number.isFinite(latitude) && Number.isFinite(longitude) && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180) {
    try {
      const place = await reverseGeocode(latitude, longitude);
      return Response.json(
        {
          ...place,
          language: place.country ? languageForCountry(place.country) : "",
          source: "gps",
        },
        { headers: { "cache-control": "private, no-store" } },
      );
    } catch (error) {
      console.error("Could not name the shared location.", error);
      return Response.json(
        { country: "", city: "", region: "", language: "", error: "We could not name your location." },
        { status: 502, headers: { "cache-control": "private, no-store" } },
      );
    }
  }

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
      source: validCountry ? "network" : "",
    },
    { headers: { "cache-control": "private, no-store" } },
  );
}
