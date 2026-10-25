"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, type User } from "firebase/auth";
import { useCallback, useEffect, useMemo, useState } from "react";
import { firebaseAuth, firebaseConfigured } from "@/lib/firebase/client";
import { AFFILIATE_COMMISSION_RATE, AFFILIATE_MIN_PAYOUT_MINOR } from "@/lib/affiliates";
import "./affiliate.css";

type Payout = {
  id: string;
  amountMinor: number;
  status: string;
  requestedAt: string;
  paidAt: string | null;
  note: string;
};

type ReferredOrder = {
  id: string;
  subtotalMinor: number;
  commissionMinor: number;
  createdAt: string;
};

type Summary = {
  affiliate: { code: string; name: string; email: string; status: string; commissionRate: number } | null;
  stats?: {
    referredOrders: number;
    paidOrders: number;
    earnedMinor: number;
    paidOutMinor: number;
    requestedMinor: number;
    availableMinor: number;
  };
  payouts?: Payout[];
  orders?: ReferredOrder[];
  minPayoutMinor?: number;
};

type Section = "dashboard" | "links" | "promotions" | "earnings" | "referrals" | "analytics" | "payouts" | "settings";

type IconName =
  | "home" | "link" | "megaphone" | "wallet" | "users" | "chart" | "card" | "gear"
  | "copy" | "check" | "arrow" | "share" | "gift" | "spark" | "headset" | "leaf";

const iconPaths: Record<IconName, string> = {
  home: "M4 11.5 12 4.5l8 7V20h-6v-5h-4v5H4z",
  link: "M9.5 14.5 14.5 9.5M8 11 5.8 13.2a3.6 3.6 0 0 0 5 5L13 16M16 13l2.2-2.2a3.6 3.6 0 0 0-5-5L11 8",
  megaphone: "M4 10v4l3 .8V21h3v-5.4l8 2.4V6zM18 9.5h2.5M18 14.5h2.5",
  wallet: "M3 8h15a3 3 0 0 1 3 3v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM3 8V6a2 2 0 0 1 2-2h11M17 14h.01",
  users: "M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm-6 9a6 6 0 0 1 12 0M16.5 11.5a3 3 0 1 0 0-6M18 20a5.5 5.5 0 0 0-2-4.3",
  chart: "M4 20V9M10 20V4M16 20v-7M22 20H2",
  card: "M3 6h18v12H3zM3 10h18M7 15h3",
  gear: "M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm8-3.5a8 8 0 0 0-.2-1.7l2-1.5-2-3.4-2.3 1a8 8 0 0 0-2.9-1.7L14.2 2h-4l-.4 2.7a8 8 0 0 0-2.9 1.7l-2.3-1-2 3.4 2 1.5a8 8 0 0 0 0 3.4l-2 1.5 2 3.4 2.3-1a8 8 0 0 0 2.9 1.7l.4 2.7h4l.4-2.7a8 8 0 0 0 2.9-1.7l2.3 1 2-3.4-2-1.5c.1-.5.2-1.1.2-1.7Z",
  copy: "M9 9h10v12H9zM5 15H3V3h12v2",
  check: "M4 12.5 9.5 18 20 6",
  arrow: "M4 12h15m-6-6 6 6-6 6",
  share: "M12 16V4m0 0L8 8m4-4 4 4M5 14v5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-5",
  gift: "M4 11h16v9H4zM3 7h18v4H3zM12 7v13M8.5 7a2.5 2.5 0 1 1 0-5c1.8 0 3.5 5 3.5 5s1.7-5 3.5-5a2.5 2.5 0 1 1 0 5",
  spark: "M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3Z",
  headset: "M4 14v-2a8 8 0 0 1 16 0v2M4 14h3v6H5a1 1 0 0 1-1-1v-5Zm16 0h-3v6h2a1 1 0 0 0 1-1v-5Z",
  leaf: "M20 4c-8 0-14 4-14 11a5 5 0 0 0 8.5 3.5C18 15 20 10 20 4ZM6 20c1.5-4 4-7 8-9",
};

function Icon({ name, className }: { name: IconName; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={iconPaths[name]} />
    </svg>
  );
}

const navItems: { key: Section; label: string; icon: IconName }[] = [
  { key: "dashboard", label: "Dashboard", icon: "home" },
  { key: "links", label: "Affiliate links", icon: "link" },
  { key: "promotions", label: "Promotions", icon: "megaphone" },
  { key: "earnings", label: "Earnings", icon: "wallet" },
  { key: "referrals", label: "Referrals", icon: "users" },
  { key: "analytics", label: "Analytics", icon: "chart" },
  { key: "payouts", label: "Payouts", icon: "card" },
  { key: "settings", label: "Settings", icon: "gear" },
];

const sharePages = [
  { name: "Seasonal picks", copy: "Fresh, natural and in season — the section shoppers open most.", href: "/#hm-products", hash: "#hm-products" },
  { name: "Local farmers", copy: "Customers who want food grown close to home.", href: "/#hm-vendors", hash: "#hm-vendors" },
  { name: "Quality picks", copy: "Everything that passes our freshness and safety checks.", href: "/#hm-about", hash: "#hm-about" },
];

function money(minor: number) {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(minor / 100);
}

function percent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function shortDate(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-NG", { day: "numeric", month: "short" });
}

