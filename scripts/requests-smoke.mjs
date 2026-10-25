// End-to-end checks for Pay Later applications and special/event orders.
// Run against a dev server: node scripts/requests-smoke.mjs
//
// Firebase Admin's token exchange fails from a bare script on some machines, so
// this harness signs its own service-account assertions, mints custom tokens and
// talks to Identity Toolkit / Firestore over REST.
import crypto from "node:crypto";
import { readFileSync } from "node:fs";
import { v2 as cloudinary } from "cloudinary";

const BASE_URL = process.env.SMOKE_BASE_URL ?? "http://localhost:3000";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((line) => line.includes("=") && !line.trimStart().startsWith("#"))
    .map((line) => {
      const index = line.indexOf("=");
      return [line.slice(0, index).trim(), line.slice(index + 1).trim()];
    }),
);

const serviceAccount = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON);
const privateKey = serviceAccount.private_key.replace(/\\n/g, "\n");
const projectId = serviceAccount.project_id;

const base64url = (value) => Buffer.from(typeof value === "string" ? value : JSON.stringify(value)).toString("base64url");

function signJwt(payload) {
  const unsigned = `${base64url({ alg: "RS256", typ: "JWT" })}.${base64url(payload)}`;
  const signature = crypto.createSign("RSA-SHA256").update(unsigned).sign(privateKey, "base64url");
  return `${unsigned}.${signature}`;
}

async function accessToken() {
  const now = Math.floor(Date.now() / 1000);
  const assertion = signJwt({
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/cloud-platform",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  });
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(`Could not get an access token: ${result.error_description ?? response.status}`);
  return result.access_token;
}

function customToken(uid, role) {
  const now = Math.floor(Date.now() / 1000);
  return signJwt({
    iss: serviceAccount.client_email,
    sub: serviceAccount.client_email,
    aud: "https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit",
    iat: now,
    exp: now + 3600,
    uid,
    claims: { role },
  });
}

async function createUser(bearer, uid) {
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts`, {
    method: "POST",
    headers: { authorization: `Bearer ${bearer}`, "content-type": "application/json" },
    body: JSON.stringify({ localId: uid, email: `${uid}@example.com`, emailVerified: true }),
  });
  if (!response.ok) throw new Error(`Could not create ${uid}: ${(await response.text()).slice(0, 200)}`);
}

async function deleteUser(bearer, uid) {
  await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:delete`, {
    method: "POST",
    headers: { authorization: `Bearer ${bearer}`, "content-type": "application/json" },
    body: JSON.stringify({ localId: uid }),
  }).catch(() => {});
}

async function idTokenFor(uid, role) {
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${env.NEXT_PUBLIC_FIREBASE_API_KEY}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: customToken(uid, role), returnSecureToken: true }),
    },
  );
  const result = await response.json();
  if (!response.ok) throw new Error(`Could not sign in ${uid}: ${result.error?.message ?? response.status}`);
  return result.idToken;
}

