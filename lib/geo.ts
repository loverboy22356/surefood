// SureFood lists and charges in Naira, so it is also the fallback when the visitor's
// location cannot be detected (for example a plain local dev server).
export const BASE_CURRENCY = "NGN";

export type DetectedLocation = {
  country: string;
  city: string;
  region: string;
  language: string;
  currency: string;
};

export const COUNTRY_CURRENCY: Record<string, string> = {
  NG: "NGN", GH: "GHS", KE: "KES", ZA: "ZAR", EG: "EGP", MA: "MAD", TN: "TND", DZ: "DZD",
  ET: "ETB", TZ: "TZS", UG: "UGX", RW: "RWF", ZM: "ZMW", MW: "MWK", MZ: "MZN", BW: "BWP",
  NA: "NAD", SN: "XOF", CI: "XOF", CM: "XAF", AO: "AOA", CD: "CDF", SD: "SDG", LY: "LYD",
  GB: "GBP", IE: "EUR", FR: "EUR", DE: "EUR", ES: "EUR", IT: "EUR", PT: "EUR", NL: "EUR",
  BE: "EUR", AT: "EUR", FI: "EUR", GR: "EUR", SK: "EUR", SI: "EUR", LT: "EUR", LV: "EUR",
  EE: "EUR", LU: "EUR", MT: "EUR", CY: "EUR", US: "USD", CA: "CAD", MX: "MXN", BR: "BRL",
  AR: "ARS", CL: "CLP", CO: "COP", PE: "PEN", AU: "AUD", NZ: "NZD", CH: "CHF", SE: "SEK",
  NO: "NOK", DK: "DKK", PL: "PLN", CZ: "CZK", HU: "HUF", RO: "RON", BG: "BGN", TR: "TRY",
  RU: "RUB", UA: "UAH", AE: "AED", SA: "SAR", QA: "QAR", KW: "KWD", IL: "ILS", IN: "INR",
  PK: "PKR", BD: "BDT", LK: "LKR", NP: "NPR", CN: "CNY", HK: "HKD", TW: "TWD", JP: "JPY",
  KR: "KRW", SG: "SGD", MY: "MYR", ID: "IDR", TH: "THB", VN: "VND", PH: "PHP",
};

export const TIMEZONE_COUNTRY: Record<string, string> = {
  "Africa/Lagos": "NG", "Africa/Accra": "GH", "Africa/Nairobi": "KE", "Africa/Johannesburg": "ZA",
  "Africa/Cairo": "EG", "Africa/Casablanca": "MA", "Africa/Tunis": "TN", "Africa/Algiers": "DZ",
  "Africa/Addis_Ababa": "ET", "Africa/Dar_es_Salaam": "TZ", "Africa/Kampala": "UG", "Africa/Kigali": "RW",
  "Africa/Lusaka": "ZM", "Africa/Blantyre": "MW", "Africa/Maputo": "MZ", "Africa/Gaborone": "BW",
  "Africa/Windhoek": "NA", "Africa/Dakar": "SN", "Africa/Abidjan": "CI", "Africa/Douala": "CM",
  "Africa/Luanda": "AO", "Africa/Kinshasa": "CD", "Africa/Khartoum": "SD", "Africa/Tripoli": "LY",
  "Africa/Mogadishu": "SO", "Africa/Antananarivo": "MG",
  "Europe/London": "GB", "Europe/Dublin": "IE", "Europe/Paris": "FR", "Europe/Berlin": "DE",
  "Europe/Madrid": "ES", "Europe/Rome": "IT", "Europe/Lisbon": "PT", "Europe/Amsterdam": "NL",
  "Europe/Brussels": "BE", "Europe/Vienna": "AT", "Europe/Helsinki": "FI", "Europe/Athens": "GR",
  "Europe/Warsaw": "PL", "Europe/Prague": "CZ", "Europe/Budapest": "HU", "Europe/Bucharest": "RO",
  "Europe/Sofia": "BG", "Europe/Istanbul": "TR", "Europe/Moscow": "RU", "Europe/Kyiv": "UA",
  "Europe/Stockholm": "SE", "Europe/Oslo": "NO", "Europe/Copenhagen": "DK", "Europe/Zurich": "CH",
  "America/New_York": "US", "America/Chicago": "US", "America/Denver": "US", "America/Los_Angeles": "US",
  "America/Toronto": "CA", "America/Vancouver": "CA", "America/Mexico_City": "MX", "America/Sao_Paulo": "BR",
  "America/Argentina/Buenos_Aires": "AR", "America/Santiago": "CL", "America/Bogota": "CO", "America/Lima": "PE",
  "Australia/Sydney": "AU", "Australia/Melbourne": "AU", "Pacific/Auckland": "NZ",
  "Asia/Dubai": "AE", "Asia/Riyadh": "SA", "Asia/Qatar": "QA", "Asia/Kuwait": "KW", "Asia/Jerusalem": "IL",
  "Asia/Kolkata": "IN", "Asia/Karachi": "PK", "Asia/Dhaka": "BD", "Asia/Colombo": "LK", "Asia/Kathmandu": "NP",
  "Asia/Shanghai": "CN", "Asia/Hong_Kong": "HK", "Asia/Taipei": "TW", "Asia/Tokyo": "JP", "Asia/Seoul": "KR",
  "Asia/Singapore": "SG", "Asia/Kuala_Lumpur": "MY", "Asia/Jakarta": "ID", "Asia/Bangkok": "TH",
  "Asia/Ho_Chi_Minh": "VN", "Asia/Manila": "PH", "Asia/Tehran": "IR", "Asia/Tbilisi": "GE",
  "Asia/Yerevan": "AM", "Asia/Baku": "AZ", "Asia/Almaty": "KZ", "Asia/Tashkent": "UZ",
  "Asia/Ulaanbaatar": "MN", "Asia/Phnom_Penh": "KH", "Asia/Vientiane": "LA", "Asia/Yangon": "MM",
};

