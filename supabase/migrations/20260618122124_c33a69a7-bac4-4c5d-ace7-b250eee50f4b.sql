
-- 1) Extend invoices with payment tracking columns (nullable for backward compatibility)
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS amount numeric(14,2),
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_reminder_at timestamptz;

CREATE INDEX IF NOT EXISTS invoices_payment_status_idx ON public.invoices(payment_status);
CREATE INDEX IF NOT EXISTS invoices_amount_idx ON public.invoices(amount);

-- 2) Singleton settings table
CREATE TABLE IF NOT EXISTS public.accounts_followup_settings (
  id smallint PRIMARY KEY DEFAULT 1,
  threshold_amount numeric(14,2) NOT NULL DEFAULT 50000,
  initial_delay_days integer NOT NULL DEFAULT 2,
  snooze_days integer NOT NULL DEFAULT 3,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT accounts_followup_settings_singleton CHECK (id = 1)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounts_followup_settings TO authenticated;
GRANT ALL ON public.accounts_followup_settings TO service_role;

ALTER TABLE public.accounts_followup_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "afs admin read" ON public.accounts_followup_settings
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "afs admin write" ON public.accounts_followup_settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP TRIGGER IF EXISTS afs_updated_at ON public.accounts_followup_settings;
CREATE TRIGGER afs_updated_at BEFORE UPDATE ON public.accounts_followup_settings
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.accounts_followup_settings (id, threshold_amount, initial_delay_days, snooze_days)
VALUES (1, 50000, 2, 3)
ON CONFLICT (id) DO NOTHING;

-- 3) Reminders / history table
CREATE TABLE IF NOT EXISTS public.account_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending', -- pending | paid | not_paid | snoozed
  message text NOT NULL,
  due_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  responded_by uuid,
  next_remind_at timestamptz,
  telegram_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.account_reminders TO authenticated;
GRANT ALL ON public.account_reminders TO service_role;

ALTER TABLE public.account_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reminders admin read" ON public.account_reminders
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "reminders admin write" ON public.account_reminders
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP TRIGGER IF EXISTS account_reminders_updated_at ON public.account_reminders;
CREATE TRIGGER account_reminders_updated_at BEFORE UPDATE ON public.account_reminders
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS account_reminders_invoice_idx ON public.account_reminders(invoice_id);
CREATE INDEX IF NOT EXISTS account_reminders_status_idx ON public.account_reminders(status);
CREATE INDEX IF NOT EXISTS account_reminders_due_idx ON public.account_reminders(due_at);
