# Sure Foodz — Product Requirements Document & Design Brief

**Product:** Sure Foodz (surefoodz.com)
**Document version:** 1.0
**Date:** 30 October 2026
**Status:** For design sign-off
**Owner:** Sure Foodz product team
**Audience:** Visual/UI designer, front-end engineer, founder

| Role | Name | Signature | Date |
| --- | --- | --- | --- |
| Product owner | | | |
| Lead designer | | | |
| Engineering | | | |

---

## 1. What Sure Foodz is

Sure Foodz is a Nigerian food marketplace. Verified farmers, vendors and suppliers list fresh food and everyday essentials; buyers shop from them, pay online, and get delivery. Three things make it different from a generic grocery app:

1. **Every seller is verified before they can list anything.** Identity, address and business documents are checked by staff. Buyers see that verification on every product.
2. **Buy now, pay later — without cards or a credit bureau.** A buyer proves income (business registration, employment letter, payslip), proves who they are (NIN) and where they live (NEPA bill), and gives two referees the company can call. Staff approve a credit limit by hand. This is a low-interest food credit, not a card product.
3. **Special / event orders placed early cost less.** Event orders earn a planning-band discount: the further ahead the event, the deeper the discount. Staff quote the exact figure.

Supporting pillar: an **affiliate programme** — anyone can refer buyers and earn 5% of goods value. Payouts are requested in-app and **paid manually by bank transfer**.

**Tagline:** Fresh Food · Better Life
**One-line pitch:** Fresh food from verified local sellers across Nigeria — pay later, or order early for your event and pay less.

---

## 2. The problem

- Food shopping in Nigeria means travelling to crowded markets, haggling, prices that change by who is asking, and no idea who grew or packed what.
- Families who need food now but get paid later have no formal option; informal credit is risky for both sides.
- Event hosts (weddings, corporate, festivals) buy food in bulk at short notice and overpay.
- Small vendors and suppliers have no credible online storefront, and buyers have no reason to trust an unknown seller.

Sure Foodz answers all four in one marketplace: verified supply, transparent pricing, structured food credit, and early-planning discounts.

---

## 3. Users and roles

| Role | Who | What they do in the product |
| --- | --- | --- |
| **Buyer** | Households, individuals | Browse, search, save favourites, cart, checkout, Paystack payment, track orders, apply for Pay Later, request event orders, join affiliate programme |
| **Vendor** | Shop owners, market traders | Listed after verification + approval fee (₦2,000); manage listings, stock, orders, delivery fee quotes, payout account |
| **Supplier** | Wholesalers, distributors | Listed after verification + approval fee (₦5,000); bulk/wholesale workspace, sell to vendors, larger catalogue |
| **Producer / manufacturer** | Farms, food processors | Sell own produce; manufacturer listings require a NAFDAC number |
| **Rider** | Delivery partners | Assigned deliveries (role exists; delivery UI not yet built) |
| **Staff / admin** | Sure Foodz team | Seller verification queue, Pay Later queue, event-order queue, affiliate payouts, categories, marketplace control |
| **Affiliate** | Any signed-in user | Shares a referral link, earns 5%, requests payout |

Roles are exclusive: one email = one role. A vendor who wants to buy wholesale uses their vendor account; a person cannot be buyer and seller on the same email.

---

## 4. Goals, non-goals, success measures

**Goals**

- G1. A first-time visitor understands the offer and can find a product in under 15 seconds on a phone.
- G2. Buyers trust the marketplace on sight — verification, real photos, real prices, real sellers.
- G3. Pay Later and event orders are discoverable enough to be used, but never feel like the price of entry.
- G4. Sellers can run their whole business (list, stock, orders, payouts) without leaving the workspace.
- G5. Staff queues are fast to work through on a laptop.

**Non-goals (this phase)**

- No card-on-file credit product, no automated credit scoring, no automated affiliate payouts — money movement outside checkout is manual by design.
- No in-app chat between buyer and seller.
- No rider delivery app.
- No native mobile apps; the web experience is mobile-first.

**Success measures**