/** Daily commission buckets for the performance chart. */
function dailySeries(orders: ReferredOrder[], days: number) {
  const buckets = new Map<string, { commission: number; count: number }>();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let index = days - 1; index >= 0; index -= 1) {
    const day = new Date(today);
    day.setDate(day.getDate() - index);
    buckets.set(day.toISOString().slice(0, 10), { commission: 0, count: 0 });
  }
  for (const order of orders) {
    const key = new Date(order.createdAt).toISOString().slice(0, 10);
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.commission += order.commissionMinor;
      bucket.count += 1;
    }
  }
  return [...buckets.entries()].map(([date, value]) => ({ date, ...value }));
}

function windowTotal(orders: ReferredOrder[], fromDaysAgo: number, toDaysAgo: number) {
  const now = Date.now();
  const from = now - fromDaysAgo * 86_400_000;
  const to = now - toDaysAgo * 86_400_000;
  return orders.reduce((total, order) => {
    const at = new Date(order.createdAt).getTime();
    return at >= from && at < to ? total + order.commissionMinor : total;
  }, 0);
}

function LineChart({ points, days }: { points: { date: string; commission: number }[]; days: number }) {
  const width = 720;
  const height = 190;
  const padding = { top: 16, right: 12, bottom: 26, left: 12 };
  const max = Math.max(...points.map((point) => point.commission), 1);
  const stepX = (width - padding.left - padding.right) / Math.max(points.length - 1, 1);
  const coords = points.map((point, index) => ({
    x: padding.left + index * stepX,
    y: padding.top + (1 - point.commission / max) * (height - padding.top - padding.bottom),
  }));
  const line = coords.map((coord, index) => `${index === 0 ? "M" : "L"}${coord.x.toFixed(1)} ${coord.y.toFixed(1)}`).join(" ");
  const area = `${line} L${coords[coords.length - 1]?.x.toFixed(1) ?? 0} ${height - padding.bottom} L${coords[0]?.x.toFixed(1) ?? 0} ${height - padding.bottom} Z`;
  const labelEvery = Math.max(Math.ceil(points.length / 6), 1);

  return (
    <div className="affd-chart">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Commission for the last ${days} days`}>
        <defs>
          <linearGradient id="affdArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#a855f7" stopOpacity="0.32" />
            <stop offset="100%" stopColor="#a855f7" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75, 1].map((ratio) => (
          <line key={ratio} x1={padding.left} x2={width - padding.right} y1={padding.top + (height - padding.top - padding.bottom) * ratio} y2={padding.top + (height - padding.top - padding.bottom) * ratio} stroke="#f0e9f9" strokeWidth="1" />
        ))}
        <path d={area} fill="url(#affdArea)" />
        <path d={line} fill="none" stroke="#7c3aed" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
        {coords.map((coord, index) => (
          <circle key={points[index].date} cx={coord.x} cy={coord.y} r="3.2" fill="#fff" stroke="#7c3aed" strokeWidth="2" />
        ))}
        {points.map((point, index) => (
          index % labelEvery === 0 ? (
            <text key={`label-${point.date}`} x={coords[index].x} y={height - 6} textAnchor="middle" fill="#a294bb" fontSize="9">
              {new Date(point.date).toLocaleDateString("en-NG", { day: "numeric", month: "short" })}
            </text>
          ) : null
        ))}
      </svg>
    </div>
  );
}

function Sparkline({ values }: { values: number[] }) {
  const width = 180;
  const height = 56;
  const max = Math.max(...values, 1);
  const step = width / Math.max(values.length - 1, 1);
  const path = values
    .map((value, index) => `${index === 0 ? "M" : "L"}${(index * step).toFixed(1)} ${(height - (value / max) * (height - 8) - 4).toFixed(1)}`)
    .join(" ");
  return (
    <svg className="affd-spark" viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <path d={path} fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function AffiliatePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [copied, setCopied] = useState("");
  const [section, setSection] = useState<Section>("dashboard");
  const [range, setRange] = useState(7);
  const [search, setSearch] = useState("");
  const [payoutForm, setPayoutForm] = useState({ bankDetails: "", note: "" });

  const loadSummary = useCallback(async (currentUser: User) => {
    setLoading(true);
    setError("");
    try {
      const token = await currentUser.getIdToken();
      const response = await fetch("/api/affiliate", { headers: { authorization: `Bearer ${token}` } });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not load your affiliate dashboard.");
      setSummary(result);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load your affiliate dashboard.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!firebaseConfigured()) {
      setAuthReady(true);
      return;
    }
    return onAuthStateChanged(firebaseAuth(), (currentUser) => {
      setUser(currentUser);
      setAuthReady(true);
      if (currentUser) void loadSummary(currentUser);
      else setSummary(null);
    });
  }, [loadSummary]);

  const code = summary?.affiliate?.code ?? "";
  const link = useMemo(() => {
    if (!code) return "";
    const origin = typeof window === "undefined" ? "" : window.location.origin;
    return `${origin}/?ref=${code}`;
  }, [code]);

  const stats = summary?.stats;
  const orders = useMemo(() => summary?.orders ?? [], [summary]);
  const payouts = useMemo(() => summary?.payouts ?? [], [summary]);
  const points = useMemo(() => dailySeries(orders, range), [orders, range]);
  const previous = windowTotal(orders, 14, 7);
  const current = windowTotal(orders, 7, 0);
  const growth = previous > 0 ? (current - previous) / previous : current > 0 ? 1 : 0;
  const conversion = stats && stats.referredOrders > 0 ? stats.paidOrders / stats.referredOrders : 0;
  const minPayout = summary?.minPayoutMinor ?? AFFILIATE_MIN_PAYOUT_MINOR;
  const canRequest = Boolean(stats && stats.availableMinor >= minPayout);
  const rate = summary?.affiliate?.commissionRate ?? AFFILIATE_COMMISSION_RATE;

  async function join() {
    if (!user) return;
    setBusy(true);
    setError("");
    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/affiliate", { method: "POST", headers: { authorization: `Bearer ${token}` } });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not join the affiliate programme.");
      setSummary(result);
      setNotice("You are in. Share your link and your first commission is one order away.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not join the affiliate programme.");
    } finally {
      setBusy(false);
    }
  }

  async function copy(value: string, key: string) {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      window.setTimeout(() => setCopied(""), 2200);
    } catch {
      setError("Your browser blocked the clipboard. Select the link and copy it manually.");
    }
  }

  async function requestPayout(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/affiliate/payouts", {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify(payoutForm),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not request a payout.");
      setNotice(result.message || "Payout requested. Our team will transfer it by hand.");
      setPayoutForm({ bankDetails: "", note: "" });
      await loadSummary(user);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not request a payout.");
    } finally {
      setBusy(false);
    }
  }

  function submitSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = search.trim();
    if (query) router.push(`/search?q=${encodeURIComponent(query)}`);
  }

  const shareButtons = () => (
    <div className="affd-share">
      <a className="affd-share-wa" href={`https://wa.me/?text=${encodeURIComponent(`Get fresh food on SureFood: ${link}`)}`} target="_blank" rel="noreferrer">WhatsApp</a>
      <a className="affd-share-fb" href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}`} target="_blank" rel="noreferrer">Facebook</a>
      <a className="affd-share-x" href={`https://twitter.com/intent/tweet?text=${encodeURIComponent("Fresh food on SureFood")}&url=${encodeURIComponent(link)}`} target="_blank" rel="noreferrer">X (Twitter)</a>
      <a className="affd-share-tg" href={`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent("Get fresh food on SureFood")}`} target="_blank" rel="noreferrer">Telegram</a>
      <button type="button" onClick={() => void copy(link, "more")}><Icon name="share" /> {copied === "more" ? "Copied" : "More"}</button>
    </div>
  );

  const emptyState = !authReady ? (
    <p className="affd-empty">Checking your account…</p>
  ) : !user ? (
    <section className="affd-card affd-join">
      <h2>Sign in to join the programme</h2>
      <p>Your affiliate account uses the same SureFood account you shop with, so your code, orders and payouts stay in one place.</p>
      <Link className="affd-cta" href="/login">Sign in to continue <Icon name="arrow" /></Link>
    </section>
  ) : loading && !summary ? (
    <p className="affd-empty">Loading your affiliate dashboard…</p>
  ) : !summary?.affiliate ? (
    <section className="affd-card affd-join">
      <h2>Join the affiliate programme</h2>
      <p>One tap creates your referral code. There is nothing to pay, and you can stop sharing at any time.</p>
      <ul className="affd-ticks">
        <li>Your own referral link and code</li>
        <li>{Math.round(rate * 100)}% of the goods value of every paid order</li>
        <li>Bank payout requested from this dashboard and sent by our team</li>
      </ul>
      <button className="affd-cta" type="button" onClick={() => void join()} disabled={busy}>
        {busy ? "Creating your code…" : "Join free"} <Icon name="arrow" />
      </button>
    </section>
  ) : null;

  if (emptyState) {
    return (
      <main className="affd-page">
        <div className="affd-shell">
          <aside className="affd-side">
            <Link className="affd-brand" href="/"><span className="affd-brand-mark"><Icon name="leaf" /></span><span><strong>SureFood</strong><small>Fresh Food · Better Life</small></span></Link>
            <Link className="affd-back" href="/">← Back to shop</Link>
          </aside>
          <div className="affd-main">
            <header className="affd-topbar"><strong>Affiliate programme</strong></header>
            <div className="affd-body">{emptyState}</div>
          </div>
        </div>
      </main>
    );
  }

  const activeSection = navItems.find((item) => item.key === section);

  return (
    <main className="affd-page">
      <div className="affd-shell">
        <aside className="affd-side">
          <Link className="affd-brand" href="/"><span className="affd-brand-mark"><Icon name="leaf" /></span><span><strong>SureFood</strong><small>Fresh Food · Better Life</small></span></Link>
          <nav className="affd-nav" aria-label="Affiliate sections">
            {navItems.map((item) => (
              <button
                key={item.key}
                type="button"
                className={section === item.key ? "affd-nav-item is-active" : "affd-nav-item"}
                aria-current={section === item.key ? "page" : undefined}
                onClick={() => setSection(item.key)}
              >
                <Icon name={item.icon} />
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
          <div className="affd-side-card">
            <span className="affd-side-gift"><Icon name="gift" /></span>
            <strong>Grow together</strong>
            <p>Share SureFood with your network and earn amazing rewards.</p>
            <button type="button" className="affd-side-button" onClick={() => void copy(link, "side")}>
              {copied === "side" ? "Link copied ✓" : "Copy my link"}
            </button>
          </div>
          <Link className="affd-back" href="/">← Back to shop</Link>
        </aside>

        <div className="affd-main">
          <header className="affd-topbar">
            <form className="affd-search" onSubmit={submitSearch}>
              <span aria-hidden="true">⌕</span>
              <input value={search} onChange={(event) => setSearch(event.target.value)} type="search" placeholder="Search products, categories, or anything…" aria-label="Search the SureFood shop" />
            </form>
            <div className="affd-top-actions">
              <span className="affd-top-title">{activeSection?.label}</span>
              <Link className="affd-account" href="/account">
                <span className="affd-account-avatar">{(summary?.affiliate?.name || user?.displayName || "S").slice(0, 1).toUpperCase()}</span>
                <span><strong>{summary?.affiliate?.name || user?.displayName || "Affiliate"}</strong><small>Affiliate</small></span>
              </Link>
            </div>
          </header>

          <div className="affd-body">
            {error && <p className="affd-alert" role="alert">{error}</p>}
            {notice && !error && <p className="affd-notice" role="status">{notice}</p>}

            {section === "dashboard" && (
              <div className="affd-grid">
                <div className="affd-col">
                <section className="affd-hero">
                  <div className="affd-hero-copy">
                    <span className="affd-eyebrow">Affiliate program</span>
                    <h1>Share SureFood,<br /><em>Earn commission!</em></h1>
                    <p>Refer your friends, family and followers to SureFood and earn a commission on every successful purchase.</p>
                    <ul className="affd-hero-points">
                      <li><span><Icon name="link" /></span>Get your<br />unique link</li>
                      <li><span><Icon name="share" /></span>Share it<br />anywhere</li>
                      <li><span><Icon name="wallet" /></span>Earn<br />commission</li>
                    </ul>
                    <button className="affd-cta" type="button" onClick={() => void copy(link, "hero")}>
                      {copied === "hero" ? "Link copied ✓" : "Start sharing"} <Icon name="arrow" />
                    </button>
                  </div>
                  <div className="affd-hero-art" aria-hidden="true">
                    <span className="affd-hero-badge">%</span>
                    <div className="affd-hero-art-card">
                      <span className="affd-hero-art-logo"><Icon name="leaf" /></span>
                      <strong>SureFood</strong>
                      <small>REFER &amp; EARN</small>
                    </div>
                    <p>Your friend shops → You earn!</p>
                  </div>
                </section>

                <div className="affd-pair">
                  <section className="affd-card">
                    <header className="affd-card-head"><span className="affd-card-icon"><Icon name="link" /></span><div><h2>Your affiliate link</h2><p>Share this link with your audience. When they make a purchase, you&apos;ll earn a commission.</p></div></header>
                    <div className="affd-link-box">
                      <code>{link}</code>
                      <button type="button" onClick={() => void copy(link, "link")}>{copied === "link" ? "Copied ✓" : "Copy"}</button>
                    </div>
                    {shareButtons()}
                  </section>

                  <section className="affd-card affd-rate">
                    <header className="affd-card-head"><span className="affd-card-icon"><Icon name="spark" /></span><div><h2>Commission rate</h2><p>Paid on the goods value of every order that is actually paid for.</p></div></header>
                    <p className="affd-rate-value">up to <strong>{Math.round(rate * 100)}%</strong></p>
                    <p className="affd-rate-note">per successful order</p>
                    <button type="button" className="affd-text-link" onClick={() => setSection("earnings")}>View details <Icon name="arrow" /></button>
                  </section>
                </div>

                <section className="affd-card">
                  <header className="affd-card-head">
                    <div><h2>Performance overview</h2><p>Commission and orders from your referral link.</p></div>
                    <div className="affd-range">
                      {[7, 14, 30].map((days) => (
                        <button key={days} type="button" className={range === days ? "is-active" : ""} onClick={() => setRange(days)}>Last {days} days</button>
                      ))}
                    </div>
                  </header>
                  <div className="affd-mini-stats">
                    <div><span className="affd-mini-icon is-violet"><Icon name="users" /></span><small>Referred orders</small><strong>{stats?.referredOrders ?? 0}</strong></div>
                    <div><span className="affd-mini-icon is-green"><Icon name="check" /></span><small>Successful orders</small><strong>{stats?.paidOrders ?? 0}</strong></div>
                    <div><span className="affd-mini-icon is-amber"><Icon name="wallet" /></span><small>Total commission</small><strong>{money(stats?.earnedMinor ?? 0)}</strong></div>
                    <div><span className="affd-mini-icon is-blue"><Icon name="card" /></span><small>Pending payouts</small><strong>{money(stats?.requestedMinor ?? 0)}</strong></div>
                  </div>
                  <LineChart points={points} days={range} />
                </section>
                </div>

                <aside className="affd-col-side">
                  <section className="affd-earnings-card">
                    <header><span>Total earnings</span><Icon name="wallet" /></header>
                    <strong>{money(stats?.earnedMinor ?? 0)}</strong>
                    <p className={growth >= 0 ? "affd-growth" : "affd-growth is-down"}>
                      {growth >= 0 ? "▲" : "▼"} {Math.abs(Math.round(growth * 100))}% <small>vs. last 7 days</small>
                    </p>
                    <Sparkline values={dailySeries(orders, 14).map((point) => point.commission)} />
                    <dl>
                      <div><dt>Total referrals</dt><dd>{stats?.referredOrders ?? 0}</dd></div>
                      <div><dt>Successful orders</dt><dd>{stats?.paidOrders ?? 0}</dd></div>
                      <div><dt>Pending</dt><dd>{money(stats?.requestedMinor ?? 0)}</dd></div>
                    </dl>
                  </section>

                  <section className="affd-card affd-quick">
                    <h2 className="affd-h2"><Icon name="spark" /> Quick links</h2>
                    <ul>
                      <li><button type="button" onClick={() => setSection("links")}><span className="affd-quick-icon"><Icon name="link" /></span><span><strong>Your affiliate link</strong><small>Copy and share it anywhere</small></span><em aria-hidden="true">›</em></button></li>
                      <li><button type="button" onClick={() => setSection("promotions")}><span className="affd-quick-icon"><Icon name="megaphone" /></span><span><strong>Ready-to-share pages</strong><small>Links to the pages shoppers open</small></span><em aria-hidden="true">›</em></button></li>
                      <li><button type="button" onClick={() => setSection("earnings")}><span className="affd-quick-icon"><Icon name="wallet" /></span><span><strong>Earnings breakdown</strong><small>Where your commission came from</small></span><em aria-hidden="true">›</em></button></li>
                      <li><a href="mailto:support@surefoodz.com"><span className="affd-quick-icon"><Icon name="headset" /></span><span><strong>Support</strong><small>Get help when you need it</small></span><em aria-hidden="true">›</em></a></li>
                    </ul>
                  </section>
                </aside>
              </div>
            )}

            {section === "links" && (
              <>
                <section className="affd-banner">
                  <div>
                    <span className="affd-eyebrow">Affiliate links</span>
                    <h1>Share SureFood,<br /><em>Earn commission!</em></h1>
                    <p>Get your unique affiliate link, share it with your friends, family and followers. Earn commission on every successful purchase made through your link.</p>
                    <ul className="affd-ticks is-inline">
                      <li>Unique tracking link</li>
                      <li>Real-time earnings</li>
                      <li>Lifetime cookies</li>
                    </ul>
                    <button className="affd-cta" type="button" onClick={() => void copy(link, "links-hero")}>{copied === "links-hero" ? "Link copied ✓" : "Copy my link"} <Icon name="arrow" /></button>
                  </div>
                  <div className="affd-banner-art" aria-hidden="true"><span><Icon name="link" /></span><strong>Your link<br />works!</strong></div>
                </section>

                <section className="affd-card">
                  <header className="affd-card-head"><div><h2>Your affiliate link</h2><p>Create and manage the link you share. It credits you for 90 days after the first click.</p></div></header>
                  <div className="affd-link-row">
                    <div className="affd-link-main">
                      <strong>{code}</strong>
                      <div className="affd-link-box">
                        <code>{link}</code>
                        <button type="button" onClick={() => void copy(link, "links")}>{copied === "links" ? "Copied ✓" : "Copy"}</button>
                      </div>
                      {shareButtons()}
                    </div>
                    <dl className="affd-link-stats">
                      <div><dt><Icon name="users" /> Referred orders</dt><dd>{stats?.referredOrders ?? 0}</dd></div>
                      <div><dt><Icon name="check" /> Paid orders</dt><dd>{stats?.paidOrders ?? 0}</dd></div>
                      <div><dt><Icon name="chart" /> Conversion</dt><dd>{percent(conversion)}</dd></div>
                    </dl>
                  </div>
                </section>

                <section className="affd-card">
                  <h2 className="affd-h2">Make the link work harder</h2>
                  <ul className="affd-tips">
                    <li><strong>Use social media</strong><span>WhatsApp status, Facebook groups and X are where most SureFood orders start.</span></li>
                    <li><strong>Show the basket</strong><span>Post a photo of what you actually bought — real food converts better than a banner.</span></li>
                    <li><strong>Share during meal times</strong><span>Late morning and early evening is when people plan what to cook.</span></li>
                  </ul>
                </section>
              </>
            )}

            {section === "promotions" && (
              <>
                <section className="affd-banner is-promo">
                  <div>
                    <span className="affd-eyebrow">Special promotions</span>
                    <h1>More shares,<br /><em>bigger rewards!</em></h1>
                    <p>There are no bonus campaigns running right now. These ready-made SureFood pages are the ones shoppers open most — share yours and every paid order still earns {Math.round(rate * 100)}%.</p>
                    <button className="affd-cta" type="button" onClick={() => void copy(link, "promo")}>{copied === "promo" ? "Link copied ✓" : "Copy my link"} <Icon name="arrow" /></button>
                  </div>
                  <div className="affd-banner-art is-megaphone" aria-hidden="true"><span><Icon name="megaphone" /></span><strong>Share more<br />Earn more</strong></div>
                </section>

                <div className="affd-split">
                  <section className="affd-card">
                    <header className="affd-card-head"><div><h2>Ready-to-share pages</h2><p>Each button copies your personal link to that page.</p></div></header>
                    <ul className="affd-promo-list">
                      {sharePages.map((page) => (
                        <li key={page.name}>
                          <span className="affd-promo-mark"><Icon name="spark" /></span>
                          <div><strong>{page.name}</strong><small>{page.copy}</small></div>
                          <button type="button" onClick={() => void copy(`${link}${page.hash}`, page.name)}>{copied === page.name ? "Copied ✓" : "Copy link"}</button>
                          <Link href={page.href} className="affd-promo-open">View <Icon name="arrow" /></Link>
                        </li>
                      ))}
                    </ul>
                  </section>

                  <section className="affd-card affd-promo-stats">
                    <h2 className="affd-h2">Your promotion stats</h2>
                    <div className="affd-tile-grid">
                      <div><span className="affd-mini-icon is-violet"><Icon name="megaphone" /></span><small>Active campaigns</small><strong>0</strong></div>
                      <div><span className="affd-mini-icon is-green"><Icon name="share" /></span><small>Referred orders</small><strong>{stats?.referredOrders ?? 0}</strong></div>
                      <div><span className="affd-mini-icon is-amber"><Icon name="chart" /></span><small>Conversion</small><strong>{percent(conversion)}</strong></div>
                      <div><span className="affd-mini-icon is-blue"><Icon name="wallet" /></span><small>Commission earned</small><strong>{money(stats?.earnedMinor ?? 0)}</strong></div>
                    </div>
                    <div className="affd-tip-card">
                      <span><Icon name="spark" /></span>
                      <div><strong>Pro tip</strong><p>Pair a seasonal photo with one clear line about the price. That is what gets clicks, not long captions.</p></div>
                    </div>
                  </section>
                </div>
              </>
            )}

            {section === "earnings" && (
              <>
                <section className="affd-banner">
                  <div>
                    <span className="affd-eyebrow">Earnings overview</span>
                    <h1>Your effort brings<br /><em>real rewards!</em></h1>
                    <p>Track your earnings, monitor your progress and keep growing with SureFood.</p>
                    <div className="affd-banner-stats">
                      <div><small>Total earnings</small><strong>{money(stats?.earnedMinor ?? 0)}</strong></div>
                      <div><small>Pending earnings</small><strong>{money(stats?.requestedMinor ?? 0)}</strong></div>
                      <div><small>Total referrals</small><strong>{stats?.referredOrders ?? 0}</strong></div>
                      <div><small>Conversion rate</small><strong>{percent(conversion)}</strong></div>
                    </div>
                  </div>
                  <div className="affd-banner-art is-wallet" aria-hidden="true">
                    <span><Icon name="wallet" /></span>
                    <strong>Quick earnings</strong>
                    <Sparkline values={dailySeries(orders, 14).map((point) => point.commission)} />
                  </div>
                </section>

                <div className="affd-split">
                  <section className="affd-card">
                    <header className="affd-card-head"><div><h2>Earnings breakdown</h2><p>Where your money came from.</p></div></header>
                    <div className="affd-breakdown">
                      <div className="affd-donut" style={{ ["--paid" as string]: `${stats?.earnedMinor ? Math.min((stats.paidOutMinor / Math.max(stats.earnedMinor, 1)) * 100, 100) : 0}%` }}>
                        <span><small>Total</small><strong>{money(stats?.earnedMinor ?? 0)}</strong></span>
                      </div>
                      <ul>
                        <li><i className="is-violet" />Product commission <strong>{money(stats?.earnedMinor ?? 0)}</strong><em>{stats?.earnedMinor ? "100%" : "0%"}</em></li>
                        <li><i className="is-green" />Paid out <strong>{money(stats?.paidOutMinor ?? 0)}</strong><em>{stats?.earnedMinor ? `${Math.round((stats.paidOutMinor / stats.earnedMinor) * 100)}%` : "0%"}</em></li>
                        <li><i className="is-amber" />Available <strong>{money(stats?.availableMinor ?? 0)}</strong><em>{stats?.earnedMinor ? `${Math.round((stats.availableMinor / stats.earnedMinor) * 100)}%` : "0%"}</em></li>
                      </ul>
                    </div>
                    <button type="button" className="affd-cta is-small" onClick={() => setSection("payouts")}>View payouts <Icon name="arrow" /></button>
                  </section>

                  <section className="affd-card">
                    <header className="affd-card-head"><div><h2>Recent earnings</h2><p>Commission from your referred orders.</p></div><Link className="affd-text-link" href="/account">My account <Icon name="arrow" /></Link></header>
                    {orders.length === 0 ? <p className="affd-empty-small">No commission yet. Your first paid referral will show here.</p> : (
                      <ul className="affd-table">
                        {orders.slice(0, 6).map((order) => (
                          <li key={`${order.id}-${order.createdAt}`}>
                            <span>{shortDate(order.createdAt)}</span>
                            <span>Order {money(order.subtotalMinor)}</span>
                            <strong>{order.commissionMinor > 0 ? money(order.commissionMinor) : "Awaiting payment"}</strong>
                            <em className={order.commissionMinor > 0 ? "is-paid" : ""}>{order.commissionMinor > 0 ? "Earned" : "Pending"}</em>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                </div>
              </>
            )}

            {section === "referrals" && (
              <>
                <section className="affd-banner">
                  <div>
                    <span className="affd-eyebrow">Referrals</span>
                    <h1>Invite friends,<br /><em>earn rewards!</em></h1>
                    <p>Share your unique referral link with friends and family. When they sign up and make a purchase, you both get the good stuff.</p>
                    <button className="affd-cta" type="button" onClick={() => void copy(link, "ref-hero")}>{copied === "ref-hero" ? "Link copied ✓" : "View your referral link"} <Icon name="arrow" /></button>
                  </div>
                  <div className="affd-banner-art is-gift" aria-hidden="true"><span><Icon name="gift" /></span><strong>You get rewarded.<br />They get great food!</strong></div>
                </section>

                <div className="affd-split is-ref">
                  <section className="affd-card">
                    <header className="affd-card-head"><div><h2>Your referral link</h2><p>Every order that starts from this link is recorded against your code for 90 days.</p></div></header>
                    <div className="affd-link-box">
                      <code>{link}</code>
                      <button type="button" onClick={() => void copy(link, "ref")}>{copied === "ref" ? "Copied ✓" : "Copy"}</button>
                    </div>
                    {shareButtons()}
                    <h3 className="affd-h3">Recent referrals</h3>
                    {orders.length === 0 ? <p className="affd-empty-small">Nothing yet — the moment someone orders through your link it appears here.</p> : (
                      <ul className="affd-table">
                        {orders.slice(0, 8).map((order) => (
                          <li key={`${order.id}-${order.createdAt}`}>
                            <span>{shortDate(order.createdAt)}</span>
                            <span>{money(order.subtotalMinor)}</span>
                            <strong>{money(order.commissionMinor)}</strong>
                            <em className={order.commissionMinor > 0 ? "is-paid" : ""}>{order.commissionMinor > 0 ? "Completed" : "Pending"}</em>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>

                  <div className="affd-stack">
                    <section className="affd-stat-panel">
                      <h2>Your referral stats</h2>
                      <div className="affd-tile-grid is-dark">
                        <div><span className="affd-mini-icon is-violet"><Icon name="users" /></span><small>Total referrals</small><strong>{stats?.referredOrders ?? 0}</strong></div>
                        <div><span className="affd-mini-icon is-green"><Icon name="check" /></span><small>Successful orders</small><strong>{stats?.paidOrders ?? 0}</strong></div>
                        <div><span className="affd-mini-icon is-amber"><Icon name="wallet" /></span><small>Commission earned</small><strong>{money(stats?.earnedMinor ?? 0)}</strong></div>
                        <div><span className="affd-mini-icon is-blue"><Icon name="chart" /></span><small>Conversion rate</small><strong>{percent(conversion)}</strong></div>
                      </div>
                    </section>

                    <section className="affd-card">
                      <h2 className="affd-h2">How it works</h2>
                      <ol className="affd-how">
                        <li><span>1</span><div><strong>Share your link</strong><small>Send it on WhatsApp, Facebook or anywhere your people are.</small></div></li>
                        <li><span>2</span><div><strong>They shop</strong><small>Their order is credited to your code automatically.</small></div></li>
                        <li><span>3</span><div><strong>You earn</strong><small>Once the order is paid, {Math.round(rate * 100)}% of the goods value is yours.</small></div></li>
                      </ol>
                    </section>
                  </div>
                </div>
              </>
            )}

            {section === "analytics" && (
              <>
                <section className="affd-card">
                  <header className="affd-card-head">
                    <div><h2>Analytics</h2><p>How your link has performed. Numbers come from your referred orders.</p></div>
                    <div className="affd-range">
                      {[7, 14, 30].map((days) => (
                        <button key={days} type="button" className={range === days ? "is-active" : ""} onClick={() => setRange(days)}>Last {days} days</button>
                      ))}
                    </div>
                  </header>
                  <div className="affd-mini-stats">
                    <div><span className="affd-mini-icon is-violet"><Icon name="users" /></span><small>Referred orders</small><strong>{stats?.referredOrders ?? 0}</strong></div>
                    <div><span className="affd-mini-icon is-green"><Icon name="check" /></span><small>Conversion</small><strong>{percent(conversion)}</strong></div>
                    <div><span className="affd-mini-icon is-amber"><Icon name="wallet" /></span><small>Commission</small><strong>{money(stats?.earnedMinor ?? 0)}</strong></div>
                    <div><span className="affd-mini-icon is-blue"><Icon name="chart" /></span><small>Best day</small><strong>{money(Math.max(...dailySeries(orders, range).map((point) => point.commission), 0))}</strong></div>
                  </div>
                  <LineChart points={points} days={range} />
                </section>

                <section className="affd-card">
                  <h2 className="affd-h2">Day by day</h2>
                  <ul className="affd-table is-day">
                    {[...points].reverse().filter((point) => point.count > 0).slice(0, 12).map((point) => (
                      <li key={point.date}>
                        <span>{new Date(point.date).toLocaleDateString("en-NG", { weekday: "short", day: "numeric", month: "short" })}</span>
                        <span>{point.count} order{point.count === 1 ? "" : "s"}</span>
                        <strong>{money(point.commission)}</strong>
                      </li>
                    ))}
                  </ul>
                  {points.every((point) => point.count === 0) && <p className="affd-empty-small">No referred orders in this window yet.</p>}
                </section>
              </>
            )}

            {section === "payouts" && (
              <>
                <section className="affd-banner is-payout">
                  <div>
                    <span className="affd-eyebrow">Payouts</span>
                    <h1>Get your<br /><em>earnings, fast!</em></h1>
                    <p>Payouts are checked and transferred by hand by our team. Request one as soon as you reach {money(minPayout)}.</p>
                    <button className="affd-cta" type="button" onClick={() => document.getElementById("affd-payout-form")?.scrollIntoView({ behavior: "smooth" })}>Request a payout <Icon name="arrow" /></button>
                  </div>
                  <div className="affd-balance-card">
                    <span>Available balance</span>
                    <strong>{money(stats?.availableMinor ?? 0)}</strong>
                    <small>Total earned {money(stats?.earnedMinor ?? 0)}</small>
                    <button type="button" disabled={!canRequest} onClick={() => document.getElementById("affd-payout-form")?.scrollIntoView({ behavior: "smooth" })}>
                      {canRequest ? "Request payout" : `Reach ${money(minPayout)} to request`}
                    </button>
                  </div>
                </section>

                <div className="affd-split">
                  <section className="affd-card">
                    <header className="affd-card-head"><div><h2>Payout history</h2><p>Every request you have made and where it stands.</p></div></header>
                    {payouts.length === 0 ? <p className="affd-empty-small">No payouts yet. Your first request will show here.</p> : (
                      <ul className="affd-table is-payout">
                        {payouts.map((payout) => (
                          <li key={payout.id}>
                            <span>{shortDate(payout.requestedAt)}</span>
                            <span>{payout.note || "Bank transfer"}</span>
                            <strong>{money(payout.amountMinor)}</strong>
                            <em className={`is-${payout.status}`}>{payout.status === "paid" ? "Paid" : payout.status === "cancelled" ? "Cancelled" : "Awaiting payment"}</em>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>

                  <section className="affd-card" id="affd-payout-form">
                    <header className="affd-card-head"><div><h2>Withdraw money</h2><p>Tell us where to send it. Payouts are manual, so double-check the details.</p></div></header>
                    {!canRequest && <p className="affd-help">You can request a payout once you have {money(minPayout)} available.</p>}
                    <form className="affd-form" onSubmit={requestPayout}>
                      <label htmlFor="affd-bank">Bank account (name · bank · number)</label>
                      <input
                        id="affd-bank"
                        value={payoutForm.bankDetails}
                        onChange={(event) => setPayoutForm((current) => ({ ...current, bankDetails: event.target.value }))}
                        required
                        minLength={10}
                        maxLength={240}
                        placeholder="Ada Obi · GTBank · 0123456789"
                      />
                      <label htmlFor="affd-note">Note for the team (optional)</label>
                      <input
                        id="affd-note"
                        value={payoutForm.note}
                        onChange={(event) => setPayoutForm((current) => ({ ...current, note: event.target.value }))}
                        maxLength={240}
                        placeholder="Anything we should know"
                      />
                      <button className="affd-cta" type="submit" disabled={busy || !canRequest}>
                        {busy ? "Sending request…" : canRequest ? `Request ${money(stats?.availableMinor ?? 0)}` : `Unlocks at ${money(minPayout)}`} <Icon name="arrow" />
                      </button>
                    </form>
                  </section>
                </div>
              </>
            )}

            {section === "settings" && (
              <>
                <section className="affd-banner is-settings">
                  <div>
                    <span className="affd-eyebrow">Settings</span>
                    <h1>Your affiliate<br /><em>details</em></h1>
                    <p>Your affiliate account runs on your SureFood account. Change your name, phone or address from your profile.</p>
                    <Link className="affd-cta" href="/account">Open my profile <Icon name="arrow" /></Link>
                  </div>
                  <div className="affd-banner-art is-gear" aria-hidden="true"><span><Icon name="gear" /></span><strong>Turn your network<br />into earnings</strong></div>
                </section>

                <div className="affd-split">
                  <section className="affd-card">
                    <header className="affd-card-head"><div><h2>Affiliate account</h2><p>The details your commissions are paid against.</p></div></header>
                    <dl className="affd-info">
                      <div><dt>Name</dt><dd>{summary?.affiliate?.name || "—"}</dd></div>
                      <div><dt>Email</dt><dd>{summary?.affiliate?.email || user?.email || "—"}</dd></div>
                      <div><dt>Referral code</dt><dd>{code}</dd></div>
                      <div><dt>Status</dt><dd><span className={summary?.affiliate?.status === "active" ? "affd-pill is-active" : "affd-pill"}>{summary?.affiliate?.status === "active" ? "Active" : "Paused"}</span></dd></div>
                      <div><dt>Commission rate</dt><dd>{Math.round(rate * 100)}% of goods value</dd></div>
                      <div><dt>Minimum payout</dt><dd>{money(minPayout)}</dd></div>
                    </dl>
                  </section>

                  <div className="affd-stack">
                    <section className="affd-card">
                      <h2 className="affd-h2">Payout method</h2>
                      <p className="affd-help">Payouts are sent manually to the bank account you enter when you request one. Have a different account? Just use it in the next request.</p>
                      <Link className="affd-text-link" href="/account">Manage my account <Icon name="arrow" /></Link>
                    </section>
                    <section className="affd-card">
                      <h2 className="affd-h2">Fair rules</h2>
                      <ul className="affd-ticks">
                        <li>Commission is earned on paid orders only, never on cancelled or unpaid ones.</li>
                        <li>Your own orders never earn commission.</li>
                        <li>Payouts are sent by hand — allow up to five working days.</li>
                        <li>Accounts that self-refer or send fake traffic are paused.</li>
                      </ul>
                    </section>
                  </div>
                </div>
              </>
            )}

            <section className="affd-help-card">
              <span className="affd-help-icon"><Icon name="headset" /></span>
              <div><strong>Need help?</strong><p>Our team handles affiliate payouts, codes and disputes.</p></div>
              <a className="affd-cta is-small" href="mailto:support@surefoodz.com">Contact support <Icon name="arrow" /></a>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
