-- Manager-only sale voiding. Distinct from a refund: a void means the sale
-- itself was a mistake (never should have happened), so it fully restocks
-- every line and leaves an audit trail of who voided it and why, rather than
-- going through the partial-return refund flow.
alter table sales
  add column void_reason text,
  add column voided_by uuid references profiles (id),
  add column voided_at timestamptz;

create or replace function void_sale(p_sale_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role staff_role;
  v_status sale_status;
  v_item record;
begin
  select role into v_role from profiles where id = auth.uid();
  if v_role is null or v_role not in ('admin', 'manager') then
    raise exception 'Only admins or managers can void a sale';
  end if;

  if p_reason is null or trim(p_reason) = '' then
    raise exception 'A reason is required to void a sale';
  end if;

  select status into v_status from sales where id = p_sale_id;
  if v_status is null then
    raise exception 'Sale not found';
  end if;
  if v_status <> 'completed' then
    raise exception 'Only completed sales can be voided';
  end if;

  for v_item in
    select si.product_id, si.quantity, coalesce(pu.conversion_qty, 1) as conversion_qty
    from sale_items si
    left join product_units pu on pu.id = si.product_unit_id
    where si.sale_id = p_sale_id
  loop
    if v_item.product_id is not null then
      update products
      set stock_qty = stock_qty + v_item.quantity * v_item.conversion_qty,
          updated_at = now()
      where id = v_item.product_id;
    end if;
  end loop;

  update sales
  set status = 'voided',
      void_reason = trim(p_reason),
      voided_by = auth.uid(),
      voided_at = now()
  where id = p_sale_id;
end;
$$;

revoke execute on function void_sale(uuid, text) from public;
grant execute on function void_sale(uuid, text) to authenticated;
