"use client";

import Link from "next/link";
import { onAuthStateChanged, type User } from "firebase/auth";
import { useEffect, useState } from "react";
import { firebaseAuth, firebaseConfigured } from "@/lib/firebase/client";
import { formatMarketMoney } from "@/app/components/marketplace-product";
import {
  governmentLevels,
  payLaterApplicantLabels,
  payLaterApplicantTypes,
  payLaterDocumentLabels,
  payLaterDocumentTypes,
  requiredPayLaterDocuments,
  type GovernmentLevel,
  type PayLaterApplicantType,
  type PayLaterDocumentType,
  type PayLaterStatus,
} from "@/lib/requests";
import "../requests.css";

type ApplicationSummary = {
  reference: string;
  status: PayLaterStatus;
  applicantType: PayLaterApplicantType;
  submittedAt: string | null;
  reviewNote: string;
};

type Referee = { name: string; phone: string; relationship: string };

const emptyReferee: Referee = { name: "", phone: "", relationship: "" };

const applicantBlurb: Record<PayLaterApplicantType, string> = {
  business: "You run a registered business and can prove it",
  "government-employee": "You work for a government agency",
  "private-employee": "You work for a private company",
};

export default function PayLaterPage() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [application, setApplication] = useState<ApplicationSummary | null>(null);
  const [applicantType, setApplicantType] = useState<PayLaterApplicantType>("business");
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    address: "",
    businessName: "",
    registrationNumber: "",
    businessAddress: "",
    employer: "",
    employeeNumber: "",
    governmentLevel: "federal" as GovernmentLevel,
  });
  const [referees, setReferees] = useState<Referee[]>([{ ...emptyReferee }, { ...emptyReferee }]);
  const [documents, setDocuments] = useState<Partial<Record<PayLaterDocumentType, string>>>({});
  const [uploading, setUploading] = useState<PayLaterDocumentType | "">("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loadingApplication, setLoadingApplication] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [attached, setAttached] = useState<{ name: string; quantity: number; price: number; currency: string } | null>(null);

  // A product picked in the shop arrives as ?product=<name>&qty=<n>&price=<minor>&currency=<code>.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const product = params.get("product");
    if (!product) return;
    const quantity = Number(params.get("qty") ?? "1");
    const price = Number(params.get("price") ?? "0");
    setAttached({
      name: product,
      quantity: Number.isFinite(quantity) && quantity > 0 ? Math.floor(quantity) : 1,
      price: Number.isFinite(price) && price > 0 ? price : 0,
      currency: params.get("currency") || "NGN",
    });
  }, []);

  useEffect(() => {
    if (!firebaseConfigured()) {
      setAuthReady(true);
      return;
    }
    return onAuthStateChanged(firebaseAuth(), (current) => {
      setUser(current);
      setAuthReady(true);
      setForm((currentForm) => ({
        ...currentForm,
        fullName: currentForm.fullName || current?.displayName || "",
        email: current?.email || currentForm.email,
      }));
    });
  }, []);

  useEffect(() => {
    if (!user) {
      setApplication(null);
      return;
    }
    let active = true;
    setLoadingApplication(true);
    void (async () => {
      try {
        const token = await user.getIdToken();
        const response = await fetch("/api/pay-later/applications", { headers: { authorization: `Bearer ${token}` } });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Could not load your Pay Later application.");
        if (active) setApplication(result.application ?? null);
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : "Could not load your Pay Later application.");
      } finally {
        if (active) setLoadingApplication(false);
      }
    })();
    return () => { active = false; };
  }, [user]);

  function update(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updateReferee(index: number, field: keyof Referee, value: string) {
    setReferees((current) => current.map((referee, position) => position === index ? { ...referee, [field]: value } : referee));
  }

  async function uploadDocument(documentType: PayLaterDocumentType, file: File) {
    if (!user) return;
    setUploading(documentType);
    setError("");
    try {
      const token = await user.getIdToken();
      const body = new FormData();
      body.append("documentType", documentType);
      body.append("file", file);
      const response = await fetch("/api/pay-later/documents", {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
        body,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not upload that document.");
      setDocuments((current) => ({ ...current, [documentType]: result.publicId }));
      setNotice(`${payLaterDocumentLabels[documentType]} uploaded.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not upload that document.");
    } finally {
      setUploading("");
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/pay-later/applications", {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({
          applicantType,
          fullName: form.fullName,
          email: form.email,
          phone: form.phone,
          address: form.address,
          business: {
            name: form.businessName,
            registrationNumber: form.registrationNumber,
            address: form.businessAddress,
          },
          employment: {
            employer: form.employer,
            employeeNumber: form.employeeNumber,
            governmentLevel: form.governmentLevel,
          },
          referees,
          documents,
          consent,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not submit your Pay Later application.");
      setApplication(result.application);
      setNotice("");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not submit your Pay Later application.");
    } finally {
      setBusy(false);
    }
  }

  const requiredDocuments = requiredPayLaterDocuments(applicantType);
  const awaitingDecision = application && application.status !== "declined";

  return (
    <main className="service-page">
      <header className="service-topbar">
        <Link className="service-brand" href="/">
          <span className="mark">s</span>
          <span><strong>SureFood</strong><small>Fresh Food · Better Life</small></span>
        </Link>
        <div className="service-top-actions">
          <Link href="/special-orders">Event orders</Link>
          <Link className="strong" href={user ? "/account" : "/login"}>{user ? "My account" : "Sign in"}</Link>
        </div>
      </header>

      <section className="service-hero">
        <div className="service-hero-inner">
          <span className="service-eyebrow">BUY NOW · PAY LATER</span>
          <h1>Take the food you need today,<br />pay it back on a <em>low-interest plan</em>.</h1>
          <p>
            SureFood Pay Later is a small food credit line for businesses and salaried workers — no bank card, no
            collateral. You show us who you are, we check your business or employment and speak to two people who can
            vouch for you, then you shop on a repayment plan.
          </p>
          <ul className="service-hero-points">
            <li>No card required</li>
            <li>Business owners and employees</li>
            <li>Two referees, verified before approval</li>
          </ul>
        </div>
      </section>

      <div className="service-shell">
        <div className="service-grid">
          <div>
            {attached && (
              <section className="pl-attached" role="status" aria-label="Product attached to this application">
                <span className="pl-attached-mark" aria-hidden="true">🧺</span>
                <span className="pl-attached-copy">
                  <b>{attached.name}</b>
                  <small>
                    {attached.quantity} {attached.quantity === 1 ? "unit" : "units"}
                    {attached.price > 0 ? ` × ${formatMarketMoney(attached.price, attached.currency)}` : ""} · once approved,
                    this is the item you take on credit. You can change it when you order.
                  </small>
                </span>
                {attached.price > 0 && (
                  <strong className="pl-attached-total">
                    {formatMarketMoney(attached.price * attached.quantity, attached.currency)}
                  </strong>
                )}
              </section>
            )}
            {error && <p className="service-alert" role="alert">{error}</p>}
            {notice && !error && <p className="service-notice" role="status">{notice}</p>}

            {!authReady ? (
              <p className="service-empty">Checking your account…</p>
            ) : !user ? (
              <section className="service-status">
                <span className="badge">Sign in first</span>
                <h2>Applications are tied to your SureFood account</h2>
                <p>
                  Sign in or create an account, then come back here to apply. We use your account email to reach you
                  about the decision and to attach the credit plan once it is approved.
                </p>
                <p>
                  <Link className="auth-service-link" href="/login" style={{ fontSize: 12 }}>Sign in to apply →</Link>
                </p>
                <p><small>No account yet? <Link href="/signup" style={{ color: "#5b21b6", fontWeight: 600 }}>Create one</Link> — it takes a minute.</small></p>
              </section>
            ) : loadingApplication ? (
              <p className="service-empty">Checking your application…</p>
            ) : awaitingDecision ? (
              <section className="service-status" aria-live="polite">
                <span className="badge">{application.status === "approved" ? "Approved" : "With our review team"}</span>
                <h2>{application.status === "approved" ? "Your Pay Later plan is approved" : "We have your application"}</h2>
                <p>
                  {application.status === "approved"
                    ? "Your SureFood Pay Later line is open. Our team will confirm your limit and repayment plan with you before your first credit order."
                    : "Our team is checking your business or employment details, your evidence and your referees. We usually respond within two working days."}
                </p>
                <dl>
                  <div><dt>Reference</dt><dd>{application.reference}</dd></div>
                  <div><dt>Applying as</dt><dd>{payLaterApplicantLabels[application.applicantType]}</dd></div>
                  <div><dt>Submitted</dt><dd>{application.submittedAt ? new Date(application.submittedAt).toLocaleString() : "Just now"}</dd></div>
                  {application.reviewNote && <div><dt>Review note</dt><dd>{application.reviewNote}</dd></div>}
                </dl>
              </section>
            ) : (
              <>
                {application?.status === "declined" && (
                  <p className="service-alert" role="status">
                    Your previous application ({application.reference}) was not approved.
                    {application.reviewNote ? ` ${application.reviewNote}` : ""} You can correct the details and apply again.
                  </p>
                )}
                <section className="service-card">
                  <h2>Apply for Pay Later</h2>
                  <p>Everything here is reviewed by a person, not an automated score. Fill it in fully so the decision is not delayed.</p>
                  <form className="service-form" onSubmit={submit}>
                    <fieldset className="service-fieldset">
                      <legend>How do you earn?</legend>
                      <div className="service-radio-group">
                        {payLaterApplicantTypes.map((type) => (
                          <label key={type} className={applicantType === type ? "service-radio is-selected" : "service-radio"}>
                            <input
                              type="radio"
                              name="applicantType"
                              value={type}
                              checked={applicantType === type}
                              onChange={() => setApplicantType(type)}
                            />
                            <strong>{payLaterApplicantLabels[type]}</strong>
                            <small>{applicantBlurb[type]}</small>
                          </label>
                        ))}
                      </div>
                    </fieldset>

                    <fieldset className="service-fieldset">
                      <legend>Your details</legend>
                      <div className="service-row">
                        <label className="service-field"><span>Full name</span><input value={form.fullName} onChange={(event) => update("fullName", event.target.value)} required minLength={2} maxLength={120} autoComplete="name" /></label>
                        <label className="service-field"><span>Email address</span><input type="email" value={form.email} onChange={(event) => update("email", event.target.value)} required autoComplete="email" /></label>
                      </div>
                      <div className="service-row">
                        <label className="service-field"><span>Phone number</span><input type="tel" value={form.phone} onChange={(event) => update("phone", event.target.value)} required placeholder="0803 000 0000" autoComplete="tel" /></label>
                        <label className="service-field"><span>Home address</span><input value={form.address} onChange={(event) => update("address", event.target.value)} required minLength={10} maxLength={240} autoComplete="street-address" /></label>
                      </div>
                    </fieldset>

                    {applicantType === "business" ? (
                      <fieldset className="service-fieldset">
                        <legend>Your business</legend>
                        <div className="service-row">
                          <label className="service-field"><span>Registered business name</span><input value={form.businessName} onChange={(event) => update("businessName", event.target.value)} required minLength={2} maxLength={150} /></label>
                          <label className="service-field"><span>Registration number (CAC / equivalent)</span><input value={form.registrationNumber} onChange={(event) => update("registrationNumber", event.target.value)} required minLength={3} maxLength={80} placeholder="RC 1234567" /></label>
                        </div>
                        <label className="service-field"><span>Business address</span><input value={form.businessAddress} onChange={(event) => update("businessAddress", event.target.value)} required minLength={10} maxLength={240} /></label>
                      </fieldset>
                    ) : (
                      <fieldset className="service-fieldset">
                        <legend>Your employment</legend>
                        <div className="service-row">
                          <label className="service-field"><span>{applicantType === "government-employee" ? "Ministry, agency or office" : "Employer (company name)"}</span><input value={form.employer} onChange={(event) => update("employer", event.target.value)} required minLength={2} maxLength={150} /></label>
                          <label className="service-field"><span>Staff / employee number</span><input value={form.employeeNumber} onChange={(event) => update("employeeNumber", event.target.value)} required minLength={2} maxLength={60} /></label>
                        </div>
                        {applicantType === "government-employee" && (
                          <label className="service-field">
                            <span>Level of government</span>
                            <select value={form.governmentLevel} onChange={(event) => update("governmentLevel", event.target.value)}>
                              {governmentLevels.map((level) => <option key={level} value={level}>{level[0].toUpperCase() + level.slice(1)} government</option>)}
                            </select>
                          </label>
                        )}
                      </fieldset>
                    )}

                    <fieldset className="service-fieldset">
                      <legend>Evidence</legend>
                      <p className="service-help" style={{ marginBottom: 10 }}>
                        PDF, JPG or PNG up to 15 MB. Uploaded privately — only our review team can open it.
                      </p>
                      {payLaterDocumentTypes.map((documentType) => {
                        const required = requiredDocuments.includes(documentType);
                        const uploaded = Boolean(documents[documentType]);
                        return (
                          <div className="service-doc" key={documentType}>
                            <div>
                              <strong>{payLaterDocumentLabels[documentType]}{required ? "" : " (optional)"}</strong>
                              <small>{documentType === "business-registration" ? "Certificate showing your business name and number" : documentType === "employment-letter" ? "Letter from your employer confirming your role and staff number" : "Recent payslip, bank statement or sales records"}</small>
                            </div>
                            <input
                              type="file"
                              accept="application/pdf,image/jpeg,image/png"
                              aria-label={`Upload ${payLaterDocumentLabels[documentType]}`}
                              disabled={uploading === documentType}
                              onChange={(event) => {
                                const file = event.target.files?.[0];
                                if (file) void uploadDocument(documentType, file);
                              }}
                            />
                            <span className={uploaded ? "service-doc-status done" : "service-doc-status"}>
                              {uploading === documentType ? "Uploading…" : uploaded ? "Uploaded ✓" : required ? "Required" : "Optional"}
                            </span>
                          </div>
                        );
                      })}
                    </fieldset>

                    <fieldset className="service-fieldset">
                      <legend>Two people we can call</legend>
                      <p className="service-help" style={{ marginBottom: 10 }}>
                        Referees must be reachable and must know you — they confirm who you are before the plan is approved. They cannot be the same person.
                      </p>
                      {referees.map((referee, index) => (
                        <div className="service-row" key={index}>
                          <label className="service-field"><span>Referee {index + 1} name</span><input value={referee.name} onChange={(event) => updateReferee(index, "name", event.target.value)} required minLength={2} maxLength={120} /></label>
                          <label className="service-field"><span>Referee {index + 1} phone</span><input type="tel" value={referee.phone} onChange={(event) => updateReferee(index, "phone", event.target.value)} required placeholder="0803 000 0000" /></label>
                          <label className="service-field"><span>How do they know you?</span><input value={referee.relationship} onChange={(event) => updateReferee(index, "relationship", event.target.value)} required minLength={2} maxLength={60} placeholder="Business partner, colleague, neighbour…" /></label>
                        </div>
                      ))}
                    </fieldset>

                    <label className="service-consent">
                      <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} required />
                      <span>
                        I confirm these details are true and my documents are genuine. I agree that SureFood may contact my
                        employer or business registry and my two referees to verify them, and that the limit, interest and
                        repayment plan are confirmed by SureFood after review.
                      </span>
                    </label>

                    <button className="service-submit" type="submit" disabled={busy || uploading !== ""}>
                      {busy ? "Submitting application…" : "Submit Pay Later application"} <span aria-hidden="true">→</span>
                    </button>
                  </form>
                </section>
              </>
            )}
          </div>

          <aside style={{ display: "grid", gap: 16 }}>
            <section className="service-card">
              <h2>How it works</h2>
              <ol className="service-steps">
                <li><strong>Apply online.</strong> Tell us how you earn and upload your evidence.</li>
                <li><strong>We verify.</strong> Your business registration or employment is checked, and we call both referees.</li>
                <li><strong>You get a decision.</strong> Approved applicants get a food credit limit and a repayment plan.</li>
                <li><strong>Shop and repay.</strong> Buy the food you need now and pay it back in agreed instalments.</li>
              </ol>
            </section>

            <section className="service-card">
              <h2>What you will need</h2>
              <div className="service-requirement">
                <strong>Business owners</strong>
                <ul>
                  <li>Registered business name and number</li>
                  <li>Business address</li>
                  <li>Registration certificate</li>
                  <li>Evidence of income (recommended)</li>
                </ul>
              </div>
              <div className="service-requirement">
                <strong>Employees — government or private</strong>
                <ul>
                  <li>Employer and staff number</li>
                  <li>For government staff, the level of government</li>
                  <li>Employment letter</li>
                  <li>Evidence of income (recommended)</li>
                </ul>
              </div>
              <div className="service-requirement">
                <strong>Everyone</strong>
                <ul>
                  <li>A SureFood account</li>
                  <li>Two referees with working phone numbers</li>
                  <li>A phone number we can reach you on</li>
                </ul>
              </div>
            </section>

            <section className="service-card">
              <h2>Planning an event?</h2>
              <p>Ordering weeks ahead for a wedding or celebration earns a bigger discount than a normal order.</p>
              <Link className="auth-service-link" href="/special-orders" style={{ fontSize: 11.5 }}>See event order discounts →</Link>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
