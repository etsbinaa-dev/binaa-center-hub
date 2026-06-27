
CREATE POLICY "Authenticated read receptions" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'receptions');
CREATE POLICY "Authenticated upload receptions" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'receptions');
CREATE POLICY "Authenticated update receptions" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'receptions');
CREATE POLICY "Authenticated delete receptions" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'receptions');
