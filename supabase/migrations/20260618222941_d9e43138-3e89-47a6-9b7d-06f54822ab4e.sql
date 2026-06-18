
CREATE POLICY "Auth read daily-payments"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'daily-payments');
CREATE POLICY "Auth insert daily-payments"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'daily-payments');
CREATE POLICY "Auth update daily-payments"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'daily-payments');
CREATE POLICY "Auth delete daily-payments"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'daily-payments');