| Measure | Target |
| --- | --- |
| Home → product detail (mobile) | under 3 interactions |
| Checkout completion | ≥ 60% of carts that reach checkout |
| Pay Later applications submitted per week | tracked, growing |
| Event orders placed ≥ 30 days ahead | ≥ 50% of event orders |
| Seller listing time after approval | under 10 minutes |
| Mobile LCP on 3G-class connection | under 2.5 s |

---

## 5. Brand identity

### 5.1 Name — critical

The name is **Sure Foodz**, with a **Z**. It is **not** "Sure Food", "Shure Food", "Short Food" or "Sure Foods". The domain is `surefoodz.com`. The wordmark must show the Z. Two-tone treatment is preferred: "Sure" in the dark brand colour, "Foodz" in the lighter brand purple — `Sure Foodz`. The `Foodz` highlight is part of the mark, not decoration.

### 5.2 Wordmark & mark

- Current in-product mark: a leaf glyph in a rounded square + "Sure Foodz" set in **Fraunces** (see 5.4).
- The founder will supply a final logo. Until then, design the lockup to hold the leaf + two-tone wordmark; keep 8 px clear space, min width 120 px, and provide a monochrome version for the dark footer.
- The leaf mark must scale down to a 16 px favicon and read as a leaf, not a blob.

### 5.3 Colour

Existing tokens (light theme, from `app/globals.css`). These are the source of truth — extend them, don't replace them.

| Token | Hex | Use |
| --- | --- | --- |
| `--brand` | `#392456` | Primary purple: buttons, links, active states |
| `--brand-dark` | `#26173e` | Headings, wordmark, pressed states |
| `--brand-deep` | `#27193c` | Dark bands, announcement bar, footer |
| `--brand-soft` | `#e8dcf2` | Tinted chips, selected rows, soft fills |
| `--surface` | `#f6f3f8` | Page/card wash |
| `--ink` | `#2d2637` | Body text |
| `--muted` | `#837e89` | Secondary text, labels |
| `--line` | `#e9e6ec` | Borders, dividers |

Accent colours allowed, sparingly:

- **Harvest gold** `#E8B34A` — discount badges, "pay less" emphasis, rating stars, hero accent words.
- **Leaf green** `#3E7B4F` — freshness / verified / in-stock signals **only**. This is a semantic colour, not a brand colour. Do not use green as a page or section background.
- **Alert red** `#C0392B` — errors, rejected states, destructive actions.
- **Success** uses leaf green; **warning** uses harvest gold with dark ink text.

**Rule (from client feedback, repeated):** the site is **purple**. Green is an accent for "fresh/verified" only. No green headers, green bands, green buttons or green footers.

Dark theme palette already generated: page `#120b20`, text `#ece6f8`, purple accents `#a855f7` / `#6d28d9`, borders `rgba(196,165,255,.34)`. Light is the **default** for new visitors who have no preference; a stored choice always wins.

### 5.4 Typography

- **Interface:** Figtree (400/500/600/700/800/900). Base body 15.5 px, line-height 1.5, tracking −0.005em.
- **Brand voice:** Fraunces (500/600/700, optical size 9–144). Used for the wordmark, big editorial statements, and a *few* section titles.
- **Rule from client feedback:** current type reads "AI-generated". Fix by: fewer fonts in play, stricter scale, no letter-spacing below −0.5 px except large display sizes, no all-caps body copy, and no gradient text. Award weight and hierarchy to size and colour, not to decoration.
- Type scale (desktop → mobile): display 40/32, h1 32/26, h2 24/21, h3 18/17, body 15.5/15, small 13/12.5, micro 11.5.
- Numerals: use tabular figures for prices and tables. Prices are always NGN with the ₦ symbol and no decimals, e.g. `₦12,500`.

### 5.5 Imagery

- Real photography only. No stock-photo smiles, no 3D blobs, no AI-looking gradients over produce.
- Product images: square, 1:1, on a clean neutral background, one subject per card, sharp at 2×.
- Hero/editorial images: warm natural light, shallow depth, food shot from a real kitchen or market. Keep the file under 250 KB (WebP/AVIF) — the current hero went from 2.9 MB PNG to 203 KB WebP.
- Seller photos and store cover images come from sellers; provide a graceful fallback tile (monogram + category icon) for missing images.

### 5.6 Iconography & illustration

