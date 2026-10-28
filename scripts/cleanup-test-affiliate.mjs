// Temporary: remove the throwaway affiliate used for UI review.
import { readFileSync, rmSync } from "node:fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

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

try {
  const user = await auth.getUserByEmail("affiliate-ui-check@example.com");
  await db.collection("affiliates").doc(user.uid).delete().catch(() => {});
  await db.collection("users").doc(user.uid).delete().catch(() => {});
  await auth.deleteUser(user.uid);
  console.log("removed test affiliate:", user.uid);
} catch (error) {
  console.log("nothing to remove:", error.code ?? error.message);
} finally {
  rmSync("public/ui-check-session.json", { force: true });
}
