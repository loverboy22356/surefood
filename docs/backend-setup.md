# SureFood backend setup

The application uses Firebase Authentication custom tokens and Cloud Firestore, Cloudinary for public product photos and private business documents, and Brevo for email OTP. Smile ID automatically checks supported business registration numbers; staff still review address and identity documents.

## Configure local development

1. In Firebase Console, enable Authentication, the Google sign-in provider, and Cloud Firestore.
2. Create a Firebase service account and keep its JSON private. Add the web-app configuration to `.env.local`. For Firebase Admin, either set `FIREBASE_SERVICE_ACCOUNT_JSON` in `.env.local` or save the downloaded key as `firebase-service-account.json` in the project root; the local key filename is ignored by Git.
3. Create a strong random `OTP_HASH_SECRET`. Add a verified Brevo transactional-email sender and its API key as server-only variables.
4. Add Cloudinary cloud name, API key, and API secret as environment variables. The API secret must never use a `NEXT_PUBLIC_` prefix. Product images use signed public uploads; KYC files are uploaded server-side as private raw assets and use short-lived staff download links.
5. Configure Smile ID's server-only `SMILE_ID_PARTNER_ID`, `SMILE_ID_API_KEY`, `SMILE_ID_CALLBACK_URL`, and `SMILE_ID_ENVIRONMENT` (`sandbox` or `production`). The callback must be a publicly reachable HTTPS URL pointing to `/api/webhooks/smile-id`. Without these values, seller applications are blocked. Never expose Smile ID credentials to the browser or commit them.
6. Deploy Firestore rules and indexes with the Firebase CLI: `npx firebase-tools deploy --only firestore:rules,firestore:indexes`. The approved-seller index is required by the public marketplace endpoint.
7. Start the app with `npm run dev`. The first account should be created through the sign-up page; staff roles must only be assigned by a trusted administrator using Firebase Admin SDK custom claims.
8. Configure the server-only `PAYSTACK_SECRET_KEY` with a Paystack test key locally and a production secret in deployment secrets. Set `APP_BASE_URL` to the public HTTPS SureFood URL in production. The Paystack merchant account associated with this key receives buyer payments. Do not add the secret to a `NEXT_PUBLIC_` variable or source control.
9. In Paystack, configure the webhook URL as `/api/webhooks/paystack` and subscribe to `charge.success`. The app verifies webhook signatures and independently verifies each transaction against Paystack before marking an order paid.
10. Language and currency detection need no extra configuration: `/api/rates` reads live NGN reference rates, and `/api/translate` uses Google's public translation endpoint. For production traffic, set the server-only `GOOGLE_TRANSLATE_API_KEY` (Cloud Translation API enabled) so translation uses a keyed, quota-managed request instead of the public endpoint.

## Account and verification behavior

- Buyers, vendors, and suppliers use email one-time codes sent through Brevo, or Google sign-in. Buyers do not need business verification. Google does not provide a buyer phone number or delivery address; buyers can add and edit both in their account profile. A delivery address is required before checkout.
- Vendor and supplier portal links open sign-up with the selected role preselected. Account roles are exclusive: if an email already has an account under another role, create the seller account with a different email. Seller accounts must be approved by SureFood staff before they can create, publish, or update listings.
- Buyers can browse without signing in. Adding an item saves the cart in the browser and sends guests to buyer sign-up; only live listings can be ordered.
- Vendors and suppliers must submit their business name, registration number, address, business registration document, proof of address, and NIN document. The country selector uses the `country-state-city` country dataset. When configured, Smile ID checks the business registration number, exact registered business name, and active status for Nigeria, Kenya, and South Africa. Applicants can opt to skip this automatic registry check and submit for manual review; if automatic checks are unavailable, applications go to manual review. Staff must check the country's official registry and all documents before approval.
- Staff with a Firebase `staff` or `admin` custom claim review documents at `/admin/verification`. Document links are short-lived (15 minutes) and should only be opened on trusted staff devices.
- Staff approvals enable seller workspaces and product listing. The server requires either a successful automatic registry result or a staff-confirmed official registry check, plus private copies of all three documents and staff attestations for the registration document, address, and NIN. Document-image authenticity and person-to-document matching are not automated. Rejections require a note; applicants see the note, can replace any verification document, and resubmit.
- KYC documents are stored in Cloudinary as private raw assets. Rejected applicants can replace their files; public delivery URLs must not be used for KYC documents.
- Product listing, seller workspaces, and signed product-image uploads are available only after approval and a paid approval fee in every environment.
- New product listings require a product source (farmer, producer, or manufacturer), a future expiry date, a valid category, and a NAFDAC number for manufacturer products. Active listings are hidden from buyers after expiry and seller location is derived from the approved business profile.
- Approved vendors, suppliers, and staff can create product categories. Buyers can browse all locations or filter listings by the seller's city and region; product details show the seller, location, verification status, product source, expiry, and NAFDAC number when available.
- Verification fees are ₦2,000 for vendors and ₦5,000 for suppliers, non-refundable. Staff approval records the fee as pending and the seller pays it through Paystack on `/onboarding`; listings and signed product-image uploads stay locked until a verified Paystack transaction (webhook or authenticated verification) marks the fee paid. Sellers approved before fees were collected keep listing access only if no fee record exists.
- Meaningful seller, order-status, and verification actions are written to the Firestore `activities` collection with the actor, target user, action, summary, and timestamp. Activity history is available to the signed-in actor or target user through `GET /api/activity`; activity reads are limited to 20 recent records.
- Deploy the activity collection indexes along with the existing Firestore indexes before using activity history in production.
- Buyers must save a valid phone number and delivery address before ordering. Checkout creates one order per seller and reserves inventory; the seller sees the order and confirms the seller-handled delivery fee. The buyer is notified in-app and can pay the confirmed product-plus-delivery total through Paystack; gateway fees are not added as an extra buyer line item by SureFood.
- Paystack is initialized server-side in NGN only. The secret key never reaches the browser. Only a signed Paystack webhook or an authenticated buyer verification request, followed by a server-to-server Paystack transaction verification, can mark an order paid. Paid orders can then be advanced by the seller to preparation and delivery.
- Buyer payments are received by the SureFood Paystack merchant account. Seller payouts are manual. Approved sellers must submit a Nigerian bank account verified through Paystack before confirming delivery fees; the resolved account holder name must match the approved business name. The full account number is not returned to the browser.
- Orders can be cancelled and reserved inventory restored before payment. Paid-order refunds are not automated; sellers cannot cancel a paid order through the status API until a refund process exists.
- Staff review endpoints require a Firebase custom role of `staff` or `admin`. Never allow a public sign-up form to grant those roles.
- Every page is shown in the visitor's browser language, detected automatically and switchable by the visitor; text is machine translated in the browser through `POST /api/translate` and the choice is remembered in local storage. Prices stay NGN in the database and in Paystack, and are shown to other-currency visitors as clearly labelled converted estimates at live rates. Product names are translated for reading only; listings, orders, and receipts keep the seller's original text.

