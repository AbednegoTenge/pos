-- Refunds: supports partial returns (specific items/quantities from a sale),
-- restocks inventory automatically, and flips the parent sale to 'refunded'
-- once every item on it has been returned. Amounts are the sum of the
-- returned lines' original prices — VAT/NHIL/GETFund/COVID levy are not
-- individually reversed per line; that's a deliberate v1 simplification.
create table refunds (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references sales (id),
  processed_by uuid references profiles (id),
  reason text not null,
  total_ghs numeric(12, 2) not null check (total_ghs >= 0),
  created_at timestamptz not null default now()
);

create table refund_items (
  id uuid primary key default gen_random_uuid(),
  refund_id uuid not null references refunds (id) on delete cascade,
  sale_item_id uuid not null references sale_items (id),
  quantity numeric(12, 2) not null check (quantity > 0),
  line_total_ghs numeric(12, 2) not null
);

create index refunds_sale_idx on refunds (sale_id);
create index refund_items_refund_idx on refund_items (refund_id);
create index refund_items_sale_item_idx on refund_items (sale_item_id);

alter table refunds enable row level security;
alter table refund_items enable row level security;

-- Any staff member can see refund history; only admins/managers can process
-- one, since reversing a sale is financially sensitive.
create policy "staff read refunds" on refunds for select using (auth.uid() is not null);
create policy "managers create refunds" on refunds for insert with check (
  exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('admin', 'manager'))
);

create policy "staff read refund_items" on refund_items for select using (auth.uid() is not null);
create policy "managers create refund_items" on refund_items for insert with check (
  exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('admin', 'manager'))
);

-- Put returned stock back.
create or replace function restock_on_refund_item()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product_id uuid;
begin
  select product_id into v_product_id from sale_items where id = new.sale_item_id;
  if v_product_id is not null then
    update products
    set stock_qty = stock_qty + new.quantity,
        updated_at = now()
    where id = v_product_id;
  end if;
  return new;
end;
$$;

create trigger refund_items_restock
  after insert on refund_items
  for each row execute function restock_on_refund_item();

-- Once every unit sold on a sale has been refunded, mark the whole sale refunded.
create or replace function update_sale_status_on_refund()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sale_id uuid;
  v_total_sold numeric;
  v_total_refunded numeric;
begin
  select si.sale_id into v_sale_id from sale_items si where si.id = new.sale_item_id;

  select coalesce(sum(quantity), 0) into v_total_sold
  from sale_items where sale_id = v_sale_id;

  select coalesce(sum(ri.quantity), 0) into v_total_refunded
  from refund_items ri
  join sale_items si on si.id = ri.sale_item_id
  where si.sale_id = v_sale_id;

  if v_total_refunded >= v_total_sold then
    update sales set status = 'refunded' where id = v_sale_id;
  end if;

  return new;
end;
$$;

create trigger refund_items_update_sale_status
  after insert on refund_items
  for each row execute function update_sale_status_on_refund();
