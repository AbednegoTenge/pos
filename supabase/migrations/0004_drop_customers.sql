-- Customers/loyalty tracking was never built out in the UI, and the discount
-- field on checkout already covers ad-hoc loyal-customer pricing — so drop
-- the unused table rather than carry dead schema.
alter table sales drop column customer_id;
drop table customers;
