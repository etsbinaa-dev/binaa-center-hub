ALTER TABLE public.app_settings 
  ADD COLUMN IF NOT EXISTS daily_report_time TIME NOT NULL DEFAULT '21:00',
  ADD COLUMN IF NOT EXISTS daily_report_last_sent_date DATE;