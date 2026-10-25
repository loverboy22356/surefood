import { Timestamp } from "firebase-admin/firestore";
import { authenticatedUser } from "@/lib/auth/server";
import { adminDb } from "@/lib/firebase/admin";
import { findPayLaterDocument } from "@/lib/cloudinary-server";
import { cleanString, isEmail, jsonError, readJson } from "@/lib/http";
import {
  isGovernmentLevel,
  isPayLaterApplicantType,
  isValidPhone,
  payLaterDocumentLabels,
  payLaterDocumentTypes,
  requiredPayLaterDocuments,
  type PayLaterApplicantType,
  type PayLaterDocumentType,
} from "@/lib/requests";

export const runtime = "nodejs";

type RefereeInput = { name: string; phone: string; relationship: string };

function reference(id: string) {
  return `PL-${id.slice(0, 6).toUpperCase()}`;
}

function summarise(id: string, data: Record<string, unknown>) {
  return {
    reference: reference(id),
    status: String(data.status ?? "submitted"),
    applicantType: String(data.applicantType ?? ""),
    submittedAt: (data.submittedAt as { toDate?: () => Date } | undefined)?.toDate?.().toISOString() ?? null,
    reviewNote: String(data.reviewNote ?? ""),
  };
}

function cleanReferees(value: unknown, applicantPhone: string): { referees: RefereeInput[]; error: string } {
  if (!Array.isArray(value) || value.length !== 2) {
    return { referees: [], error: "Add two referees we can contact." };
  }
  const referees: RefereeInput[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      return { referees: [], error: "Add two referees we can contact." };
    }
    const record = entry as Record<string, unknown>;
    const name = cleanString(record.name, 120);
    const phone = cleanString(record.phone, 24);
    const relationship = cleanString(record.relationship, 60);
    if (name.length < 2) return { referees: [], error: "Enter both referee names." };
    if (!isValidPhone(phone)) return { referees: [], error: "Enter a valid phone number for each referee." };
    if (phone.replace(/\D/g, "") === applicantPhone.replace(/\D/g, "")) {
      return { referees: [], error: "Referee phone numbers must be different from your own number." };
    }
    if (relationship.length < 2) return { referees: [], error: "Tell us how each referee knows you." };
    referees.push({ name, phone, relationship });
  }
  const uniquePhones = new Set(referees.map((referee) => referee.phone.replace(/\D/g, "")));
  if (uniquePhones.size !== referees.length) {
    return { referees: [], error: "The two referees must be different people with different phone numbers." };
  }
  return { referees, error: "" };
}

export async function GET(request: Request) {
  const user = await authenticatedUser(request);
  if (!user) return jsonError("Sign in to view your Pay Later application.", 401);

  try {
    const snapshot = await adminDb().collection("payLaterApplications")
      .where("uid", "==", user.uid)
      .limit(10)
      .get();
    const applications = snapshot.docs
      .map((document) => ({
        id: document.id,
        data: document.data(),
        submittedAt: (document.data().submittedAt as { toMillis?: () => number } | undefined)?.toMillis?.() ?? 0,
      }))
      .sort((a, b) => b.submittedAt - a.submittedAt);
    const latest = applications[0];
    return Response.json({ application: latest ? summarise(latest.id, latest.data) : null });
  } catch (error) {
    console.error("Could not load a Pay Later application.", error);
    return jsonError("We could not load your Pay Later application.", 500);
  }
}

