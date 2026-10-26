import { adminDb, firebaseAdminConfigured } from "@/lib/firebase/admin";
import { AFFILIATE_COMMISSION_RATE, AFFILIATE_MIN_PAYOUT_MINOR } from "@/lib/affiliates";
import { DEFAULT_PRODUCT_CATEGORIES } from "@/lib/product-categories";

export const runtime = "nodejs";

type SharePage = { name: string; copy: string; href: string };
type Tactic = { title: string; copy: string };
type Campaign = { id: string; title: string; copy: string; endsAt: string | null };

const PROGRAMME_DOC = "settings/affiliate";

/**
 * These are the programme's own terms, not page decoration: the dashboard reads
 * them from here so the copy always matches what the payouts code actually does.
 */
const programmeRules = [
  "Commission is earned on paid orders only, never on cancelled or unpaid ones.",
  "Your own orders never earn commission.",
  "Payouts are sent by hand — allow up to five working days.",
  "Accounts that self-refer or send fake traffic are paused.",
];

const shareTactics: Tactic[] = [
  { title: "Use social media", copy: "WhatsApp status, Facebook groups and X are where most SureFood orders start." },
  { title: "Show the basket", copy: "Post a photo of what you actually bought — real food converts better than a banner." },
  { title: "Share during meal times", copy: "Late morning and early evening is when people plan what to cook." },
];

function cleanStrings(value: unknown, limit: number) {
  if (!Array.isArray(value)) return null;
  const items = value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => item.length > 1 && item.length <= limit)
    .slice(0, 12);
  return items.length ? items : null;
}

function cleanSharePages(value: unknown) {
  if (!Array.isArray(value)) return null;
  const pages: SharePage[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const page = entry as Record<string, unknown>;
    const name = typeof page.name === "string" ? page.name.trim().slice(0, 60) : "";
    const copy = typeof page.copy === "string" ? page.copy.trim().slice(0, 160) : "";
    const href = typeof page.href === "string" && page.href.startsWith("/") ? page.href.slice(0, 160) : "";
    if (!name || !href) continue;
    pages.push({ name, copy, href });
    if (pages.length === 6) break;
  }
  return pages.length ? pages : null;
}

function cleanTactics(value: unknown) {
  if (!Array.isArray(value)) return null;
  const tactics: Tactic[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const tactic = entry as Record<string, unknown>;
    const title = typeof tactic.title === "string" ? tactic.title.trim().slice(0, 60) : "";
    const copy = typeof tactic.copy === "string" ? tactic.copy.trim().slice(0, 180) : "";
    if (!title || !copy) continue;
    tactics.push({ title, copy });
    if (tactics.length === 6) break;
  }
  return tactics.length ? tactics : null;
}

function toIso(value: unknown) {
  const millis = (value as { toMillis?: () => number } | undefined)?.toMillis?.();
  return millis ? new Date(millis).toISOString() : null;
}

/** Category pages built from the live catalogue, so the links point at real stock. */
async function categorySharePages(): Promise<SharePage[]> {
  try {
    const snapshot = await adminDb().collection("products").where("status", "==", "active").limit(400).get();
    const counts = new Map<string, number>();
    for (const document of snapshot.docs) {
      const category = String(document.data().category ?? "").trim();
      if (category) counts.set(category, (counts.get(category) ?? 0) + 1);
    }
    const ranked = [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 3);
    const fallback = DEFAULT_PRODUCT_CATEGORIES.slice(0, 3).map((name) => [name, 0] as [string, number]);
    return (ranked.length ? ranked : fallback).map(([name, count]) => ({
      name,
      copy: count ? `${count} product${count === 1 ? "" : "s"} ready to order in this aisle.` : "A busy aisle shoppers keep coming back to.",
      href: `/search?q=${encodeURIComponent(name)}`,
    }));
  } catch (error) {
    console.error("Could not build affiliate share pages from the catalogue.", error);
    return DEFAULT_PRODUCT_CATEGORIES.slice(0, 3).map((name) => ({
      name,
      copy: "A busy aisle shoppers keep coming back to.",
      href: `/search?q=${encodeURIComponent(name)}`,
    }));
  }
}

/** Bonus campaigns live in Firestore; only the running ones are published. */
async function activeCampaigns(): Promise<Campaign[]> {
  try {
    const snapshot = await adminDb().collection("affiliateCampaigns").where("active", "==", true).limit(10).get();
    const now = Date.now();
    return snapshot.docs
      .map((document) => {
        const data = document.data();
        const endsAt = toIso(data.endsAt);
        return {
          id: document.id,
          title: String(data.title ?? "").trim().slice(0, 90),
          copy: String(data.copy ?? "").trim().slice(0, 220),
          endsAt,
          expired: endsAt ? new Date(endsAt).getTime() < now : false,
        };
      })
      .filter((campaign) => campaign.title && !campaign.expired)
      .map(({ id, title, copy, endsAt }) => ({ id, title, copy, endsAt }));
  } catch (error) {
    console.error("Could not load affiliate campaigns.", error);
    return [];
  }
}

export async function GET() {
  const programme = {
    commissionRate: AFFILIATE_COMMISSION_RATE,
    minPayoutMinor: AFFILIATE_MIN_PAYOUT_MINOR,
    attributionDays: 90,
    currency: "NGN",
    supportEmail: String(process.env.SUREFOOD_SUPPORT_EMAIL || "support@surefoodz.com"),
    rules: programmeRules,
    tactics: shareTactics,
    sharePages: [] as SharePage[],
  };

  if (!firebaseAdminConfigured()) {
    return Response.json({ programme, campaigns: [] }, { headers: { "cache-control": "no-store" } });
  }

  try {
    const settings = await adminDb().doc(PROGRAMME_DOC).get();
    const stored = settings.exists ? settings.data() ?? {} : {};

    const commissionRate = Number(stored.commissionRate);
    if (Number.isFinite(commissionRate) && commissionRate > 0 && commissionRate <= 0.5) {
      programme.commissionRate = commissionRate;
    }
    const minPayoutMinor = Number(stored.minPayoutMinor);
    if (Number.isSafeInteger(minPayoutMinor) && minPayoutMinor >= 0) {
      programme.minPayoutMinor = minPayoutMinor;
    }
    const attributionDays = Number(stored.attributionDays);
    if (Number.isSafeInteger(attributionDays) && attributionDays > 0 && attributionDays <= 365) {
      programme.attributionDays = attributionDays;
    }
    if (typeof stored.supportEmail === "string" && stored.supportEmail.includes("@")) {
      programme.supportEmail = stored.supportEmail.trim().slice(0, 160);
    }
    programme.rules = cleanStrings(stored.rules, 220) ?? programme.rules;
    programme.tactics = cleanTactics(stored.tactics) ?? programme.tactics;
    programme.sharePages = cleanSharePages(stored.sharePages) ?? (await categorySharePages());

    const campaigns = await activeCampaigns();
    return Response.json(
      { programme, campaigns },
      { headers: { "cache-control": "public, max-age=0, s-maxage=60, stale-while-revalidate=300" } },
    );
  } catch (error) {
    console.error("Could not load the affiliate programme settings.", error);
    programme.sharePages = await categorySharePages();
    return Response.json(
      { programme, campaigns: [] },
      { headers: { "cache-control": "public, max-age=0, s-maxage=60, stale-while-revalidate=300" } },
    );
  }
}
