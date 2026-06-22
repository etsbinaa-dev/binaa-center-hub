
-- 1) app_settings singleton table
CREATE TABLE IF NOT EXISTS public.app_settings (
  id smallint PRIMARY KEY DEFAULT 1,
  org_name text NOT NULL DEFAULT '',
  org_phone text NOT NULL DEFAULT '',
  org_address text NOT NULL DEFAULT '',
  whatsapp_message text NOT NULL DEFAULT 'مرحباً {{name}}، فاتورتكم رقم {{invoice}} من بِناء HUB جاهزة. شكراً لتعاملكم معنا.',
  show_sms_message boolean NOT NULL DEFAULT true,
  critical_quantity integer NOT NULL DEFAULT 5,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT app_settings_singleton CHECK (id = 1)
);

GRANT SELECT, INSERT, UPDATE ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "app_settings read for authenticated"
  ON public.app_settings FOR SELECT TO authenticated USING (true);

CREATE POLICY "app_settings insert admin only"
  ON public.app_settings FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "app_settings update admin only"
  ON public.app_settings FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER app_settings_set_updated_at
  BEFORE UPDATE ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.app_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- 2) Drop unused app_users table
DROP TABLE IF EXISTS public.app_users CASCADE;