async function deleteDocument(bearer, collection, id) {
  await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collection}/${id}`, {
    method: "DELETE",
    headers: { authorization: `Bearer ${bearer}` },
  }).catch(() => {});
}

const runId = Date.now().toString(36);
const uids = { buyer: `pl-buyer-${runId}`, staff: `pl-staff-${runId}` };
const tokens = {};
const created = { applications: [], requests: [], uploads: [], authUsers: [] };
let failures = 0;

function check(name, ok, detail = "") {
  if (!ok) failures += 1;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  return ok;
}

async function api(path, { method = "GET", role, body, form, expect } = {}) {
  const headers = {};
  if (role) headers.authorization = `Bearer ${tokens[role]}`;
  if (body !== undefined) headers["content-type"] = "application/json";
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    ...(form ? { body: form } : {}),
  });
  const text = await response.text();
  let payload = null;
  try { payload = text ? JSON.parse(text) : null; } catch { payload = { raw: text.slice(0, 300) }; }
  const ok = expect === undefined ? response.ok : response.status === expect;
  if (!ok) console.log(`      ${method} ${path} -> ${response.status} ${text.slice(0, 400)}`);
  return { status: response.status, ok, payload };
}

function isoDate(daysAhead) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + daysAhead);
  return date.toISOString().slice(0, 10);
}

const tinyPdf = Buffer.from(
  "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[]/Count 0>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n",
  "utf8",
);

const businessApplication = {
  applicantType: "business", consent: true,
  fullName: "Ada Obi", email: "", phone: "08030000001",
  address: "14 Market Road, Aba, Abia",
  business: { name: "Ada Foods", registrationNumber: "RC 1234567", address: "14 Market Road, Aba" },
  referees: [
    { name: "Chidi Nwosu", phone: "08030000002", relationship: "Business partner" },
    { name: "Ngozi Eze", phone: "08030000003", relationship: "Neighbour" },
  ],
  documents: {},
};

async function main() {
  const health = await fetch(BASE_URL).catch(() => null);
  if (!health?.ok) throw new Error(`Dev server is not responding at ${BASE_URL}`);
  console.log(`Requests smoke test ${runId} against ${BASE_URL}\n`);

  const bearer = await accessToken();
  for (const [role, uid] of Object.entries(uids)) {
    await createUser(bearer, uid);
    created.authUsers.push(uid);
    tokens[role] = await idTokenFor(uid, role);
  }
  check("Signed in a test buyer and staff account", Boolean(tokens.buyer && tokens.staff));

  // --- Pay Later -----------------------------------------------------------
  const anonymous = await api("/api/pay-later/applications", { method: "POST", body: { applicantType: "business" }, expect: 401 });
  check("Pay Later application requires sign-in", anonymous.status === 401);

  const badType = await api("/api/pay-later/applications", {
    method: "POST", role: "buyer", expect: 400,
    body: { ...businessApplication, applicantType: "astronaut" },
  });
  check("Rejects an unknown applicant type", badType.status === 400);

  const noConsent = await api("/api/pay-later/applications", {
    method: "POST", role: "buyer", expect: 400,
    body: { ...businessApplication, consent: false },
  });
  check("Requires the verification consent", noConsent.status === 400);

  const noDocuments = await api("/api/pay-later/applications", {
    method: "POST", role: "buyer", expect: 400,
    body: { ...businessApplication, email: `${uids.buyer}@example.com` },
  });
  check("Business application requires registration evidence", noDocuments.status === 400);

  const duplicateReferees = await api("/api/pay-later/applications", {
    method: "POST", role: "buyer", expect: 400,
    body: {
      ...businessApplication, email: `${uids.buyer}@example.com`,
      applicantType: "private-employee",
      employment: { employer: "Zed Ltd", employeeNumber: "EMP-77" },
      referees: [
        { name: "Chidi Nwosu", phone: "08030000009", relationship: "Colleague" },
        { name: "Ngozi Eze", phone: "08030000009", relationship: "Colleague" },
      ],
    },
  });
  check("Rejects identical referee phone numbers", duplicateReferees.status === 400);

  const form = new FormData();
  form.append("documentType", "business-registration");
  form.append("file", new Blob([tinyPdf], { type: "application/pdf" }), "registration.pdf");
  const upload = await api("/api/pay-later/documents", { method: "POST", role: "buyer", form });
  const publicId = upload.payload?.publicId;
  if (typeof publicId === "string") created.uploads.push(publicId);
  check("Uploads private business registration evidence", upload.ok && typeof publicId === "string", publicId ?? JSON.stringify(upload.payload));

  const application = await api("/api/pay-later/applications", {
    method: "POST", role: "buyer",
    body: {
      ...businessApplication,
      email: `${uids.buyer}@example.com`,
      documents: { "business-registration": publicId },
    },
  });
  check("Submits a Pay Later application", application.status === 201, application.payload?.application?.reference);
  const applicationReference = application.payload?.application?.reference;

  const duplicateApplication = await api("/api/pay-later/applications", {
    method: "POST", role: "buyer", expect: 409,
    body: {
      ...businessApplication,
      email: `${uids.buyer}@example.com`,
      documents: { "business-registration": publicId },
    },
  });
  check("Blocks a second open application", duplicateApplication.status === 409);

  const ownStatus = await api("/api/pay-later/applications", { role: "buyer" });
  check("Applicant can read their application status", ownStatus.payload?.application?.status === "submitted",
    ownStatus.payload?.application?.reference);

  const lockedUpload = new FormData();
  lockedUpload.append("documentType", "proof-of-income");
  lockedUpload.append("file", new Blob([tinyPdf], { type: "application/pdf" }), "income.pdf");
  const locked = await api("/api/pay-later/documents", { method: "POST", role: "buyer", form: lockedUpload, expect: 409 });
  check("Evidence is locked while under review", locked.status === 409);

  const queue = await api("/api/admin/pay-later", { role: "staff" });
  const queued = queue.payload?.applications?.find((item) => item.reference === applicationReference);
  check("Staff see the application in the Pay Later queue", Boolean(queued), `${queue.payload?.applications?.length ?? 0} queued`);
  check("Queue includes a signed evidence link", Boolean(queued?.documents?.[0]?.url), queued?.documents?.[0]?.type ?? "none");
  if (queued) created.applications.push(queued.id);

  const buyerCannotReview = await api(`/api/admin/pay-later/${queued?.id}`, {
    method: "PATCH", role: "buyer", body: { status: "approved" }, expect: 403,
  });
  check("Only staff can decide applications", buyerCannotReview.status === 403);

  const declinedWithoutNote = await api(`/api/admin/pay-later/${queued?.id}`, {
    method: "PATCH", role: "staff", body: { status: "declined" }, expect: 400,
  });
  check("Declining requires a note", declinedWithoutNote.status === 400);

  const approval = await api(`/api/admin/pay-later/${queued?.id}`, {
    method: "PATCH", role: "staff", body: { status: "approved", note: "CAC verified, referees confirmed." },
  });
  check("Staff can approve an application", approval.ok && approval.payload?.status === "approved");

  const approved = await api("/api/pay-later/applications", { role: "buyer" });
  check("Applicant sees the approval", approved.payload?.application?.status === "approved");

  // --- Special / event orders ---------------------------------------------
  const eventOrder = await api("/api/special-orders", {
    method: "POST",
    body: {
      consent: true,
      fullName: "Tunde Balogun", email: "tunde@example.com", phone: "08030000010",
      eventType: "wedding", eventDate: isoDate(75), guestCount: 180,
      deliveryAddress: "Lekki Phase 1, Lagos",
      items: "6 bags of rice (50kg), 4 cartons of tomatoes, 30kg chicken, 20 litres of oil",
      notes: "Deliver by 9am on the day.",
    },
  });
  check("Accepts a public event order request", eventOrder.status === 201, eventOrder.payload?.reference);
  check("Early lead time maps to the early planning band", String(eventOrder.payload?.tierLabel ?? "").includes("Early"),
    String(eventOrder.payload?.tierLabel ?? ""));

  const pastEvent = await api("/api/special-orders", {
    method: "POST", expect: 400,
    body: {
      consent: true, fullName: "Tunde Balogun", email: "tunde@example.com", phone: "08030000010",
      eventType: "wedding", eventDate: isoDate(-3), guestCount: 180,
      deliveryAddress: "Lekki Phase 1, Lagos", items: "6 bags of rice (50kg), 4 cartons of tomatoes",
    },
  });
  check("Rejects an event date in the past", pastEvent.status === 400);

  const tinyGuestCount = await api("/api/special-orders", {
    method: "POST", expect: 400,
    body: {
      consent: true, fullName: "Tunde Balogun", email: "tunde@example.com", phone: "08030000010",
      eventType: "wedding", eventDate: isoDate(40), guestCount: 3,
      deliveryAddress: "Lekki Phase 1, Lagos", items: "6 bags of rice (50kg), 4 cartons of tomatoes",
    },
  });
  check("Rejects a guest count below the minimum", tinyGuestCount.status === 400);

  const eventQueue = await api("/api/admin/special-orders", { role: "staff" });
  const queuedEvent = eventQueue.payload?.requests?.find((item) => item.reference === eventOrder.payload?.reference);
  check("Staff see the event order in the queue", Boolean(queuedEvent));
  if (queuedEvent) created.requests.push(queuedEvent.id);

  const quoted = await api(`/api/admin/special-orders/${queuedEvent?.id}`, {
    method: "PATCH", role: "staff",
    body: { status: "quoted", quoteNote: "12% event discount, total ₦480,000, payment due 14 days before the event." },
  });
  check("Staff can mark an event order quoted", quoted.ok && quoted.payload?.status === "quoted");

  const confirmed = await api(`/api/admin/special-orders/${queuedEvent?.id}`, {
    method: "PATCH", role: "staff", body: { status: "confirmed", quoteNote: "Paid in full." },
  });
  check("Staff can confirm an event order", confirmed.ok && confirmed.payload?.status === "confirmed");

  for (const id of created.applications) await deleteDocument(bearer, "payLaterApplications", id);
  for (const id of created.requests) await deleteDocument(bearer, "specialOrders", id);
  for (const uid of created.authUsers) await deleteUser(bearer, uid);

  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
  });
  for (const publicId of created.uploads) {
    await cloudinary.uploader.destroy(publicId, { resource_type: "raw", type: "private" }).catch(() => {});
  }
}

try {
  await main();
} catch (error) {
  failures += 1;
  console.error("Smoke test crashed:", error);
} finally {
  console.log(`\n${failures === 0 ? "All checks passed." : `${failures} check(s) failed.`}`);
  process.exit(failures === 0 ? 0 : 1);
}
