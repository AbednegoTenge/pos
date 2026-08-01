-- Enable realtime on products so the POS can show an in-app low-stock popup
-- the moment a sale (or manual edit) pushes a product at/below its
-- low_stock_threshold. Replica identity is set to full so UPDATE payloads
-- include the pre-change row — without it, `old` only carries the primary
-- key, and the client can't tell whether stock just crossed the threshold or
-- was already low (which would mean re-alerting on every subsequent sale).
alter table products replica identity full;
alter publication supabase_realtime add table products;
