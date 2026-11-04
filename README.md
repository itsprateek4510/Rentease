# RentEase – rent furniture, appliances, electronics, baby and fitness gear (MERN)

A RentoMojo-style rental platform. Pick a city, browse, choose a tenure (longer = cheaper per month), pay, track deliveries, extend or return.

## Run locally
Needs Node 22.12+ (Node 24 LTS recommended). Copy `server/.env.example` to `server/.env` if you do not already have one, and set `JWT_SECRET` to a random secret. Do not overwrite existing configuration.

Start the backend in one terminal:
```bash
cd server
npm install
CLIENT_URL=http://localhost:5175 npm run dev:local
```
This downloads MongoDB on first use, starts a local replica set on port 27017 and the API on port 5000. Data persists in `server/.local-data/mongo`. It never seeds or resets data. Keep this terminal running.

Start the frontend in another terminal:
```bash
cd client
npm install
npm run dev
```
Open **http://localhost:5175**. With Atlas or your own MongoDB replica set, set `MONGO_URI` and use `npm run dev` in `server` instead. Checkout, cancellation, payments and referral credits use MongoDB transactions; a standalone MongoDB instance is not sufficient.

**Optional demo data:** `npm run seed` in `server` resets the configured database. Only run it on a disposable development database, after checking `MONGO_URI`. The seeded accounts below exist only after seeding.

## Google OAuth + JWT sessions
1. Create a Google Cloud OAuth client of type **Web application**. Configure its consent screen and add test users if the application is in testing mode.
2. Set these values in `server/.env` (never in client-side configuration):
   ```dotenv
   GOOGLE_CLIENT_ID=your-google-client-id
   GOOGLE_CLIENT_SECRET=your-google-client-secret
   GOOGLE_REDIRECT_URI=http://localhost:5000/api/auth/google/callback
   CLIENT_URL=http://localhost:5175
   ```
3. Add the exact `GOOGLE_REDIRECT_URI` above to Google's authorized redirect URIs and restart the API. Login then offers **Continue with Google**, with renter/lender selection for new accounts. Existing roles are preserved; admin accounts cannot be created through OAuth.

Google authorization uses state, PKCE and a verified ID-token nonce. Existing email accounts are deliberately **not automatically linked** to Google; use their existing login method. Missing OAuth credentials leave OTP/email login available.

All login methods issue a 15-minute JWT held only in browser memory. An opaque, hashed server-side refresh session rotates through a 30-day HttpOnly cookie. Logout/password changes revoke server sessions. Production cookies require HTTPS; serve the frontend and API on the same site (prefer `/api` through a reverse proxy). `CLIENT_URL` must match the actual browser origin; a comma-separated allowlist is supported, with the first origin used for redirects.

## Locations and lender delivery coverage
- Customers can enter any Indian city/town and state/UT, look up a six-digit PIN, or fetch their location. Popular cities are shortcuts, not a nationwide service whitelist.
- In **Vendor desk → Inventory**, set delivery coverage per listing: origin city, selected cities, states/UTs, PIN codes, a radius in kilometres, or all India. Existing listings remain local by default.
- Location filters apply to products and packages. At checkout the server resolves the delivery PIN independently and enforces lender coverage, rather than trusting submitted city/coordinates.
- City coverage uses the postal district and normalized city names; use PIN restrictions for precise boundaries. Radius coverage uses the PIN-code centre, not a verified street address. PIN and reverse lookups depend on India Post's public API and OpenStreetMap Nominatim; failures do not block manual browsing, but checkout fails closed if it cannot verify delivery.
- Check out one lender at a time. Packages are also resolved within one lender. Changing location no longer silently discards cart items.

## Verification
Run `npm test` in both `server` and `client`, and `npm run build` in `client`. Backend integration tests start an isolated temporary MongoDB replica set; they do not use or reset your configured database. See [AUDIT.md](AUDIT.md) for fixes and outstanding deployment work.

## Logins
- **Customers use phone OTP** (Login/Signup button). In dev the code shows on screen and in the server terminal. Demo customer phone: `9876510000`. New numbers sign up automatically.
- Email + password (link inside the login box): admin@rentease.com / admin123, vendor@rentease.com / vendor123, user@rentease.com / user123.
- Real SMS: fill `TWILIO_SID`, `TWILIO_TOKEN`, `TWILIO_FROM` in `server/.env` and set `NODE_ENV=production`. Real email: fill `SMTP_*`.

## What's included
**Customer:** city picker, search, category pills and sub-category tiles, filters with counts (stock, budget, capacity, brand), badges, wishlist, product pages with tenure pricing, cart, coupons, rent credit, packages and RentEase Plus plans (bundle discounts), checkout with saved addresses and a demo payment gateway, order tracking, monthly rent payments, invoices, extend / return / cancel with refund, maintenance, disputes, reviews, KYC, refer and earn, relocation requests, store locator, business enquiries, help widget, contact form.
**Vendor:** inventory (brand, capacity, price, tenure, stock), delivery and return flow, damage charges, maintenance queue.
**Admin:** KPI reports, orders, maintenance, disputes, users and KYC approval, coupons, cities, service requests, messages.

## Data
Seed loads 81 products x 10 cities (810 listings), 6 packages, 3 plans, 5 coupons, 20 stores, 3 vendors, 8 customers, 15 orders in every status with payments, maintenance, disputes, reviews, messages and requests. Reviews, testimonials and stores are sample data. Product photos are real, locally stored images in `client/public/products` (one per catalog item); a missing photo falls back to an illustration. Re-fetch them with `cd server && node scripts/fetchProductImages.js`.

## Notes
- Prices: `monthlyRent` is the 3-month price. Multipliers are in `server/utils/pricing.js` and `client/src/api.js` (1 month x1.25, 6 x0.92, 9 x0.86, 12 x0.8).
- The payment gateway is a development demo. Fake online checkout/rent payments are disabled in production; only pay-on-delivery checkout remains available until a real gateway is integrated.
- Terms and privacy pages are sample text. Have a lawyer review them before launch.
- Change `JWT_SECRET` before deploying.