// Primary language spoken in each market. Unknown countries fall back to English.
export const COUNTRY_LANGUAGE: Record<string, string> = {
  NG: "en", GH: "en", KE: "sw", TZ: "sw", UG: "en", ZA: "en", ZM: "en", MW: "en", BW: "en", NA: "en",
  RW: "rw", SO: "so", MG: "mg", ET: "am", SD: "ar", EG: "ar", LY: "ar", TN: "ar", DZ: "ar", MA: "ar",
  SN: "fr", CI: "fr", CM: "fr", CD: "fr", AO: "pt", MZ: "pt",
  FR: "fr", BE: "fr", DE: "de", AT: "de", CH: "de", ES: "es", MX: "es", AR: "es", CL: "es",
  CO: "es", PE: "es", IT: "it", PT: "pt", BR: "pt", NL: "nl", GB: "en", IE: "en", US: "en", CA: "en",
  AU: "en", NZ: "en", SE: "sv", NO: "no", DK: "da", FI: "fi", PL: "pl", CZ: "cs", HU: "hu", RO: "ro",
  BG: "bg", HR: "hr", RS: "sr", SK: "sk", LT: "lt", LV: "lv", EE: "et", TR: "tr", RU: "ru", UA: "uk",
  GR: "el", IL: "he", SA: "ar", AE: "ar", QA: "ar", KW: "ar", IN: "hi", PK: "ur", BD: "bn", LK: "si",
  NP: "ne", CN: "zh-CN", HK: "zh-TW", TW: "zh-TW", JP: "ja", KR: "ko", SG: "en", MY: "ms", ID: "id",
  TH: "th", VN: "vi", PH: "fil", IR: "fa", GE: "ka", AM: "hy", AZ: "az", KZ: "kk", UZ: "uz", MN: "mn",
  KH: "km", LA: "lo", MM: "my",
};

export function languageForCountry(country: string) {
  return COUNTRY_LANGUAGE[country.toUpperCase()] ?? "";
}

export function currencyForCountry(country: string) {
  return COUNTRY_CURRENCY[country.toUpperCase()] ?? "";
}

/** Nearest city name implied by an IANA timezone, e.g. "Africa/Lagos" → "Lagos". */
export function cityFromTimezone(timezone: string) {
  const city = timezone.split("/").pop() ?? "";
  return city.replaceAll("_", " ").trim();
}

export function countryLabel(country: string) {
  if (!country || !/^[A-Za-z]{2}$/.test(country)) return "";
  try {
    return new Intl.DisplayNames(undefined, { type: "region" }).of(country.toUpperCase()) ?? country;
  } catch {
    return country.toUpperCase();
  }
}
