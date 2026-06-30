ALTER TABLE public.drivers
  ADD COLUMN IF NOT EXISTS reception_ciment_rate numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reception_barig_rate numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reception_fer_rate numeric NOT NULL DEFAULT 0;
