-- v1.10.1 Fase A — Motor de Reglas Tarifarias por Producto (solo estructura)

CREATE TYPE public.pricing_rule_type AS ENUM ('passenger','group','seasonal','fixed','percentage','supplement','discount');
CREATE TYPE public.pricing_passenger_type AS ENUM ('adult','child','infant','senior','any');
CREATE TYPE public.pricing_calculation_type AS ENUM ('fixed_amount','percentage','per_unit');
CREATE TYPE public.pricing_condition_type AS ENUM ('day_of_week','destination','booking_window','nationality','partner','organization');
CREATE TYPE public.pricing_condition_operator AS ENUM ('equals','between','greater_than','less_than');
CREATE TYPE public.pricing_profile_status AS ENUM ('draft','active','inactive','archived');

-- 1) Perfiles tarifarios
CREATE TABLE public.product_pricing_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  product_variant_id uuid NULL REFERENCES public.product_variants(id) ON DELETE CASCADE,
  name text NOT NULL,
  currency text NOT NULL DEFAULT 'ARS',
  status public.pricing_profile_status NOT NULL DEFAULT 'draft',
  valid_from date NULL,
  valid_until date NULL,
  priority integer NOT NULL DEFAULT 100,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_pricing_profiles TO authenticated;
GRANT ALL ON public.product_pricing_profiles TO service_role;
ALTER TABLE public.product_pricing_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pricing_profiles_manage" ON public.product_pricing_profiles
  FOR ALL TO authenticated
  USING (public.can_manage_product(product_id))
  WITH CHECK (public.can_manage_product(product_id));
CREATE POLICY "pricing_profiles_staff_read" ON public.product_pricing_profiles
  FOR SELECT TO authenticated
  USING (public.is_operations(auth.uid()) OR public.has_role(auth.uid(), 'agent'));

CREATE INDEX idx_pricing_profiles_product ON public.product_pricing_profiles(product_id);
CREATE INDEX idx_pricing_profiles_variant ON public.product_pricing_profiles(product_variant_id);
CREATE INDEX idx_pricing_profiles_status ON public.product_pricing_profiles(status);

CREATE TRIGGER trg_pricing_profiles_updated_at
  BEFORE UPDATE ON public.product_pricing_profiles
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Helper de permisos por perfil
CREATE OR REPLACE FUNCTION public.can_manage_pricing_profile(_profile_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.product_pricing_profiles p
    WHERE p.id = _profile_id AND public.can_manage_product(p.product_id)
  )
$$;

-- 2) Reglas de precio
CREATE TABLE public.pricing_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pricing_profile_id uuid NOT NULL REFERENCES public.product_pricing_profiles(id) ON DELETE CASCADE,
  rule_type public.pricing_rule_type NOT NULL,
  passenger_type public.pricing_passenger_type NOT NULL DEFAULT 'any',
  min_age integer NULL,
  max_age integer NULL,
  min_quantity integer NULL,
  max_quantity integer NULL,
  season_code text NULL,
  calculation_type public.pricing_calculation_type NOT NULL,
  value numeric NOT NULL DEFAULT 0,
  currency text NULL,
  priority integer NOT NULL DEFAULT 100,
  active boolean NOT NULL DEFAULT true,
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pricing_rules TO authenticated;
GRANT ALL ON public.pricing_rules TO service_role;
ALTER TABLE public.pricing_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pricing_rules_manage" ON public.pricing_rules
  FOR ALL TO authenticated
  USING (public.can_manage_pricing_profile(pricing_profile_id))
  WITH CHECK (public.can_manage_pricing_profile(pricing_profile_id));
CREATE POLICY "pricing_rules_staff_read" ON public.pricing_rules
  FOR SELECT TO authenticated
  USING (public.is_operations(auth.uid()) OR public.has_role(auth.uid(), 'agent'));

CREATE INDEX idx_pricing_rules_profile ON public.pricing_rules(pricing_profile_id);
CREATE INDEX idx_pricing_rules_type ON public.pricing_rules(rule_type);

CREATE TRIGGER trg_pricing_rules_updated_at
  BEFORE UPDATE ON public.pricing_rules
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 3) Grupos de pasajeros
CREATE TABLE public.passenger_pricing_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pricing_profile_id uuid NOT NULL REFERENCES public.product_pricing_profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  adult_min integer NULL,
  adult_max integer NULL,
  child_min integer NULL,
  child_max integer NULL,
  infant_min integer NULL,
  infant_max integer NULL,
  description text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.passenger_pricing_groups TO authenticated;
GRANT ALL ON public.passenger_pricing_groups TO service_role;
ALTER TABLE public.passenger_pricing_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "passenger_pricing_groups_manage" ON public.passenger_pricing_groups
  FOR ALL TO authenticated
  USING (public.can_manage_pricing_profile(pricing_profile_id))
  WITH CHECK (public.can_manage_pricing_profile(pricing_profile_id));
CREATE POLICY "passenger_pricing_groups_staff_read" ON public.passenger_pricing_groups
  FOR SELECT TO authenticated
  USING (public.is_operations(auth.uid()) OR public.has_role(auth.uid(), 'agent'));

CREATE INDEX idx_passenger_pricing_groups_profile ON public.passenger_pricing_groups(pricing_profile_id);

-- 4) Condiciones
CREATE TABLE public.pricing_conditions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pricing_profile_id uuid NOT NULL REFERENCES public.product_pricing_profiles(id) ON DELETE CASCADE,
  condition_type public.pricing_condition_type NOT NULL,
  operator public.pricing_condition_operator NOT NULL DEFAULT 'equals',
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pricing_conditions TO authenticated;
GRANT ALL ON public.pricing_conditions TO service_role;
ALTER TABLE public.pricing_conditions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pricing_conditions_manage" ON public.pricing_conditions
  FOR ALL TO authenticated
  USING (public.can_manage_pricing_profile(pricing_profile_id))
  WITH CHECK (public.can_manage_pricing_profile(pricing_profile_id));
CREATE POLICY "pricing_conditions_staff_read" ON public.pricing_conditions
  FOR SELECT TO authenticated
  USING (public.is_operations(auth.uid()) OR public.has_role(auth.uid(), 'agent'));

CREATE INDEX idx_pricing_conditions_profile ON public.pricing_conditions(pricing_profile_id);