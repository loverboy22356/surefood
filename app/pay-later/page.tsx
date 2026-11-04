"use client";

import Link from "next/link";
import { onAuthStateChanged, type User } from "firebase/auth";
import { useEffect, useState } from "react";
import { firebaseAuth, firebaseConfigured } from "@/lib/firebase/client";
import { ShopFooter, ShopHeader } from "@/app/components/shop-chrome";
import { formatMarketMoney } from "@/app/components/marketplace-product";
import {
  governmentLevels,
  payLaterApplicantLabels,
  payLaterApplicantTypes,
  payLaterDocumentHelp,
  payLaterDocumentLabels,
  payLaterDocumentTypes,
  requiredPayLaterDocuments,
  type GovernmentLevel,
  type PayLaterApplicantType,
  type PayLaterDocumentType,
  type PayLaterStatus,
} from "@/lib/requests";
import "@/app/services.css";
import "@/app/services-premium.css";

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
  { title: "Apply online", copy: "Tell us how you earn and upload your evidence." },
  { title: "We verify", copy: "Your business registration or employment is checked, and we call both referees." },
  { title: "You get a decision", copy: "Approved applicants get a food credit limit and a repayment plan." },
  { title: "Shop and repay", copy: "Buy the food you need now and pay it back in agreed instalments." },
];

