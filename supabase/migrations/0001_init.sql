-- POS schema for a Ghanaian local business
-- Currency: Ghana Cedis (GHS). Tax model: VAT + NHIL + GETFund + COVID-19 Levy,
-- all computed on the pre-VAT value per GRA's cascading levy rules.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Staff (extends Supabase auth.users)
-- ---------------------------------------------------------------------------
create type staff_role as enum ('admin', 'manager', 'cashier');

create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  role staff_role not null default 'cashier',
  pin_hash text, -- optional quick-switch PIN for shared terminals
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Catalog
-- ---------------------------------------------------------------------------
create table categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references categories (id) on delete set null,
  name text not null,
  sku text unique,
  barcode text unique,
  unit text not null default 'pc', -- e.g. pc, kg, bag, crate
  price_ghs numeric(12, 2) not null check (price_ghs >= 0),
  cost_ghs numeric(12, 2) check (cost_ghs >= 0),
  vat_exempt boolean not null default false, -- some staple foods/goods are VAT-exempt
  stock_qty numeric(12, 2) not null default 0,
  low_stock_threshold numeric(12, 2) not null default 5,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index products_category_idx on products (category_id);
create index products_name_idx on products using gin (to_tsvector('english', name));

-- ---------------------------------------------------------------------------
-- Customers (optional loyalty / credit tab)
-- ---------------------------------------------------------------------------
create table customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text unique,
  credit_balance_ghs numeric(12, 2) not null default 0,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Sales
-- ---------------------------------------------------------------------------
create type payment_method as enum ('cash', 'momo_mtn', 'momo_vodafone', 'momo_airteltigo', 'card', 'credit');
create type sale_status as enum ('completed', 'refunded', 'voided');

create table sales (
  id uuid primary key default gen_random_uuid(),
  receipt_no text not null unique,
  cashier_id uuid references profiles (id),
  customer_id uuid references customers (id),
  subtotal_ghs numeric(12, 2) not null,
  discount_ghs numeric(12, 2) not null default 0,
  vat_ghs numeric(12, 2) not null default 0,
  nhil_ghs numeric(12, 2) not null default 0,
  getfund_ghs numeric(12, 2) not null default 0,
  covid_levy_ghs numeric(12, 2) not null default 0,
  total_ghs numeric(12, 2) not null,
  payment_method payment_method not null,
  payment_reference text, -- MoMo transaction id, card auth code, etc.
  status sale_status not null default 'completed',
  synced boolean not null default true, -- false while queued offline
  created_at timestamptz not null default now()
);

create index sales_created_at_idx on sales (created_at desc);
create index sales_cashier_idx on sales (cashier_id);

create table sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references sales (id) on delete cascade,
  product_id uuid references products (id),
  product_name text not null, -- snapshot in case product is later edited/deleted
  unit_price_ghs numeric(12, 2) not null,
  quantity numeric(12, 2) not null check (quantity > 0),
  line_total_ghs numeric(12, 2) not null
);

create index sale_items_sale_idx on sale_items (sale_id);

-- ---------------------------------------------------------------------------
-- Business settings (single row)
-- ---------------------------------------------------------------------------
create table business_settings (
  id boolean primary key default true check (id), -- enforce a single row
  business_name text not null default 'My Business',
  address text,
  phone text,
  tin text, -- Ghana Tax Identification Number
  vat_rate numeric(5, 4) not null default 0.15,      -- 15%
  nhil_rate numeric(5, 4) not null default 0.025,    -- 2.5%
  getfund_rate numeric(5, 4) not null default 0.025, -- 2.5%
  covid_levy_rate numeric(5, 4) not null default 0.01, -- 1%
  tax_enabled boolean not null default true,
  receipt_footer text default 'Thank you for your patronage!'
);

insert into business_settings (id) values (true);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table profiles enable row level security;
alter table categories enable row level security;
alter table products enable row level security;
alter table customers enable row level security;
alter table sales enable row level security;
alter table sale_items enable row level security;
alter table business_settings enable row level security;

-- Any authenticated staff member can read catalog/customers/settings and
-- record sales; only admins/managers can manage the catalog and settings.
create policy "staff read profiles" on profiles for select using (auth.uid() is not null);
create policy "staff update own profile" on profiles for update using (auth.uid() = id);

create policy "staff read categories" on categories for select using (auth.uid() is not null);
create policy "managers write categories" on categories for all using (
  exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('admin', 'manager'))
);

create policy "staff read products" on products for select using (auth.uid() is not null);
create policy "managers write products" on products for all using (
  exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('admin', 'manager'))
);

create policy "staff read customers" on customers for select using (auth.uid() is not null);
create policy "staff write customers" on customers for all using (auth.uid() is not null);

create policy "staff read sales" on sales for select using (auth.uid() is not null);
create policy "staff create sales" on sales for insert with check (auth.uid() is not null);
create policy "managers update sales" on sales for update using (
  exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('admin', 'manager'))
);

create policy "staff read sale_items" on sale_items for select using (auth.uid() is not null);
create policy "staff create sale_items" on sale_items for insert with check (auth.uid() is not null);

create policy "staff read settings" on business_settings for select using (auth.uid() is not null);
create policy "admins write settings" on business_settings for update using (
  exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
);

-- ---------------------------------------------------------------------------
-- Stock deduction on sale
-- ---------------------------------------------------------------------------
create or replace function deduct_stock_on_sale_item()
returns trigger as $$
begin
  if new.product_id is not null then
    update products
    set stock_qty = stock_qty - new.quantity,
        updated_at = now()
    where id = new.product_id;
  end if;
  return new;
end;
$$ language plpgsql security definer;

create trigger sale_items_deduct_stock
  after insert on sale_items
  for each row execute function deduct_stock_on_sale_item();

-- Auto-create a profile row when a new auth user signs up.
-- search_path is pinned and public.profiles is fully qualified because this
-- trigger runs under the auth service's session, whose search_path doesn't
-- necessarily include `public`.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email), 'cashier');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
