
-- Restrict SECURITY DEFINER function callable by signed-in users
REVOKE EXECUTE ON FUNCTION public.create_notification(text, text, uuid) FROM PUBLIC, authenticated;

-- Tighten always-true RLS policies to require an authenticated session
DROP POLICY IF EXISTS "Authenticated can insert daily_payments" ON public.daily_payments;
CREATE POLICY "Authenticated can insert daily_payments" ON public.daily_payments
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated can update daily_payments" ON public.daily_payments;
CREATE POLICY "Authenticated can update daily_payments" ON public.daily_payments
  FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "auth insert temp_entries" ON public.temp_entries;
CREATE POLICY "auth insert temp_entries" ON public.temp_entries
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "auth update temp_entries" ON public.temp_entries;
CREATE POLICY "auth update temp_entries" ON public.temp_entries
  FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "auth insert house_cash_ops" ON public.house_cash_ops;
CREATE POLICY "auth insert house_cash_ops" ON public.house_cash_ops
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "auth update house_cash_ops" ON public.house_cash_ops;
CREATE POLICY "auth update house_cash_ops" ON public.house_cash_ops
  FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "receptions insert authenticated" ON public.receptions;
CREATE POLICY "receptions insert authenticated" ON public.receptions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "receptions update authenticated" ON public.receptions;
CREATE POLICY "receptions update authenticated" ON public.receptions
  FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
