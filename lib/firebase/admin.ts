import "server-only";

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const serviceAccountFile = join(process.cwd(), "firebase-service-account.json");

export function firebaseAdminConfigured() {
  return Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_JSON) || existsSync(serviceAccountFile);
}

function loadServiceAccount() {
  const serviceAccountValue = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  let serviceAccountJson = serviceAccountValue;
  if (!serviceAccountJson) {
    try {
      serviceAccountJson = readFileSync(serviceAccountFile, "utf8");
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") {
        throw new Error(
          "Firebase Admin is not configured. Set FIREBASE_SERVICE_ACCOUNT_JSON or add firebase-service-account.json to the project root.",
        );
      }
      throw error;
    }
  }

  try {
    return JSON.parse(serviceAccountJson);
  } catch (error) {
    console.error("Firebase Admin service account must contain valid JSON.", error);
    throw new Error("Firebase Admin service account configuration is invalid.");
  }
}

function getAdminApp(): App {
  const existingApp = getApps()[0];
  if (existingApp) return existingApp;

  let serviceAccount: {
    project_id: string;
    client_email: string;
    private_key: string;
  } = loadServiceAccount();

  if (!serviceAccount.project_id || !serviceAccount.client_email || !serviceAccount.private_key) {
    throw new Error("Firebase Admin service account is missing required fields.");
  }
  const configuredProjectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (configuredProjectId && serviceAccount.project_id !== configuredProjectId) {
    throw new Error("Firebase Admin service account project does not match the configured Firebase web project.");
  }

  return initializeApp({
    credential: cert({
      projectId: serviceAccount.project_id,
      clientEmail: serviceAccount.client_email,
      privateKey: serviceAccount.private_key.replace(/\\n/g, "\n"),
    }),
  });
}

export function adminAuth() {
  return getAuth(getAdminApp());
}

export function adminDb() {
  return getFirestore(getAdminApp());
}
