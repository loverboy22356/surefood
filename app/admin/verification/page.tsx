"use client";

import Link from "next/link";
import { onAuthStateChanged, type User } from "firebase/auth";
import { useCallback, useEffect, useState } from "react";
import { firebaseAuth, firebaseConfigured } from "@/lib/firebase/client";

type Application = {
  uid: string;
  displayName: string;
  email: string;
  role: "vendor" | "supplier";
  phone: string;
  verificationStatus: string;
  registryStatus: string;
  registryCheck: {
    registrationMatches: boolean;
    businessNameMatches: boolean;
    active: boolean;
  } | null;
  submittedAt: string | null;
  business: {
    businessName: string;
    registrationNumber: string;
    country: string;
    address: string;
    city: string;
    region: string;
    postalCode: string;
    registrationDocumentUrl: string;
    addressProofUrl: string;
    ninDocumentUrl: string;
  };
};

type DocumentReviewChecks = {
  businessRegistrationValid: boolean;
  registryNumberVerified: boolean;
  proofOfAddressValid: boolean;
  ninMatchesApplicant: boolean;
};

// Vendors are verified on proof of address and NIN only; suppliers must also prove a registered business.
function needsRegistration(application: Application) {
  return application.role !== "vendor";
}

function documentsMissing(application: Application) {
  return (
    (needsRegistration(application) && !application.business.registrationDocumentUrl) ||
    !application.business.addressProofUrl ||
    !application.business.ninDocumentUrl
  );
}

function canApprove(application: Application, checks: DocumentReviewChecks | undefined) {
  if (!checks || documentsMissing(application)) return false;
  if (!checks.proofOfAddressValid || !checks.ninMatchesApplicant) return false;
  if (!needsRegistration(application)) return true;
  if (!checks.businessRegistrationValid) return false;
  return application.registryStatus === "verified" ||
    (["manual_review", "submission_failed", "not_checked"].includes(application.registryStatus) && checks.registryNumberVerified);
}

