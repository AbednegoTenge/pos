# POS — Point of Sale for a Ghanaian Local Business

A web-based POS built for small/medium retail businesses in Ghana (provision
shops, chop bars, pharmacies, boutiques). Single-page React app backed by
Supabase (Postgres + Auth). No custom backend server — Supabase is the API.

## Stack

- **Frontend**: React 19 + Vite + TypeScript + React Router
- **UI**: Tailwind CSS v4 + shadcn/ui (`components.json`, preset "Nova")
- **Backend**: Supabase (Postgres, Auth, Row Level Security) — no separate server
- **Charts**: Recharts
- **Path alias**: `@/*` → `src/*`

## Setup

1. `npm install`
2. Create a Supabase project at supabase.com.
3. Run `supabase/migrations/0001_init.sql` against it (via the SQL editor, or
   `supabase db push` if using the Supabase CLI linked to the project).
4. Copy `.env.example` to `.env.local` and fill in `VITE_SUPABASE_URL` /
   `VITE_SUPABASE_ANON_KEY` from the project's API settings.
5. Create at least one staff user in Supabase Auth, then update their row in
   `profiles` to `role = 'admin'` (new signups default to `cashier` via the
   `handle_new_user` trigger).
6. `npm run dev`

## Commands

- `npm run dev` — start Vite dev server
- `npm run build` — `tsc -b` then production build
- `npm run lint` — oxlint

## Domain rules specific to Ghana

- **Currency**: GHS everywhere, formatted with `formatGHS()` in `src/lib/currency.ts`.
- **Tax cascade** (`src/lib/tax.ts`): GRA charges NHIL, GETFund, and the
  COVID-19 Levy on the VAT-exclusive taxable base, and VAT is then charged on
  top of *(base + those three levies)* — not on the base alone. Rates live in
  `business_settings` and are editable from the Settings page. Products can be
  marked `vat_exempt` (staples etc.) to skip all four charges; a flat discount
  is spread proportionally across taxable vs. exempt lines.
- **Payment methods**: cash, MTN MoMo, Vodafone Cash, AirtelTigo Money, card.
  Mobile money and card are currently manual-reference entry (cashier types in
  the transaction ID after completing payment on the customer's phone/terminal)
  — this is the active checkout flow (`src/components/pos/PaymentDialog.tsx`).
- **Paystack integration (built, not wired in)**: a full live-payment path
  exists but is currently dormant — `src/lib/paystack.ts` (lazy-loads
  Paystack's Inline popup) and the deployed `verify-paystack-payment` Edge
  Function (re-verifies status/amount/currency server-side with the secret
  key before trusting a payment, since the client-side popup callback alone is
  spoofable) are ready to use. To switch checkout over to it, swap the manual
  reference `Input` for the momo/card methods in `PaymentDialog.tsx` for a call
  to `payWithPaystack()` followed by
  `supabase.functions.invoke('verify-paystack-payment', { body: { reference, expectedAmountGhs } })`,
  and only call `onConfirm(method, reference)` once that returns `verified: true`.
  See "Paystack setup" below for the key/secret configuration either way.
- **Offline sales** (`src/lib/offlineQueue.ts`): if a Supabase write fails
  during checkout, the sale is queued in `localStorage` instead of being lost.
  `OfflineBanner` (in the app shell) retries the queue whenever the browser's
  `online` event fires. This is a pragmatic MVP mechanism, not a full
  local-first sync engine — it only covers the sale-completion write path.
- **Refunds** (`supabase/migrations/0003_refunds.sql`, `src/hooks/useRefunds.ts`,
  `src/components/pos/RefundDialog.tsx`): admin/manager only (RLS-enforced, not
  just UI-hidden). Supports partial returns — pick specific items/quantities
  off a sale, not just an all-or-nothing reversal. A trigger restocks
  `products.stock_qty` on refund, and another flips the parent `sales.status`
  to `refunded` once every unit on it has been returned (partial refunds leave
  the sale `completed`, with history visible on the Transactions detail view).
  Refund amounts are the sum of the returned lines' original prices — VAT/NHIL/
  GETFund/COVID levy are not individually reversed per line; that's a
  deliberate v1 simplification, not an oversight.

## Data model (`supabase/migrations/`)

`profiles` (extends `auth.users`, role admin/manager/cashier) →
`categories` → `products` → `sales` → `sale_items`, plus a single-row
`business_settings` table, and `refunds` → `refund_items` (each tied back to
a `sale_items` row). Triggers: deduct stock on `sale_items` insert, restock on
`refund_items` insert, auto-mark a sale `refunded` once fully returned. RLS
restricts catalog/settings/refund writes to admin/manager roles while any
authenticated staff member can read and record sales.

There's no `customers` table — a deliberate call, not a gap. Loyalty/repeat
customers are handled with the flat discount field on checkout instead of a
customer record; `0004_drop_customers.sql` removes the table that `0001_init.sql`
originally created for this, which is why it's created then dropped rather
than never having existed in the migration history.

## Known gaps (scaffold, not yet built)

- No UI to create/edit categories (products can only be assigned to existing
  ones — add a categories CRUD screen if needed).
- No PIN quick-switch for shared terminals (`profiles.pin_hash` column exists
  but is unused).
- Offline queue covers sales only — inventory edits and refunds made while
  offline are not queued (both require an active connection).
- No end-of-day till/cash reconciliation (no "shift" concept yet).

## Paystack setup

1. Create a Paystack account at paystack.com (Ghana-enabled), grab the
   **test** keys first from Settings → API Keys & Webhooks.
2. Put the **public** key in `.env.local` as `VITE_PAYSTACK_PUBLIC_KEY` (safe
   to expose client-side).
3. Set the **secret** key as an Edge Function secret — never in `.env.local`:
   `supabase secrets set PAYSTACK_SECRET_KEY=sk_test_...`
4. Deploy the verification function:
   `supabase functions deploy verify-paystack-payment`
5. Test with Paystack's documented test MoMo numbers/cards before going live,
   then swap in live keys the same way.

## MCP

`supabase` and `shadcn` MCP servers are configured in `.mcp.json` — use the
Supabase MCP tools to run migrations/inspect the live database, and the
shadcn MCP to add further components (`npx shadcn@latest add <component>` also
works directly).
