import "server-only";

import { adminAuth } from "@/lib/firebase/admin";
import type { AppRole } from "@/lib/auth/types";

export async function authenticatedUser(request: Request) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return null;
  }

  try {
    return await adminAuth().verifyIdToken(authorization.slice(7), true);
  } catch (error) {
    console.warn("Firebase bearer token verification failed.", error);
    return null;
  }
}

export function isAppRole(value: unknown): value is AppRole {
  return ["buyer", "vendor", "supplier", "producer", "manufacturer", "rider", "staff", "admin"].includes(String(value));
}

export function isStaff(role: unknown) {
  return role === "staff" || role === "admin";
}
