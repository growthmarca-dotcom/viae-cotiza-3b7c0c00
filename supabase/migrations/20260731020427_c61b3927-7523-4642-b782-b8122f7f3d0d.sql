-- 1. Roles
CREATE TYPE public.app_role AS ENUM ('admin', 'agent', 'provider');
CREATE TYPE public.account_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE public.opportunity_status AS ENUM ('new', 'contacted', 'quoted', 'negotiating', 'won', 'lost');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE POLICY "own roles select" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "admins read all roles" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins manage roles" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 2. Estado de aprobación en profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS status public.account_status NOT NULL DEFAULT 'pending';

CREATE OR REPLACE FUNCTION public.is_approved(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id AND status = 'approved');
$$;

CREATE POLICY "admins read all profiles" ON public.profiles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins update all profiles" ON public.profiles FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Asignar rol de agente por defecto al registrarse (queda pendiente de aprobación)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, agency_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'agency_name')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'agent')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;

-- 3. Base CRM en clients
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS destination text,
  ADD COLUMN IF NOT EXISTS travel_start date,
  ADD COLUMN IF NOT EXISTS travel_end date,
  ADD COLUMN IF NOT EXISTS pax_count integer,
  ADD COLUMN IF NOT EXISTS opportunity_status public.opportunity_status NOT NULL DEFAULT 'new';

CREATE UNIQUE INDEX IF NOT EXISTS clients_user_email_key
  ON public.clients (user_id, lower(email)) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS clients_user_phone_key
  ON public.clients (user_id, phone) WHERE phone IS NOT NULL AND email IS NULL;

CREATE POLICY "admins read all clients" ON public.clients FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins read all quotations" ON public.quotations FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 4. Solo cuentas aprobadas (o admins) pueden operar sus propios datos
DROP POLICY IF EXISTS "own clients all" ON public.clients;
CREATE POLICY "own clients all" ON public.clients FOR ALL TO authenticated
  USING (auth.uid() = user_id AND (public.is_approved(auth.uid()) OR public.has_role(auth.uid(), 'admin')))
  WITH CHECK (auth.uid() = user_id AND (public.is_approved(auth.uid()) OR public.has_role(auth.uid(), 'admin')));

DROP POLICY IF EXISTS "own quotations all" ON public.quotations;
CREATE POLICY "own quotations all" ON public.quotations FOR ALL TO authenticated
  USING (auth.uid() = user_id AND (public.is_approved(auth.uid()) OR public.has_role(auth.uid(), 'admin')))
  WITH CHECK (auth.uid() = user_id AND (public.is_approved(auth.uid()) OR public.has_role(auth.uid(), 'admin')));