# RentEase – rent furniture, appliances, electronics, baby and fitness gear (MERN)

A RentoMojo-style rental platform. Pick a city, browse, choose a tenure (longer = cheaper per month), pay, track deliveries, extend or return.

## Run locally
Needs Node 18+ and MongoDB (local, or an Atlas URI in `server/.env`).
```bash
cd server && npm install && npm run seed && npm run dev     # API on :5000
cd client && npm install && npm run dev                      # site on :5173
```
`npm run seed` resets the database.

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
- The payment gateway is a demo. Connect Razorpay or similar before real use.
- Terms and privacy pages are sample text. Have a lawyer review them before launch.
- Change `JWT_SECRET` before deploying.