- Line icons, 1.7 px stroke, rounded caps, 20/24 px grid. The current set is hand-rolled SVG in the components; formalise it as a 40-icon library.
- Emoji may appear in category chips **only** (🥬 🍎 🌾). Never in headings, buttons or empty states.
- No illustration style exists yet; if you add one, make it flat, purple/gold, food-subject, and use it only for empty states and errors.

### 5.7 Voice & tone

- Plain, warm Nigerian English. Short sentences. No corporate fog, no exclamation marks in body copy.
- Speak like a helpful shopkeeper: "We will call both referees" not "Verification of referees will be conducted".
- Never promise what the product cannot do: Paystack collects the money; refunds are manual; payouts are manual.
- Money is always shown as a converted **estimate** for non-Nigerian visitors with the live rate and timestamp — never imply a locked price.

---

## 6. Design principles

These come directly from client review and are binding:

1. **Mobile first, genuinely.** Over 80% of traffic is a phone. Design the 390 px layout first; desktop is the enlargement. Nothing may break, overlap or require horizontal scroll at 320–430 px.
2. **Content must reach the edges.** Full-bleed media and section rules run to the viewport edges. No dead gutters on the right and left of a hero; no boxed-in photo floating in whitespace.
3. **Compact, not cavernous.** Cards, banners and headers are smaller than the current build. A phone should show the top of the product grid without scrolling past a wall of banner. Cut hero height, cut card padding, cut whitespace between blocks.
4. **Calm chrome.** Fewer banners. At most one promotional band in the flow at a time. Footers are quiet: no bright blue, no heavy colour block — use a deep neutral/purple, restrained type, clear columns, terms and privacy present.
5. **One accent at a time.** Purple leads; gold accents; green only for verified/fresh.
6. **Trust is visible.** Verification status, seller location, distance and "open store" belong on the product screen. Never bury trust signals in a modal or a settings page.
7. **Every state is designed.** Loading (skeletons, not spinners), empty, error, offline, permission-denied (location), unauthorised, and success. No blank white screens.
8. **Motion confirms, it does not perform.** See section 12.
9. **Both themes, every screen.** Every screen must be reviewed in light and dark.
10. **No hard-coded data in the UI.** Anything shown to a user comes from the API or a documented constant.

---

## 7. Information architecture

```
Home (/)
├── Search / browse (/search)
│   └── Product details (modal over any listing)
├── Seller storefront (/store/[sellerId])
├── Cart (drawer) → Checkout → Payment (Paystack) → /checkout/verify
├── Account (/account)
│   ├── Profile & delivery details
│   ├── Orders (status, pay, track)
│   ├── Saved products (/favorites)
│   └── Theme switch (light/dark) — lives HERE only
├── Pay Later (/pay-later)              → application + status
├── Event & special orders (/special-orders) → request + status
├── Affiliate (/affiliate)              → link, earnings, payouts
├── Seller onboarding (/onboarding)     → documents, approval fee
├── Vendor workspace (/vendor)
├── Supplier workspace (/supplier)  and  /supplier/store
├── Staff workspace (/admin)
│   ├── Verification queue
│   ├── Pay Later queue
│   ├── Event orders queue
│   ├── Affiliates & payouts
│   └── Categories
├── Content: /about, /contact, /terms, /privacy
└── Auth: /login, /signup (role preselect via ?role=vendor|supplier)
```

**Global navigation (desktop):** Home · Shop · Pay later · Event orders · Affiliate · About · Contact, with location picker, search, account and cart on the right. The full menu collapses into a drawer below 1280 px and the drawer must be a designed, thumb-reachable panel.

**Global footer:** two option cards (Buy now pay later / Special & event orders), then four columns — Shop, Company, Support & legal, and the brand block — then a bottom bar with © and legal links.

---

## 8. Screen requirements

For each screen: purpose, required content, layout intent, states. Data fields listed are the minimum the API already returns.

### 8.1 Home (buyer) — `/`

**Purpose:** convert a first-time visitor into a product tap.

Required order of content:

