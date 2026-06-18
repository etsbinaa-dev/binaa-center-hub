
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS paid_amount numeric(14,2) NOT NULL DEFAULT 0;

UPDATE public.invoices
SET paid_amount = COALESCE(amount, 0)
WHERE payment_status = 'paid' AND paid_amount = 0;
