import "server-only";

/**
 * Per-instance memo for public catalogue reads.
 *
 * Every buyer-facing page fires the same handful of read-only endpoints
 * (/api/products, /api/categories, the seller directories). Without a cache each
 * one pays for a Firestore round trip on every request, which is what made the
 * site feel slow. Two layers fix that:
 *
 *   1. this cache, so a warm instance answers repeat reads without touching Firestore;
 *   2. the cache-control header below, so the CDN answers the same reads without
 *      reaching the server at all.
 *
 * Only ever use it for payloads that are identical for every visitor.
 */

type Entry = { value: unknown; at: number };

const entries = new Map<string, Entry>();
const inFlight = new Map<string, Promise<unknown>>();
const MAX_ENTRIES = 64;

/** Shared catalogue reads stay fresh for a minute: new listings appear quickly, misses do not. */
export const CATALOG_TTL_MS = 60_000;

/**
 * Categories are editable from the admin workspace, so they are held for a much
 * shorter spell than the catalogue itself.
 */
export const CATEGORIES_TTL_MS = 15_000;

/**
 * CDN + browser caching for public reads. s-maxage lets the edge answer the
 * request, stale-while-revalidate keeps the edge fresh in the background so the
 * next visitor never waits for Firestore either.
 */
export const PUBLIC_CACHE_CONTROL = "public, max-age=0, s-maxage=60, stale-while-revalidate=300";

export const CATEGORIES_CACHE_CONTROL = "public, max-age=0, s-maxage=15, stale-while-revalidate=60";

export const PUBLIC_CACHE_HEADERS = { "cache-control": PUBLIC_CACHE_CONTROL } as const;

export const CATEGORIES_CACHE_HEADERS = { "cache-control": CATEGORIES_CACHE_CONTROL } as const;

/** Drops a memoised read, called by the write handlers that change it. */
export function invalidate(key: string) {
  entries.delete(key);
}

/** Serialises concurrent misses for the same key so only one Firestore query runs. */
export async function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const hit = entries.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.value as T;

  const pending = inFlight.get(key);
  if (pending) return pending as Promise<T>;

  const promise = load()
    .then((value) => {
      entries.set(key, { value, at: Date.now() });
      if (entries.size > MAX_ENTRIES) {
        const oldest = entries.keys().next().value;
        if (oldest !== undefined) entries.delete(oldest);
      }
      return value;
    })
    .finally(() => {
      inFlight.delete(key);
    });

  inFlight.set(key, promise);
  return promise;
}
