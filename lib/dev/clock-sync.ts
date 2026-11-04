/**
 * Development-only clock correction for Firebase.
 *
 * Firebase Admin signs a self-signed access token from the machine's clock: the
 * JWT carries `iat = Date.now()` and expires an hour later. When the computer's
 * clock runs behind (a stopped Windows Time service, a resumed virtual machine)
 * Google receives a token that is already expired and every Firestore call comes
 * back `UNAUTHENTICATED` / `ACCESS_TOKEN_EXPIRED`, so the catalogue looks broken
 * even though the code is fine.
 *
 * This measures the offset against Google's own clock and applies it only while
 * the token is being signed, which keeps request deadlines and timers on the
 * machine's real clock. It is a convenience, not a repair - syncing the system
 * clock (Settings -> Time & language -> Date & time -> Sync now) removes the need
 * for it - and it is only installed in development, never in production.
 */

const CLOCK_SOURCE = "https://oauth2.googleapis.com/token";
const TOLERANCE_MS = 60_000;
const RECHECK_MS = 10 * 60_000;
const PROBE_TIMEOUT_MS = 8_000;

type JwtAccessLike = {
  prototype: { getRequestHeaders: ((...args: unknown[]) => unknown) & { sfPatched?: boolean } };
};

const nativeNow = Date.now.bind(Date);
let offsetMs = 0;
let patched = false;
let timer: ReturnType<typeof setInterval> | null = null;

async function measureOffset() {
  try {
    const response = await fetch(CLOCK_SOURCE, {
      method: "HEAD",
      cache: "no-store",
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    const header = response.headers.get("date");
    const serverTime = header ? Date.parse(header) : Number.NaN;
    if (Number.isNaN(serverTime)) return null;
    return serverTime - nativeNow();
  } catch {
    return null;
  }
}

function patchTokenClock(JWTAccess: JwtAccessLike) {
  const original = JWTAccess.prototype.getRequestHeaders;
  if (original.sfPatched) return;

  const patchedFn = function patchedGetRequestHeaders(this: unknown, ...args: unknown[]) {
    const savedNow = Date.now;
    Date.now = () => nativeNow() + offsetMs;
    try {
      return original.apply(this, args);
    } finally {
      Date.now = savedNow;
    }
  };
  patchedFn.sfPatched = true;
  JWTAccess.prototype.getRequestHeaders = patchedFn;
}

async function refresh() {
  const offset = await measureOffset();
  if (offset === null) return;

  if (Math.abs(offset) <= TOLERANCE_MS) {
    offsetMs = 0;
    return;
  }

  offsetMs = offset;
  if (patched) return;

  // google-auth-library ships with firebase-admin; resolving it lazily keeps a
  // missing package from breaking anything beyond this convenience.
  const { JWTAccess } = (await import("google-auth-library")) as unknown as { JWTAccess: JwtAccessLike };
  patchTokenClock(JWTAccess);
  patched = true;
  console.warn(
    `[dev] This computer's clock is ${Math.round(Math.abs(offsetMs) / 1000)}s ${
      offsetMs > 0 ? "behind" : "ahead of"
    } real time. Firebase tokens are signed with corrected timestamps while the dev server runs; sync the Windows clock to fix it properly.`,
  );
}

export async function syncDevClock() {
  await refresh();
  if (timer) return;
  timer = setInterval(() => {
    void refresh();
  }, RECHECK_MS);
  timer.unref?.();
}
