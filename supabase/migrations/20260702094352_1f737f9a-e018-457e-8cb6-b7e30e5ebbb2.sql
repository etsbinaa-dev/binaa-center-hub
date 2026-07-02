
-- Fix: SECURITY DEFINER function callable by authenticated. Convert has_role to SECURITY INVOKER.
-- user_roles has a "read self" SELECT policy so an INVOKER call reading the caller's own row works.
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NOT NULL AND _user_id <> auth.uid() THEN
    RETURN false;
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
END;
$function$;

-- Fix: RLS policies always-true on drivers. Require authenticated + admin for writes.
DROP POLICY IF EXISTS "Authenticated users can insert drivers" ON public.drivers;
DROP POLICY IF EXISTS "Authenticated users can update drivers" ON public.drivers;
DROP POLICY IF EXISTS "Authenticated users can delete drivers" ON public.drivers;

CREATE POLICY "Admins can insert drivers"
  ON public.drivers FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update drivers"
  ON public.drivers FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete drivers"
  ON public.drivers FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
