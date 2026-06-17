
CREATE TABLE public.activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  user_name text NOT NULL,
  user_role text,
  module text NOT NULL,
  action text NOT NULL,
  description text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.activity_logs TO authenticated;
GRANT ALL ON public.activity_logs TO service_role;

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read activity_logs" ON public.activity_logs
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert activity_logs" ON public.activity_logs
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

CREATE INDEX activity_logs_created_at_idx ON public.activity_logs (created_at DESC);