## API surface

- `POST /api/auth/request-code` and `POST /api/auth/verify-code`: Brevo email OTP and Firebase custom-token sign-in.
- `GET, POST, PATCH /api/profile`: read a profile, create one after verified Google sign-in, or update the signed-in buyer's phone and delivery address.
- `GET, POST /api/onboarding`: read KYC status and documents or submit a seller application for automatic business-registry verification when available, otherwise manual review.
- `POST /api/onboarding/documents`: upload a PDF, JPG, or PNG verification document (up to 15 MB) to Cloudinary as a private raw asset.
- `GET /api/admin/accounts/verification`: staff-only queue with short-lived document links.
- `PATCH /api/admin/accounts/{uid}/verification`: staff approval/rejection. Rejection requires an applicant-facing note.
- `POST /api/webhooks/smile-id`: verify Smile ID's signed business-registry callback and update the application result.
- `GET /api/products`: browse the active catalog; `GET /api/products?mine=true` lists a seller's products.
- `GET /api/marketplace/sellers?role={vendor|supplier|producer|manufacturer}`: browse approved seller profiles without exposing contact or verification documents.
- `POST /api/products` and `PATCH /api/products/{productId}`: create listings and update stock/details as an approved seller.
- `GET /api/orders`: read the signed-in user's orders; `GET /api/orders?mine=purchases` lists the orders a seller placed with suppliers. `POST /api/orders`: create seller-specific orders after validating the buyer address, seller approval, current product prices, and stock. Buyer accounts can order from any approved seller; vendor accounts use the same endpoint to buy wholesale stock from approved suppliers.
- `PATCH /api/orders/{orderId}`: set seller-handled delivery fee before payment or advance a paid order through fulfilment.
- `POST /api/payments/initialize` and `POST /api/payments/verify`: start Paystack checkout or verify its result for the signed-in buyer or purchasing vendor.
- `POST /api/payments/approval-fee` and `POST /api/payments/approval-fee/verify`: start and confirm the vendor/supplier approval-fee payment that unlocks listings.
- `POST /api/webhooks/paystack`: verify the Paystack signature and transaction before recording payment.
- `GET /api/payments/banks` and `GET, POST /api/profile/payout-account`: load banks and resolve/store an approved seller's business-matched payout account.
- `POST /api/media/signature`: create a short-lived signed Cloudinary upload authorization for an approved seller.
- `PATCH /api/admin/accounts/{uid}/verification`: staff review of business registration, CAC number, address, and NIN verification.
- `GET /api/activity`: recent activity for the signed-in actor and events addressed to their account.
- `GET /api/rates`: NGN reference exchange rates cached for six hours, used to show buyer-currency estimates.
- `POST /api/translate`: server-side machine translation of visible page text; cached per language and rate limited per client.

## Production security checklist

- Rotate any provider secrets that were pasted into chat before adding replacements to the deployment secret manager.
- Use production Firebase, Brevo, and Cloudinary credentials only in environment-specific secret storage. Never commit `.env.local`, service-account JSON, OTP values, or uploaded identity documents.
- Configure Firebase Auth authorized domains, Google OAuth consent, Brevo sender/domain authentication, and Cloudinary access/retention settings before onboarding real businesses.
- Existing KYC files in Firebase Storage are not migrated automatically. Staff should reject legacy pending applications with a re-upload note; applicants can then replace documents with Cloudinary uploads before resubmitting.
- Set staff custom claims only through a trusted, audited Admin SDK process. Do not create public staff signup or expose service-account credentials in the app.
- Use a payment provider and signed payment webhook before treating `Confirm` as proof of payment or enabling customer-facing paid checkout.
