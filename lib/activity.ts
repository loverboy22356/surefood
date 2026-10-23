import "server-only";

import { Timestamp, type Transaction, type WriteBatch } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";

type ActivityWriter = Transaction | WriteBatch;

type ActivityInput = {
  actorUid: string;
  actorRole: string;
  targetUserId: string;
  action: string;
  targetType: string;
  targetId: string;
  summary: string;
};

export function createActivity(writer: ActivityWriter, activity: ActivityInput) {
  const activityRef = adminDb().collection("activities").doc();
  writer.create(activityRef, {
    ...activity,
    createdAt: Timestamp.now(),
  });
}