export async function POST(request: Request) {
  const user = await authenticatedUser(request);
  if (!user) return jsonError("Sign in to apply for Pay Later.", 401);
  if (user.role === "staff" || user.role === "admin") {
    return jsonError("Staff accounts cannot apply for Pay Later.", 403);
  }

  const body = await readJson(request);
  if (!body) return jsonError("Enter valid application details.", 400);
  if (body.consent !== true) {
    return jsonError("Confirm that your details are true and we may verify them before applying.", 400);
  }

  const applicantType = body.applicantType;
  if (!isPayLaterApplicantType(applicantType)) {
    return jsonError("Tell us whether you are a business owner or an employee.", 400);
  }
  const typedApplicantType: PayLaterApplicantType = applicantType;
  const fullName = cleanString(body.fullName, 120);
  const email = cleanString(body.email, 160).toLowerCase() || String(user.email ?? "").toLowerCase();
  const phone = cleanString(body.phone, 24);
  const address = cleanString(body.address, 240);
  if (fullName.length < 2) return jsonError("Enter your full name.", 400);
  if (!isEmail(email)) return jsonError("Enter a valid email address.", 400);
  if (!isValidPhone(phone)) return jsonError("Enter a valid phone number.", 400);
  if (address.length < 10) return jsonError("Enter your full home address.", 400);

  const business = (body.business && typeof body.business === "object" && !Array.isArray(body.business))
    ? body.business as Record<string, unknown>
    : {};
  const employment = (body.employment && typeof body.employment === "object" && !Array.isArray(body.employment))
    ? body.employment as Record<string, unknown>
    : {};

  const businessName = cleanString(business.name, 150);
  const registrationNumber = cleanString(business.registrationNumber, 80).toUpperCase();
  const businessAddress = cleanString(business.address, 240);
  const employer = cleanString(employment.employer, 150);
  const employeeNumber = cleanString(employment.employeeNumber, 60);
  const governmentLevel = cleanString(employment.governmentLevel, 20);

  if (typedApplicantType === "business") {
    if (businessName.length < 2) return jsonError("Enter your registered business name.", 400);
    if (registrationNumber.length < 3) return jsonError("Enter your business registration number.", 400);
    if (businessAddress.length < 10) return jsonError("Enter your full business address.", 400);
  } else {
    if (employer.length < 2) return jsonError("Enter your employer.", 400);
    if (employeeNumber.length < 2) return jsonError("Enter your staff or employee number.", 400);
    if (typedApplicantType === "government-employee" && !isGovernmentLevel(governmentLevel)) {
      return jsonError("Choose the level of government you work for.", 400);
    }
  }

  const { referees, error: refereeError } = cleanReferees(body.referees, phone);
  if (refereeError) return jsonError(refereeError, 400);

  const submittedDocuments = (body.documents && typeof body.documents === "object" && !Array.isArray(body.documents))
    ? body.documents as Record<string, unknown>
    : {};
  const documentPaths: Partial<Record<PayLaterDocumentType, string>> = {};
  for (const documentType of payLaterDocumentTypes) {
    const value = submittedDocuments[documentType];
    if (typeof value !== "string" || !value) continue;
    const found = await findPayLaterDocument(user.uid, documentType, value);
    if (!found) return jsonError("One of your uploads could not be found. Upload your evidence again.", 400);
    documentPaths[documentType] = value;
  }
  const missingDocuments = requiredPayLaterDocuments(typedApplicantType).filter((documentType) => !documentPaths[documentType]);
  if (missingDocuments.length) {
    return jsonError(
      `Upload ${missingDocuments.map((documentType) => payLaterDocumentLabels[documentType]).join(", ")} before applying.`,
      400,
    );
  }

  try {
    const db = adminDb();
    const ownApplications = await db.collection("payLaterApplications").where("uid", "==", user.uid).limit(10).get();
    if (ownApplications.docs.some((document) => ["submitted", "approved"].includes(String(document.data().status)))) {
      return jsonError("You already have an open Pay Later application. Contact support to change it.", 409);
    }

    const created = await db.collection("payLaterApplications").add({
      uid: user.uid,
      role: String(user.role ?? "buyer"),
      accountEmail: String(user.email ?? ""),
      applicantType: typedApplicantType,
      fullName,
      email,
      phone,
      address,
      business: typedApplicantType === "business"
        ? { name: businessName, registrationNumber, address: businessAddress }
        : {},
      employment: typedApplicantType === "business"
        ? {}
        : {
            employer,
            employeeNumber,
            governmentLevel: typedApplicantType === "government-employee" ? governmentLevel : "",
          },
      referees,
      documents: documentPaths,
      status: "submitted",
      reviewNote: "",
      submittedAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    return Response.json({ application: summarise(created.id, { status: "submitted", applicantType: typedApplicantType, submittedAt: Timestamp.now() }) }, { status: 201 });
  } catch (error) {
    console.error("Could not create a Pay Later application.", error);
    return jsonError("We could not submit your Pay Later application.", 500);
  }
}
