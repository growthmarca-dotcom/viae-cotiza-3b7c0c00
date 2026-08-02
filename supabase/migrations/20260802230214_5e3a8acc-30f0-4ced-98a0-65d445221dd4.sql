-- ============================================================
-- v1.9.6 Fase 0 — Motor Tarifario Multiproveedor (solo estructura)
-- No calcula precios. No modifica reservas, cotizaciones,
-- transporte ni comisiones.
-- ============================================================

DO $$ BEGIN
  CREATE TYPE public.tariff_status AS ENUM ('draft','active','inactive','archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.tariff_season_type AS ENUM ('high','mid','low','special');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.tariff_condition_type AS ENUM (
    'nights','operating_days','min_advance_days','group_size','promotion','restriction','other'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ------------------------------------------------------------
-- 1) passenger_categories — catálogo con edades configurables
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.passenger_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  code text NOT NULL,
  label text NOT NULL,
  passenger_type public.passenger_type,
  min_age integer,
  max_age integer,
  occupies_seat boolean NOT NULL DEFAULT true,
  is_free boolean NOT NULL DEFAULT false,
  requires_document boolean NOT NULL DEFAULT false,
  notes text,
  sort_order integer NOT NULL DEFAULT 0,
  status public.tariff_status NOT NULL DEFAULT 'active',
  record_status public.record_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT passenger_categories_age_range CHECK (min_age IS NULL OR max_age IS NULL OR max_age >= min_age)
);
CREATE UNIQUE INDEX IF NOT EXISTS passenger_categories_owner_code_idx
  ON public.passenger_categories(user_id, code);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.passenger_categories TO authenticated;
GRANT ALL ON public.passenger_categories TO service_role;
ALTER TABLE public.passenger_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "passenger_categories_admin_all" ON public.passenger_categories
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "passenger_categories_staff_read" ON public.passenger_categories
  FOR SELECT TO authenticated
  USING (
    public.is_operations(auth.uid())
    OR public.has_role(auth.uid(), 'agent')
    OR user_id = auth.uid()
  );

-- ------------------------------------------------------------
-- 2) tariff_seasons — rangos de fechas reutilizables
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tariff_seasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  name text NOT NULL,
  season_type public.tariff_season_type NOT NULL DEFAULT 'mid',
  date_from date NOT NULL,
  date_to date NOT NULL,
  priority integer NOT NULL DEFAULT 0,
  notes text,
  status public.tariff_status NOT NULL DEFAULT 'active',
  record_status public.record_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tariff_seasons_range CHECK (date_to >= date_from)
);
CREATE INDEX IF NOT EXISTS tariff_seasons_owner_idx ON public.tariff_seasons(user_id);
CREATE INDEX IF NOT EXISTS tariff_seasons_dates_idx ON public.tariff_seasons(date_from, date_to);
CREATE INDEX IF NOT EXISTS tariff_seasons_org_idx ON public.tariff_seasons(organization_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tariff_seasons TO authenticated;
GRANT ALL ON public.tariff_seasons TO service_role;
ALTER TABLE public.tariff_seasons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tariff_seasons_admin_all" ON public.tariff_seasons
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "tariff_seasons_staff_read" ON public.tariff_seasons
  FOR SELECT TO authenticated
  USING (
    public.is_operations(auth.uid())
    OR public.has_role(auth.uid(), 'agent')
    OR user_id = auth.uid()
  );

CREATE POLICY "tariff_seasons_provider_read" ON public.tariff_seasons
  FOR SELECT TO authenticated
  USING (
    organization_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.providers p
      WHERE p.organization_id = tariff_seasons.organization_id
        AND p.user_id = auth.uid()
    )
  );

