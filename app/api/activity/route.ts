import { Timestamp } from "firebase-admin/firestore";
import { authenticatedUser } from "@/lib/auth/server";
import { adminDb, firebaseAdminConfigured } from "@/lib/firebase/admin";
import { jsonError } from "@/lib/http";

type ActivityDocument = {
  id: string;
  action: string;
  summary: string;
  createdAt: Timestamp;
};

export async function GET(request: Request) {
  if (!firebaseAdminConfigured()) {
    return jsonError("Activity history is unavailable until Firebase Admin is configured on the server.", 503);
  }
  const user = await authenticatedUser(request);
  if (!user) return jsonError("Sign in to view activity history.", 401);

  try {
    const activities = adminDb().collection("activities");
    const [actorSnapshot, targetSnapshot] = await Promise.all([
      activities.where("actorUid", "==", user.uid).orderBy("createdAt", "desc").limit(20).get(),
      activities.where("targetUserId", "==", user.uid).orderBy("createdAt", "desc").limit(20).get(),
    ]);
    const byId = new Map<string, ActivityDocument>();
    for (const document of [...actorSnapshot.docs, ...targetSnapshot.docs]) {
      const data = document.data();
      if (!(data.createdAt instanceof Timestamp)) {
        throw new Error(`Activity ${document.id} has an invalid timestamp.`);
      }
      byId.set(document.id, {
        id: document.id,
        action: String(data.action),
        summary: String(data.summary),
        createdAt: data.createdAt,
      });
    }
    const result = [...byId.values()]
      .sort((left, right) => right.createdAt.toMillis() - left.createdAt.toMillis())
      .slice(0, 20)
      .map(({ id, action, summary, createdAt }) => ({
        id,
        action,
        summary,
        createdAt: createdAt.toDate().toISOString(),
      }));
    return Response.json({ activities: result });
  } catch (error) {
    console.error("Could not load SureFood activity history.", error);
    return jsonError("We could not load activity history.", 500);
  }
}
