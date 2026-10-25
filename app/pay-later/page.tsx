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

const payLaterSteps = [
  { icon: "doc" as const, title: "Apply online", copy: "Tell us how you earn and upload your evidence." },
  { icon: "shield" as const, title: "We verify", copy: "Your business registration or employment is checked, and we call both referees." },
  { icon: "card" as const, title: "You get a decision", copy: "Approved applicants get a food credit limit and a repayment plan." },
  { icon: "cart" as const, title: "Shop and repay", copy: "Buy the food you need now and pay it back in agreed instalments." },
];

function PlIcon({ name }: { name: "doc" | "shield" | "card" | "cart" | "bolt" | "clipboard" | "user" | "users" }) {
  const paths: Record<typeof name, React.ReactNode> = {
    doc: <><rect x="5" y="3" width="14" height="18" rx="2.5" /><path d="M9 8h6M9 12h6M9 16h4" /></>,
    shield: <><path d="M12 3l7 3v6c0 4.5-3 7.6-7 9-4-1.4-7-4.5-7-9V6l7-3Z" /><path d="M9 12l2 2 4-4" /></>,
    card: <><rect x="3" y="6" width="18" height="12" rx="2.5" /><path d="M3 10h18M7 15h3" /></>,
    cart: <><circle cx="9" cy="20" r="1.4" /><circle cx="18" cy="20" r="1.4" /><path d="M3 4h2l2.4 10.2a2 2 0 0 0 2 1.6h7.9a2 2 0 0 0 2-1.6L21 8H6" /></>,
    bolt: <><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" /></>,
    clipboard: <><rect x="6" y="4" width="12" height="17" rx="2.5" /><path d="M9 4V3h6v1M9 10h6M9 14h4" /></>,
    user: <><circle cx="12" cy="8" r="3.6" /><path d="M5 20c0-3.6 3.1-6.2 7-6.2s7 2.6 7 6.2" /></>,
    users: <><circle cx="9" cy="8" r="3.2" /><path d="M3 19c0-3.1 2.7-5.4 6-5.4s6 2.3 6 5.4" /><path d="M16 5.4a3.2 3.2 0 0 1 0 6.2M17 14c2.4.5 4 2.4 4 5" /></>,
  };
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}

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
              <>
                <section className="pl-signin">
                  <div className="pl-signin-copy">
                    <span className="pl-signin-badge"><PlIcon name="user" /> SIGN IN FIRST</span>
                    <h2>Applications are tied to your SureFood account</h2>
                    <p>
                      Sign in or create an account, then come back here to apply. We use your account email to reach you
                      about the decision and to attach the credit plan once it is approved.
                    </p>
                    <Link className="pl-signin-cta" href="/login">
                      <PlIcon name="user" /> Sign in to apply <span aria-hidden="true">→</span>
                    </Link>
                    <p className="pl-signin-foot">✦ No account yet? <Link href="/signup">Create one</Link> — it takes a minute.</p>
                  </div>
                  <div className="pl-signin-art" aria-hidden="true">
                    <svg viewBox="0 0 220 270">
                      <defs>
                        <linearGradient id="plPhoneBody" x1="0" y1="0" x2="1" y2="1">
                          <stop offset="0" stopColor="#5b21b6" />
                          <stop offset="1" stopColor="#8b5cf6" />
                        </linearGradient>
                        <linearGradient id="plPhoneScreen" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0" stopColor="#ffffff" />
                          <stop offset="1" stopColor="#f2e9ff" />
                        </linearGradient>
                      </defs>
                      <circle cx="112" cy="132" r="100" fill="#f4ecff" />
                      <circle cx="112" cy="132" r="74" fill="#ece0ff" />
                      <ellipse cx="112" cy="252" rx="66" ry="11" fill="#e6d6ff" />
                      <g className="pl-art-float">
                        <g transform="rotate(-7 112 132)">
                          <rect x="64" y="34" width="96" height="196" rx="22" fill="#3a1270" />
                          <rect x="69.5" y="39.5" width="85" height="185" rx="18" fill="url(#plPhoneScreen)" />
                          <rect x="98" y="46" width="28" height="5" rx="2.5" fill="#d8c9f2" />
                          <path d="M112 96c-11 0-20 8-20 19 0 12 8 20 20 26 12-6 20-14 20-26 0-11-9-19-20-19Z" fill="#6d28d9" opacity=".14" />
                          <path d="M118 84c-9 .5-16 5-16 13 0 8 5 12 12 12 7 0 12-5 12-13 0-4-3-9-8-12Z" fill="url(#plPhoneBody)" />
                          <path d="M100 120c-4-10-2-20 6-27 2 9 2 19-6 27Z" fill="#a78bfa" />
                          <text x="112" y="158" textAnchor="middle" fontFamily="Manrope, sans-serif" fontSize="15" fontWeight="800" fill="#3a1270">SureFood</text>
                          <rect x="84" y="168" width="56" height="5" rx="2.5" fill="#e4d7f7" />
                          <rect x="92" y="180" width="40" height="5" rx="2.5" fill="#efe6fb" />
                          <circle cx="112" cy="205" r="9" fill="#4c1d95" />
                        </g>
                      </g>
                      <g className="pl-art-card">
                        <rect x="104" y="178" width="92" height="52" rx="14" fill="#fff" stroke="#ede3fb" />
                        <circle cx="124" cy="204" r="11" fill="#f0e6ff" />
                        <circle cx="124" cy="201" r="3.6" fill="#7c3aed" />
                        <path d="M118 210c0-3 2.7-4.6 6-4.6s6 1.6 6 4.6" fill="#7c3aed" />
                        <rect x="143" y="195" width="38" height="5" rx="2.5" fill="#e6d9f8" />
                        <rect x="143" y="206" width="26" height="5" rx="2.5" fill="#f0e8fb" />
                        <circle cx="182" cy="188" r="10" fill="#4c1d95" />
                        <path d="M178 188l3 3 5-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                      </g>
                      <circle cx="52" cy="72" r="5" fill="#c4b5fd" className="pl-art-spark" />
                      <circle cx="176" cy="96" r="4" fill="#a78bfa" className="pl-art-spark" />
                      <path d="M176 132l3 6 6 3-6 3-3 6-3-6-6-3 6-3 3-6Z" fill="#d8b4fe" />
                    </svg>
                  </div>
                </section>

                <section className="pl-banner">
                  <span className="pl-banner-mark" aria-hidden="true">🌿</span>
                  <div className="pl-banner-copy">
                    <span>SHOP SMARTER WITH SUREFOOD</span>
                    <strong>Fresh food. Better life.</strong>
                    <p>Quality produce, trusted vendors, and flexible payment options — all in one place.</p>
                  </div>
                  <span className="pl-banner-art" aria-hidden="true">🧺</span>
                </section>
              </>
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

          <aside className="pl-side">
            <section className="pl-how">
              <h2><span className="pl-panel-mark"><PlIcon name="bolt" /></span> How it works</h2>
              <ol className="pl-how-list">
                {payLaterSteps.map((step, index) => (
                  <li key={step.title}>
                    <span className="pl-how-num" aria-hidden="true">{index + 1}</span>
                    <span className="pl-how-icon" aria-hidden="true"><PlIcon name={step.icon} /></span>
                    <span className="pl-how-copy"><strong>{step.title}</strong><small>{step.copy}</small></span>
                  </li>
                ))}
              </ol>
            </section>

            <section className="pl-need">
              <h2><span className="pl-panel-mark"><PlIcon name="clipboard" /></span> What you will need</h2>
              <div className="pl-need-grid">
                <div>
                  <h3><PlIcon name="user" /> Business owners</h3>
                  <ul>
                    <li>Registered business name and number</li>
                    <li>Business address</li>
                    <li>Registration certificate</li>
                    <li>Evidence of income (recommended)</li>
                  </ul>
                </div>
                <div>
                  <h3><PlIcon name="users" /> Employees — government or private</h3>
                  <ul>
                    <li>Employer and staff number</li>
                    <li>For government staff, the level of government</li>
                    <li>Employment letter</li>
                    <li>Evidence of income (recommended)</li>
                  </ul>
                </div>
              </div>
              <p className="pl-need-everyone"><strong>Everyone:</strong> a SureFood account, a phone number we can reach you on, and two referees with working phone numbers.</p>
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