function PlIcon({ name }: { name: "bolt" | "clipboard" | "user" | "users" | "store" }) {
  const paths: Record<typeof name, React.ReactNode> = {
    bolt: <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" />,
    clipboard: <><rect x="6" y="4" width="12" height="17" rx="2.5" /><path d="M9 4V3h6v1M9 10h6M9 14h4" /></>,
    user: <><circle cx="12" cy="8" r="3.6" /><path d="M5 20c0-3.6 3.1-6.2 7-6.2s7 2.6 7 6.2" /></>,
    users: <><circle cx="9" cy="8" r="3.2" /><path d="M3 19c0-3.1 2.7-5.4 6-5.4s6 2.3 6 5.4" /><path d="M16 5.4a3.2 3.2 0 0 1 0 6.2M17 14c2.4.5 4 2.4 4 5" /></>,
    store: <><path d="M4 9h16v11H4z" /><path d="m4 9 2-5h12l2 5M9 20v-6h6v6" /></>,
  };
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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
    <div className="sf-page">
      <ShopHeader />

      <main className="sf-shell" style={{ flex: "1 1 auto", paddingBottom: 60 }}>
        <nav className="sf-flow-steps" aria-label="Breadcrumb">
          <Link href="/">Home</Link><i>/</i>
          <Link href="/shop">Shop</Link><i>/</i>
          <span className="is-on">Pay later</span>
        </nav>

        <header className="svc-hero">
          <div className="svc-hero-copy">
            <div className="svc-head">
              <Link href={user ? "/account" : "/"} className="svc-back" aria-label="Back">←</Link>
              <button
                type="button"
                className="svc-share"
                aria-label="Share this page"
                onClick={() => {
                  const url = window.location.href;
                  if (navigator.share) void navigator.share({ title: "Sure Foodz Pay Later", url }).catch(() => {});
                  else void navigator.clipboard?.writeText(url);
                }}
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle cx="18" cy="5" r="2.6" stroke="currentColor" strokeWidth="1.8" />
                  <circle cx="6" cy="12" r="2.6" stroke="currentColor" strokeWidth="1.8" />
                  <circle cx="18" cy="19" r="2.6" stroke="currentColor" strokeWidth="1.8" />
                  <path d="m8.5 10.8 7-4.2M8.5 13.2l7 4.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <span className="svc-kicker">Buy now · Pay later</span>
            <h1 className="svc-title">Pay Later</h1>
            <p className="svc-lede">
              A small food credit line for businesses and salaried workers — no bank card, no collateral. You show us who you
              are, we check your business or employment, speak to two people who can vouch for you, then you shop on a
              low-interest repayment plan.
            </p>
            <ul className="svc-points">
              <li>No card required</li>
              <li>Business owners and employees</li>
              <li>Two referees, checked before approval</li>
            </ul>
          </div>

          <aside className="svc-facts" aria-label="Pay Later at a glance">
            <div className="svc-fact"><b>{payLaterSteps.length}</b><small>steps from application to a decision</small></div>
            <div className="svc-fact"><b>{referees.length}</b><small>referees we speak to before approval</small></div>
            <div className="svc-fact"><b>{requiredDocuments.length}</b><small>documents required for your profile</small></div>
          </aside>
        </header>

        <div className="svc-layout">
          <div className="svc-main">
            {attached && (
              <section className="svc-attached" role="status" aria-label="Product attached to this application">
                <span className="svc-attached-mark" aria-hidden="true">🧺</span>
                <span className="svc-attached-copy">
                  <b>{attached.name}</b>
                  <small>
                    {attached.quantity} {attached.quantity === 1 ? "unit" : "units"}
                    {attached.price > 0 ? ` × ${formatMarketMoney(attached.price, attached.currency)}` : ""} · once approved,
                    this is the item you take on credit. You can change it when you order.
                  </small>
                </span>
                {attached.price > 0 && (
                  <strong className="svc-attached-total">
                    {formatMarketMoney(attached.price * attached.quantity, attached.currency)}
                  </strong>
                )}
              </section>
            )}

            {error && <p className="svc-alert" role="alert">{error}</p>}
            {notice && !error && <p className="svc-notice" role="status">{notice}</p>}

            {!authReady ? (
              <p className="marketplace-empty">Checking your account…</p>
            ) : !user ? (
              <>
                <section className="svc-gate">
                  <div>
                    <span className="svc-badge">Sign in first</span>
                    <h2>Applications are tied to your Sure Foodz account</h2>
                    <p>
                      Sign in or create an account, then come back here to apply. We use your account email to reach you
                      about the decision and to attach the credit plan once it is approved.
                    </p>
                    <Link className="svc-submit" href="/login">Sign in to apply <span aria-hidden="true">→</span></Link>
                    <p className="svc-gate-foot">✦ No account yet? <Link href="/signup">Create one</Link> — it takes a minute.</p>
                  </div>
                  <div className="svc-gate-art" aria-hidden="true">
                    <svg viewBox="0 0 180 180" width="170" height="170" fill="none">
                      <circle cx="90" cy="92" r="72" fill="#eff5ff" />
                      <rect x="38" y="62" width="104" height="66" rx="12" fill="#fff" stroke="#c9dcff" strokeWidth="2" />
                      <rect x="38" y="80" width="104" height="12" fill="#0c59b6" opacity=".18" />
                      <circle cx="58" cy="110" r="9" fill="#dbe8ff" />
                      <path d="M47 110c0-4 4.6-6.6 11-6.6s11 2.6 11 6.6" fill="#1b6cff" opacity=".45" />
                      <rect x="92" y="104" width="34" height="6" rx="3" fill="#c9dcff" />
                      <rect x="92" y="116" width="22" height="6" rx="3" fill="#e0eaff" />
                      <path d="M129 46c-9 2-15 8-15 16 0 9 6 14 14 14 8 0 13-6 13-15 0-5-4-11-12-15Z" fill="#1b6cff" opacity=".2" />
                      <path d="M152 50c-8-1-14 2-16 8-3 8 1 14 8 16 8 2 14-2 16-9 1-5-1-11-8-15Z" fill="#0c59b6" opacity=".35" />
                      <circle cx="132" cy="140" r="14" fill="#1b6cff" />
                      <path d="m126 140 4 4 8-8" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                </section>
              </>
            ) : loadingApplication ? (
              <p className="marketplace-empty">Checking your application…</p>
            ) : awaitingDecision ? (
              <section className="svc-card svc-status" aria-live="polite">
                <span className="svc-badge">{application.status === "approved" ? "Approved" : "With our review team"}</span>
                <h2>{application.status === "approved" ? "Your Pay Later plan is approved" : "We have your application"}</h2>
                <p>
                  {application.status === "approved"
                    ? "Your Sure Foodz Pay Later line is open. Our team will confirm your limit and repayment plan with you before your first credit order."
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
                  <p className="svc-alert" role="status">
                    Your previous application ({application.reference}) was not approved.
                    {application.reviewNote ? ` ${application.reviewNote}` : ""} You can correct the details and apply again.
                  </p>
                )}
                <section className="svc-card">
                  <h2>Apply for Pay Later</h2>
                  <p>Everything here is reviewed by a person, not an automated score. Fill it in fully so the decision is not delayed.</p>
                  <form className="svc-form" onSubmit={submit}>
                    <fieldset className="svc-fieldset">
                      <legend>How do you earn?</legend>
                      <div className="svc-radio-group">
                        {payLaterApplicantTypes.map((type) => (
                          <label key={type} className={applicantType === type ? "svc-radio is-selected" : "svc-radio"}>
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

                    <fieldset className="svc-fieldset">
                      <legend>Your details</legend>
                      <div className="svc-row">
                        <label className="svc-field"><span>Full name</span><input value={form.fullName} onChange={(event) => update("fullName", event.target.value)} required minLength={2} maxLength={120} autoComplete="name" /></label>
                        <label className="svc-field"><span>Email address</span><input type="email" value={form.email} onChange={(event) => update("email", event.target.value)} required autoComplete="email" /></label>
                      </div>
                      <div className="svc-row">
                        <label className="svc-field"><span>Phone number</span><input type="tel" value={form.phone} onChange={(event) => update("phone", event.target.value)} required placeholder="0803 000 0000" autoComplete="tel" /></label>
                        <label className="svc-field"><span>Home address</span><input value={form.address} onChange={(event) => update("address", event.target.value)} required minLength={10} maxLength={240} autoComplete="street-address" /></label>
                      </div>
                    </fieldset>

                    {applicantType === "business" ? (
                      <fieldset className="svc-fieldset">
                        <legend>Your business</legend>
                        <div className="svc-row">
                          <label className="svc-field"><span>Registered business name</span><input value={form.businessName} onChange={(event) => update("businessName", event.target.value)} required minLength={2} maxLength={150} /></label>
                          <label className="svc-field"><span>Registration number (CAC / equivalent)</span><input value={form.registrationNumber} onChange={(event) => update("registrationNumber", event.target.value)} required minLength={3} maxLength={80} placeholder="RC 1234567" /></label>
                        </div>
                        <label className="svc-field"><span>Business address</span><input value={form.businessAddress} onChange={(event) => update("businessAddress", event.target.value)} required minLength={10} maxLength={240} /></label>
                      </fieldset>
                    ) : (
                      <fieldset className="svc-fieldset">
                        <legend>Your employment</legend>
                        <div className="svc-row">
                          <label className="svc-field"><span>{applicantType === "government-employee" ? "Ministry, agency or office" : "Employer (company name)"}</span><input value={form.employer} onChange={(event) => update("employer", event.target.value)} required minLength={2} maxLength={150} /></label>
                          <label className="svc-field"><span>Staff / employee number</span><input value={form.employeeNumber} onChange={(event) => update("employeeNumber", event.target.value)} required minLength={2} maxLength={60} /></label>
                        </div>
                        {applicantType === "government-employee" && (
                          <label className="svc-field">
                            <span>Level of government</span>
                            <select value={form.governmentLevel} onChange={(event) => update("governmentLevel", event.target.value)}>
                              {governmentLevels.map((level) => <option key={level} value={level}>{level[0].toUpperCase() + level.slice(1)} government</option>)}
                            </select>
                          </label>
                        )}
                      </fieldset>
                    )}

                    <fieldset className="svc-fieldset">
                      <legend>Evidence</legend>
                      <p className="svc-help" style={{ marginBottom: 10 }}>
                        Everyone proves who they are with a NIN slip and proves where they live with the NEPA (electricity)
                        bill. The bill must carry the same address you entered above. PDF, JPG or PNG up to 15 MB —
                        uploaded privately, only our review team can open it.
                      </p>
                      {payLaterDocumentTypes.map((documentType) => {
                        const required = requiredDocuments.includes(documentType);
                        const uploaded = Boolean(documents[documentType]);
                        return (
                          <div className="svc-doc" key={documentType}>
                            <div>
                              <strong>{payLaterDocumentLabels[documentType]}{required ? "" : " (optional)"}</strong>
                              <small>{payLaterDocumentHelp[documentType]}</small>
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
                            <span className={uploaded ? "svc-doc-status done" : "svc-doc-status"}>
                              {uploading === documentType ? "Uploading…" : uploaded ? "Uploaded ✓" : required ? "Required" : "Optional"}
                            </span>
                          </div>
                        );
                      })}
                    </fieldset>

                    <fieldset className="svc-fieldset">
                      <legend>Two people we can call</legend>
                      <p className="svc-help" style={{ marginBottom: 10 }}>
                        Referees must be reachable and must know you — they confirm who you are before the plan is approved.
                        They cannot be the same person.
                      </p>
                      <div className="svc-referees">
                        {referees.map((referee, index) => (
                          <div className="svc-referee" key={index}>
                            <h3>Referee {index + 1}</h3>
                            <div className="svc-row">
                              <label className="svc-field"><span>Name</span><input aria-label={`Referee ${index + 1} name`} value={referee.name} onChange={(event) => updateReferee(index, "name", event.target.value)} required minLength={2} maxLength={120} /></label>
                              <label className="svc-field"><span>Phone number</span><input aria-label={`Referee ${index + 1} phone`} type="tel" value={referee.phone} onChange={(event) => updateReferee(index, "phone", event.target.value)} required placeholder="0803 000 0000" /></label>
                              <label className="svc-field"><span>How do they know you?</span><input aria-label={`Referee ${index + 1} relationship`} value={referee.relationship} onChange={(event) => updateReferee(index, "relationship", event.target.value)} required minLength={2} maxLength={60} placeholder="Business partner, colleague, neighbour…" /></label>
                            </div>
                          </div>
                        ))}
                      </div>
                    </fieldset>

                    <label className="svc-consent">
                      <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} required />
                      <span>
                        I confirm these details are true and my documents are genuine. I agree that Sure Foodz may contact my
                        employer or business registry and my two referees to verify them, and that the limit, interest and
                        repayment plan are confirmed by Sure Foodz after review.
                      </span>
                    </label>

                    <button className="svc-submit" type="submit" disabled={busy || uploading !== ""}>
                      {busy ? "Submitting application…" : "Submit Pay Later application"} <span aria-hidden="true">→</span>
                    </button>
                  </form>
                </section>
              </>
            )}
          </div>

          <aside className="svc-side">
            <section className="svc-card">
              <div className="svc-card-head"><span aria-hidden="true"><PlIcon name="bolt" /></span><h2>How it works</h2></div>
              <ol className="svc-how-list">
                {payLaterSteps.map((step, index) => (
                  <li key={step.title}>
                    <span className="svc-how-num" aria-hidden="true">{index + 1}</span>
                    <span><strong>{step.title}</strong><small>{step.copy}</small></span>
                  </li>
                ))}
              </ol>
            </section>

            <section className="svc-card">
              <div className="svc-card-head"><span aria-hidden="true"><PlIcon name="clipboard" /></span><h2>What you will need</h2></div>
              <div className="svc-need">
                <div>
                  <h3><PlIcon name="store" /> Business owners</h3>
                  <ul>
                    <li>Registered business name and number</li>
                    <li>Business address</li>
                    <li>Registration certificate</li>
                    <li>NIN slip and NEPA bill</li>
                    <li>Evidence of income (recommended)</li>
                  </ul>
                </div>
                <div>
                  <h3><PlIcon name="users" /> Employees — government or private</h3>
                  <ul>
                    <li>Employer and staff number</li>
                    <li>For government staff, the level of government</li>
                    <li>Employment letter</li>
                    <li>NIN slip and NEPA bill</li>
                    <li>Evidence of income (recommended)</li>
                  </ul>
                </div>
                <p className="svc-need-foot">
                  <strong>Everyone:</strong> a Sure Foodz account, a NIN slip, a NEPA electricity bill in your name, a phone
                  number we can reach you on, and two referees with working phone numbers.
                </p>
              </div>
            </section>

            <section className="svc-card">
              <div className="svc-card-head"><span aria-hidden="true"><PlIcon name="user" /></span><h2>Planning an event?</h2></div>
              <p>Ordering weeks ahead for a wedding or celebration earns a bigger discount than a normal order.</p>
              <Link className="svc-link" href="/special-orders">See event order discounts →</Link>
            </section>
          </aside>
        </div>
      </main>

      <ShopFooter />
    </div>
  );
}
