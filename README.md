# POS — Point of Sale for a Ghanaian Local Business

A point-of-sale web app for small/medium retail businesses in Ghana (provision
shops, chop bars, pharmacies, boutiques): checkout with cart & Mobile Money
support, inventory management, sales dashboard, and Ghana-specific tax
handling (VAT, NHIL, GETFund, COVID-19 Levy).

See [`CLAUDE.md`](./CLAUDE.md) for architecture, setup, and domain notes.

## Quick start

```bash
npm install
cp .env.example .env.local   # then fill in your Supabase project URL + anon key
npm run dev
```

You'll also need to run `supabase/migrations/0001_init.sql` against a Supabase
project before the app has any data to show — see `CLAUDE.md` for the full
setup walkthrough, and `npm run seed` to populate demo products.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Type-check and build for production |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Run oxlint |
| `npm run seed` | Seed demo categories/products (needs Supabase service role key) |
