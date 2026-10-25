"use client";

import Link from "next/link";
import { onAuthStateChanged, type User } from "firebase/auth";
import { useCallback, useEffect, useState } from "react";
import { firebaseAuth, firebaseConfigured } from "@/lib/firebase/client";
import { payLaterApplicantLabels, payLaterDocumentLabels, type PayLaterDocumentType } from "@/lib/requests";
import "../../requests.css";

type Application = {
  id: string;
  reference: string;
  applicantType: string;
  fullName: string;
  email: string;
  accountEmail: string;
  phone: string;
  address: string;
  business: { name: string; registrationNumber: string; address: string };
  employment: { employer: string; employeeNumber: string; governmentLevel: string };
  referees: { name: string; phone: string; relationship: string }[];
  documents: { type: string; url: string }[];
  submittedAt: string | null;
};

export default function PayLaterQueuePage() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [staff, setStaff] = useState(false);
  const [applications, setApplications] = useState<Application[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadQueue = useCallback(async (currentUser: User) => {
    setLoading(true);
    setError("");
    try {
      const token = await currentUser.getIdToken();
      const response = await fetch("/api/admin/pay-later", { headers: { authorization: `Bearer ${token}` } });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not load Pay Later applications.");
      setApplications(result.applications);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load Pay Later applications.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!firebaseConfigured()) {
      setError("Firebase is not configured on this deployment.");
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
        const isStaffUser = token.claims.role === "staff" || token.claims.role === "admin";
        setStaff(isStaffUser);
        if (!isStaffUser) {
          setError("A SureFood staff or admin account is required to review Pay Later applications.");
          return;
        }
        await loadQueue(currentUser);
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "Could not verify staff access.");
      }
    });
  }, [loadQueue]);

  async function decide(application: Application, status: "approved" | "declined") {
    if (!user) return;
    const note = notes[application.id]?.trim() ?? "";
    if (status === "declined" && !note) {
      setError("Add a note explaining what the applicant needs to correct before declining.");
      return;
    }
    setBusyId(application.id);
    setError("");
    setNotice("");
    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/admin/pay-later/${encodeURIComponent(application.id)}`, {
        method: "PATCH",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ status, note }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not save this decision.");
      setApplications((current) => current.filter((item) => item.id !== application.id));
      setNotice(`${application.fullName || application.reference} marked ${status}.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save this decision.");
    } finally {
      setBusyId("");
    }
  }

  return (
    <main className="manual-review-page">
      <header className="manual-review-header">
        <Link href="/" className="brand"><span className="brand-mark">s</span><span>sure<span>food</span></span></Link>
        <div>
          <span>STAFF WORKSPACE</span>
          <h1>Pay Later applications</h1>
          <p>Check the business or employment evidence, confirm both referees, then approve or decline. Approval opens a food credit line; the limit and repayment plan are agreed with the applicant.</p>
        </div>
        {staff && <button type="button" onClick={() => user && void loadQueue(user)} disabled={loading}>{loading ? "Refreshing…" : "Refresh queue"}</button>}
        <nav className="admin-queue-nav">
          <Link href="/admin/verification">Business verification</Link>
          <Link className="is-current" href="/admin/pay-later">Pay Later</Link>
          <Link href="/admin/special-orders">Event orders</Link>
          <Link href="/admin/categories">Categories</Link>
        </nav>
      </header>

      {error && <p className="manual-review-alert" role="alert">{error}</p>}
      {notice && <p className="manual-review-notice" role="status">{notice}</p>}

      {!authReady ? <p className="manual-review-empty">Checking staff access…</p>
        : !user ? <p className="manual-review-empty">Sign in with a SureFood staff account to review applications. <Link href="/login">Sign in →</Link></p>
          : staff && loading && applications.length === 0 ? <p className="manual-review-empty">Loading applications…</p>
            : staff && applications.length === 0 ? <section className="manual-review-empty">No Pay Later applications are waiting for review.</section>
              : staff && (
                <section className="manual-review-list" aria-label="Pay Later applications awaiting review">
                  {applications.map((application) => (
                    <article className="manual-review-card" key={application.id}>
                      <div className="manual-review-card-heading">
                        <div>
                          <span className="manual-review-role">
                            {payLaterApplicantLabels[application.applicantType as keyof typeof payLaterApplicantLabels] ?? application.applicantType} · {application.reference}
                          </span>
                          <h2>{application.fullName}</h2>
                          <p>{application.email} · {application.phone}</p>
                          <small>Submitted: {application.submittedAt ? new Date(application.submittedAt).toLocaleString() : "Date unavailable"}</small>
                        </div>
                      </div>

                      <dl className="manual-review-details">
                        <div className="manual-review-address"><dt>Applicant address</dt><dd>{application.address || "Not provided"}</dd></div>
                        {application.applicantType === "business" ? (
                          <>
                            <div><dt>Business name</dt><dd>{application.business.name || "Not provided"}</dd></div>
                            <div><dt>Registration number</dt><dd>{application.business.registrationNumber || "Not provided"}</dd></div>
                            <div className="manual-review-address"><dt>Business address</dt><dd>{application.business.address || "Not provided"}</dd></div>
                          </>
                        ) : (
                          <>
                            <div><dt>Employer</dt><dd>{application.employment.employer || "Not provided"}</dd></div>
                            <div><dt>Staff number</dt><dd>{application.employment.employeeNumber || "Not provided"}</dd></div>
                            {application.employment.governmentLevel && <div><dt>Government level</dt><dd>{application.employment.governmentLevel}</dd></div>}
                          </>
                        )}
                      </dl>

                      <div>
                        <p className="manual-review-role" style={{ marginBottom: 6 }}>Referees</p>
                        <ul className="queue-referees">
                          {application.referees.map((referee, index) => (
                            <li key={`${referee.phone}-${index}`}>
                              <strong>{referee.name} · {referee.phone}</strong>
                              <small>{referee.relationship}</small>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="manual-review-documents">
                        {application.documents.length > 0
                          ? application.documents.map((document) => (
                              <a key={document.type} href={document.url} target="_blank" rel="noreferrer">
                                Open {payLaterDocumentLabels[document.type as PayLaterDocumentType] ?? document.type} ↗
                              </a>
                            ))
                          : <span>No evidence uploaded</span>}
                      </div>

                      <label className="manual-review-note">
                        Review note
                        <textarea
                          value={notes[application.id] ?? ""}
                          onChange={(event) => setNotes((current) => ({ ...current, [application.id]: event.target.value }))}
                          maxLength={500}
                          placeholder="Required when declining; shared with the applicant"
                        />
                      </label>

                      <div className="manual-review-actions">
                        <button type="button" className="manual-review-reject" disabled={busyId === application.id} onClick={() => void decide(application, "declined")}>
                          {busyId === application.id ? "Saving…" : "Decline application"}
                        </button>
                        <button type="button" className="manual-review-approve" disabled={busyId === application.id} onClick={() => void decide(application, "approved")}>
                          {busyId === application.id ? "Saving…" : "Approve credit line"}
                        </button>
                      </div>
                    </article>
                  ))}
                </section>
              )}
    </main>
  );
}
