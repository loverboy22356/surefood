/**
 * Public runtime configuration for the Sure Foodz mobile app.
 *
 * Only values that are already shipped to every browser in the website bundle
 * are exposed here: the Firebase web API key. No server secret is ever returned.
 */
export const runtime = "nodejs";

export async function GET() {
  const firebaseApiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!firebaseApiKey) {
    return Response.json(
      { error: "Sign-in is not configured on this server yet." },
      { status: 503 },
    );
  }
  return Response.json(
    { firebaseApiKey },
    { headers: { "cache-control": "public, max-age=300" } },
  );
}
