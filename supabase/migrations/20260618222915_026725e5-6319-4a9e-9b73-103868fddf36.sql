
CREATE TABLE public.daily_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_name TEXT NOT NULL,
  invoice_number TEXT,
  amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('bankily','seddad','cash','check','other')),
  image_path TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_payments TO authenticated;
GRANT ALL ON public.daily_payments TO service_role;

ALTER TABLE public.daily_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read daily_payments"
  ON public.daily_payments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert daily_payments"
  ON public.daily_payments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update daily_payments"
  ON public.daily_payments FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can delete daily_payments"
  ON public.daily_payments FOR DELETE TO authenticated USING (true);

CREATE INDEX daily_payments_created_at_idx ON public.daily_payments (created_at DESC);

CREATE TRIGGER set_daily_payments_updated_at
  BEFORE UPDATE ON public.daily_payments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.notification_settings (kind, enabled)
VALUES ('daily_payment', true)
ON CONFLICT (kind) DO NOTHING;
