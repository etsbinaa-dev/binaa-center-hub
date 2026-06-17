
CREATE TYPE public.delivery_status AS ENUM ('new', 'in_progress', 'delivered');

ALTER TABLE public.orders
  ADD COLUMN delivery_status public.delivery_status NOT NULL DEFAULT 'new',
  ADD COLUMN delivered_at timestamptz;
