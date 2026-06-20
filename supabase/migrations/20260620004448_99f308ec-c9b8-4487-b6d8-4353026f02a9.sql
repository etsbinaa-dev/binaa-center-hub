ALTER TABLE public.daily_payments ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending';
ALTER TABLE public.daily_payments ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;
ALTER TABLE public.daily_payments ADD COLUMN IF NOT EXISTS reviewed_by uuid;
ALTER TABLE public.daily_payments ADD COLUMN IF NOT EXISTS reviewed_by_name text;
CREATE INDEX IF NOT EXISTS daily_payments_status_idx ON public.daily_payments(status, created_at DESC);