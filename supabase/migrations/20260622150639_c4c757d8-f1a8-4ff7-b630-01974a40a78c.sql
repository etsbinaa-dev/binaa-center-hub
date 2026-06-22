
-- 1. Restrict DELETE policies on data tables to admin or record creator
DROP POLICY IF EXISTS "Authenticated can delete daily_payments" ON public.daily_payments;
CREATE POLICY "Admin or creator can delete daily_payments"
ON public.daily_payments FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) OR created_by = auth.uid());

DROP POLICY IF EXISTS "auth delete house_cash_ops" ON public.house_cash_ops;
CREATE POLICY "Admin or creator can delete house_cash_ops"
ON public.house_cash_ops FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) OR created_by = auth.uid());

DROP POLICY IF EXISTS "receptions delete authenticated" ON public.receptions;
CREATE POLICY "Admin or creator can delete receptions"
ON public.receptions FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) OR created_by = auth.uid());

DROP POLICY IF EXISTS "auth delete temp_entries" ON public.temp_entries;
CREATE POLICY "Admin or creator can delete temp_entries"
ON public.temp_entries FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) OR created_by = auth.uid());

-- 2. Restrict has_role to checking the caller's own role (prevents role enumeration)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only allow checking the caller's own role. RLS policies always call
  -- has_role(auth.uid(), ...) so this does not break existing authorization.
  -- Service role and SECURITY DEFINER contexts (auth.uid() IS NULL) keep full access.
  IF auth.uid() IS NOT NULL AND _user_id <> auth.uid() THEN
    RETURN false;
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
END;
$$;

-- 3. Lock down SECURITY DEFINER function execution
REVOKE EXECUTE ON FUNCTION public.create_notification(text, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_notification(text, text, uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;

-- Trigger-only functions: nobody should call these directly
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_order_change() FROM PUBLIC, anon, authenticated;

-- 4. Realtime channel authorization: only allow users to subscribe to their own notif topic
-- Channel name pattern used in the app: `notif-${user.id}`
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own notif topic" ON realtime.messages;
CREATE POLICY "Users read own notif topic"
ON realtime.messages FOR SELECT TO authenticated
USING (
  realtime.topic() = 'notif-' || auth.uid()::text
);
