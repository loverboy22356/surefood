import { Timestamp } from "firebase-admin/firestore";
import { authenticatedUser } from "@/lib/auth/server";
import { adminDb } from "@/lib/firebase/admin";
import { cleanString, isEmail, jsonError, readJson } from "@/lib/http";
import { isEventType, isValidPhone, planningTierFor } from "@/lib/requests";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await readJson(request);
  if (!body) return jsonError("Enter valid event order details.", 400);
  if (body.consent !== true) {
    return jsonError("Confirm that this is a request for a quote before sending it.", 400);
  }

  const fullName = cleanString(body.fullName, 120);
  const email = cleanString(body.email, 160).toLowerCase();
  const phone = cleanString(body.phone, 24);
  const eventType = body.eventType;
  const eventDate = cleanString(body.eventDate, 10);
  const guestCount = Number(body.guestCount);
  const deliveryAddress = cleanString(body.deliveryAddress, 240);
  const items = cleanString(body.items, 2000);
  const notes = cleanString(body.notes, 600);

  if (fullName.length < 2) return jsonError("Enter your full name.", 400);
  if (!isEmail(email)) return jsonError("Enter a valid email address.", 400);
  if (!isValidPhone(phone)) return jsonError("Enter a valid phone number.", 400);
  if (!isEventType(eventType)) return jsonError("Choose the type of event.", 400);
  if (!Number.isInteger(guestCount) || guestCount < 10 || guestCount > 10_000) {
    return jsonError("Enter a guest count between 10 and 10,000.", 400);
  }
  const tier = planningTierFor(eventDate);
  if (!tier || tier.days > 365) {
    return jsonError("Choose an event date between tomorrow and one year from now.", 400);
  }
  if (deliveryAddress.length < 5) return jsonError("Enter the delivery address or city.", 400);
  if (items.length < 10) return jsonError("List the food items and quantities you need.", 400);

  try {
    const user = await authenticatedUser(request);
    const created = await adminDb().collection("specialOrders").add({
      uid: user?.uid ?? "",
      accountEmail: user?.email ?? "",
      fullName,
      email,
      phone,
      eventType,
      eventDate,
      guestCount,
      deliveryAddress,
      items,
      notes,
      tier: { id: tier.id, label: tier.label, days: tier.days },
      status: "requested",
      quoteNote: "",
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    return Response.json({
      reference: `EO-${created.id.slice(0, 6).toUpperCase()}`,
      tierLabel: tier.label,
      eventDate,
    }, { status: 201 });
  } catch (error) {
    console.error("Could not save a special order request.", error);
    return jsonError("We could not send your event order request.", 500);
  }
}
