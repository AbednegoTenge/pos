-- Supabase grants EXECUTE on new public-schema functions to anon/authenticated
-- by default (separately from the PUBLIC pseudo-role revoked in 0006), so
-- void_sale was still reachable by unauthenticated requests. Its internal
-- role check already rejects those calls safely, but it shouldn't be
-- reachable at all — tighten the grant to match intent.
revoke execute on function void_sale(uuid, text) from anon;