1. **Header** — logo, nav, location picker ("Use my location" + city select), search, account, cart with count, mobile menu.
2. **Hero** — full-bleed produce photo, ≤ 300 px tall on mobile. Badge "Farm Fresh · Local · Trusted", headline with one gold emphasis word (e.g. "for a **Healthier You**"), one-line subcopy, prominent search field, three trust points (Track Nearby Vendors / Secure Payments / Fresh & Quality), and a "Find Nearby Vendors" row. The photo must be visibly present behind the copy — never a flat purple slab.
3. **Category strip** — 8 emoji chips, horizontally scrollable on mobile, selected state.
4. **Offer banner** — one only. Image + "Special Offer" pill + headline + CTA + discount badge.
5. **Featured products** — section head with count, category filter note, and a live-rate note when the visitor's currency is not NGN. Grid: **6 across on desktop, 5 at ≤1240, 4 at ≤1120, 2 on mobile.** Cards compact; the row sits above the fold on desktop.
6. **Vendors & suppliers near you** — copy block with location action + city select, a real map panel, and a **horizontally scrollable** seller strip (never a 60-item vertical wall). Each seller card: image/monogram, name, role badge (Vendor/Supplier), city + distance, verified tick.
7. **Footer.**

Remove the "More ways to shop" style duplicate sections; the client asked for them gone.

### 8.2 Search / browse — `/search`

- Search field with query echo, result count, category and location filters, sort (nearest, price, newest).
- Same 6/5/4/2 grid as home. Skeleton cards while loading. Empty state suggests a category and shows nearest sellers.
- Vendor and supplier result strips scroll horizontally.

### 8.3 Product details (modal)

The hub of the buying decision. Required content, in order:

- Image (1:1, zoomable), name, seller name, **verified vendor/supplier line**, seller city + distance.
- Price in ₦ (plus converted estimate for foreign visitors), unit/weight, stock state, category, product source (farmer/producer/manufacturer), expiry, NAFDAC number when present.
- Quantity stepper, **Add to cart**, **Save** (heart).
- **Two buying options, as first-class buttons** — not text links, not buried:
  - **Pay later on this item** → pre-fills `/pay-later` with this product attached (name, price, seller, quantity).
  - **Order for an event / special order** → pre-fills `/special-orders` with this product in the item list.
- **Seller block:** verification line, "Open store" button (goes to `/store/[sellerId]`), and the same two buying options repeated — the client asked for the vendor block to carry them too.
- Trust line: secure payment, delivery handled by the seller, support contact.

States: missing image, out of stock (disable add, keep Pay Later visible), price changed since listing, seller no longer approved (block purchase, explain).

### 8.4 Storefront — `/store/[sellerId]`

- Cover, avatar/monogram, seller name, verified badge, city, member-since, product count, rating slot (future).
- Same two buying-option buttons at the top of the store.
- Seller's products in the same responsive grid, plus a "verified vendor" header strip that makes the store auditable.
- Empty store state: "This seller has not listed anything yet — here are sellers near you."

### 8.5 Cart and checkout

- **Cart drawer** from the right: line items with image, name, seller, qty stepper, remove, subtotal per seller, total, "Checkout". Empty state has a clear shop CTA.
- Cart persists in the browser for guests; adding an item prompts sign-up for guests.
- **Checkout** requires a saved phone and delivery address; otherwise inline capture. One order is created **per seller**.
- After ordering, the buyer sees **"Pending seller confirmation"** — the seller sets the delivery fee — then **"Awaiting buyer payment"**, then Paystack. The UI must explain this two-step honestly: *"Waiting for [seller] to confirm the delivery fee. Checkout opens for payment the moment they add it."*
- Payment is NGN only. Foreign visitors see estimates with a "charged in Naira at checkout" note.

### 8.6 Account — `/account`

- Hero with greeting, avatar, role chip, member since.
- **Profile & delivery details** (editable name, phone, address).
- **Orders** — one card per order: id, seller, items, status pill, total, delivery fee, and the single next action (Pay / Track / Cancel-before-payment / View). Status set: `Pending payment · Confirm · Processing · Ready · Assigned for delivery · Delivered · Cancelled/Refund`, plus buyer-facing states `Pending seller confirmation` and `Awaiting buyer payment`.
- **Saved products** link, **Pay Later** link, **Affiliate** link, help/contact block, thank-you block.
- **Theme switch (light/dark) lives only here** — the client asked for a single switch on the profile. Remove the toggle from every other screen.
- Must be a designed, compact, beautiful page — the client called the current one bland. Use the affiliate dashboard's quality as the benchmark.

