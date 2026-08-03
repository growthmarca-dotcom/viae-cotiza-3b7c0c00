-- v1.10.2 Fase A — Conexión Inventario Global + Motor de Disponibilidad (solo estructura)

CREATE TYPE public.availability_quantity_type AS ENUM ('capacity','units','seats','rooms','vehicles','slots');
CREATE TYPE public.product_availability_mode AS ENUM ('calendar','request','external');
CREATE TYPE public.product_availability_status AS ENUM ('draft','active','inactive');
CREATE TYPE public.product_availability_rule_type AS ENUM ('weekly','date_range','blackout','minimum_stay','minimum_notice');

-- 1) availability_sources: referencia opcional al catálogo comercial
ALTER TABLE public.availability_sources
  ADD COLUMN product_id uuid NULL REFERENCES public.products(id) ON DELETE CASCADE,
  ADD COLUMN product_variant_id uuid NULL REFERENCES public.product_variants(id) ON DELETE CASCADE;

CREATE INDEX idx_availability_sources_product ON public.availability_sources(product_id);
CREATE INDEX idx_availability_sources_variant ON public.availability_sources(product_variant_id);

-- 2) service_availability: referencia opcional al catálogo + granularidad de cupo
ALTER TABLE public.service_availability
  ADD COLUMN product_id uuid NULL REFERENCES public.products(id) ON DELETE CASCADE,
  ADD COLUMN product_variant_id uuid NULL REFERENCES public.product_variants(id) ON DELETE CASCADE,
  ADD COLUMN availability_type public.availability_quantity_type NOT NULL DEFAULT 'capacity',
  ADD COLUMN available_quantity numeric NULL,
  ADD COLUMN minimum_quantity numeric NULL,
  ADD COLUMN maximum_quantity numeric NULL,
  ADD COLUMN booking_cutoff_hours integer NULL,
  ADD COLUMN metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

-- El servicio pasa a ser opcional sólo cuando la fila describe un producto del catálogo
ALTER TABLE public.service_availability ALTER COLUMN service_id DROP NOT NULL;
ALTER TABLE public.service_availability
  ADD CONSTRAINT service_availability_target_check
  CHECK (service_id IS NOT NULL OR product_id IS NOT NULL);

CREATE INDEX idx_service_availability_product ON public.service_availability(product_id);
CREATE INDEX idx_service_availability_variant ON public.service_availability(product_variant_id);

-- 3) Perfiles de disponibilidad por producto
CREATE TABLE public.product_availability_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  product_variant_id uuid NULL REFERENCES public.product_variants(id) ON DELETE CASCADE,
  name text NOT NULL,
  availability_mode public.product_availability_mode NOT NULL DEFAULT 'calendar',
  status public.product_availability_status NOT NULL DEFAULT 'draft',
  priority integer NOT NULL DEFAULT 100,
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_availability_profiles TO authenticated;
GRANT ALL ON public.product_availability_profiles TO service_role;
ALTER TABLE public.product_availability_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "product_availability_profiles_manage" ON public.product_availability_profiles
  FOR ALL TO authenticated
  USING (public.can_manage_product(product_id))
  WITH CHECK (public.can_manage_product(product_id));
CREATE POLICY "product_availability_profiles_staff_read" ON public.product_availability_profiles
  FOR SELECT TO authenticated
  USING (public.is_operations(auth.uid()) OR public.has_role(auth.uid(), 'agent'));

CREATE INDEX idx_product_availability_profiles_product ON public.product_availability_profiles(product_id);
CREATE INDEX idx_product_availability_profiles_variant ON public.product_availability_profiles(product_variant_id);

CREATE TRIGGER trg_product_availability_profiles_updated_at
  BEFORE UPDATE ON public.product_availability_profiles
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Helper de permisos por perfil de disponibilidad
CREATE OR REPLACE FUNCTION public.can_manage_availability_profile(_profile_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.product_availability_profiles p
    WHERE p.id = _profile_id AND public.can_manage_product(p.product_id)
  )
$$;

-- 4) Reglas de calendario
CREATE TABLE public.product_availability_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  availability_profile_id uuid NOT NULL REFERENCES public.product_availability_profiles(id) ON DELETE CASCADE,
  rule_type public.product_availability_rule_type NOT NULL,
  day_of_week integer NULL,
  start_date date NULL,
  end_date date NULL,
  quantity numeric NULL,
  status public.product_availability_status NOT NULL DEFAULT 'active',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_availability_rules TO authenticated;
GRANT ALL ON public.product_availability_rules TO service_role;
ALTER TABLE public.product_availability_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "product_availability_rules_manage" ON public.product_availability_rules
  FOR ALL TO authenticated
  USING (public.can_manage_availability_profile(availability_profile_id))
  WITH CHECK (public.can_manage_availability_profile(availability_profile_id));
CREATE POLICY "product_availability_rules_staff_read" ON public.product_availability_rules
  FOR SELECT TO authenticated
  USING (public.is_operations(auth.uid()) OR public.has_role(auth.uid(), 'agent'));

CREATE INDEX idx_product_availability_rules_profile ON public.product_availability_rules(availability_profile_id);
CREATE INDEX idx_product_availability_rules_type ON public.product_availability_rules(rule_type);

CREATE TRIGGER trg_product_availability_rules_updated_at
  BEFORE UPDATE ON public.product_availability_rules
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();