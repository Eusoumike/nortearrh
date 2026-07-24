
CREATE POLICY "Admins can read backup files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'backups' AND public.has_role(auth.uid(), 'admin'));
