ALTER TABLE public.customer_balances ADD COLUMN IF NOT EXISTS current_balance NUMERIC NOT NULL DEFAULT 0;
UPDATE public.customer_balances SET current_balance = initial_balance WHERE current_balance = 0 AND initial_balance IS NOT NULL;
ALTER TABLE public.customer_balances DROP COLUMN IF EXISTS initial_balance;