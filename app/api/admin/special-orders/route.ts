import { authenticatedUser, isStaff } from "@/lib/auth/server";
import { adminDb } from "@/lib/firebase/admin";
import { jsonError } from "@/lib/http";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const user = await authenticatedUser(request);
  if (!user || !isStaff(user.role)) return jsonError("Staff access is required.", 403);

  try {
    const snapshot = await adminDb().collection("specialOrders").limit(100).get();
    const requests = snapshot.docs.map((document) => {
      const data = document.data();
      return {
        id: document.id,
        reference: `EO-${document.id.slice(0, 6).toUpperCase()}`,
        status: String(data.status ?? "requested"),
        fullName: String(data.fullName ?? ""),
        email: String(data.email ?? ""),
        phone: String(data.phone ?? ""),
        eventType: String(data.eventType ?? ""),
        eventDate: String(data.eventDate ?? ""),
        guestCount: Number(data.guestCount ?? 0),
        deliveryAddress: String(data.deliveryAddress ?? ""),
        items: String(data.items ?? ""),
        notes: String(data.notes ?? ""),
        tierLabel: String(data.tier?.label ?? ""),
        tierDays: Number(data.tier?.days ?? 0),
        quoteNote: String(data.quoteNote ?? ""),
        createdAt: data.createdAt?.toDate?.().toISOString() ?? null,
      };
    }).sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
    return Response.json({ requests });
  } catch (error) {
    console.error("Could not load the special order queue.", error);
    return jsonError("We could not load event order requests.", 500);
  }
}
