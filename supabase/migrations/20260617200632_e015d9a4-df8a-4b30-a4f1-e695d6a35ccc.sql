
CREATE TYPE public.invoice_status AS ENUM ('new', 'sent');

CREATE TABLE public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name text NOT NULL,
  customer_phone text NOT NULL,
  invoice_number text NOT NULL,
  image_path text,
  status public.invoice_status NOT NULL DEFAULT 'new',
  sent_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoices TO authenticated;
GRANT ALL ON public.invoices TO service_role;

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invoices select" ON public.invoices FOR SELECT TO authenticated USING (true);
CREATE POLICY "invoices insert" ON public.invoices FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "invoices update" ON public.invoices FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "invoices delete admin" ON public.invoices FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER invoices_updated_at BEFORE UPDATE ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX invoices_status_idx ON public.invoices(status);
CREATE INDEX invoices_invoice_number_idx ON public.invoices(invoice_number);
