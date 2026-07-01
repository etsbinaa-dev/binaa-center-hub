CREATE TABLE public.extra_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  keywords text[] NOT NULL DEFAULT '{}',
  price_tonne numeric NOT NULL DEFAULT 0,
  price_unit numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.extra_materials TO authenticated;
GRANT ALL ON public.extra_materials TO service_role;

ALTER TABLE public.extra_materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read extra_materials"
  ON public.extra_materials FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated can insert extra_materials"
  ON public.extra_materials FOR INSERT
  TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated can update extra_materials"
  ON public.extra_materials FOR UPDATE
  TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated can delete extra_materials"
  ON public.extra_materials FOR DELETE
  TO authenticated USING (auth.uid() IS NOT NULL);

INSERT INTO public.extra_materials (name, keywords, price_tonne, price_unit) VALUES
  ('بلاتر', ARRAY['بلاتر','blater','plater'], 1200, 48),
  ('تانشتي', ARRAY['تانشتي','tachinti'], 0, 100),
  ('فليكونت', ARRAY['فليكونت','flycont'], 0, 50),
  ('كول كرو', ARRAY['كول كرو','coulcro'], 1200, 24),
  ('فيلاص', ARRAY['فيلاص','vilas'], 0, 250);
