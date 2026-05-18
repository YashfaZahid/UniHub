-- Run this in the Supabase SQL Editor

-- 1. Add phone number to existing shops table
ALTER TABLE shops ADD COLUMN IF NOT EXISTS phone TEXT;

-- 2. Create products table (text-only, no images)
CREATE TABLE IF NOT EXISTS products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  price_or_range TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_shop_id ON products(shop_id);
