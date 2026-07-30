-- Sell-by-package support: a product's stock is tracked in its base unit
-- (products.unit / stock_qty), but it can optionally also be sold in larger
-- packagings (e.g. a "Box of 24" on top of a product tracked in individual
-- packs). product_units rows are additional sellable packagings for a
-- product; there is no row for the base unit itself — a null
-- sale_items.product_unit_id means "sold as the base product".
create table product_units (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products (id) on delete cascade,
  label text not null, -- e.g. 'Box of 24'
  conversion_qty numeric(12, 2) not null check (conversion_qty > 0), -- how many base units this packaging contains
  price_ghs numeric(12, 2) not null check (price_ghs >= 0), -- set independently, not auto-derived, so case/bulk discounts are possible
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (product_id, label)
);

create index product_units_product_idx on product_units (product_id);

alter table product_units enable row level security;

create policy "staff read product_units" on product_units for select using (auth.uid() is not null);
create policy "managers write product_units" on product_units for all using (
  exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('admin', 'manager'))
);

-- Record which packaging (if any) was sold on a sale line.
alter table sale_items add column product_unit_id uuid references product_units (id);

-- Stock deduction must account for the packaging multiplier: selling one
-- "Box of 24" deducts 24 base units, not 1.
create or replace function deduct_stock_on_sale_item()
returns trigger as $$
declare
  v_conversion_qty numeric(12, 2) := 1;
begin
  if new.product_id is not null then
    if new.product_unit_id is not null then
      select coalesce(conversion_qty, 1) into v_conversion_qty
      from product_units where id = new.product_unit_id;
    end if;

    update products
    set stock_qty = stock_qty - (new.quantity * v_conversion_qty),
        updated_at = now()
    where id = new.product_id;
  end if;
  return new;
end;
$$ language plpgsql security definer;

-- Refund restocking must apply the same multiplier as the original sale line.
create or replace function restock_on_refund_item()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product_id uuid;
  v_conversion_qty numeric(12, 2);
begin
  select si.product_id, coalesce(pu.conversion_qty, 1)
    into v_product_id, v_conversion_qty
  from sale_items si
  left join product_units pu on pu.id = si.product_unit_id
  where si.id = new.sale_item_id;

  if v_product_id is not null then
    update products
    set stock_qty = stock_qty + (new.quantity * v_conversion_qty),
        updated_at = now()
    where id = v_product_id;
  end if;
  return new;
end;
$$;