### 8.7 Pay Later — `/pay-later`

- **Hero:** what it is (food credit, no bank card), who it is for, the honest promise ("we do not need your card; we do need proof of how you earn").
- **How it works (4 steps):** Apply online → We verify → You get a decision → Shop and repay.
- **What you will need:** business owners (business name, CAC/registration number, business address, registration certificate) vs employees (employer, staff number, government/private, level, employment letter, payslip). Plus, for everyone: **NIN slip** and **NEPA/electricity bill** proving where they live, and **two referees** with name, phone and relationship.
- **Application form** — grouped in clear sections with progress indication; file upload per document with type/size guidance; applicant-type switch changes the document set; validation inline, not on submit.
- **Status view** — submitted / approved / declined, with the plan detail when approved.
- Attached-product banner when arriving from a product ("You are applying to buy *X* — ₦Y from *Seller*").
- **Must feel institutional and calm.** This is a credit application: no confetti, no playful motion, clear consequences and privacy reassurance.

### 8.8 Event & special orders — `/special-orders`

- **Hero:** "Plan your event food early, and pay a better price." Explain that the earlier the order, the deeper the discount.
- **Form:** contact, event type (wedding / birthday / corporate / festival / religious / other), event date with live **planning band** feedback (Early ≥60 days, Advance ≥30, Short-notice ≥14, Standard <14), guest count, delivery city/address, item list (free text with example placeholder), notes, and a required acknowledgement that this is a **request, not a paid order**.
- **Discount by planning band** panel — states that staff confirm the exact figure in the quote.
- **How event orders work** — request → quote → confirm → pay before the day.
- **Status view** — requested / quoted / confirmed / declined, with the quote breakdown.
- A product attached from a product page appears at the top of the request.

### 8.9 Affiliate — `/affiliate`

- Dashboard quality benchmark for the whole product: sidebar + content shell.
- **Sidebar:** dashboard, referrals, payouts, programme rules, back to shop.
- **Content:** referral link with copy button, code, 90-day cookie note, **5% of goods value**, minimum payout **₦5,000**, manual bank transfer, statuses (active/paused), earnings summary (earned, pending, paid, available), payout request form (min enforced), payout history table with `requested / paid / cancelled`.
- Empty state for a brand-new affiliate: "Share your link — your first referral shows up here."
- **All figures come from the API**, never hard-coded.

### 8.10 Auth — `/login`, `/signup`

- Split layout: brand art (kitchen/produce photo) + form. The photo must be present and sharp; the login art is currently a CSS background and must be treated as a designed asset.
- Email **one-time code** flow: enter email → receive 6-digit code → verify. Show resend with countdown.
- **Google sign-in must work** and be visually equal to email. If it fails, show a specific, actionable message — never "Sign in to continue." with no context.
- Role preselect for `?role=vendor` / `?role=supplier`, with a clear "you are creating a seller account" note.
- **Human check:** a lightweight "verify you are not a robot" challenge (select-the-food-tile style), inline, keyboard-accessible, with a clear error and retry. It must never block a legitimate user silently.
- Errors: "We could not check your account. Try again shortly." is a system failure, not a user error — design a distinct state that offers retry and support contact.
- Responsive: the split collapses to a single column on mobile with the art reduced to a slim band, not removed.

### 8.11 Seller onboarding — `/onboarding`

- Status machine: not started → documents uploaded → automatic registry check (Smile ID) or manual review → approved → approval fee → listings unlocked; or rejected with a note and resubmission.
- Show exactly which documents are needed per role. **Vendors:** proof of address + NIN. **Suppliers:** business registration (CAC) + proof of address + NIN.
- Document upload with preview, replace, and 15 MB limit (PDF/JPG/PNG).
- Approval fee card: **₦2,000 vendor / ₦5,000 supplier**, non-refundable, paid by Paystack. Listings and image uploads stay locked until it is paid — make that lock obvious, not mysterious.
- Rejection state: the staff note, which document to replace, resubmit action.

### 8.12 Vendor workspace — `/vendor`

