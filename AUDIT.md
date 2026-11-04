# Project audit and follow-up

Scope: source review of all backend route groups, data models, middleware and frontend pages, plus targeted unit/component and database-backed integration tests. This is not a claim that every workflow is production-ready or independently penetration-tested.

## Fixed

- Google authorization-code OAuth with state, PKCE, ID-token signature/audience/nonce verification, and verified email. No silent account linking or OAuth-created admins.
- Replaced seven-day browser-persisted JWTs with short-lived memory-only access tokens, hashed rotating refresh sessions, HttpOnly cookies, and session revocation on logout/password changes.
- Restricted credentialed CORS and unsafe cross-origin requests; added response security headers, bounded JSON payloads and normalized API errors.
- Profile email changes require verification; arbitrary profile phone edits and unverified registration phones cannot become login identities. Passwordless accounts no longer crash password comparison.
- OTP consumption is conditional/atomic to prevent successful-code replay; phone identities and OTP records have unique indexes.
- Removed demo-city restrictions from location selection, addresses and enquiries. Added India-wide city/state/PIN input and reverse location lookup.
- Per-listing lender coverage is applied to search, packages and checkout. Checkout verifies location server-side using the delivery PIN; legacy products retain local coverage.
- Prevented mass assignment of vendor ownership, ratings and available stock; validated prices, stock, tenures and coverage. Inventory writes use optimistic concurrency; rented inventory cannot be deleted or reduced below current rentals.
- Transactional stock reservation, order/payment creation, credit use, cancellation/restocking, rent records and delivery status updates. Failed checkout rolls back inventory.
- Checkout supports `Idempotency-Key`; the browser sends a stable key for retries within the checkout page. Reusing a key for different order contents is rejected.
- Concurrent referrals cannot award duplicate credits; concurrent cancellation cannot restock twice.
- New orders/packages stay within one lender. Lenders cannot change the status of legacy orders containing other lenders' items; those require an admin.
- Added validation for malformed IDs, fractional quantities/extension periods, invalid delivery/pickup dates and negative damage charges.
- Backend failures are visible in the main catalog, home, packages and management pages instead of unhandled rejected promises or blank dashboards.
- Production does not print undeliverable OTPs or pretend demo online payments were collected.
- Updated vulnerable dependencies and added automated tests. Persistent local replica-set launcher makes development possible without a preinstalled MongoDB service.

## Required before deployment

1. **Secrets/repository hygiene:** `server/.env` and dependency directories were already tracked in Git. `.gitignore` does not untrack existing files. Rotate any exposed secrets, remove `.env` and `node_modules` from tracking after reviewing local changes, and assess whether repository history needs secret cleanup. They were not deleted or untracked automatically.
2. **Credentials:** supply real Google OAuth, SMS and SMTP credentials; configure production OAuth redirect/consent settings. Live Google login cannot be verified without those credentials. Existing demo passwords must not be deployed.
3. **Real payments:** integrate a payment provider with verified webhooks, idempotent monthly billing and actual refunds/deposit settlements. Current payment/refund records are demo bookkeeping, not money movement. Online payments are blocked in production until implemented.
4. **KYC:** current KYC masks document text and supports manual approval; it is not a document-verification service. Lender verification, fraud controls and approval policies also need business decisions.
5. **Location accuracy/reliability:** city matching is postal-district based, and radius checks use postal centroids. Exact street-address boundaries require an address/geocoding provider. Public India Post/Nominatim services have availability, usage and rate limits; use an appropriately licensed production provider and caching/quotas at scale.
6. **Infrastructure:** use an authenticated MongoDB replica set/Atlas, HTTPS, backups, monitoring, and correct same-site proxy/CORS settings. Review existing duplicate phone identities before deploying unique indexes; startup must not silently discard conflicting user records.
7. **Scale:** the in-memory rate limiter is single-process only; use shared storage for multiple API instances. Catalog coverage filtering currently runs in application memory and needs indexed/geospatial queries and pagination for large catalogs.
8. **Remaining workflow work:** explicit Google account linking, OTP-verified phone changes, multi-lender checkout/shipping/settlements and legacy multi-lender maintenance need separate flows. Double-click/retry idempotency for real recurring payments belongs in the payment integration.
9. **UI/QA:** component and API tests cover the changed critical paths, not every page/action in a real browser. Complete accessibility, mobile, browser, delivery/return and failure-recovery end-to-end testing before release. Legal text, sample testimonials/store details and shipping promises require review.

No existing database was seeded or reset during this work. Test databases are isolated and temporary.
