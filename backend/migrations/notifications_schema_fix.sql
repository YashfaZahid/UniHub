-- Ensure notifications table matches UniHub app expectations.
-- Run in Supabase SQL Editor if message/order notifications are not appearing.

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS body TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS message TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}'::jsonb;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS read BOOLEAN DEFAULT FALSE;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT FALSE;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS reference_id UUID;

-- Backfill read flag if only one column exists
UPDATE notifications SET read = COALESCE(read, is_read, FALSE) WHERE read IS NULL;
UPDATE notifications SET is_read = COALESCE(is_read, read, FALSE) WHERE is_read IS NULL;
UPDATE notifications SET body = COALESCE(NULLIF(body, ''), message, title, '') WHERE body IS NULL OR body = '';
UPDATE notifications SET message = COALESCE(NULLIF(message, ''), body, title, '') WHERE message IS NULL OR message = '';

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, read);