Dark/light dashboard shell with sidebar workspace nav. Tabs: Dashboard, Products, Orders, Inventory, Customers, Pricing & Discounts, Shipments, Payouts, Analytics, Profile, Settings.

Must include:

- KPI row (revenue, orders, low stock, payout due).
- Orders table: id, product, qty, buyer, total (+ delivery fee), status, **next step** action (Start preparing / Mark ready / Mark delivered), Details, Cancel (only before payment).
- **Delivery quote form** for `Pending seller confirmation` orders — this is the step that unblocks the buyer's payment, so it must be prominent.
- Product form: name, category, price, stock, unit, source, expiry, NAFDAC (manufacturers), image upload.
- **Payout account:** Nigerian bank + account number, resolved name must match the approved business name; full number never echoed back.
- Empty, loading and error states for every table.

### 8.13 Supplier workspace — `/supplier`

Same shell, wholesale-flavoured nav: Dashboard, Products, Bulk Orders, Inventory, Orders, Customers & Vendors, Pricing & Discounts, Shipments & Delivery, Payouts, Analytics, Supplier Profile, Settings.

- Bulk-order and pricing screens must read as B2B: per-case pricing, minimum order quantity, buyer business names.
- The **purple bulk banner artwork** already swapped in should be reused as the supplier-side visual language, not the buyer hero.

### 8.14 Staff workspace — `/admin`

- Separate staff sign-in (email + password, plus setup key for the first account). No public role granting.
- Landing hub with counts: verifications pending, Pay Later pending, event orders pending, affiliate payouts requested.
- **Verification queue:** applicant, role, business name and number, registry check result, document links (short-lived, opened on trusted devices), approve / reject with required note.
- **Pay Later queue:** applicant type, income evidence, NIN, utility bill, both referees with tel links, approve (with limit and repayment plan) / decline.
- **Event order queue:** event type, date, planning band, guest count, items, quote and confirm.
- **Affiliates:** active/paused, earnings, payout requests with "mark paid".
- **Categories:** create/edit product categories.
- Density matters: these are worked through in batches. Tables, not cards.

### 8.15 Content pages — `/about`, `/contact`, `/terms`, `/privacy`

- Shared editorial layout: kicker, title, lede, last-updated date, readable measure (≈68 ch), anchored subheadings, contact cards.
- Terms and privacy must be linked from the footer, the sign-up form and checkout.

---

## 9. Key flows

**F1. First purchase.** Land → hero search or category → product details → add to cart → sign up (OTP or Google) → phone + address → checkout (one order per seller) → seller confirms delivery fee → buyer pays by Paystack → order status advances → delivered.

**F2. Pay Later.** Product details → "Pay later on this item" → `/pay-later` with product attached → choose applicant type → capture identity, income evidence, NIN, NEPA bill → two referees → submit → staff verify → approve with limit → buyer shops on credit → repays in agreed instalments.

**F3. Event order.** Product details or nav → `/special-orders` → event type and date (planning band updates live) → guests, delivery, items → acknowledge "request, not order" → submit → staff quote with discount → buyer confirms and pays ahead of the date.

**F4. Become a seller.** `/signup?role=vendor` → OTP/Google → `/onboarding` documents → registry check → staff approve → approval fee → listings unlocked → product form → live listing.

**F5. Sell flow (vendor).** Order arrives → confirm delivery fee → buyer pays → start preparing → mark ready → mark delivered → payout (manual).

**F6. Affiliate.** Sign in → `/affiliate` → copy link → buyer lands with 90-day cookie → orders → 5% credited → request payout ≥ ₦5,000 → staff transfer → marked paid.

---

## 10. Component library to deliver

Buttons (primary/secondary/ghost/destructive, 3 sizes, icon-leading, loading, disabled) · inputs, selects, comboboxes, textareas, steppers · file upload with preview · checkbox/radio/switch (the theme switch) · segmented control (applicant type, auth mode) · chips/pills (category, status, band) · badges (verified, discount, low stock) · product card (grid + list + horizontal-scroll strip variants) · seller card · order card · KPI tile · data table (sortable, sticky header, row actions, empty state) · tabs and sidebar nav · drawer (cart) · modal (product details) · toast/inline notice · skeleton loaders · empty states (illustrated) · error and retry blocks · map panel · progress indicator for multi-step forms · tooltips for verification.