export default function ManualVerificationPage() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [staff, setStaff] = useState(false);
  const [applications, setApplications] = useState<Application[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [documentChecks, setDocumentChecks] = useState<Record<string, DocumentReviewChecks>>({});
  const [busyUid, setBusyUid] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadQueue = useCallback(async (currentUser: User) => {
    setLoading(true);
    setError("");
    try {
      const token = await currentUser.getIdToken();
      const response = await fetch("/api/admin/accounts/verification", {
        headers: { authorization: `Bearer ${token}` },
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not load the verification queue.");
      setApplications(result.applications);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load the verification queue.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!firebaseConfigured()) {
      setError("Firebase is not configured. Set up the server and client environment before reviewing applications.");
      setAuthReady(true);
      return;
    }
    return onAuthStateChanged(firebaseAuth(), async (currentUser) => {
      setUser(currentUser);
      setAuthReady(true);
      setStaff(false);
      setApplications([]);
      if (!currentUser) return;
      try {
        const token = await currentUser.getIdTokenResult();
        const isStaff = token.claims.role === "staff" || token.claims.role === "admin";
        setStaff(isStaff);
        if (!isStaff) {
          setError("A SureFood staff or admin account is required to review business applications.");
          return;
        }
        await loadQueue(currentUser);
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "Could not verify staff access.");
      }
    });
  }, [loadQueue]);

  async function review(application: Application, status: "approved" | "rejected") {
    if (!user) return;
    const note = notes[application.uid]?.trim() ?? "";
    if (status === "rejected" && !note) {
      setError("Add a review note before rejecting an application.");
      return;
    }
    setBusyUid(application.uid);
    setError("");
    setNotice("");
    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/admin/accounts/${encodeURIComponent(application.uid)}/verification`, {
        method: "PATCH",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ status, note, documentChecks: documentChecks[application.uid] }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not save this review.");
      setApplications((current) => current.filter((item) => item.uid !== application.uid));
      setNotice(`${application.business.businessName || application.displayName} marked ${status}.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save this review.");
    } finally {
      setBusyUid("");
    }
  }

  function updateDocumentCheck(uid: string, check: keyof DocumentReviewChecks, checked: boolean) {
    setDocumentChecks((current) => {
      const existing = current[uid] ?? {
        businessRegistrationValid: false,
        registryNumberVerified: false,
        proofOfAddressValid: false,
        ninMatchesApplicant: false,
      };
      return { ...current, [uid]: { ...existing, [check]: checked } };
    });
  }

  return (
    <main className="manual-review-page">
      <header className="manual-review-header">
        <Link href="/" className="brand"><span className="brand-mark">s</span><span>sure<span>food</span></span></Link>
        <div><span>STAFF WORKSPACE</span><h1>Business verification</h1><p>Vendor applications are checked on proof of address and NIN only. Supplier applications without an automatic registry result also require staff to check the official registry.</p></div>
        {staff && <button type="button" onClick={() => user && void loadQueue(user)} disabled={loading}>{loading ? "Refreshing…" : "Refresh queue"}</button>}
        {staff && <Link href="/admin/categories">Manage product categories →</Link>}
      </header>
      {error && <p className="manual-review-alert" role="alert">{error}</p>}
      {notice && <p className="manual-review-notice" role="status">{notice}</p>}
      {!authReady ? <p className="manual-review-empty">Checking staff access…</p>
        : !user ? <p className="manual-review-empty">Sign in with a SureFood staff account to review applications. <Link href="/login">Sign in →</Link></p>
          : staff && loading && applications.length === 0 ? <p className="manual-review-empty">Loading submitted applications…</p>
            : staff && applications.length === 0 ? <section className="manual-review-empty">No business applications are waiting for review.</section>
              : staff && <section className="manual-review-list" aria-label="Applications awaiting review">
                {applications.map((application) => (
                  <article className="manual-review-card" key={application.uid}>
                    <div className="manual-review-card-heading">
                      <div><span className="manual-review-role">{application.role} · {application.verificationStatus.replaceAll("_", " ")}</span><h2>{application.business.businessName || application.displayName}</h2><p>{application.email} · {application.phone}</p><small>Last submitted: {application.submittedAt ? new Date(application.submittedAt).toLocaleString() : "Date unavailable"}</small></div>
                      <small>{application.role === "supplier" ? "Approval fee: ₦5,000" : application.role === "vendor" ? "Approval fee: ₦2,000" : "Approval fee: ₦0"}</small>
                    </div>
                    <dl className="manual-review-details">
                      {needsRegistration(application) && <div><dt>Registration number</dt><dd>{application.business.registrationNumber || "Not provided"}</dd></div>}
                      <div><dt>Country</dt><dd>{application.business.country || "Not provided"}</dd></div>
                      {needsRegistration(application) && <div><dt>Automated registry check</dt><dd>{application.registryStatus.replaceAll("_", " ")}{application.registryCheck?.registrationMatches && application.registryCheck.businessNameMatches && application.registryCheck.active ? " · number, name, and active status matched" : ""}</dd></div>}
                      <div className="manual-review-address"><dt>Business address</dt><dd>{[application.business.address, application.business.city, application.business.region, application.business.postalCode].filter(Boolean).join(", ") || "Not provided"}</dd></div>
                    </dl>
                    <div className="manual-review-documents">
                      {needsRegistration(application) && (application.business.registrationDocumentUrl
                        ? <a href={application.business.registrationDocumentUrl} target="_blank" rel="noreferrer">Open business registration ↗</a>
                        : <span>Business registration must be re-uploaded</span>)}
                      {application.business.addressProofUrl
                        ? <a href={application.business.addressProofUrl} target="_blank" rel="noreferrer">Open proof of address ↗</a>
                        : <span>Proof of address must be re-uploaded</span>}
                      {application.business.ninDocumentUrl
                        ? <a href={application.business.ninDocumentUrl} target="_blank" rel="noreferrer">Open NIN document ↗</a>
                        : <span>NIN document must be re-uploaded</span>}
                    </div>
                    <fieldset className="manual-review-checks">
                      <legend>Required checks before approval</legend>
                      {needsRegistration(application) && <label><input type="checkbox" checked={documentChecks[application.uid]?.businessRegistrationValid ?? false} onChange={(event) => updateDocumentCheck(application.uid, "businessRegistrationValid", event.target.checked)} /> Registration certificate is readable and matches the submitted business name and number</label>}
                      {needsRegistration(application) && ["manual_review", "submission_failed", "not_checked"].includes(application.registryStatus) && <label><input type="checkbox" checked={documentChecks[application.uid]?.registryNumberVerified ?? false} onChange={(event) => updateDocumentCheck(application.uid, "registryNumberVerified", event.target.checked)} /> I checked the official registry for this country and confirmed the business is active and the number and registered name match</label>}
                      <label><input type="checkbox" checked={documentChecks[application.uid]?.proofOfAddressValid ?? false} onChange={(event) => updateDocumentCheck(application.uid, "proofOfAddressValid", event.target.checked)} /> Proof of address is readable and matches the business address</label>
                      <label><input type="checkbox" checked={documentChecks[application.uid]?.ninMatchesApplicant ?? false} onChange={(event) => updateDocumentCheck(application.uid, "ninMatchesApplicant", event.target.checked)} /> NIN document is readable and matches the applicant</label>
                    </fieldset>
                    {documentsMissing(application) &&
                      <p className="manual-review-alert">Reject this application with a re-upload note; it cannot be approved until {needsRegistration(application) ? "the business registration, proof of address, and NIN are" : "the proof of address and NIN are"} uploaded to private Cloudinary storage.</p>}
                    <label className="manual-review-note">Review note<textarea value={notes[application.uid] ?? ""} onChange={(event) => setNotes((current) => ({ ...current, [application.uid]: event.target.value }))} maxLength={500} placeholder="Required when rejecting; shared with the applicant" /></label>
                    <div className="manual-review-actions">
                      <button type="button" className="manual-review-reject" disabled={busyUid === application.uid} onClick={() => void review(application, "rejected")}>{busyUid === application.uid ? "Saving…" : "Reject application"}</button>
                      <button type="button" className="manual-review-approve" disabled={busyUid === application.uid || !canApprove(application, documentChecks[application.uid])} onClick={() => void review(application, "approved")}>{busyUid === application.uid ? "Saving…" : "Approve seller"}</button>
                    </div>
                  </article>
                ))}
              </section>}
    </main>
  );
}
