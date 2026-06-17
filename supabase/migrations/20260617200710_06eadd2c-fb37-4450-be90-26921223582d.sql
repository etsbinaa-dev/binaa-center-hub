
CREATE POLICY "invoice-files read" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'invoice-files');
CREATE POLICY "invoice-files insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'invoice-files');
CREATE POLICY "invoice-files update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'invoice-files');
CREATE POLICY "invoice-files delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'invoice-files');
