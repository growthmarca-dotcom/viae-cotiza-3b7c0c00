CREATE POLICY "own company logo read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'company-logos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "own company logo insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'company-logos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "own company logo update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'company-logos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "own company logo delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'company-logos' AND (storage.foldername(name))[1] = auth.uid()::text);