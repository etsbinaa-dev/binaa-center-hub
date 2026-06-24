CREATE TABLE IF NOT EXISTS public.vehicles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  tracking_url TEXT DEFAULT '',
  url_updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, UPDATE ON public.vehicles TO authenticated;
GRANT ALL ON public.vehicles TO service_role;

ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vehicles select" ON public.vehicles
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "vehicles update admin" ON public.vehicles
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.vehicles (id, name) VALUES
  ('vehicle_1', 'سيارة 1'),
  ('vehicle_2', 'سيارة 2'),
  ('vehicle_3', 'سيارة 3')
ON CONFLICT (id) DO NOTHING;