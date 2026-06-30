ALTER TABLE public.receptions
  ADD COLUMN IF NOT EXISTS brought_by_driver BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS driver_name TEXT;