-- ------------------------------------------------------------
-- 3) tariff_plans — plan tarifario de un servicio
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tariff_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  provider_id uuid REFERENCES public.providers(id) ON DELETE SET NULL,
  resource_id uuid REFERENCES public.resources(id) ON DELETE SET NULL,
  service_kind public.booking_service_kind,
  transport_service_type public.transport_service_type,
  title text NOT NULL,
  description text,
  currency text NOT NULL DEFAULT 'ARS',
  valid_from date,
  valid_until date,
  priority integer NOT NULL DEFAULT 0,
  version integer NOT NULL DEFAULT 1,
  status public.tariff_status NOT NULL DEFAULT 'draft',
  record_status public.record_status NOT NULL DEFAULT 'active',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tariff_plans_validity CHECK (valid_until IS NULL OR valid_from IS NULL OR valid_until >= valid_from)
);
CREATE INDEX IF NOT EXISTS tariff_plans_owner_idx ON public.tariff_plans(user_id);
CREATE INDEX IF NOT EXISTS tariff_plans_org_idx ON public.tariff_plans(organization_id);
CREATE INDEX IF NOT EXISTS tariff_plans_resource_idx ON public.tariff_plans(resource_id);
CREATE INDEX IF NOT EXISTS tariff_plans_status_idx ON public.tariff_plans(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tariff_plans TO authenticated;
GRANT ALL ON public.tariff_plans TO service_role;
ALTER TABLE public.tariff_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tariff_plans_admin_all" ON public.tariff_plans
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "tariff_plans_ops_read" ON public.tariff_plans
  FOR SELECT TO authenticated
  USING (public.is_operations(auth.uid()) OR user_id = auth.uid());

CREATE POLICY "tariff_plans_agent_read" ON public.tariff_plans
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'agent') AND status = 'active' AND record_status = 'active');

CREATE POLICY "tariff_plans_provider_manage" ON public.tariff_plans
  FOR ALL TO authenticated
  USING (
    organization_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.providers p
      WHERE p.organization_id = tariff_plans.organization_id
        AND p.user_id = auth.uid()
    )
  )
  WITH CHECK (
    organization_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.providers p
      WHERE p.organization_id = tariff_plans.organization_id
        AND p.user_id = auth.uid()
    )
  );

-- ------------------------------------------------------------
-- 4) tariff_rules — precio por temporada / categoría / ocupación
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tariff_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  plan_id uuid NOT NULL REFERENCES public.tariff_plans(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  season_id uuid REFERENCES public.tariff_seasons(id) ON DELETE SET NULL,
  passenger_category_id uuid REFERENCES public.passenger_categories(id) ON DELETE SET NULL,
  resource_id uuid REFERENCES public.resources(id) ON DELETE SET NULL,
  service_kind public.booking_service_kind,
  transport_service_type public.transport_service_type,
  label text,
  occupancy integer,
  min_quantity integer,
  max_quantity integer,
  currency text NOT NULL DEFAULT 'ARS',
  price numeric(14,2),
  priority integer NOT NULL DEFAULT 0,
  valid_from date,
  valid_until date,
  status public.tariff_status NOT NULL DEFAULT 'active',
  record_status public.record_status NOT NULL DEFAULT 'active',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tariff_rules_quantity CHECK (min_quantity IS NULL OR max_quantity IS NULL OR max_quantity >= min_quantity),
  CONSTRAINT tariff_rules_validity CHECK (valid_until IS NULL OR valid_from IS NULL OR valid_until >= valid_from),
  CONSTRAINT tariff_rules_price_positive CHECK (price IS NULL OR price >= 0),
  CONSTRAINT tariff_rules_occupancy_positive CHECK (occupancy IS NULL OR occupancy > 0)
);
CREATE INDEX IF NOT EXISTS tariff_rules_plan_idx ON public.tariff_rules(plan_id);
CREATE INDEX IF NOT EXISTS tariff_rules_season_idx ON public.tariff_rules(season_id);
CREATE INDEX IF NOT EXISTS tariff_rules_category_idx ON public.tariff_rules(passenger_category_id);
CREATE INDEX IF NOT EXISTS tariff_rules_owner_idx ON public.tariff_rules(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tariff_rules TO authenticated;
GRANT ALL ON public.tariff_rules TO service_role;
ALTER TABLE public.tariff_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tariff_rules_admin_all" ON public.tariff_rules
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "tariff_rules_ops_read" ON public.tariff_rules
  FOR SELECT TO authenticated
  USING (public.is_operations(auth.uid()) OR user_id = auth.uid());

CREATE POLICY "tariff_rules_agent_read" ON public.tariff_rules
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'agent')
    AND status = 'active' AND record_status = 'active'
    AND EXISTS (
      SELECT 1 FROM public.tariff_plans tp
      WHERE tp.id = tariff_rules.plan_id AND tp.status = 'active' AND tp.record_status = 'active'
    )
  );

