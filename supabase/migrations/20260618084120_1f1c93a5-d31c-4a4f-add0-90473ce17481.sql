
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS driver_name text,
  ADD COLUMN IF NOT EXISTS pointeur_name text,
  ADD COLUMN IF NOT EXISTS delivery_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivery_invoice_path text,
  ADD COLUMN IF NOT EXISTS delivery_invoice_number text,
  ADD COLUMN IF NOT EXISTS delivery_notes text;
