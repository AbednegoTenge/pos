---
name: seed-demo-data
description: Seed the Supabase database with realistic demo categories and products (a Ghanaian provision shop catalog) so the POS can be tested end-to-end without manually entering inventory.
---

# Seed demo data

Use this when the user wants to try out the POS (checkout, inventory, reports)
against a freshly created Supabase project that has no products yet, or asks
to "seed demo data" / "add sample products" / "populate the catalog."

## Steps

1. Confirm `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are available as env
   vars in the shell (the **service role** key, not the anon key — RLS blocks
   catalog writes from unauthenticated/anon requests, and this script does not
   sign in as a staff user). Get the service role key from the Supabase
   project's API settings; never commit it or put it in `.env.local` (that
   file only holds the anon key for the client app).
2. Run `npm run seed` from the project root.
3. It upserts 4 categories (Beverages, Provisions, Toiletries, Snacks) and ~14
   sample products with realistic GHS prices, stock levels, and VAT-exempt
   flags (staples like rice, sugar, milk are marked exempt per Ghanaian VAT
   rules — see `CLAUDE.md`'s tax section for why).
4. Re-running is safe for categories (upserted by name) but will duplicate
   products, since products aren't upserted by name — check `products` first
   if re-seeding, or truncate the table before re-running.

To add different/more sample data, edit the `PRODUCTS` array in
`scripts/seed.mjs` directly rather than writing a new script.
