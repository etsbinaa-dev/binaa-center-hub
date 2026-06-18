
CREATE TABLE public.role_permissions (
  role public.app_role NOT NULL,
  module text NOT NULL,
  permission text NOT NULL CHECK (permission IN ('view','create','edit','delete')),
  allowed boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (role, module, permission)
);

GRANT SELECT ON public.role_permissions TO authenticated;
GRANT ALL ON public.role_permissions TO service_role;

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read permissions"
  ON public.role_permissions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert permissions"
  ON public.role_permissions FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update permissions"
  ON public.role_permissions FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete permissions"
  ON public.role_permissions FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Seed defaults: admin gets all; others match current MODULE_ACCESS for "view",
-- and write perms (create/edit/delete) granted to non-monitor roles where they had view.
DO $$
DECLARE
  r public.app_role;
  m text;
  p text;
  modules text[] := ARRAY['home','orders','invoices','delivery','inventory','customers','users','reports','accounts_followup','settings'];
  perms text[] := ARRAY['view','create','edit','delete'];
  allow boolean;
BEGIN
  FOREACH m IN ARRAY modules LOOP
    FOREACH p IN ARRAY perms LOOP
      FOR r IN SELECT unnest(ARRAY['admin','accountant','delivery','monitor']::public.app_role[]) LOOP
        allow := false;
        IF r = 'admin' THEN
          allow := true;
        ELSIF r = 'accountant' THEN
          IF m IN ('home','orders','invoices','inventory','customers','reports') THEN
            allow := (p = 'view') OR (p IN ('create','edit'));
          END IF;
        ELSIF r = 'delivery' THEN
          IF m IN ('home','delivery') THEN
            allow := (p = 'view') OR (p = 'edit');
          END IF;
        ELSIF r = 'monitor' THEN
          IF m IN ('home','orders','invoices','delivery','inventory','customers','reports') THEN
            allow := (p = 'view');
          END IF;
        END IF;
        INSERT INTO public.role_permissions(role, module, permission, allowed)
        VALUES (r, m, p, allow)
        ON CONFLICT (role, module, permission) DO NOTHING;
      END LOOP;
    END LOOP;
  END LOOP;
END $$;
