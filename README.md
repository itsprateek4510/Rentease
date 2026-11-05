# RentEase

**A MERN rental platform for furniture, appliances, electronics, baby gear and fitness equipment.**

Pick a city, browse the catalog, choose a tenure (longer = cheaper per month), check out, and track deliveries. Extend, return or cancel anytime.

![Node](https://img.shields.io/badge/node-%3E%3D22.12-339933?logo=node.js&logoColor=white)
![React](https://img.shields.io/badge/react-18-61DAFB?logo=react&logoColor=black)
![Express](https://img.shields.io/badge/express-4-000000?logo=express)
![MongoDB](https://img.shields.io/badge/mongodb-replica%20set-47A248?logo=mongodb&logoColor=white)

---

## Table of contents

- [Tech stack](#tech-stack)
- [Quick start](#quick-start)
- [Environment variables](#environment-variables)
- [Demo accounts](#demo-accounts)
- [Features](#features)
- [Google OAuth + JWT sessions](#google-oauth--jwt-sessions)
- [Locations and delivery coverage](#locations-and-delivery-coverage)
- [Available scripts](#available-scripts)
- [Project structure](#project-structure)
- [Seed data and pricing](#seed-data-and-pricing)
- [Testing](#testing)
- [Before deploying](#before-deploying)

---

## Tech stack

| Layer | Technology |
| --- | --- |
| Frontend | React 18, Vite 8, React Router 7, Axios |
| Backend | Node.js 22.12+, Express 4, Mongoose 8 |
| Auth | Google OAuth 2.0, JWT access tokens, rotating refresh sessions |
| Database | MongoDB **replica set** (required for transactions) |
| Email / SMS | Nodemailer (SMTP), Twilio (optional) |
| Testing | Vitest (client), `node:test` + Supertest + `mongodb-memory-server` (server) |

---

## Quick start

### Prerequisites

- **Node.js 22.12+** (Node 24 LTS recommended)
- npm
- No local MongoDB install needed for development (see step 2)

### 1. Configure the server

```bash
cd server
npm install
```

Copy `server/.env.example` to `server/.env` if you don't already have one, then set a strong `JWT_SECRET`. **Do not overwrite an existing configuration.**

```bash
# macOS / Linux
cp .env.example .env

# Windows (PowerShell)
Copy-Item .env.example .env
```

### 2. Start the backend

```bash
npm run dev:local
```

This command:

- Downloads MongoDB on first use
- Starts a local single-node replica set on **port 27017**
- Starts the API on **port 5000**
- Persists data in `server/.local-data/mongo` — it **never seeds or resets** your data

Keep this terminal running.

### 3. Start the frontend

In a second terminal:

```bash
cd client
npm install
npm run dev
```

Open **http://localhost:5175**.

### Using Atlas or your own MongoDB

Set `MONGO_URI` in `server/.env` and run `npm run dev` in `server` instead of `dev:local`.

> **Note:** Checkout, cancellation, payments and referral credits use MongoDB transactions, so a standalone MongoDB instance is **not** sufficient. Use a replica set.

### Optional: load demo data

```bash
cd server
npm run seed
```

> ⚠️ **This resets the configured database.** Only run it against a disposable development database after confirming `MONGO_URI`. The demo accounts below exist only after seeding.

---

## Environment variables

All variables live in `server/.env`. Example values come from `server/.env.example`.

| Variable | Default | Required | Purpose |
| --- | --- | --- | --- |
| `PORT` | `5000` | No | API port |
| `MONGO_URI` | `mongodb://127.0.0.1:27017/rentease?replicaSet=rentease-local` | Yes | MongoDB connection string (must be a replica set) |
| `JWT_SECRET` | `change_this_secret` | **Yes** | Signs access tokens. Use a long random value in any real environment |
| `CLIENT_URL` | `http://localhost:5175` | Yes | Allowed browser origin(s). Comma-separated allowlist supported; the first origin is used for redirects |
| `NODE_ENV` | `development` | No | Set `production` for deployed environments |
| `GOOGLE_CLIENT_ID` | — | For Google login | OAuth web client ID |
| `GOOGLE_CLIENT_SECRET` | — | For Google login | OAuth web client secret |
| `GOOGLE_REDIRECT_URI` | `http://localhost:5000/api/auth/google/callback` | For Google login | Must exactly match the URI in Google Cloud Console |
| `SMTP_HOST` | — | No | SMTP host for real email (OTP codes, reset links) |
| `SMTP_PORT` | `587` | No | SMTP port |
| `SMTP_USER` | — | No | SMTP username |
| `SMTP_PASS` | — | No | SMTP password |
| `MAIL_FROM` | `RentEase <no-reply@rentease.in>` | No | Sender address |
| `TWILIO_SID` | — | No | Twilio account SID for real SMS OTP |
| `TWILIO_TOKEN` | — | No | Twilio auth token |
| `TWILIO_FROM` | — | No | Twilio sender number |

Without SMTP/Twilio credentials (or outside production), OTP codes print to the server console and appear on screen in development.

The client also accepts `VITE_API_URL` (defaults to `/api` via the Vite proxy).

---

## Demo accounts

Available **after running `npm run seed`**. Never deploy demo passwords.

| Role | Login |
| --- | --- |
| Customer | Phone OTP — demo number `9876510000`. New numbers sign up automatically |
| Admin | `admin@rentease.com` / `admin123` |
| Vendor | `vendor@rentease.com` / `vendor123` |
| User | `user@rentease.com` / `user123` |

Customers use phone OTP (Login/Signup button). Email + password login is available via the link inside the login box.

---

## Features

### Customer

- City picker, search, category pills and sub-category tiles
- Filters with counts (stock, budget, capacity, brand) and badges
- Wishlist and product pages with tenure pricing
- Cart, coupons, rent credit, packages and RentEase Plus plans (bundle discounts)
- Checkout with saved addresses and a demo payment gateway
- Order tracking, monthly rent payments and invoices
- Extend, return or cancel with refund; maintenance and disputes
- Reviews, KYC, refer & earn, relocation requests
- Store locator, business enquiries, help widget and contact form

### Vendor

- Inventory management (brand, capacity, price, tenure, stock)
- Delivery and return flow
- Damage charges
- Maintenance queue

### Admin

- KPI reports
- Orders and maintenance
- Disputes
- Users and KYC approval
- Coupons and cities
- Service requests and messages

---

## Google OAuth + JWT sessions

### Set up Google login

1. Create a **Web application** OAuth client in Google Cloud Console. Configure the consent screen and add test users if the app is in testing mode.
2. Add these values to `server/.env` (**never** in client-side configuration):

   ```dotenv
   GOOGLE_CLIENT_ID=your-google-client-id
   GOOGLE_CLIENT_SECRET=your-google-client-secret
   GOOGLE_REDIRECT_URI=http://localhost:5000/api/auth/google/callback
   CLIENT_URL=http://localhost:5175
   ```

3. Add the exact `GOOGLE_REDIRECT_URI` to Google's authorized redirect URIs and restart the API.

Login then offers **Continue with Google**, with renter/lender selection for new accounts. Existing roles are preserved; admin accounts cannot be created through OAuth.

### How sessions work

- Google authorization uses `state`, PKCE and a verified ID-token nonce.
- Existing email accounts are deliberately **not automatically linked** to Google — use their existing login method.
- Missing OAuth credentials leave OTP/email login available.
- All login methods issue a **15-minute JWT held only in browser memory**.
- An opaque, hashed, server-side refresh session rotates through a **30-day HttpOnly cookie**.
- Logout and password changes revoke server sessions.
- Production cookies require HTTPS. Serve the frontend and API on the same site (prefer `/api` through a reverse proxy).
- `CLIENT_URL` must match the actual browser origin.

---

## Locations and delivery coverage

- Customers can enter any Indian city/town and state/UT, look up a six-digit PIN, or fetch their location. Popular cities are shortcuts, not a nationwide service whitelist.
- In **Vendor desk → Inventory**, set delivery coverage per listing: origin city, selected cities, states/UTs, PIN codes, a radius in kilometres, or all India. Existing listings remain local by default.
- Location filters apply to products and packages. At checkout the server resolves the delivery PIN independently and enforces lender coverage instead of trusting submitted city/coordinates.
- City coverage uses the postal district and normalized city names; use PIN restrictions for precise boundaries. Radius coverage uses the PIN-code centre, not a verified street address.
- PIN and reverse lookups depend on India Post's public API and OpenStreetMap Nominatim. Failures don't block manual browsing, but checkout fails closed if delivery can't be verified.
- Check out one lender at a time. Packages are also resolved within one lender. Changing location no longer silently discards cart items.

---

## Available scripts

### Server (`server/`)

| Script | Description |
| --- | --- |
| `npm start` | Start the API (requires `MONGO_URI`) |
| `npm run dev` | Start the API with file watching |
| `npm run dev:local` | Start a persistent local MongoDB replica set + API |
| `npm test` | Run backend integration tests |
| `npm run seed` | Reset and load demo data (**destructive**) |

### Client (`client/`)

| Script | Description |
| --- | --- |
| `npm run dev` | Start the Vite dev server on port 5175 |
| `npm run build` | Build for production |
| `npm run preview` | Preview the production build |
| `npm test` | Run client tests |

---

## Project structure

```text
Rentease-main/
├── client/                  # React + Vite frontend
│   ├── public/products/     # Product images (local, one per catalog item)
│   └── src/
│       ├── components/      # Shared UI components
│       ├── pages/           # Route-level pages
│       ├── api.js           # API client, pricing multipliers, categories
│       └── ...
├── server/                  # Express API
│   ├── middleware/          # Auth and request middleware
│   ├── models/              # Mongoose models/indexes
│   ├── routes/              # Auth, products, orders, admin, extras
│   ├── scripts/             # devLocal.js, image fetchers
│   ├── test/                # Integration tests
│   ├── utils/               # Pricing, coverage, coupon, mailer, SMS, session
│   ├── seed.js              # Demo data loader
│   └── server.js            # API entry point
├── AUDIT.md                 # Security/quality review and deployment checklist
└── README.md
```

---

## Seed data and pricing

### What the seed loads

- 81 products × 10 cities = **810 listings**
- 6 packages, 3 plans, 5 coupons, 20 stores
- 3 vendors, 8 customers
- 15 orders across every status, with payments, maintenance, disputes, reviews, messages and requests

Reviews, testimonials and store details are sample data.

### Product images

Real product photos are stored locally in `client/public/products` (one per catalog item). A missing photo falls back to an illustration. Re-fetch them with:

```bash
cd server
node scripts/fetchProductImages.js
```

### Pricing

`monthlyRent` is the **3-month price**. Longer tenures are cheaper per month.

| Tenure | Multiplier |
| --- | --- |
| 1 month | ×1.25 |
| 3 months | ×1.00 (base) |
| 6 months | ×0.92 |
| 9 months | ×0.86 |
| 12 months | ×0.80 |

Multipliers live in `server/utils/pricing.js` and `client/src/api.js`.

---

## Testing

```bash
# Backend
cd server
npm test

# Frontend
cd client
npm test

# Production build check
npm run build
```

Backend integration tests start an isolated temporary MongoDB replica set — they do **not** use or reset your configured database.

For a full security and quality review, see [AUDIT.md](AUDIT.md).

---

## Before deploying

This project is a working demo, **not production-ready as-is**. Key items from [AUDIT.md](AUDIT.md):

- 🔐 **Secrets:** rotate any exposed secrets and remove `server/.env` and `node_modules` from Git tracking (they are already committed). Review whether repository history needs secret cleanup.
- 🔑 **Credentials:** supply real Google OAuth, SMTP and Twilio credentials; configure production redirect/consent settings. Never deploy demo passwords.
- 💳 **Payments:** the gateway is a development demo. Online checkout/rent payments are disabled in production; only pay-on-delivery remains until a real provider with verified webhooks, idempotent billing and settlements is integrated.
- 🪪 **KYC:** current KYC masks document text and supports manual approval — it is not a document-verification service.
- 📍 **Location accuracy:** matching uses postal districts and PIN centroids. Public India Post/Nominatim APIs have usage limits; use a licensed provider with caching/quotas at scale.
- 🏗️ **Infrastructure:** use an authenticated MongoDB replica set/Atlas, HTTPS, backups, monitoring and correct same-site proxy/CORS settings.
- 📈 **Scale:** the in-memory rate limiter is single-process only. Catalog coverage filtering runs in application memory and needs indexed/geospatial queries and pagination for large catalogs.
- 🧪 **QA:** complete accessibility, mobile, browser, delivery/return and failure-recovery end-to-end testing. Terms, privacy and sample testimonials need review.

Finally, change `JWT_SECRET` before deploying.
