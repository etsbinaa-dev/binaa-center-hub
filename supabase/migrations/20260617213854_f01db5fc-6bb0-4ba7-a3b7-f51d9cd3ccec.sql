
CREATE TABLE public.quantities (
  product_key text PRIMARY KEY,
  label text NOT NULL,
  category text NOT NULL,
  quantity integer NOT NULL DEFAULT 0,
  min_quantity integer NOT NULL DEFAULT 50,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.quantities TO authenticated;
GRANT ALL ON public.quantities TO service_role;

ALTER TABLE public.quantities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read quantities" ON public.quantities FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert quantities" ON public.quantities FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth update quantities" ON public.quantities FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER quantities_set_updated_at
BEFORE UPDATE ON public.quantities
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