CREATE POLICY "tariff_rules_provider_manage" ON public.tariff_rules
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tariff_plans tp
      JOIN public.providers p ON p.organization_id = tp.organization_id
      WHERE tp.id = tariff_rules.plan_id AND p.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tariff_plans tp
      JOIN public.providers p ON p.organization_id = tp.organization_id
      WHERE tp.id = tariff_rules.plan_id AND p.user_id = auth.uid()
    )
  );

-- ------------------------------------------------------------
-- 5) tariff_rule_conditions — condiciones futuras (solo estructura)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tariff_rule_conditions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  rule_id uuid NOT NULL REFERENCES public.tariff_rules(id) ON DELETE CASCADE,
  condition_type public.tariff_condition_type NOT NULL,
  operator text NOT NULL DEFAULT 'eq',
  value_numeric numeric(14,2),
  value_text text,
  value_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_restriction boolean NOT NULL DEFAULT false,
  priority integer NOT NULL DEFAULT 0,
  notes text,
  status public.tariff_status NOT NULL DEFAULT 'active',
  record_status public.record_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tariff_rule_conditions_operator CHECK (operator IN ('eq','neq','gt','gte','lt','lte','between','in','not_in'))
);
CREATE INDEX IF NOT EXISTS tariff_rule_conditions_rule_idx ON public.tariff_rule_conditions(rule_id);
CREATE INDEX IF NOT EXISTS tariff_rule_conditions_type_idx ON public.tariff_rule_conditions(condition_type);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tariff_rule_conditions TO authenticated;
GRANT ALL ON public.tariff_rule_conditions TO service_role;
ALTER TABLE public.tariff_rule_conditions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tariff_rule_conditions_admin_all" ON public.tariff_rule_conditions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "tariff_rule_conditions_ops_read" ON public.tariff_rule_conditions
  FOR SELECT TO authenticated
  USING (public.is_operations(auth.uid()) OR user_id = auth.uid());

CREATE POLICY "tariff_rule_conditions_agent_read" ON public.tariff_rule_conditions
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'agent')
    AND status = 'active' AND record_status = 'active'
    AND EXISTS (
      SELECT 1 FROM public.tariff_rules tr
      JOIN public.tariff_plans tp ON tp.id = tr.plan_id
      WHERE tr.id = tariff_rule_conditions.rule_id
        AND tr.status = 'active' AND tp.status = 'active'
    )
  );

CREATE POLICY "tariff_rule_conditions_provider_manage" ON public.tariff_rule_conditions
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tariff_rules tr
      JOIN public.tariff_plans tp ON tp.id = tr.plan_id
      JOIN public.providers p ON p.organization_id = tp.organization_id
      WHERE tr.id = tariff_rule_conditions.rule_id AND p.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tariff_rules tr
      JOIN public.tariff_plans tp ON tp.id = tr.plan_id
      JOIN public.providers p ON p.organization_id = tp.organization_id
      WHERE tr.id = tariff_rule_conditions.rule_id AND p.user_id = auth.uid()
    )
  );

-- ------------------------------------------------------------
-- updated_at + auditoría (reutiliza triggers existentes)
-- ------------------------------------------------------------
CREATE TRIGGER tg_passenger_categories_updated BEFORE UPDATE ON public.passenger_categories
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER tg_tariff_seasons_updated BEFORE UPDATE ON public.tariff_seasons
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER tg_tariff_plans_updated BEFORE UPDATE ON public.tariff_plans
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER tg_tariff_rules_updated BEFORE UPDATE ON public.tariff_rules
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER tg_tariff_rule_conditions_updated BEFORE UPDATE ON public.tariff_rule_conditions
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TRIGGER tg_tariff_plans_audit AFTER INSERT OR UPDATE OR DELETE ON public.tariff_plans
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit();
CREATE TRIGGER tg_tariff_rules_audit AFTER INSERT OR UPDATE OR DELETE ON public.tariff_rules
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit();

REVOKE ALL ON public.passenger_categories FROM anon;
REVOKE ALL ON public.tariff_seasons FROM anon;
REVOKE ALL ON public.tariff_plans FROM anon;
REVOKE ALL ON public.tariff_rules FROM anon;
REVOKE ALL ON public.tariff_rule_conditions FROM anon;