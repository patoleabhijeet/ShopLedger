# ShopLedger

## Stack
- Node.js application using Express 4 and body-parser.
- Browser UI is static HTML, CSS, and JavaScript served from `public/`.
- Application records are stored in `data/db.json` through synchronous filesystem operations.

## Module map
- `routes/customers.js` — lists customers and settlements; records customer settlements.
- `routes/orders.js` — lists, fetches, creates, and cancels orders.
- `routes/products.js` — lists products and active coupons.
- `routes/reports.js` — pricing preview, dashboard/reconciliation reports, and admin export.
- `lib/coupons.js` — normalizes, validates, calculates, and lists coupons.
- `lib/dates.js` — current date, normalized date keys, and fiscal year helper.
- `lib/inventory.js` — product lookup, stock checks/reservation/release, inventory summary.
- `lib/invoice.js` — computes invoice figures and renders printable invoice HTML.
- `lib/ledger.js` — customer balances, Khata charges/reversals, and settlements.
- `lib/orders.js` — adds, fetches, lists, and cancels orders.
- `lib/pricing.js` — subtotal, discount, and checkout total calculations.
- `lib/reports.js` — dashboard summary and GST invoice reconciliation.
- `lib/store.js` — reads/writes JSON store and appends audit records.
- `lib/tax.js` — resolves item GST rates and splits tax into CGST/SGST.

## Commands
- Start the app: `node server.js` (also `npm start`).
- Run tests: `node --test`. The package's current `npm test` script is a placeholder that exits with an error.

## Rules
1. Write characterization tests before changing behaviour.
2. Change only the module(s) the ticket is about.
3. Tests never read or write `data/db.json`; they use in-memory data.
4. Add no dependencies.
5. Make the smallest fix that works.

## Current ticket
- Invoice total and GST breakdown do not match what the customer was billed.
- Allowed files: `lib/invoice.js` (`lib/tax.js` only if truly needed).
