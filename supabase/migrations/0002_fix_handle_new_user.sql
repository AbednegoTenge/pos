-- Fixes "Database error creating new user": the trigger function must fully
-- qualify public.profiles and pin its own search_path, otherwise it can run
-- under whatever search_path the auth service's session has (which doesn't
-- necessarily include `public`), causing the insert inside the trigger to
-- fail with "relation profiles does not exist" (surfaced by GoTrue as a
-- generic "Database error creating new user").
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', new.email), 'cashier');
  return new;
end;
$$;
