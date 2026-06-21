
-- Temporary entries (income/expense quick book)
CREATE TABLE public.temp_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('income','expense')),
  amount numeric NOT NULL CHECK (amount >= 0),
  description text,
  notes text,
  status text NOT NULL DEFAULT 'pending',
  created_by uuid,
  created_by_name text,
  reviewed_at timestamptz,
  reviewed_by uuid,
  reviewed_by_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.temp_entries TO authenticated;
GRANT ALL ON public.temp_entries TO service_role;
ALTER TABLE public.temp_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read temp_entries" ON public.temp_entries FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert temp_entries" ON public.temp_entries FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth update temp_entries" ON public.temp_entries FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth delete temp_entries" ON public.temp_entries FOR DELETE TO authenticated USING (true);
CREATE INDEX temp_entries_status_created_idx ON public.temp_entries (status, created_at DESC);
CREATE TRIGGER temp_entries_set_updated_at BEFORE UPDATE ON public.temp_entries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- House cash bag operations (كيص الدار)
CREATE TABLE public.house_cash_ops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  op_type text NOT NULL CHECK (op_type IN ('central_to_house','house_to_bank','house_to_central','add_cash','withdraw_cash')),
  amount numeric NOT NULL CHECK (amount >= 0),
  notes text,
  status text NOT NULL DEFAULT 'pending',
  created_by uuid,
  created_by_name text,
  reviewed_at timestamptz,
  reviewed_by uuid,
  reviewed_by_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.house_cash_ops TO authenticated;
GRANT ALL ON public.house_cash_ops TO service_role;
ALTER TABLE public.house_cash_ops ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read house_cash_ops" ON public.house_cash_ops FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert house_cash_ops" ON public.house_cash_ops FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth update house_cash_ops" ON public.house_cash_ops FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth delete house_cash_ops" ON public.house_cash_ops FOR DELETE TO authenticated USING (true);
CREATE INDEX house_cash_ops_status_created_idx ON public.house_cash_ops (status, created_at DESC);
CREATE TRIGGER house_cash_ops_set_updated_at BEFORE UPDATE ON public.house_cash_ops
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
