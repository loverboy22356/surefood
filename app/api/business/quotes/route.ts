import { Timestamp } from "firebase-admin/firestore";
import { authenticatedUser } from "@/lib/auth/server";
import { adminDb, firebaseAdminConfigured } from "@/lib/firebase/admin";
import { cleanString, isEmail, jsonError, readJson } from "@/lib/http";
import { isValidPhone } from "@/lib/requests";
import { isBusinessType, isOrderRhythm } from "@/lib/business";

/**
 * A written quotation request from a business. Public on purpose: a buyer can
 * ask before creating an account, and the queue keeps the lead either way.
 */
export async function POST(request: Request) {
  if (!firebaseAdminConfigured()) {
    return jsonError("Quotation requests are unavailable until Firebase Admin is configured.", 503);
  }
  const body = await readJson(request);
  if (!body) return jsonError("Enter valid quotation details.", 400);

  const businessName = cleanString(body.businessName, 140);
  const contactName = cleanString(body.contactName, 120);
  const email = cleanString(body.email, 160).toLowerCase();
  const phone = cleanString(body.phone, 20);
  const businessType = cleanString(body.businessType, 30);
  const needs = cleanString(body.needs, 600);
  const quantity = cleanString(body.quantity, 200);
  const rhythm = cleanString(body.rhythm, 20) || "one-off";
  const address = cleanString(body.address, 240);
  const city = cleanString(body.city, 80);
  const region = cleanString(body.region, 80);
  const notes = cleanString(body.notes, 400);

  if (!businessName) return jsonError("Tell us the name of your business.", 400);
  if (!contactName) return jsonError("Tell us who we should speak to.", 400);
  if (!isEmail(email)) return jsonError("Enter a valid email address.", 400);
  if (!isValidPhone(phone)) return jsonError("Enter a phone number we can reach you on.", 400);
  if (!(isBusinessType(businessType))) return jsonError("Choose the type of business you run.", 400);
  if (needs.length < 5) return jsonError("List the products you need a price for.", 400);
  if (!isOrderRhythm(rhythm)) return jsonError("Choose how often you would like deliveries.", 400);
  if (body.consent !== true) return jsonError("Please agree to be contacted about this quotation.", 400);

  try {
    const user = await authenticatedUser(request);
    const reference = `QT-${Date.now().toString(36).toUpperCase().slice(-6)}`;
    const now = Timestamp.now();
    const quote = {
      reference,
      uid: user?.uid ?? "",
      accountEmail: String(user?.email ?? ""),
      businessName,
      contactName,
      email,
      phone,
      businessType,
      needs,
      quantity,
      rhythm,
      address,
      city,
      region,
      notes,
      status: "requested",
      quoteNote: "",
      quotedTotalMinor: null,
      createdAt: now,
      updatedAt: now,
    };
    const document = adminDb().collection("quotationRequests").doc();
    await document.set(quote);
    return Response.json({ reference, id: document.id }, { status: 201 });
  } catch (error) {
    console.error("Could not save a quotation request.", error);
    return jsonError("We could not send your quotation request. Please try again.", 500);
  }
}
