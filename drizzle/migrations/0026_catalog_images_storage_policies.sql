CREATE POLICY "catalog images read by org members" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'catalog-images' AND (public.has_role(auth.uid(), 'admin') OR public.is_member_of(auth.uid(), ((storage.foldername(name))[1])::uuid)));
CREATE POLICY "catalog images upload by catalog editors" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'catalog-images' AND lower(storage.extension(name)) IN ('jpg','jpeg','png','webp') AND public.can_edit_org_catalog(((storage.foldername(name))[1])::uuid));