// Temporary: create a throwaway affiliate so the signed-in dashboard can be
// exercised in the browser. Removed again by scripts/cleanup-test-affiliate.mjs.
import { readFileSync, writeFileSync } from "node:fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

const env = {};
for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const match = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)$/);
  if (!match) continue;
  let value = match[2].trim();
  if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
  env[match[1]] = value;
}

const sa = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON);
const app = initializeApp({
  credential: cert({
    projectId: sa.project_id,
    clientEmail: sa.client_email,
    privateKey: sa.private_key.replace(/\\n/g, "\n"),
  }),
});
const auth = getAuth(app);
const db = getFirestore(app);

const email = "affiliate-ui-check@example.com";
let uid;
try {
  uid = (await auth.getUserByEmail(email)).uid;
} catch {
  uid = (await auth.createUser({ email, emailVerified: true, displayName: "Faronation" })).uid;
}
await auth.setCustomUserClaims(uid, { role: "buyer" });

const now = Timestamp.now();
await db.collection("users").doc(uid).set({
  uid,
  email,
  role: "buyer",
  displayName: "Faronation",
  phone: "+234 800 000 0000",
  location: "12 Allen Avenue, Ikeja, Lagos",
  verificationStatus: "not_required",
  createdAt: now,
  updatedAt: now,
}, { merge: true });

await db.collection("affiliates").doc(uid).set({
  uid,
  code: "FARONATION",
  name: "Faronation",
  email,
  status: "active",
  commissionRate: 0.05,
  createdAt: now,
  updatedAt: now,
}, { merge: true });

const customToken = await auth.createCustomToken(uid, { role: "buyer" });
writeFileSync("public/ui-check-session.json", JSON.stringify({
  uid,
  email,
  apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: env.NEXT_PUBLIC_FIREBASE_APP_ID,
  messagingSenderId: env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  customToken,
}));
console.log("test affiliate ready:", uid);
