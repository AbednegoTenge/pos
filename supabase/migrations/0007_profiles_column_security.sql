-- The "staff update own profile" RLS policy (0001_init.sql) only checks that
-- a user is updating their own row — it doesn't restrict which columns. That
-- let any authenticated cashier call the Supabase client directly and set
-- their own `role` to 'admin', bypassing every admin/manager-only gate in
-- the app (catalog writes, settings, refunds, void_sale). Column-level
-- privileges close that without touching the row-level policy: staff can
-- still edit their own name (and future PIN), but role/is_active changes
-- stay a Supabase-dashboard action, matching the setup flow in the README.
revoke update on profiles from authenticated, anon;
grant update (full_name, pin_hash) on profiles to authenticated;
