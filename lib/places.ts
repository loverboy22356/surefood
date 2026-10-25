export type Coords = { lat: number; lon: number };

/**
 * Coordinates for the cities and states SureFood sellers trade from. They let the
 * shop show a real distance ("1.4 km away") instead of guessing, and they are only
 * used for sorting and labels — never for pricing.
 */
const PLACES: Record<string, Coords> = {
  // Lagos and its districts
  lagos: { lat: 6.5244, lon: 3.3792 },
  ikeja: { lat: 6.6018, lon: 3.3515 },
  "ikeja lagos": { lat: 6.6018, lon: 3.3515 },
  lekki: { lat: 6.4698, lon: 3.5852 },
  ajah: { lat: 6.4667, lon: 3.5667 },
  ikorodu: { lat: 6.6194, lon: 3.5105 },
  yaba: { lat: 6.5095, lon: 3.3711 },
  surulere: { lat: 6.4969, lon: 3.3481 },
  "surulere lagos": { lat: 6.4969, lon: 3.3481 },
  apapa: { lat: 6.4388, lon: 3.3596 },
  festac: { lat: 6.4667, lon: 3.2833 },
  ojo: { lat: 6.46, lon: 3.15 },
  badagry: { lat: 6.415, lon: 2.8813 },
  epe: { lat: 6.5844, lon: 3.9833 },
  agege: { lat: 6.6152, lon: 3.3211 },
  maryland: { lat: 6.5716, lon: 3.3679 },
  magodo: { lat: 6.6200, lon: 3.3700 },
  ketu: { lat: 6.5900, lon: 3.3800 },
  alaba: { lat: 6.4600, lon: 3.1900 },

  // South-east
  aba: { lat: 5.1066, lon: 7.3667 },
  umuahia: { lat: 5.525, lon: 7.4934 },
  owerri: { lat: 5.4836, lon: 7.0333 },
  enugu: { lat: 6.4584, lon: 7.5464 },
  nsukka: { lat: 6.8567, lon: 7.3958 },
  onitsha: { lat: 6.1667, lon: 6.7833 },
  awka: { lat: 6.2109, lon: 7.074 },
  abakaliki: { lat: 6.3249, lon: 8.1137 },
  "port harcourt": { lat: 4.8156, lon: 7.0498 },
  "port-harcourt": { lat: 4.8156, lon: 7.0498 },
  ph: { lat: 4.8156, lon: 7.0498 },
  "port harcourt rivers": { lat: 4.8156, lon: 7.0498 },
  uyo: { lat: 5.0378, lon: 7.9128 },
  "ikot ekpene": { lat: 5.1819, lon: 7.7147 },
  calabar: { lat: 4.9757, lon: 8.3417 },
  asaba: { lat: 6.198, lon: 6.73 },
  warri: { lat: 5.5167, lon: 5.75 },
  yenagoa: { lat: 4.9267, lon: 6.2676 },
  eket: { lat: 4.6423, lon: 7.9244 },
  bonny: { lat: 4.4522, lon: 7.1686 },

  // South-west
  ibadan: { lat: 7.3775, lon: 3.947 },
  abeokuta: { lat: 7.1557, lon: 3.3451 },
  "ijebu ode": { lat: 6.8194, lon: 3.9197 },
  ijebuode: { lat: 6.8194, lon: 3.9197 },
  sagamu: { lat: 6.8485, lon: 3.6467 },
  akure: { lat: 7.2571, lon: 5.2058 },
  "ado ekiti": { lat: 7.6211, lon: 5.2214 },
  "ado-ekiti": { lat: 7.6211, lon: 5.2214 },
  osogbo: { lat: 7.7827, lon: 4.5418 },
  ilesa: { lat: 7.6279, lon: 4.7414 },
  ede: { lat: 7.7364, lon: 4.4353 },
  oyo: { lat: 7.8526, lon: 3.9312 },
  ondo: { lat: 7.0932, lon: 4.8418 },

  // North
  abuja: { lat: 9.0765, lon: 7.3986 },
  "federal capital territory": { lat: 9.0765, lon: 7.3986 },
  fct: { lat: 9.0765, lon: 7.3986 },
  gwagwalada: { lat: 8.9434, lon: 7.0821 },
  kubwa: { lat: 9.1583, lon: 7.3392 },
  kaduna: { lat: 10.5222, lon: 7.4383 },
  zaria: { lat: 11.0855, lon: 7.7199 },
  kano: { lat: 12.0022, lon: 8.592 },
  katsina: { lat: 12.9908, lon: 7.6018 },
  jos: { lat: 9.8965, lon: 8.8583 },
  bauchi: { lat: 10.3103, lon: 9.8439 },
  gombe: { lat: 10.2897, lon: 11.1673 },
  yola: { lat: 9.2035, lon: 12.4954 },
  jalingo: { lat: 8.8833, lon: 11.3667 },
  damaturu: { lat: 11.7479, lon: 11.9608 },
  maiduguri: { lat: 11.8311, lon: 13.151 },
  mubi: { lat: 10.2686, lon: 13.267 },
  "birnin kebbi": { lat: 12.4539, lon: 4.1975 },
  sokoto: { lat: 13.0059, lon: 5.2476 },
  gusau: { lat: 12.1628, lon: 6.6614 },
  dutse: { lat: 11.7563, lon: 9.3387 },
  lafia: { lat: 8.4939, lon: 8.5155 },
  makurdi: { lat: 7.7322, lon: 8.5391 },
  lokoja: { lat: 7.8023, lon: 6.7333 },
  minna: { lat: 9.6139, lon: 6.5569 },
  bida: { lat: 9.0833, lon: 6.0167 },
  ilorin: { lat: 8.4966, lon: 4.5421 },
  wukari: { lat: 7.87, lon: 9.78 },
  otukpo: { lat: 7.19, lon: 8.13 },

  // States, so a seller who only stored a state still gets a distance.
  abia: { lat: 5.4527, lon: 7.5248 },
  anambra: { lat: 6.2109, lon: 7.074 },
  ebonyi: { lat: 6.3249, lon: 8.1137 },
  "rivers": { lat: 4.8156, lon: 7.0498 },
  "cross river": { lat: 4.9757, lon: 8.3417 },
  "akwa ibom": { lat: 5.0378, lon: 7.9128 },
  "delta": { lat: 5.8904, lon: 5.6804 },
  "edo": { lat: 6.335, lon: 5.6037 },
  benin: { lat: 6.335, lon: 5.6037 },
  "benin city": { lat: 6.335, lon: 5.6037 },
  "bayelsa": { lat: 4.9267, lon: 6.2676 },
  ekiti: { lat: 7.6211, lon: 5.2214 },
  kwara: { lat: 8.4966, lon: 4.5421 },
  kogi: { lat: 7.8023, lon: 6.7333 },
  niger: { lat: 9.6139, lon: 6.5569 },
  plateau: { lat: 9.8965, lon: 8.8583 },
  benue: { lat: 7.7322, lon: 8.5391 },
  nasarawa: { lat: 8.4939, lon: 8.5155 },
  borno: { lat: 11.8311, lon: 13.151 },
  adamawa: { lat: 9.2035, lon: 12.4954 },
  taraba: { lat: 8.8833, lon: 11.3667 },
  yobe: { lat: 11.7479, lon: 11.9608 },
  zamfara: { lat: 12.1628, lon: 6.6614 },
  jigawa: { lat: 11.7563, lon: 9.3387 },
  kebbi: { lat: 12.4539, lon: 4.1975 },
  katsina_state: { lat: 12.9908, lon: 7.6018 },

  // Nearby African markets
  accra: { lat: 5.6037, lon: -0.187 },
  nairobi: { lat: -1.2921, lon: 36.8219 },
  johannesburg: { lat: -26.2041, lon: 28.0473 },
  cairo: { lat: 30.0444, lon: 31.2357 },
  "cape town": { lat: -33.9249, lon: 18.4241 },
  cotonou: { lat: 6.3703, lon: 2.3912 },
  lome: { lat: 6.1725, lon: 1.2314 },
  niamey: { lat: 13.5116, lon: 2.1254 },
  yaounde: { lat: 3.848, lon: 11.5021 },
  douala: { lat: 4.0511, lon: 9.7679 },

  // Rest of the world (visitors abroad still get a nearby-first view).
  london: { lat: 51.5074, lon: -0.1278 },
  "new york": { lat: 40.7128, lon: -74.006 },
  toronto: { lat: 43.6532, lon: -79.3832 },
  dubai: { lat: 25.2048, lon: 55.2708 },
  paris: { lat: 48.8566, lon: 2.3522 },
  berlin: { lat: 52.52, lon: 13.405 },
  madrid: { lat: 40.4168, lon: -3.7038 },
  rome: { lat: 41.9028, lon: 12.4964 },
  amsterdam: { lat: 52.3676, lon: 4.9041 },
  lisbon: { lat: 38.7223, lon: -9.1393 },
  dublin: { lat: 53.3498, lon: -6.2603 },
  "hong kong": { lat: 22.3193, lon: 114.1694 },
  singapore: { lat: 1.3521, lon: 103.8198 },
  tokyo: { lat: 35.6762, lon: 139.6503 },
  sydney: { lat: -33.8688, lon: 151.2093 },
  mumbai: { lat: 19.076, lon: 72.8777 },
  delhi: { lat: 28.7041, lon: 77.1025 },
  istanbul: { lat: 41.0082, lon: 28.9784 },
  "los angeles": { lat: 34.0522, lon: -118.2437 },
  chicago: { lat: 41.8781, lon: -87.6298 },
  houston: { lat: 29.7604, lon: -95.3698 },
  atlanta: { lat: 33.749, lon: -84.388 },
  calgary: { lat: 51.0447, lon: -114.0719 },
};

