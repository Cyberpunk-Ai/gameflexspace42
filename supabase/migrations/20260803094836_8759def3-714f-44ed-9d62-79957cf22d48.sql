ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referral_source text;

CREATE POLICY "Public read tournament images" ON storage.objects FOR SELECT USING (bucket_id = 'tournament-images');
CREATE POLICY "Admins manage tournament images" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'tournament-images' AND public.has_role(auth.uid(),'admin'))
  WITH CHECK (bucket_id = 'tournament-images' AND public.has_role(auth.uid(),'admin'));

CREATE POLICY "Public read status media" ON storage.objects FOR SELECT USING (bucket_id = 'status-media');
CREATE POLICY "Users upload own status media" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'status-media' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users update own status media" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'status-media' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users delete own status media" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'status-media' AND (storage.foldername(name))[1] = auth.uid()::text);