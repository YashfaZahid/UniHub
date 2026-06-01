-- UniHub: remove unused feature tables (comments, requests/matches, reviews, normalized categories)
-- Run manually in Supabase SQL Editor after deploying app changes.
-- Review dependencies in your project before executing.

-- ── Normalized category tables (app uses shops.category text column only) ──
DROP TABLE IF EXISTS product_categories CASCADE;
DROP TABLE IF EXISTS categories CASCADE;

-- ── Comments ──
DROP TABLE IF EXISTS comments CASCADE;

-- ── Requests & matching ──
DROP TABLE IF EXISTS matches CASCADE;
DROP TABLE IF EXISTS requests CASCADE;

-- ── Reviews & ratings ──
DROP TABLE IF EXISTS order_reviews CASCADE;
DROP TABLE IF EXISTS shop_reviews CASCADE;
DROP TABLE IF EXISTS reviews CASCADE;

-- Optional: drop shops.average_rating if you no longer need the column
-- ALTER TABLE shops DROP COLUMN IF EXISTS average_rating;
