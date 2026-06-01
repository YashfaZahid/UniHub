-- Avatars bucket policies (path: {user_id}/avatar.{ext})
-- Matches backend upload_avatar() in image_utils.py and POST /api/profile/avatar

-- Public read (profile images visible on feed, shop, profile pages)
-- CREATE POLICY "Public read avatars"
-- ON storage.objects FOR SELECT
-- USING (bucket_id = 'avatars');

-- Authenticated users upload only to their own folder
-- CREATE POLICY "Users upload own avatar"
-- ON storage.objects FOR INSERT
-- WITH CHECK (
--   bucket_id = 'avatars'
--   AND auth.role() = 'authenticated'
--   AND (storage.foldername(name))[1] = auth.uid()::text
-- );

-- UPDATE / DELETE for own folder
-- CREATE POLICY "Users update own avatar"
-- ON storage.objects FOR UPDATE
-- USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- CREATE POLICY "Users delete own avatar"
-- ON storage.objects FOR DELETE
-- USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Note: The Flask route uses service_role and path {user_id}/avatar.{ext},
-- so uploads work even when the browser Supabase session is missing.
-- profiles.profile_image stores the full public URL.
