import { jsonError, readJson } from "@/lib/http";

export const runtime = "nodejs";

const CACHE_LIMIT = 6_000;
const cache = new Map<string, string>();
const DELIMITER = "\n@@\n";
const REQUEST_LIMIT = 45;
const REQUEST_WINDOW_MS = 60_000;
const requestLog = new Map<string, { count: number; resetAt: number }>();

function clientKey(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip") || "local";
}

function withinRateLimit(request: Request) {
  const key = clientKey(request);
  const now = Date.now();
  if (requestLog.size > 5_000) {
    for (const [entryKey, entry] of requestLog) if (entry.resetAt < now) requestLog.delete(entryKey);
  }
  const entry = requestLog.get(key);
  if (!entry || entry.resetAt < now) {
    requestLog.set(key, { count: 1, resetAt: now + REQUEST_WINDOW_MS });
    return true;
  }
  entry.count += 1;
  return entry.count <= REQUEST_LIMIT;
}

function cacheKey(target: string, text: string) {
  return `${target}::${text}`;
}

function remember(key: string, value: string) {
  if (cache.size >= CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (typeof oldest === "string") cache.delete(oldest);
  }
  cache.set(key, value);
}

async function translateWithGoogleKey(texts: string[], target: string) {
  const key = process.env.GOOGLE_TRANSLATE_API_KEY;
  const response = await fetch(`https://translation.googleapis.com/language/translate/v2?key=${encodeURIComponent(key ?? "")}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ q: texts, target, source: "en", format: "text" }),
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  const data = await response.json();
  const translations = data?.data?.translations;
  if (!Array.isArray(translations) || translations.length !== texts.length) {
    throw new Error("The translation service returned an unexpected response.");
  }
  return translations.map((item: { translatedText?: string }) => String(item.translatedText ?? ""));
}

async function translateWithPublicEndpoint(texts: string[], target: string) {
  const joined = texts.join(DELIMITER);
  const url = new URL("https://translate.googleapis.com/translate_a/single");
  url.searchParams.set("client", "gtx");
  url.searchParams.set("sl", "en");
  url.searchParams.set("tl", target);
  url.searchParams.set("dt", "t");
  url.searchParams.set("q", joined);
  const response = await fetch(url, {
    headers: { "user-agent": "Mozilla/5.0 (compatible; SureFoodLocale/1.0)" },
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`Translation request failed with ${response.status}.`);
  const data = await response.json();
  const segments = Array.isArray(data?.[0]) ? data[0] : [];
  const translated = segments
    .map((segment: unknown) => Array.isArray(segment) ? String(segment[0] ?? "") : "")
    .join("");
  const parts = translated.split("@@").map((part) => part.trim());
  if (parts.length !== texts.length) throw new Error("The translation response did not line up with the request.");
  return parts;
}

async function translateChunk(texts: string[], target: string) {
  const attempt = () => process.env.GOOGLE_TRANSLATE_API_KEY
    ? translateWithGoogleKey(texts, target)
    : translateWithPublicEndpoint(texts, target);
  try {
    return await attempt();
  } catch (error) {
    console.warn("Retrying a translation batch.", error);
    return attempt();
  }
}

export async function POST(request: Request) {
  if (!withinRateLimit(request)) return jsonError("Too many translation requests. Please try again in a minute.", 429);
  const body = await readJson(request);
  const target = typeof body?.target === "string" ? body.target.trim() : "";
  if (!/^[a-z]{2,3}(-[A-Za-z]{2,4})?$/.test(target)) return jsonError("Choose a valid language code.", 400);
  if (target.toLowerCase() === "en") return jsonError("The site is already in English.", 400);

  const texts = Array.isArray(body?.texts)
    ? (body.texts as unknown[])
      .filter((text): text is string => typeof text === "string")
      .map((text) => text.replace(/\s+/g, " ").trim())
      .filter((text) => text.length > 0 && text.length <= 600)
    : [];
  if (!texts.length) return jsonError("Nothing to translate.", 400);

  const unique = [...new Set(texts)];
  const translations = new Map<string, string>();
  const pending: string[] = [];
  for (const text of unique) {
    const hit = cache.get(cacheKey(target, text));
    if (hit !== undefined) translations.set(text, hit);
    else pending.push(text);
  }

  if (pending.length) {
    const chunks: string[][] = [];
    let current: string[] = [];
    let size = 0;
    for (const text of pending) {
      const addition = text.length + DELIMITER.length;
      if (current.length && (current.length >= 80 || size + addition > 4_500)) {
        chunks.push(current);
        current = [];
        size = 0;
      }
      current.push(text);
      size += addition;
    }
    if (current.length) chunks.push(current);

    for (const chunk of chunks) {
      try {
        const results = await translateChunk(chunk, target);
        chunk.forEach((text, index) => {
          const translated = results[index]?.trim();
          if (translated) {
            translations.set(text, translated);
            remember(cacheKey(target, text), translated);
          } else {
            translations.set(text, text);
          }
        });
      } catch (error) {
        console.error("Could not translate a batch of text.", error);
        for (const text of chunk) translations.set(text, text);
      }
    }
  }

  return Response.json({
    language: target,
    translations: texts.map((text) => translations.get(text) ?? text),
  });
}
