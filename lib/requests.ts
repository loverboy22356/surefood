// Shared rules for SureFood's Pay Later (buy now, pay later) applications and
// special/event food orders. Used by the public forms, the APIs and staff queues.

export const payLaterApplicantTypes = ["business", "government-employee", "private-employee"] as const;
export type PayLaterApplicantType = (typeof payLaterApplicantTypes)[number];

export const payLaterApplicantLabels: Record<PayLaterApplicantType, string> = {
  business: "Business owner",
  "government-employee": "Government employee",
  "private-employee": "Private-sector employee",
};

export function isPayLaterApplicantType(value: unknown): value is PayLaterApplicantType {
  return payLaterApplicantTypes.includes(String(value) as PayLaterApplicantType);
}

export const payLaterDocumentTypes = [
  "business-registration",
  "employment-letter",
  "proof-of-income",
  "nin-slip",
  "utility-bill",
] as const;
export type PayLaterDocumentType = (typeof payLaterDocumentTypes)[number];

export const payLaterDocumentLabels: Record<PayLaterDocumentType, string> = {
  "business-registration": "Business registration certificate",
  "employment-letter": "Employment letter",
  "proof-of-income": "Proof of income",
  "nin-slip": "NIN slip or NIN record",
  "utility-bill": "NEPA / electricity bill",
};

export const payLaterDocumentHelp: Record<PayLaterDocumentType, string> = {
  "business-registration": "Certificate showing your business name and number",
  "employment-letter": "Letter from your employer confirming your role and staff number",
  "proof-of-income": "Recent payslip, bank statement or sales records",
  "nin-slip": "Your National Identification Number slip or national ID card showing the NIN",
  "utility-bill": "Electricity (NEPA) bill in your name, dated in the last three months — it proves where you live",
};

export function isPayLaterDocumentType(value: unknown): value is PayLaterDocumentType {
  return payLaterDocumentTypes.includes(String(value) as PayLaterDocumentType);
}

/**
 * Documents an applicant must provide before the application can be submitted.
 * Everyone proves who they are (NIN) and where they live (electricity bill),
 * then proves how they earn.
 */
export function requiredPayLaterDocuments(applicantType: PayLaterApplicantType): PayLaterDocumentType[] {
  const identity: PayLaterDocumentType[] = ["nin-slip", "utility-bill"];
  return applicantType === "business"
    ? [...identity, "business-registration"]
    : [...identity, "employment-letter"];
}

export const governmentLevels = ["federal", "state", "local"] as const;
export type GovernmentLevel = (typeof governmentLevels)[number];

export function isGovernmentLevel(value: unknown): value is GovernmentLevel {
  return governmentLevels.includes(String(value) as GovernmentLevel);
}

export const payLaterStatuses = ["submitted", "approved", "declined"] as const;
export type PayLaterStatus = (typeof payLaterStatuses)[number];

export const eventTypes = ["wedding", "birthday", "corporate", "festival", "religious", "other"] as const;
export type EventType = (typeof eventTypes)[number];

export const eventTypeLabels: Record<EventType, string> = {
  wedding: "Wedding",
  birthday: "Birthday or anniversary",
  corporate: "Corporate event",
  festival: "Festival or celebration",
  religious: "Religious gathering",
  other: "Something else",
};

export function isEventType(value: unknown): value is EventType {
  return eventTypes.includes(String(value) as EventType);
}

export const specialOrderStatuses = ["requested", "quoted", "confirmed", "declined"] as const;
export type SpecialOrderStatus = (typeof specialOrderStatuses)[number];

export type PlanningTierId = "early" | "advance" | "short-notice" | "last-minute";

/**
 * Event orders earn a bigger discount the earlier they are placed. The exact
 * percentage is confirmed by staff in the quote; the tier only states which
 * planning band the request falls into.
 */
export const eventPlanningTiers: { id: PlanningTierId; minDays: number; label: string; detail: string }[] = [
  { id: "early", minDays: 60, label: "Early planning band", detail: "Two months or more before the event — the largest event discount." },
  { id: "advance", minDays: 30, label: "Advance planning band", detail: "One month or more before the event — an event discount applies." },
  { id: "short-notice", minDays: 14, label: "Short-notice band", detail: "Two weeks or more before the event — a smaller event discount." },
  { id: "last-minute", minDays: 0, label: "Standard band", detail: "Under two weeks before the event — standard prices apply." },
];

export function planningTierFor(eventDate: string, today = new Date()) {
  const target = Date.parse(`${eventDate}T00:00:00Z`);
  if (!Number.isFinite(target)) return null;
  const startOfToday = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const days = Math.floor((target - startOfToday) / 86_400_000);
  if (days < 1) return null;
  const tier = eventPlanningTiers.find((candidate) => days >= candidate.minDays) ?? eventPlanningTiers[eventPlanningTiers.length - 1];
  return { days, ...tier };
}

export function isValidPhone(value: string) {
  return /^[+()\d\s.-]{7,24}$/.test(value.trim());
}

export function isValidFutureDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const tier = planningTierFor(value);
  return Boolean(tier && tier.days <= 365);
}
