CREATE TABLE public.receptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier text NOT NULL,
  goods_type text NOT NULL,
  quantity numeric NOT NULL,
  unit text NOT NULL,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  is_archived boolean NOT NULL DEFAULT false
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.receptions TO authenticated;
GRANT ALL ON public.receptions TO service_role;

ALTER TABLE public.receptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "receptions read all authenticated"
  ON public.receptions FOR SELECT TO authenticated USING (true);

CREATE POLICY "receptions insert authenticated"
  ON public.receptions FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "receptions update authenticated"
  ON public.receptions FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "receptions delete authenticated"
  ON public.receptions FOR DELETE TO authenticated USING (true);

CREATE INDEX receptions_archived_created_at_idx
  ON public.receptions (is_archived, created_at DESC);