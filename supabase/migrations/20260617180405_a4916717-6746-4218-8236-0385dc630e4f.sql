
-- Nafiz schema migration (consolidated from 8 source migrations)

-- Roles
CREATE TYPE public.app_role AS ENUM ('admin', 'employee');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles read for authed" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles update own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles insert own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "user_roles read self" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  user_count INT;
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)));

  SELECT COUNT(*) INTO user_count FROM auth.users;
  IF user_count = 1 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'employee');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Customers
CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;
GRANT ALL ON public.customers TO service_role;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "customers select" ON public.customers FOR SELECT TO authenticated USING (true);
CREATE POLICY "customers insert" ON public.customers FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "customers update admin" ON public.customers FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "customers delete admin" ON public.customers FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE INDEX customers_name_idx ON public.customers (name);
CREATE INDEX customers_phone_idx ON public.customers (phone);

-- Orders
CREATE TYPE public.order_status AS ENUM ('active','archived');

CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  details TEXT,
  status order_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  invoiced_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  images TEXT[] NOT NULL DEFAULT '{}',
  voice_note TEXT,
  files TEXT[]
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "orders select" ON public.orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "orders insert" ON public.orders FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "orders update" ON public.orders FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "orders delete admin" ON public.orders FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE INDEX orders_status_created_idx ON public.orders (status, created_at DESC);
CREATE INDEX orders_customer_idx ON public.orders (customer_id);

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;

-- Notifications
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE,
  type text NOT NULL,
  message text NOT NULL,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own notifications" ON public.notifications
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "users update own notifications" ON public.notifications
  FOR UPDATE TO authenticated USING (user_id = auth.uid());

CREATE INDEX notifications_user_unread_idx ON public.notifications (user_id, read, created_at DESC);

ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

CREATE OR REPLACE FUNCTION public.notify_order_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  actor uuid := auth.uid();
  cust_name text;
  msg text;
  ntype text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    ntype := 'created';
    SELECT name INTO cust_name FROM public.customers WHERE id = NEW.customer_id;
    msg := 'تم إنشاء طلب جديد للعميل ' || COALESCE(cust_name, '');
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status = 'archived' AND OLD.status <> 'archived' THEN
      ntype := 'archived';
      SELECT name INTO cust_name FROM public.customers WHERE id = NEW.customer_id;
      msg := 'تم أرشفة طلب العميل ' || COALESCE(cust_name, '');
    ELSE
      ntype := 'updated';
      SELECT name INTO cust_name FROM public.customers WHERE id = NEW.customer_id;
      msg := 'تم تحديث طلب العميل ' || COALESCE(cust_name, '');
    END IF;
  END IF;

  INSERT INTO public.notifications (user_id, order_id, type, message)
  SELECT u.id, NEW.id, ntype, msg
  FROM auth.users u
  WHERE actor IS NULL OR u.id <> actor;

  RETURN NEW;
END;
$$;

CREATE TRIGGER orders_notify_insert
AFTER INSERT ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.notify_order_change();

CREATE TRIGGER orders_notify_update
AFTER UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.notify_order_change();

REVOKE EXECUTE ON FUNCTION public.notify_order_change() FROM PUBLIC, anon, authenticated;

-- Storage policies for order-attachments bucket (bucket created via API)
CREATE POLICY "auth read order attachments"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'order-attachments');

CREATE POLICY "auth upload order attachments"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'order-attachments');

CREATE POLICY "auth update order attachments"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'order-attachments');

CREATE POLICY "auth delete order attachments"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'order-attachments');
