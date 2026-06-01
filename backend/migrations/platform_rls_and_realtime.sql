-- UniHub platform: optional columns, indexes, RLS, storage, and realtime
-- Run in Supabase SQL Editor. Adjust if your schema already has these columns.

-- ── Conversations / messages (optional columns) ──
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS last_message_preview TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS read BOOLEAN DEFAULT FALSE;

-- ── Notifications ──
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}'::jsonb;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS read BOOLEAN DEFAULT FALSE;

-- ── Orders ──
ALTER TABLE orders ADD COLUMN IF NOT EXISTS conversation_id UUID REFERENCES conversations(id);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS quantity INT DEFAULT 1;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS unit_price NUMERIC(12, 2) DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS total_price NUMERIC(12, 2) DEFAULT 0;

-- ── Indexes (performance) ──
CREATE INDEX IF NOT EXISTS idx_shops_created_at ON shops(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shops_category ON shops(category);
CREATE INDEX IF NOT EXISTS idx_shop_images_shop_id ON shop_images(shop_id);
CREATE INDEX IF NOT EXISTS idx_product_images_product_id ON product_images(product_id);
CREATE INDEX IF NOT EXISTS idx_product_images_primary ON product_images(product_id) WHERE is_primary = true;
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_conversations_buyer ON conversations(buyer_id);
CREATE INDEX IF NOT EXISTS idx_conversations_seller ON conversations(seller_id);
CREATE INDEX IF NOT EXISTS idx_orders_buyer ON orders(buyer_id);
CREATE INDEX IF NOT EXISTS idx_orders_seller ON orders(seller_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_followers_following ON followers(following_id);
CREATE INDEX IF NOT EXISTS idx_saved_products_user ON saved_products(user_id);

-- ── RLS: enable on tables ──
ALTER TABLE shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE followers ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_products ENABLE ROW LEVEL SECURITY;

-- Public read for marketplace discovery (anon feed + shop pages via client)
DROP POLICY IF EXISTS "Public read shops" ON shops;
CREATE POLICY "Public read shops" ON shops FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read shop_images" ON shop_images;
CREATE POLICY "Public read shop_images" ON shop_images FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read products" ON products;
CREATE POLICY "Public read products" ON products FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read product_images" ON product_images;
CREATE POLICY "Public read product_images" ON product_images FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read profiles" ON profiles;
CREATE POLICY "Public read profiles" ON profiles FOR SELECT USING (true);

-- Profiles: users update own row
DROP POLICY IF EXISTS "Users update own profile" ON profiles;
CREATE POLICY "Users update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Shops: owners manage own shops
DROP POLICY IF EXISTS "Owners insert shops" ON shops;
CREATE POLICY "Owners insert shops" ON shops FOR INSERT WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Owners update shops" ON shops;
CREATE POLICY "Owners update shops" ON shops FOR UPDATE USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Owners delete shops" ON shops;
CREATE POLICY "Owners delete shops" ON shops FOR DELETE USING (auth.uid() = owner_id);

-- Products: shop owners only
DROP POLICY IF EXISTS "Owners manage products" ON products;
CREATE POLICY "Owners manage products" ON products FOR ALL USING (
  EXISTS (SELECT 1 FROM shops WHERE shops.id = products.shop_id AND shops.owner_id = auth.uid())
);

DROP POLICY IF EXISTS "Owners manage product_images" ON product_images;
CREATE POLICY "Owners manage product_images" ON product_images FOR ALL USING (
  EXISTS (
    SELECT 1 FROM products p
    JOIN shops s ON s.id = p.shop_id
    WHERE p.id = product_images.product_id AND s.owner_id = auth.uid()
  )
);

-- Conversations: participants only
DROP POLICY IF EXISTS "Participants read conversations" ON conversations;
CREATE POLICY "Participants read conversations" ON conversations FOR SELECT USING (
  auth.uid() = buyer_id OR auth.uid() = seller_id
);

DROP POLICY IF EXISTS "Buyers create conversations" ON conversations;
CREATE POLICY "Buyers create conversations" ON conversations FOR INSERT WITH CHECK (auth.uid() = buyer_id);

DROP POLICY IF EXISTS "Participants update conversations" ON conversations;
CREATE POLICY "Participants update conversations" ON conversations FOR UPDATE USING (
  auth.uid() = buyer_id OR auth.uid() = seller_id
);

-- Messages: participants in conversation
DROP POLICY IF EXISTS "Participants read messages" ON messages;
CREATE POLICY "Participants read messages" ON messages FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM conversations c
    WHERE c.id = messages.conversation_id
    AND (c.buyer_id = auth.uid() OR c.seller_id = auth.uid())
  )
);

DROP POLICY IF EXISTS "Participants send messages" ON messages;
CREATE POLICY "Participants send messages" ON messages FOR INSERT WITH CHECK (
  auth.uid() = sender_id AND EXISTS (
    SELECT 1 FROM conversations c
    WHERE c.id = messages.conversation_id
    AND (c.buyer_id = auth.uid() OR c.seller_id = auth.uid())
  )
);

DROP POLICY IF EXISTS "Recipients mark messages read" ON messages;
CREATE POLICY "Recipients mark messages read" ON messages FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM conversations c
    WHERE c.id = messages.conversation_id
    AND (c.buyer_id = auth.uid() OR c.seller_id = auth.uid())
  )
);

-- Orders: buyer or seller
DROP POLICY IF EXISTS "Participants read orders" ON orders;
CREATE POLICY "Participants read orders" ON orders FOR SELECT USING (
  auth.uid() = buyer_id OR auth.uid() = seller_id
);

DROP POLICY IF EXISTS "Buyers create orders" ON orders;
CREATE POLICY "Buyers create orders" ON orders FOR INSERT WITH CHECK (auth.uid() = buyer_id);

DROP POLICY IF EXISTS "Participants update orders" ON orders;
CREATE POLICY "Participants update orders" ON orders FOR UPDATE USING (
  auth.uid() = buyer_id OR auth.uid() = seller_id
);

-- Notifications: own only
DROP POLICY IF EXISTS "Users read own notifications" ON notifications;
CREATE POLICY "Users read own notifications" ON notifications FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own notifications" ON notifications;
CREATE POLICY "Users update own notifications" ON notifications FOR UPDATE USING (auth.uid() = user_id);

-- Followers / saved products
DROP POLICY IF EXISTS "Users manage own follows" ON followers;
CREATE POLICY "Users manage own follows" ON followers FOR ALL USING (auth.uid() = follower_id);

DROP POLICY IF EXISTS "Users manage own saved" ON saved_products;
CREATE POLICY "Users manage own saved" ON saved_products FOR ALL USING (auth.uid() = user_id);

-- ── Storage policies (product_images bucket) ──
-- Dashboard: Storage → product_images → Policies
-- Public read:
-- CREATE POLICY "Public read product images" ON storage.objects FOR SELECT
--   USING (bucket_id = 'product_images');
-- Authenticated upload (owner path: product_id/...):
-- CREATE POLICY "Authenticated upload product images" ON storage.objects FOR INSERT
--   WITH CHECK (bucket_id = 'product_images' AND auth.role() = 'authenticated');

-- ── Realtime (enable in Dashboard → Database → Replication) ──
-- ALTER PUBLICATION supabase_realtime ADD TABLE messages;
-- ALTER PUBLICATION supabase_realtime ADD TABLE conversations;
-- ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
