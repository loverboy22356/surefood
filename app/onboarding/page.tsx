"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Country } from "country-state-city";
import { onAuthStateChanged, type User } from "firebase/auth";
import { useEffect, useState } from "react";
import { firebaseAuth, firebaseConfigured } from "@/lib/firebase/client";
import { requiredSellerDocuments, sellerNeedsBusinessRegistration } from "@/lib/auth/seller-verification";

type DocumentType = "business-registration" | "proof-of-address" | "nin";
type DocumentStatus = Record<DocumentType, boolean>;

const allowedTypes = new Set(["application/pdf", "image/jpeg", "image/png"]);
const money = new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 });
const automaticRegistryCountries = new Set(["NG", "KE", "ZA"]);
const countryOptions = Country.getAllCountries().sort((left, right) => left.name.localeCompare(right.name));

export default function BusinessOnboardingPage() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [documents, setDocuments] = useState<DocumentStatus>({
    "business-registration": false,
    "proof-of-address": false,
    nin: false,
  });
  const [status, setStatus] = useState("incomplete");
  const [registryConfigured, setRegistryConfigured] = useState(false);
  const [registryStatus, setRegistryStatus] = useState("not_checked");
  const [skipAutomaticRegistryCheck, setSkipAutomaticRegistryCheck] = useState(false);
  const [reviewNote, setReviewNote] = useState("");
  const [role, setRole] = useState<"vendor" | "supplier">("vendor");
  const [approvalFeeMinor, setApprovalFeeMinor] = useState(0);
  const [approvalFeeStatus, setApprovalFeeStatus] = useState("not_required");
  const router = useRouter();
  const [feeBusy, setFeeBusy] = useState(false);
  const [business, setBusiness] = useState({
    businessName: "",
    registrationNumber: "",
    address: "",
    city: "",
    region: "",
    postalCode: "",
  });
  const [businessType, setBusinessType] = useState("co");
  const [country, setCountry] = useState("NG");
  const [latitude, setLatitude] = useState<number | undefined>();
  const [longitude, setLongitude] = useState<number | undefined>();
  const [busy, setBusy] = useState(false);
  const [uploadingDocument, setUploadingDocument] = useState<DocumentType | null>(null);
  const [documentUploadError, setDocumentUploadError] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  // Vendors are verified on identity and address only; suppliers must also prove a registered business.
  const needsRegistration = sellerNeedsBusinessRegistration(role);
  const requiredDocuments = requiredSellerDocuments(role) as DocumentType[];

  useEffect(() => {
    if (!firebaseConfigured()) {
      setAuthReady(true);
      return;
    }
    return onAuthStateChanged(firebaseAuth(), async (currentUser) => {
      setUser(currentUser);
      setAuthReady(true);
      if (!currentUser) return;
      try {
        const token = await currentUser.getIdToken();
        const response = await fetch("/api/onboarding", { headers: { authorization: `Bearer ${token}` } });
        if (!response.ok) {
          const result = await response.json();
          throw new Error(result.error || "Could not load your verification status.");
        }
        const result = await response.json();
        setStatus(result.verificationStatus);
        setRegistryStatus(result.registryStatus || "not_checked");
        setRegistryConfigured(Boolean(result.automaticVerificationConfigured));
        setReviewNote(result.verificationReviewNote || "");
        setRole(result.role === "supplier" ? "supplier" : "vendor");
        setApprovalFeeMinor(Number(result.approvalFeeMinor) || 0);
        setApprovalFeeStatus(String(result.approvalFeeStatus || "not_required"));
        if (result.business) {
          setBusiness({
            businessName: result.business.businessName || "",
            registrationNumber: result.business.registrationNumber || "",
            address: result.business.address || "",
            city: result.business.city || "",
            region: result.business.region || "",
            postalCode: result.business.postalCode || "",
          });
          setCountry(result.business.country || "NG");
          setBusinessType(result.business.businessType || "co");
        }
        setDocuments({
          "business-registration": Boolean(result.documents?.businessRegistration),
          "proof-of-address": Boolean(result.documents?.proofOfAddress),
          nin: Boolean(result.documents?.nin),
        });
      } catch (reason) {
        console.error("Could not load the business onboarding status.", reason);
        setError("We could not load your verification status. Refresh the page to try again.");
      }
    });
  }, []);

  useEffect(() => {
    if (!user || status !== "approved" || approvalFeeStatus !== "paid") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("reference") || params.get("trxref")) return;
    setNotice("Your business is verified. Taking you to your dashboard…");
    const destination = role === "supplier" ? "/supplier" : "/vendor";
    const timer = window.setTimeout(() => router.replace(destination), 1_200);
    return () => window.clearTimeout(timer);
  }, [user, status, approvalFeeStatus, role, router]);

  useEffect(() => {
    if (!user || status !== "approved") return;
    const params = new URLSearchParams(window.location.search);
    const reference = params.get("reference") || params.get("trxref");
    if (!reference || !reference.startsWith("sf_fee_")) return;
    let active = true;
    void (async () => {
      setFeeBusy(true);
      setError("");
      try {
        const token = await user.getIdToken();
        const response = await fetch("/api/payments/approval-fee/verify", {
          method: "POST",
          headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
          body: JSON.stringify({ reference }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Could not verify your approval fee payment.");
        if (!active) return;
        setApprovalFeeStatus("paid");
        setNotice("Your approval fee payment is confirmed. Product listings are now unlocked.");
        window.history.replaceState(null, "", "/onboarding");
        window.setTimeout(() => router.replace(role === "supplier" ? "/supplier" : "/vendor"), 1_200);
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : "Could not verify your approval fee payment.");
      } finally {
        if (active) setFeeBusy(false);
      }
    })();
    return () => { active = false; };
  }, [status, user, role, router]);

  async function payApprovalFee() {
    if (!user) {
      setError("Sign in to pay your approval fee.");
      return;
    }
    setFeeBusy(true);
    setError("");
    setNotice("");
    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/payments/approval-fee", {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not start the approval fee payment.");
      if (typeof result.authorizationUrl !== "string") throw new Error("Paystack did not return a checkout link.");
      window.location.assign(result.authorizationUrl);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not start the approval fee payment.");
      setFeeBusy(false);
    }
  }

  function canReplaceDocument(currentStatus: string) {
    return !["approved", "pending_review", "manual_review", "registry_check_pending", "registry_check_submitting"].includes(currentStatus);
  }

  function canUploadMissingDocuments(currentStatus: string) {
    return ["pending_review", "manual_review", "registry_check_pending", "registry_check_submitting"].includes(currentStatus);
  }

  async function uploadDocument(type: DocumentType, file: File | undefined) {
    setError("");
    setDocumentUploadError("");
    setNotice("");
    if (!user) {
      setError("Sign in to upload verification documents.");
      return;
    }
    if (!file) return;
    if (!allowedTypes.has(file.type) || file.size > 15 * 1024 * 1024) {
      setError("Choose a PDF, JPG, or PNG file smaller than 15 MB.");
      return;
    }
    if (documents[type] && !canReplaceDocument(status)) {
      setError("This document has already been uploaded and is locked while the application is being reviewed.");
      return;
    }
    setBusy(true);
    setUploadingDocument(type);
    try {
      const token = await user.getIdToken();
      const form = new FormData();
      form.append("documentType", type);
      form.append("file", file);
      const uploadResponse = await fetch("/api/onboarding/documents", {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
        body: form,
      });
      const uploadData = await uploadResponse.json();
      if (!uploadResponse.ok) throw new Error(uploadData.error || "Could not upload the verification document.");
      setDocuments((current) => ({ ...current, [type]: true }));
      setNotice("Document uploaded securely to Cloudinary.");
    } catch (reason) {
      console.error("Could not upload a verification document.", reason);
      setDocumentUploadError(
        reason instanceof TypeError
          ? "Could not reach SureFood's upload service. Check your connection and try again."
          : reason instanceof Error
            ? reason.message
            : "Document upload failed.",
      );
    } finally {
      setBusy(false);
      setUploadingDocument(null);
    }
  }

  function useCurrentLocation() {
    setError("");
    if (!navigator.geolocation) {
      setError("This browser does not support location access. Enter your business address manually.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLatitude(coords.latitude);
        setLongitude(coords.longitude);
        setNotice("Current location added. Your address document will be checked separately.");
      },
      (reason) => setError(reason.message || "Location permission was denied. Enter your address manually."),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  async function submitApplication(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) {
      setError("Sign in with your vendor or supplier account to continue.");
      return;
    }
    if (requiredDocuments.some((type) => !documents[type])) {
      setError(needsRegistration
        ? "Upload your business registration, proof of address, and NIN document first."
        : "Upload your proof of address and NIN document first.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    const form = new FormData(event.currentTarget);
    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/onboarding", {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({
          businessName: form.get("businessName"),
          registrationNumber: needsRegistration ? form.get("registrationNumber") : "",
          country,
          businessType,
          skipAutomaticRegistryCheck,
          address: form.get("address"),
          city: form.get("city"),
          region: form.get("region"),
          postalCode: form.get("postalCode"),
          latitude,
          longitude,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not submit your business verification.");
      setStatus(result.verificationStatus);
      setRegistryStatus(result.registryStatus || "manual_review");
      setReviewNote("");
      setNotice(result.message);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not submit your business verification.");
    } finally {
      setBusy(false);
    }
  }

  async function resubmitDocuments() {
    if (!user) {
      setError("Sign in with your vendor or supplier account to continue.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    setDocumentUploadError("");
    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/onboarding/resubmit", {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
      });
      const result = await response.json();
      if (!response.ok) {
        const missingDocuments = Array.isArray(result.missingDocuments)
          ? result.missingDocuments.filter((type: unknown): type is DocumentType =>
            type === "business-registration" || type === "proof-of-address" || type === "nin")
          : [];
        if (missingDocuments.length) {
          setDocuments((current) => ({
            ...current,
            ...(missingDocuments.includes("business-registration") ? { "business-registration": false } : {}),
            ...(missingDocuments.includes("proof-of-address") ? { "proof-of-address": false } : {}),
            ...(missingDocuments.includes("nin") ? { nin: false } : {}),
          }));
        }
        throw new Error(result.error || "Could not submit the updated documents.");
      }
      setReviewNote("");
      setNotice(result.message);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not submit the updated documents.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="onboarding-page">
      <header className="onboarding-header"><Link href="/" className="brand"><span className="brand-mark">s</span><span>sure<span>food</span></span></Link><Link href="/">Back to shop →</Link></header>
      <section className="onboarding-card">
        <span className="auth-overline">VENDOR & SUPPLIER SETUP</span>
        <h1>Verify your business</h1>
        <p className="onboarding-intro">{needsRegistration ? "Add your business details and upload your registration certificate, proof of address, and NIN document." : "Add your business details and upload your proof of address and NIN document. Vendors do not need a CAC or business registration document."} Your documents are stored privately and reviewed by SureFood staff.</p>
        {!authReady ? <p>Checking your sign-in...</p> : !user ? <p className="onboarding-state">Sign in with your vendor or supplier email to continue. <Link href="/login">Sign in →</Link></p> : (
          <>
            <div className={`verification-status status-${status.replaceAll("_", "-")}`} role="status"><strong>Verification status</strong><span>{status.replaceAll("_", " ")}</span></div>
            {status === "approved" ? <div className="onboarding-state">
              <p>Your business account is approved.</p>
              {approvalFeeStatus === "paid" ? <p>Your approval fee is paid. You can now list products and manage your SureFood store.</p>
                : <div className="onboarding-fee-card">
                  <strong>{role === "supplier" ? "Supplier" : "Vendor"} approval fee: {money.format((approvalFeeMinor || (role === "supplier" ? 5_000_00 : 2_000_00)) / 100)}</strong>
                  <p>The one-time, non-refundable approval fee unlocks product listings for your business. Pay it securely with Paystack to finish verification.</p>
                  <button className="auth-submit" type="button" disabled={feeBusy} onClick={() => void payApprovalFee()}>{feeBusy ? "Opening Paystack…" : `Pay ${money.format((approvalFeeMinor || (role === "supplier" ? 5_000_00 : 2_000_00)) / 100)} now`} <span>→</span></button>
                </div>}
            </div>
              : status === "registry_check_pending" || status === "registry_check_submitting" ? <div className="onboarding-state"><p>Your business registration number is being checked against the official registry. Seller listings remain disabled until every required verification step passes.</p>{reviewNote && <p>Verification note: {reviewNote}</p>}</div>
                : status === "pending_review" || status === "manual_review" ? <div className="onboarding-state"><p>{registryStatus === "verified" ? "The automatic business registry check passed." : needsRegistration ? "Your application is in manual review. Staff will verify the business registration with the official registry and review your address and identity documents." : "Your application is in manual review. Staff will review your proof of address and NIN document."} Seller listings remain disabled until staff approval.</p>{reviewNote && <p>Reviewer note: {reviewNote}</p>}</div>
                : (
              <form className="onboarding-form" key={`${status}-${business.registrationNumber}`} onSubmit={submitApplication}>
                {status === "rejected" && <p className="onboarding-review-note">Your application needs changes before it can be approved. Please review the staff note, update your details or documents, and resubmit.{reviewNote && <><br /><strong>Staff note: {reviewNote}</strong></>}</p>}
                <label>{needsRegistration ? "Registered business name" : "Business name"}<input name="businessName" defaultValue={business.businessName} required maxLength={150} placeholder={needsRegistration ? "Name on your registration" : "Your shop or trading name"} /></label>
                <label>Country<select value={country} onChange={(event) => setCountry(event.target.value)}>{countryOptions.map((option) => <option key={option.isoCode} value={option.isoCode}>{option.name}</option>)}</select></label>
                {needsRegistration && country === "NG" && <label>Registration type<select value={businessType} onChange={(event) => setBusinessType(event.target.value)}><option value="co">Private or public limited company</option><option value="bn">Business name</option><option value="it">Incorporated trustees</option></select></label>}
                {needsRegistration && <label>{country === "NG" ? "CAC registration number" : "Business registration number"}<input name="registrationNumber" defaultValue={business.registrationNumber} required maxLength={80} placeholder={country === "NG" ? "CAC RC or BN number" : "Registration number"} /><small>Enter the number exactly as it appears on your uploaded registration document.</small></label>}
                <label className="onboarding-full">Business address<input name="address" defaultValue={business.address} required maxLength={240} placeholder="Street address and neighbourhood" /></label>
                <div className="onboarding-fields"><label>City<input name="city" defaultValue={business.city} required maxLength={100} placeholder="City" /></label><label>State / region<input name="region" defaultValue={business.region} required maxLength={100} placeholder="State or region" /></label></div>
                <label>Postal code <span>{country === "KE" && needsRegistration ? "(required for the registry check)" : "(if applicable)"}</span><input name="postalCode" defaultValue={business.postalCode} maxLength={20} placeholder="Postal code" required={needsRegistration && country === "KE" && automaticRegistryCountries.has(country) && registryConfigured} /></label>
                {needsRegistration && automaticRegistryCountries.has(country) && registryConfigured && <label className="onboarding-full onboarding-skip-check">
                  <input type="checkbox" checked={skipAutomaticRegistryCheck} onChange={(event) => setSkipAutomaticRegistryCheck(event.target.checked)} />
                  Skip automatic verification and send my application for manual review
                </label>}
                <button className="location-detect" type="button" onClick={useCurrentLocation}>⌖ {latitude === undefined ? "Use my current location" : `Location captured (${latitude.toFixed(3)}, ${longitude?.toFixed(3)})`}</button>
                <div className="document-upload-list">
                    {needsRegistration && <DocumentUpload type="business-registration" title="Business registration" done={documents["business-registration"]} allowReplace={canReplaceDocument(status)} busy={busy} uploading={uploadingDocument === "business-registration"} onUpload={uploadDocument} />}
                    <DocumentUpload type="proof-of-address" title="Utility bill / proof of address" done={documents["proof-of-address"]} allowReplace={canReplaceDocument(status)} busy={busy} uploading={uploadingDocument === "proof-of-address"} onUpload={uploadDocument} />
                    <DocumentUpload type="nin" title="NIN document (National Identification Number)" done={documents.nin} allowReplace={canReplaceDocument(status)} busy={busy} uploading={uploadingDocument === "nin"} onUpload={uploadDocument} />
                </div>
                <button className="auth-submit" type="submit" disabled={busy}>{busy ? "Submitting..." : "Submit for verification"} <span>→</span></button>
                <p className="onboarding-note">{needsRegistration ? "Staff review your business registration, proof of address, and NIN." : "Vendors are verified with proof of address and a NIN document; no CAC or business registration document is needed."} You cannot list products until your seller account is approved. A GPS location does not replace proof of address.</p>
              </form>
            )}
            {canUploadMissingDocuments(status) && <div className="onboarding-state">
              <p>Upload any missing documents below while your application is under review. Documents already uploaded are locked until staff requests a replacement.</p>
              <div className="document-upload-list">
                {needsRegistration && <DocumentUpload type="business-registration" title="Business registration" done={documents["business-registration"]} allowReplace={false} busy={busy} uploading={uploadingDocument === "business-registration"} onUpload={uploadDocument} />}
                <DocumentUpload type="proof-of-address" title="Utility bill / proof of address" done={documents["proof-of-address"]} allowReplace={false} busy={busy} uploading={uploadingDocument === "proof-of-address"} onUpload={uploadDocument} />
                <DocumentUpload type="nin" title="NIN document (National Identification Number)" done={documents.nin} allowReplace={false} busy={busy} uploading={uploadingDocument === "nin"} onUpload={uploadDocument} />
              </div>
              <button className="auth-submit" type="button" disabled={busy || requiredDocuments.some((type) => !documents[type])} onClick={() => void resubmitDocuments()}>
                {busy ? "Submitting…" : "Submit updated documents for review"} <span>→</span>
              </button>
              {documentUploadError && <p className="auth-error" role="alert">{documentUploadError}</p>}
            </div>}
          </>
        )}
        {notice && <p className="onboarding-notice" role="status">{notice}</p>}
        {error && <p className="auth-error" role="alert">{error}</p>}
      </section>
    </main>
  );
}

function DocumentUpload({ type, title, done, allowReplace, busy, uploading, onUpload }: {
  type: DocumentType;
  title: string;
  done: boolean;
  allowReplace: boolean;
  busy: boolean;
  uploading: boolean;
  onUpload: (type: DocumentType, file: File | undefined) => void;
}) {
  const id = `document-${type}`;
  return (
    <div className={`document-upload ${done ? "uploaded" : ""}`}>
      <div><strong>{title}</strong><small>{uploading ? "Uploading securely…" : done ? allowReplace ? "Uploaded securely · replace if needed" : "Uploaded securely" : "PDF, JPG, or PNG · max 15 MB"}</small></div>
      <label htmlFor={id}>{uploading ? "Uploading…" : done ? allowReplace ? "Replace file" : "Uploaded ✓" : "Choose file"}</label>
      <input id={id} type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" disabled={busy || done && !allowReplace} onChange={(event) => {
        const file = event.target.files?.[0];
        onUpload(type, file);
        event.target.value = "";
      }} />
    </div>
  );
}
