-- ============================================================
-- TESTING BRANCH ONLY — fresh empty Supabase project
-- Do not run this on the production / main database.
--
-- 1. Create a new Supabase project (or use the testing one).
-- 2. SQL Editor → paste this entire file → Run.
-- 3. Authentication → Users → Add user (auto-confirm email):
--      admin@decoy.local     (then grant happens below if the user exists)
--      client@decoy.local
-- 4. Re-run the decoy INSERT block at the bottom, or sign up in the app
--    then promote the admin in SQL.
-- 5. Point .env (gitignored) at this project. Do not commit keys.
-- ============================================================

-- ---------- Enums ----------
CREATE TYPE public.app_role AS ENUM ('admin', 'client', 'parttimer', 'pending_parttimer');
CREATE TYPE public.order_status AS ENUM ('pending', 'in_progress', 'completed');
CREATE TYPE public.file_type AS ENUM ('input', 'output');

-- ---------- Tables ----------
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  phone TEXT DEFAULT '',
  gcash_number TEXT,
  gcash_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL DEFAULT 'client',
  name TEXT,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  service_type TEXT NOT NULL,
  pricing_tier TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL,
  instructions TEXT DEFAULT '',
  deadline DATE,
  chapter_count INTEGER,
  word_count INTEGER,
  status public.order_status NOT NULL DEFAULT 'pending',
  payment_received BOOLEAN NOT NULL DEFAULT false,
  amount NUMERIC(12,2) DEFAULT 0,
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.order_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  file_type public.file_type NOT NULL,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.order_files ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.payment_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL UNIQUE,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.payment_receipts ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL UNIQUE,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  admin_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  parttimer_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  parttimer_paid_at TIMESTAMPTZ,
  parttimer_receipt_path TEXT,
  parttimer_receipt_name TEXT
);
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.order_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL UNIQUE,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  testimony TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.order_ratings ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.parttimer_allowed_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parttimer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  service_type TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (parttimer_id, service_type)
);
ALTER TABLE public.parttimer_allowed_services ENABLE ROW LEVEL SECURITY;

-- ---------- Functions ----------
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role public.app_role;
  user_name TEXT;
  gcash_num TEXT;
  gcash_nm TEXT;
  as_parttimer BOOLEAN;
