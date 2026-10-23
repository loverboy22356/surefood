export type SellerDocumentType = "business-registration" | "proof-of-address" | "nin";

export function sellerCanManageListings(
  profile: { verificationStatus?: unknown; approvalFeeStatus?: unknown } | null | undefined,
) {
  if (!profile || profile.verificationStatus !== "approved") return false;
  // Accounts approved before fees went live have no approvalFeeStatus and stay grandfathered.
  return !profile.approvalFeeStatus || profile.approvalFeeStatus === "paid";
}

export function sellerNeedsApprovalFee(
  profile: { verificationStatus?: unknown; approvalFeeStatus?: unknown } | null | undefined,
) {
  return profile?.verificationStatus === "approved" &&
    Boolean(profile.approvalFeeStatus) &&
    profile.approvalFeeStatus !== "paid";
}

/**
 * Vendors sell direct to customers, so they are verified on identity and address only.
 * Suppliers trade wholesale and must still prove a registered business (CAC or the
 * local equivalent) before their listings go live.
 */
export function sellerNeedsBusinessRegistration(role: unknown) {
  return role !== "vendor";
}

export function requiredSellerDocuments(role: unknown): SellerDocumentType[] {
  return sellerNeedsBusinessRegistration(role)
    ? ["business-registration", "proof-of-address", "nin"]
    : ["proof-of-address", "nin"];
}
