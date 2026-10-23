"use client";

import type { User } from "firebase/auth";
import { useEffect, useState } from "react";

type Bank = { name: string; code: string };
type PayoutAccount = { bankName: string; accountName: string; accountLast4: string };

export function PayoutAccountForm({ user, businessName }: { user: User | null; businessName?: string }) {
  const [banks, setBanks] = useState<Bank[]>([]);
  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [payoutAccount, setPayoutAccount] = useState<PayoutAccount | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    let active = true;
    void (async () => {
      try {
        const token = await user.getIdToken();
        const headers = { authorization: `Bearer ${token}` };
        const [bankResponse, accountResponse] = await Promise.all([
          fetch("/api/payments/banks", { headers }),
          fetch("/api/profile/payout-account", { headers }),
        ]);
        const [bankResult, accountResult] = await Promise.all([bankResponse.json(), accountResponse.json()]);
        if (!bankResponse.ok) throw new Error(bankResult.error || "Could not load banks.");
        if (!accountResponse.ok) throw new Error(accountResult.error || "Could not load payout account.");
        if (!active) return;
        setBanks(bankResult.banks);
        setPayoutAccount(accountResult.payoutAccount);
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : "Could not load payout settings.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [user]);

  async function savePayoutAccount(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) return;
    const selectedBank = banks.find((bank) => bank.code === bankCode);
    if (!selectedBank) {
      setError("Choose a bank from the list.");
      return;
    }
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/profile/payout-account", {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ bankCode, bankName: selectedBank.name, accountNumber }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not save payout account.");
      setPayoutAccount(result.payoutAccount);
      setAccountNumber("");
      setNotice("Bank account verified against your approved business name. SureFood seller payouts are currently handled manually.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save payout account.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="vendor-panel payout-account-panel">
      <div className="vendor-panel-heading"><div><h2>Seller payout account</h2><p>Account holder name must match your approved business name: <strong>{businessName || "Not available"}</strong></p></div></div>
      {payoutAccount && <p className="payout-account-saved" role="status">✓ Verified account: {payoutAccount.accountName} · {payoutAccount.bankName} ·•••• {payoutAccount.accountLast4}</p>}
      {loading ? <p className="vendor-empty-search">Loading bank verification…</p> : (
        <form className="payout-account-form" onSubmit={savePayoutAccount}>
          <label>Bank<select value={bankCode} onChange={(event) => setBankCode(event.target.value)} required><option value="">Choose a bank</option>{banks.map((bank) => <option key={bank.code} value={bank.code}>{bank.name}</option>)}</select></label>
          <label>Account number<input value={accountNumber} onChange={(event) => setAccountNumber(event.target.value.replace(/\D/g, "").slice(0, 10))} inputMode="numeric" autoComplete="off" placeholder="10-digit account number" required /></label>
          <button className="vendor-primary-button" type="submit" disabled={saving}>{saving ? "Verifying account…" : payoutAccount ? "Verify replacement account" : "Verify and save account"}</button>
        </form>
      )}
      <p className="payout-account-note">Paystack verifies the account holder before it is saved. Buyer payments go to SureFood; seller payouts are not automatic and are paid manually.</p>
      {error && <p className="workspace-api-error" role="alert">{error}</p>}
      {notice && <p className="vendor-success" role="status">{notice}</p>}
    </section>
  );
}