BEGIN
  as_parttimer := COALESCE((NEW.raw_user_meta_data->>'signup_as_parttimer')::boolean, false);

  IF as_parttimer THEN
    gcash_num := NEW.raw_user_meta_data->>'gcash_number';
    gcash_nm := NEW.raw_user_meta_data->>'gcash_name';
  END IF;

  INSERT INTO public.profiles (user_id, full_name, email, gcash_number, gcash_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), NEW.email, gcash_num, gcash_nm);

  user_name := COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email);
  IF as_parttimer THEN
    user_role := 'pending_parttimer'::public.app_role;
  ELSE
    user_role := 'client'::public.app_role;
  END IF;

  INSERT INTO public.user_roles (user_id, role, name)
  VALUES (NEW.id, user_role, user_name);

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.approve_pending_parttimer(_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can approve part-timers';
  END IF;
  DELETE FROM public.user_roles WHERE user_id = _user_id AND role = 'pending_parttimer';
  INSERT INTO public.user_roles (user_id, role, name)
  SELECT _user_id, 'parttimer'::public.app_role, COALESCE((SELECT full_name FROM public.profiles WHERE user_id = _user_id), 'Part-timer');
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_pending_parttimer(_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can reject part-timer applications';
  END IF;
  DELETE FROM public.user_roles WHERE user_id = _user_id AND role = 'pending_parttimer';
  INSERT INTO public.user_roles (user_id, role, name)
  SELECT _user_id, 'client'::public.app_role, COALESCE((SELECT full_name FROM public.profiles WHERE user_id = _user_id), 'Client')
  ON CONFLICT (user_id, role) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_parttimer(_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can remove part-timers';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'parttimer'
  ) THEN
    RAISE EXCEPTION 'User is not a part-timer';
  END IF;

  DELETE FROM public.parttimer_allowed_services WHERE parttimer_id = _user_id;
  DELETE FROM public.user_roles WHERE user_id = _user_id AND role = 'parttimer';

  INSERT INTO public.user_roles (user_id, role, name)
  SELECT _user_id, 'client'::public.app_role, COALESCE((SELECT full_name FROM public.profiles WHERE user_id = _user_id), 'Client')
  ON CONFLICT (user_id, role) DO NOTHING;

  UPDATE public.orders
  SET assigned_to = NULL, status = 'pending'
  WHERE assigned_to = _user_id AND status = 'in_progress';
END;
$$;

GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.approve_pending_parttimer(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_pending_parttimer(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_parttimer(UUID) TO authenticated;

-- ---------- Triggers ----------
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ---------- RLS ----------
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can view profiles" ON public.profiles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'parttimer'));
CREATE POLICY "Anon read profiles with testimonials" ON public.profiles FOR SELECT TO anon
  USING (
    user_id IN (
      SELECT user_id FROM public.orders
      WHERE id IN (SELECT order_id FROM public.order_ratings WHERE testimony IS NOT NULL)
    )
  );

CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Clients see own orders" ON public.orders FOR SELECT TO authenticated
  USING (
    user_id = auth.uid() OR
    public.has_role(auth.uid(), 'admin') OR
    (
      public.has_role(auth.uid(), 'parttimer') AND
      (assigned_to IS NULL OR assigned_to = auth.uid())
    )
  );
CREATE POLICY "Anon read orders with testimonials" ON public.orders FOR SELECT TO anon
  USING (id IN (SELECT order_id FROM public.order_ratings WHERE testimony IS NOT NULL));
CREATE POLICY "Clients create own orders" ON public.orders FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admins update orders" ON public.orders FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Parttimers update assigned orders" ON public.orders FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'parttimer') AND
    (assigned_to IS NULL OR assigned_to = auth.uid())
  );
CREATE POLICY "Admins delete orders" ON public.orders FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Clients delete own pending orders" ON public.orders FOR DELETE TO authenticated
  USING (user_id = auth.uid() AND status = 'pending');

CREATE POLICY "View order files" ON public.order_files FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    order_id IN (SELECT id FROM public.orders WHERE user_id = auth.uid()) OR
    (
      public.has_role(auth.uid(), 'parttimer') AND
      order_id IN (
        SELECT id FROM public.orders
        WHERE assigned_to IS NULL OR assigned_to = auth.uid()
      )
    )
  );
CREATE POLICY "Upload input files" ON public.order_files FOR INSERT TO authenticated
  WITH CHECK (
    (uploaded_by = auth.uid() AND file_type = 'input' AND order_id IN (SELECT id FROM public.orders WHERE user_id = auth.uid()))
    OR (uploaded_by = auth.uid() AND file_type = 'output' AND public.has_role(auth.uid(), 'admin'))
    OR (uploaded_by = auth.uid() AND file_type = 'output' AND public.has_role(auth.uid(), 'parttimer') AND order_id IN (SELECT id FROM public.orders WHERE assigned_to = auth.uid()))
  );
CREATE POLICY "Delete files" ON public.order_files FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR uploaded_by = auth.uid());

CREATE POLICY "Clients insert own receipt" ON public.payment_receipts FOR INSERT TO authenticated
  WITH CHECK (
    order_id IN (SELECT id FROM public.orders WHERE user_id = auth.uid() AND status = 'completed' AND payment_received = false)
  );
CREATE POLICY "Clients update own receipt" ON public.payment_receipts FOR UPDATE TO authenticated
  USING (order_id IN (SELECT id FROM public.orders WHERE user_id = auth.uid()));
CREATE POLICY "Clients view own receipts" ON public.payment_receipts FOR SELECT TO authenticated
  USING (order_id IN (SELECT id FROM public.orders WHERE user_id = auth.uid()));
