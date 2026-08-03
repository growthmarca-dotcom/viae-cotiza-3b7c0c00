-- ENUMS
CREATE TYPE public.orchestrator_rule_type AS ENUM ('priority','compatibility','exclusion','preference','package');
CREATE TYPE public.orchestrator_rule_scope AS ENUM ('global','destination','product_category','provider');
CREATE TYPE public.package_composition_status AS ENUM ('draft','generated','selected','rejected');
CREATE TYPE public.package_component_type AS ENUM ('accommodation','activity','transfer','rental','other');
CREATE TYPE public.provider_preference_type AS ENUM ('preferred','blocked','priority','commission','quality');

-- 1. orchestrator_rules
CREATE TABLE public.orchestrator_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  rule_type public.orchestrator_rule_type NOT NULL,
  scope public.orchestrator_rule_scope NOT NULL DEFAULT 'global',
  priority integer NOT NULL DEFAULT 100,
  active boolean NOT NULL DEFAULT true,
  conditions jsonb NOT NULL DEFAULT '{}'::jsonb,
  actions jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orchestrator_rules TO authenticated;
GRANT ALL ON public.orchestrator_rules TO service_role;
ALTER TABLE public.orchestrator_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage orchestrator rules" ON public.orchestrator_rules
FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Staff read orchestrator rules" ON public.orchestrator_rules
FOR SELECT TO authenticated USING (public.is_operations(auth.uid()) OR user_id = auth.uid());

CREATE TRIGGER trg_orchestrator_rules_updated_at BEFORE UPDATE ON public.orchestrator_rules
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE INDEX idx_orchestrator_rules_org ON public.orchestrator_rules(organization_id);
CREATE INDEX idx_orchestrator_rules_type ON public.orchestrator_rules(rule_type);

-- 2. orchestrator_scores
CREATE TABLE public.orchestrator_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  search_request_id uuid NOT NULL REFERENCES public.search_requests(id) ON DELETE CASCADE,
  search_result_id uuid NOT NULL REFERENCES public.search_results(id) ON DELETE CASCADE,
  availability_score numeric,
  pricing_score numeric,
  provider_score numeric,
  quality_score numeric,
  final_score numeric,
  calculation_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orchestrator_scores TO authenticated;
GRANT ALL ON public.orchestrator_scores TO service_role;
ALTER TABLE public.orchestrator_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read orchestrator scores" ON public.orchestrator_scores
FOR SELECT TO authenticated USING (
  public.can_read_search_request(search_request_id)
  OR public.can_read_search_result(search_result_id)
);
CREATE POLICY "Manage orchestrator scores" ON public.orchestrator_scores
FOR ALL TO authenticated USING (public.can_manage_search_request(search_request_id)) WITH CHECK (public.can_manage_search_request(search_request_id));

CREATE INDEX idx_orchestrator_scores_request ON public.orchestrator_scores(search_request_id);
CREATE INDEX idx_orchestrator_scores_result ON public.orchestrator_scores(search_result_id);

-- 3. package_compositions
CREATE TABLE public.package_compositions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  search_request_id uuid NOT NULL REFERENCES public.search_requests(id) ON DELETE CASCADE,
  name text,
  status public.package_composition_status NOT NULL DEFAULT 'draft',
  total_amount numeric,
  currency text,
  score numeric,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.package_compositions TO authenticated;
GRANT ALL ON public.package_compositions TO service_role;
ALTER TABLE public.package_compositions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read package compositions" ON public.package_compositions
FOR SELECT TO authenticated USING (public.can_read_search_request(search_request_id));
CREATE POLICY "Manage package compositions" ON public.package_compositions
FOR ALL TO authenticated USING (public.can_manage_search_request(search_request_id)) WITH CHECK (public.can_manage_search_request(search_request_id));

CREATE TRIGGER trg_package_compositions_updated_at BEFORE UPDATE ON public.package_compositions
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE INDEX idx_package_compositions_request ON public.package_compositions(search_request_id);

CREATE OR REPLACE FUNCTION public.can_read_package(_package_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.package_compositions p
    WHERE p.id = _package_id AND public.can_read_search_request(p.search_request_id)
  )
$$;

CREATE OR REPLACE FUNCTION public.can_manage_package(_package_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.package_compositions p
    WHERE p.id = _package_id AND public.can_manage_search_request(p.search_request_id)
  )
$$;

-- 4. package_components
CREATE TABLE public.package_components (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES public.package_compositions(id) ON DELETE CASCADE,
  search_result_id uuid NOT NULL REFERENCES public.search_results(id) ON DELETE CASCADE,
  component_type public.package_component_type NOT NULL DEFAULT 'other',
  order_index integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.package_components TO authenticated;
GRANT ALL ON public.package_components TO service_role;
ALTER TABLE public.package_components ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read package components" ON public.package_components
FOR SELECT TO authenticated USING (
  public.can_read_package(package_id)
  OR public.can_read_search_result(search_result_id)
);
CREATE POLICY "Manage package components" ON public.package_components
FOR ALL TO authenticated USING (public.can_manage_package(package_id)) WITH CHECK (public.can_manage_package(package_id));

CREATE INDEX idx_package_components_package ON public.package_components(package_id);
CREATE INDEX idx_package_components_result ON public.package_components(search_result_id);

-- 5. provider_preferences
CREATE TABLE public.provider_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider_id uuid REFERENCES public.providers(id) ON DELETE CASCADE,
  preference_type public.provider_preference_type NOT NULL,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.provider_preferences TO authenticated;
GRANT ALL ON public.provider_preferences TO service_role;
ALTER TABLE public.provider_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage provider preferences" ON public.provider_preferences
FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Staff read provider preferences" ON public.provider_preferences
FOR SELECT TO authenticated USING (public.is_operations(auth.uid()) OR user_id = auth.uid());

CREATE TRIGGER trg_provider_preferences_updated_at BEFORE UPDATE ON public.provider_preferences
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE INDEX idx_provider_preferences_org ON public.provider_preferences(organization_id);