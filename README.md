# Atmosfera Cafe pickup ordering

A web app where Atmosfera customers order ahead and pay on their phone, then pick up in store.
Square is the back office: the menu comes from the Square item library, payments go through
Square, and paid orders land on the Square register as pickup orders.

## How it works

- **Menu**: read from Square's Catalog API (items, sizes, modifiers, photos, sold-out flags),
  refreshed at most once a minute.
- **Hours**: read from the Square location's business hours. Ordering pauses outside them.
- **Checkout**: Square's Web Payments SDK (card, Apple Pay, Google Pay) turns the card into a
  token. The server creates a Square order with a PICKUP fulfillment, checks the total matches
  what the customer saw, then charges it. A failed payment leaves nothing on the register.
- **Preview mode**: with no Square credentials the app shows a sample menu and takes no payment.

## Run it locally

```bash
npm install
cp .env.example .env.local   # fill in Square sandbox credentials, or leave empty for preview mode
npm run dev                  # http://localhost:3000
npm test                     # unit tests
```

## Deploy (Railway)

1. New project from this GitHub repo. Railway detects Next.js and runs `npm run build` and `npm start`.
2. Add the variables from `.env.example`.
3. Apple Pay needs the domain verified in the Square Developer Dashboard.

## Settings

- Prep time for "as soon as possible" orders: `src/lib/constants.ts` (10 minutes).
- Tip choices: `src/lib/money.ts` (15, 18, 20 percent and custom).
- Brand colors and fonts: `src/app/globals.css` and `src/app/layout.tsx`.

## Code map

| Path | What it does |
| --- | --- |
| `src/lib/square.ts` | All Square calls: menu, shop info, quote, place order, look up order |
| `src/lib/catalog.ts` | Turns Square catalog objects into the menu |
| `src/lib/hours.ts` | Open or closed, pickup slots, time zones |
| `src/lib/checkout.ts` | Checkout validation and the Square order request |
| `src/components/` | Menu, item options, bag, checkout form, Square payment form |
| `src/app/api/` | `quote` (price with tax) and `checkout` (create and pay) |