Each component needs: all states, light + dark, mobile + desktop, and focus-visible styling.

---

## 11. Responsive grid

| Breakpoint | Grid | Notes |
| --- | --- | --- |
| ≥1281 px | 6 product columns | full nav visible |
| 1240–1280 | 5 columns | nav becomes drawer |
| 1121–1239 | 5 columns | |
| 901–1120 | 4 columns | nearby block 2-up |
| 721–900 | 3 columns | |
| ≤720 px | 2 columns | 16 px gutters, sticky search, drawer nav |
| ≤430 px | 2 columns | hero ≤ 280 px tall, 44 px minimum tap targets |

Page gutters: `clamp(16px, 3vw, 42px)`. Media blocks are full-bleed to the viewport edge. Tables scroll horizontally inside their own container; the page never does.

---

## 12. Motion

- Purpose only: page/section entrance, hover/focus confirmation, drawer and modal transitions, skeleton→content, status changes, add-to-cart feedback.
- Durations: 120 ms micro (hover, press), 200 ms standard (fade/slide), 320 ms panels, 480 ms max for hero entrance. Easing: `cubic-bezier(.22,.61,.36,1)` for entrances, `cubic-bezier(.4,1.3,.5,1)` for playful knob moves only.
- Stagger product cards by 40 ms, max 8 items, then stop — never re-animate on scroll back.
- Respect `prefers-reduced-motion`: replace movement with opacity only, keep everything usable.
- **Banned:** parallax soup, infinite bouncing, text that types, counters that spin forever, scroll-jacking, anything that re-triggers on every scroll.

---

## 13. Theme

- Light is the default for visitors with no stored choice; system preference is followed until the visitor picks.
- Dark must be complete on **every** screen: buyer, vendor, supplier, admin, affiliate, auth, legal.
- No flash of light theme on load — paint the theme before first paint.
- Only **one** theme switch in the product: inside the account/profile settings (client request). Do not replicate it in headers.
- Contrast: body text ≥ 4.5:1, large text ≥ 3:1, focus rings ≥ 3:1 against their surface, in both themes.

---

## 14. Content and microcopy rules

- Currency: `₦12,500` (no decimals). Foreign estimates show currency code and the rate freshness, e.g. "≈ $8.10 at ₦1,543/$ · updated 2 h ago".
- Statuses are sentence case and human: "Awaiting buyer payment", not `PENDING_PAYMENT`.
- Every destructive action confirms with the consequence, not "Are you sure?".
- Every empty state names the reason and the next action.
- Every error says what happened, what to do, and offers support.
- Dates: `12 Nov 2026`. Times in the buyer's device timezone.
- No placeholder lorem, no "coming soon" without a date, no fake names or fake order counts.

---

## 15. Localisation

- **Language:** every page is machine-translated into the visitor's browser language via `/api/translate`, cached, switchable, remembered. Copy must survive translation: avoid idioms, puns and strings embedded in images.
- **Currency:** prices live in NGN and are charged in NGN. Non-Nigerian visitors see an estimate converted at a live rate (cached 6 h) with the rate timestamp and a "charged in Naira at checkout" note. The converted figure must never look like a locked price. Product names are translated for reading only; orders and receipts keep the seller's original text.
- Layout must tolerate 30–40% string growth without clipping buttons or table cells.

---

## 16. Accessibility

- WCAG 2.2 AA. Full keyboard operation for the drawer, modal, menus, tabs and forms; focus trap in modal/drawer; Escape closes.
- Semantic landmarks, one `h1` per page, labelled form controls, `aria-live` for toasts and status changes.
- 44×44 px minimum touch targets on mobile; visible focus ring on every interactive element in both themes.
- Images need alt text: product alt = "Product name from Seller, City". Decorative art is `aria-hidden`.
- Maps and iframes get titles; nothing critical is hover-only.

---

## 17. Performance budgets

| Asset | Budget |
| --- | --- |
| Hero image (WebP/AVIF, ≤1920 px) | ≤ 250 KB |
| Product thumbnail | ≤ 40 KB |
| Fonts | 2 families, `font-display: swap`, subset Latin |
| First-load JS per route | ≤ 220 KB gzipped |
| Mobile LCP | ≤ 2.5 s |
| CLS | ≤ 0.1 |
| INP | ≤ 200 ms |

