CREATE TABLE IF NOT EXISTS public.extra_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  keywords text[] NOT NULL DEFAULT '{}',
  price_tonne numeric NOT NULL DEFAULT 0,
  price_unit numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.extra_materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth select extra_materials" ON public.extra_materials
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth insert extra_materials" ON public.extra_materials
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth update extra_materials" ON public.extra_materials
  FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth delete extra_materials" ON public.extra_materials
  FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

INSERT INTO public.extra_materials (name, keywords, price_tonne, price_unit) VALUES
  ('بلاتر',   ARRAY['بلاتر','blater','plater'],           1200, 48),
  ('تانشتي',  ARRAY['تانشتي','تانشيتي','tachinti'],          0,  100),
  ('فليكونت', ARRAY['فليكونت','flycont','flexcont'],         0,   50),
  ('كول كرو', ARRAY['كول كرو','كولكرو','coulcro','coolcro'], 1200, 24),
  ('فيلاص',   ARRAY['فيلاص','فيلص','vilas','villas'],        0,  250)
ON CONFLICT (name) DO NOTHING;