const STATE_OF_CITY: Record<string, string> = {
  aba: "Abia", umuahia: "Abia", lagos: "Lagos", ikeja: "Lagos", lekki: "Lagos", ajah: "Lagos",
  ikorodu: "Lagos", yaba: "Lagos", surulere: "Lagos", apapa: "Lagos", "port harcourt": "Rivers",
  abuja: "Federal Capital Territory", kano: "Kano", ibadan: "Oyo", enugu: "Enugu", owerri: "Imo",
  onitsha: "Anambra", awka: "Anambra", uyo: "Akwa Ibom", calabar: "Cross River", asaba: "Delta",
  warri: "Delta", benin: "Edo", "benin city": "Edo", kaduna: "Kaduna", jos: "Plateau",
  ilorin: "Kwara", maiduguri: "Borno", abeokuta: "Ogun", akure: "Ondo", osogbo: "Osun",
};

function normalise(value: string) {
  return value
    .toLowerCase()
    .replace(/[.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Coordinates for a seller's city, falling back to its region/state. */
export function coordsForPlace(city: string, region = ""): Coords | null {
  for (const candidate of [city, region]) {
    const key = normalise(candidate);
    if (!key) continue;
    const direct = PLACES[key];
    if (direct) return direct;
    const firstWord = key.split(" ")[0];
    if (firstWord && PLACES[firstWord]) return PLACES[firstWord];
    const withoutSuffix = key.replace(/\s+(state|city|metropolis)$/, "");
    if (withoutSuffix !== key && PLACES[withoutSuffix]) return PLACES[withoutSuffix];
  }
  return null;
}

export function stateForCity(city: string) {
  return STATE_OF_CITY[normalise(city)] ?? "";
}

/** Great-circle distance in kilometres. */
export function distanceKm(from: Coords, to: Coords) {
  const earthRadius = 6371;
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const dLat = toRadians(to.lat - from.lat);
  const dLon = toRadians(to.lon - from.lon);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(from.lat)) * Math.cos(toRadians(to.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * earthRadius * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function formatDistance(km: number) {
  if (!Number.isFinite(km)) return "";
  if (km < 1) return "Under 1 km away";
  if (km < 10) return `${km.toFixed(1)} km away`;
  if (km < 100) return `${Math.round(km)} km away`;
  if (km < 1000) return `${Math.round(km)} km away`;
  return `${Math.round(km / 10) * 10} km away`;
}
