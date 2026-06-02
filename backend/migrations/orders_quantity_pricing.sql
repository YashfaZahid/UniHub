-- UniHub: ensure order pricing + quantity columns exist
-- Safe, idempotent migration (does not destroy existing data).
-- Run in Supabase SQL Editor.

ALTER TABLE orders ADD COLUMN IF NOT EXISTS quantity INT DEFAULT 1;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS unit_price NUMERIC(12, 2) DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS total_price NUMERIC(12, 2) DEFAULT 0;

-- Optional: index for common filtering/sorting patterns (keep minimal).
-- CREATE INDEX IF NOT EXISTS idx_orders_buyer_created_at ON orders(buyer_id, created_at DESC);
-- CREATE INDEX IF NOT EXISTS idx_orders_seller_created_at ON orders(seller_id, created_at DESC);