Rules: no layout shift from images (explicit dimensions or aspect ratio), lazy-load everything below the fold, blur placeholder for the hero, skeleton (not spinner) for data.

---

## 18. Handoff checklist

- [ ] Figma file with pages: Foundations, Components, Buyer, Seller, Staff, Auth, Legal — plus a light and dark frame for **every** screen.
- [ ] Tokens exported (colour, spacing, radius, type, shadow, motion) and named to match the CSS variables already in the codebase.
- [ ] All component states documented (default, hover, focus, active, disabled, loading, error, empty).
- [ ] Mobile frames at 390 px and 360 px for every screen; desktop at 1440 px; tablet at 834 px.
- [ ] Redlines for the 6/5/4/2 product grid, the hero height cap, and table density.
- [ ] Icon set (40 icons, 20/24 px, 1.7 px stroke) as SVG.
- [ ] Logo lockups: primary, mono, favicon; dark-surface variant.
- [ ] Image treatment spec (crop ratios, scrim values, min resolution).
- [ ] Motion spec with durations and easing named as tokens.
- [ ] Copy deck for every screen, matching the rules in section 14.
- [ ] Annotated flows for F1–F6.
- [ ] Accessibility notes per screen.

---

## 19. Known issues the design must solve

1. Hero and banner heights are too tall on phones; the buyer sees banner before products.
2. Cards are too large at desktop — target 6 across, more product per screen.
3. The nearby-vendors map block is too tall; product/vendor strips must scroll horizontally.
4. The buyer home has duplicate promotional sections ("More ways to shop") to remove.
5. The profile page reads as unfinished and lacks a visible sign-out; it must match the affiliate dashboard's quality.
6. The theme switch must appear only on the profile.
7. Login art was a large unoptimised background; seller-side art and imagery must be crisp and sharp at every size.
8. The current type scale reads generic/"AI-made"; the identity needs a distinctive but restrained type system.
9. Green appears where purple should be; audit every surface against section 5.3.
10. Google sign-in and the human check must be visibly working, with honest failure states.
11. Pay Later and event-order entry points must be first-class on product details and storefronts, not hidden links.
12. No hard-coded data anywhere in the new UI; everything from the API.

---

## 20. Open questions for sign-off

1. Final logo: is the leaf mark staying, or is the supplied new logo replacing it? Needed before wordmark frames.
2. Do we keep Fraunces as the brand voice, or move to a single family with a distinctive cut? (Client: current type feels generic.)
3. Is a seller rating/review system in scope this phase? It affects storefront and product cards.
4. Rider delivery experience: design now or defer?
5. Pay Later repayment schedule UI: instalments shown in-app, or communicated off-platform for now?
6. Confirm the discount percentages per planning band (band thresholds are fixed; the % is staff-set).
7. Do we design a printed/digital order receipt?
8. Which social channels are real (footer currently has placeholders)?

---

## Appendix A — Verified technical facts for the designer

- Stack: Next.js 16 App Router, React 19, Firebase (Auth + Firestore), Cloudinary (public product images, private KYC), Paystack (NGN payments), Brevo (email OTP), Smile ID (business-registry checks), live NGN rates (cached 6 h), machine translation endpoint.
- Auth: email one-time code (custom token) or Google sign-in. Seller roles are exclusive per email.
- Verification: vendors need proof of address + NIN; suppliers additionally need business registration. Registry checks run automatically where available (Nigeria, Kenya, South Africa) and otherwise go to manual review.
- Fees: vendor approval ₦2,000, supplier ₦5,000, non-refundable; listings and image uploads lock until paid.
- Orders: one order per seller per checkout; seller sets the delivery fee; buyer pays after the fee is confirmed; only a verified Paystack webhook or authenticated verification can mark an order paid; refunds and seller payouts are manual.
- Affiliate: 5% of goods value, 90-day referral cookie, ₦5,000 minimum payout, manual transfer.
- Listings require a product source, a future expiry date, a valid category, and a NAFDAC number for manufacturer products. Expired listings hide from buyers automatically.
- Every page is shown in the visitor's language and their currency is estimated from live NGN rates.
