import { Country, State } from "country-state-city";

export const runtime = "nodejs";

const cacheHeaders = { "cache-control": "public, max-age=86400, stale-while-revalidate=604800" };

/**
 * Place names for the buyer "Shop by location" picker. The full country/state
 * dataset stays on the server so the storefront bundle does not carry it.
 */
export async function GET(request: Request) {
  const country = new URL(request.url).searchParams.get("country")?.trim().toUpperCase() ?? "";

  if (!country) {
    const countries = Country.getAllCountries()
      .map(({ isoCode, name }) => ({ code: isoCode, name }))
      .sort((left, right) => left.name.localeCompare(right.name));
    return Response.json({ countries }, { headers: cacheHeaders });
  }

  const states = State.getStatesOfCountry(country)
    .map(({ isoCode, name }) => ({ code: isoCode, name }))
    .sort((left, right) => left.name.localeCompare(right.name));
  return Response.json({ country, states }, { headers: cacheHeaders });
}
