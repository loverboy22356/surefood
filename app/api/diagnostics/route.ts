import { jsonError } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Temporary production probe: reports whether Firebase Admin can be loaded and
 * queried on the host, without leaking credentials. Remove once the host is green.
 */
export async function GET(request: Request) {
  const key = new URL(request.url).searchParams.get("key");
  if (key !== "surefood-diag") return jsonError("Not found.", 404);

  const report: Record<string, string> = {
    node: process.version,
    region: process.env.VERCEL_REGION ?? "local",
    serviceAccountEnv: process.env.FIREBASE_SERVICE_ACCOUNT_JSON ? "set" : "missing",
    webProjectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ? "set" : "missing",
  };

  try {
    const admin = await import("@/lib/firebase/admin");
    report.adminImport = "ok";
    report.configured = admin.firebaseAdminConfigured() ? "yes" : "no";
    if (report.configured === "yes") {
      const snapshot = await admin.adminDb().collection("productCategories").limit(1).get();
      report.firestore = `ok (${snapshot.size} docs)`;
    }
  } catch (error) {
    const value = error as { name?: string; message?: string; code?: string | number };
    report.loadError = `${value?.name ?? "Error"}: ${value?.message ?? String(error)}`;
    if (value?.code !== undefined) report.loadErrorCode = String(value.code);
  }

  return Response.json(report, { headers: { "cache-control": "private, no-store" } });
}
