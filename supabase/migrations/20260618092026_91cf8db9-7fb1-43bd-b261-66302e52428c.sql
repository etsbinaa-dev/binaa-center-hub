
DROP POLICY IF EXISTS "admins manage user_roles" ON public.user_roles;
CREATE POLICY "admins manage user_roles"
ON public.user_roles FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "orders insert" ON public.orders;
CREATE POLICY "orders insert" ON public.orders FOR INSERT TO authenticated
WITH CHECK (auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'monitor'));

DROP POLICY IF EXISTS "orders update" ON public.orders;
CREATE POLICY "orders update" ON public.orders FOR UPDATE TO authenticated
USING (auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'monitor'))
WITH CHECK (auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'monitor'));

DROP POLICY IF EXISTS "invoices insert" ON public.invoices;
CREATE POLICY "invoices insert" ON public.invoices FOR INSERT TO authenticated
WITH CHECK (auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'monitor'));

DROP POLICY IF EXISTS "invoices update" ON public.invoices;
CREATE POLICY "invoices update" ON public.invoices FOR UPDATE TO authenticated
USING (auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'monitor'))
WITH CHECK (auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'monitor'));

DROP POLICY IF EXISTS "customers insert" ON public.customers;
CREATE POLICY "customers insert" ON public.customers FOR INSERT TO authenticated
WITH CHECK (auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'monitor'));

DROP POLICY IF EXISTS "auth insert quantities" ON public.quantities;
CREATE POLICY "auth insert quantities" ON public.quantities FOR INSERT TO authenticated
WITH CHECK (auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'monitor'));

DROP POLICY IF EXISTS "auth update quantities" ON public.quantities;
CREATE POLICY "auth update quantities" ON public.quantities FOR UPDATE TO authenticated
USING (auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'monitor'))
WITH CHECK (auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'monitor'));

DROP POLICY IF EXISTS "Authenticated can insert activity_logs" ON public.activity_logs;
CREATE POLICY "Authenticated can insert activity_logs" ON public.activity_logs FOR INSERT TO authenticated
WITH CHECK (auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'monitor'));