CREATE POLICY "Admins view all receipts" ON public.payment_receipts FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins view all transactions" ON public.transactions FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins insert transactions" ON public.transactions FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update transactions" ON public.transactions FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Parttimers view own transactions" ON public.transactions FOR SELECT TO authenticated
  USING (assigned_to = auth.uid());

CREATE POLICY "Clients insert own rating" ON public.order_ratings FOR INSERT TO authenticated
  WITH CHECK (
    order_id IN (SELECT id FROM public.orders WHERE user_id = auth.uid() AND status = 'completed' AND payment_received = true)
  );
CREATE POLICY "Clients update own rating" ON public.order_ratings FOR UPDATE TO authenticated
  USING (order_id IN (SELECT id FROM public.orders WHERE user_id = auth.uid()));
CREATE POLICY "Read ratings anon" ON public.order_ratings FOR SELECT TO anon USING (true);
CREATE POLICY "Read ratings authenticated" ON public.order_ratings FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage parttimer services" ON public.parttimer_allowed_services
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Parttimers read own services" ON public.parttimer_allowed_services
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'parttimer') AND parttimer_id = auth.uid());

-- ---------- Storage ----------
INSERT INTO storage.buckets (id, name, public) VALUES
  ('input-files', 'input-files', false),
  ('output-files', 'output-files', false),
  ('payment-receipts', 'payment-receipts', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Clients upload input files" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'input-files' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users view own input files" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'input-files' AND (
      auth.uid()::text = (storage.foldername(name))[1] OR
      public.has_role(auth.uid(), 'admin') OR
      (
        public.has_role(auth.uid(), 'parttimer') AND
        (storage.foldername(name))[2] IN (
          SELECT id::text FROM public.orders
          WHERE assigned_to IS NULL OR assigned_to = auth.uid()
        )
      )
    )
  );
CREATE POLICY "Users delete own input files" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'input-files' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.has_role(auth.uid(), 'admin')));

CREATE POLICY "Admins upload output files" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'output-files' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'parttimer')));
CREATE POLICY "View output files" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'output-files' AND (
      public.has_role(auth.uid(), 'admin') OR
      auth.uid()::text = (storage.foldername(name))[1] OR
      (
        public.has_role(auth.uid(), 'parttimer') AND
        (storage.foldername(name))[2] IN (
          SELECT id::text FROM public.orders WHERE assigned_to = auth.uid()
        )
      )
    )
  );
CREATE POLICY "Admins delete output files" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'output-files' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Clients upload receipt" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'payment-receipts' AND
    (storage.foldername(name))[1] IN (SELECT id::text FROM public.orders WHERE user_id = auth.uid() AND status = 'completed' AND payment_received = false)
  );
CREATE POLICY "Clients read own receipt" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'payment-receipts' AND
    ((storage.foldername(name))[1] IN (SELECT id::text FROM public.orders WHERE user_id = auth.uid()) OR public.has_role(auth.uid(), 'admin'))
  );
CREATE POLICY "Admins read receipts" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'payment-receipts' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins upload parttimer receipt" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'payment-receipts' AND
    (storage.foldername(name))[1] = 'admin-to-parttimer' AND
    public.has_role(auth.uid(), 'admin')
  );
CREATE POLICY "Parttimers read own payment receipt" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'payment-receipts' AND
    (storage.foldername(name))[1] = 'admin-to-parttimer' AND
    (storage.foldername(name))[2] IN (SELECT id::text FROM public.transactions WHERE assigned_to = auth.uid())
  );

-- ---------- Decoy roles (run after creating auth users) ----------
INSERT INTO public.user_roles (user_id, role, name)
SELECT id, 'admin'::public.app_role, 'Decoy Admin'
FROM auth.users
WHERE email = 'admin@decoy.local'
ON CONFLICT (user_id, role) DO NOTHING;

INSERT INTO public.user_roles (user_id, role, name)
SELECT id, 'client'::public.app_role, 'Decoy Client'
FROM auth.users
WHERE email = 'client@decoy.local'
ON CONFLICT (user_id, role) DO NOTHING;
