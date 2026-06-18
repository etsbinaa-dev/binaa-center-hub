
CREATE TABLE public.notification_settings (
  kind text PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_settings TO authenticated;
GRANT ALL ON public.notification_settings TO service_role;

ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated can read notification settings"
  ON public.notification_settings FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admins can insert notification settings"
  ON public.notification_settings FOR INSERT
  TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update notification settings"
  ON public.notification_settings FOR UPDATE
  TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete notification settings"
  ON public.notification_settings FOR DELETE
  TO authenticated USING (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.notification_settings (kind, enabled) VALUES
  ('order_new', true),
  ('invoice_new', true),
  ('delivery_start', true),
  ('delivery_done', true),
  ('large_account', true),
  ('debt_reminder', true),
  ('invoice_sent', true)
ON CONFLICT (kind) DO NOTHING;
