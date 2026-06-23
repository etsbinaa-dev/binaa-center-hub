CREATE TABLE IF NOT EXISTS public.customer_balances (
  phone TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  initial_balance NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_balances TO authenticated;
GRANT ALL ON public.customer_balances TO service_role;

ALTER TABLE public.customer_balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "customer_balances select" ON public.customer_balances
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "customer_balances insert admin" ON public.customer_balances
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "customer_balances update admin" ON public.customer_balances
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "customer_balances delete admin" ON public.customer_balances
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.set_customer_balances_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER customer_balances_updated_at
  BEFORE UPDATE ON public.customer_balances
  FOR EACH ROW EXECUTE FUNCTION public.set_customer_balances_updated_at();