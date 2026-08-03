-- ENUMS
CREATE TYPE public.package_template_status AS ENUM ('draft','active','inactive','archived');
CREATE TYPE public.package_item_component_type AS ENUM ('accommodation','activity','excursion','transfer','rental','other');
CREATE TYPE public.package_rule_type AS ENUM ('compatibility','exclusion','requirement','recommendation','upgrade');
CREATE TYPE public.package_constraint_type AS ENUM ('budget','age','duration','destination','availability','provider');
CREATE TYPE public.package_constraint_operator AS ENUM ('equals','greater_than','less_than','between');
CREATE TYPE public.package_version_status AS ENUM ('draft','published','retired');

-- 1. package_templates
CREATE TABLE public.package_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  destination_country text,
  destination_state text,
  destination_city text,
  duration_days integer,
  status public.package_template_status NOT NULL DEFAULT 'draft',
  priority integer NOT NULL DEFAULT 100,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.package_templates TO authenticated;
GRANT ALL ON public.package_templates TO service_role;
ALTER TABLE public.package_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage package templates" ON public.package_templates
FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Owners manage own package templates" ON public.package_templates
FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TRIGGER trg_package_templates_updated_at BEFORE UPDATE ON public.package_templates
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE INDEX idx_package_templates_org ON public.package_templates(organization_id);
CREATE INDEX idx_package_templates_status ON public.package_templates(status);

-- 2. package_template_items
CREATE TABLE public.package_template_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_template_id uuid NOT NULL REFERENCES public.package_templates(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  product_variant_id uuid REFERENCES public.product_variants(id) ON DELETE SET NULL,
  component_type public.package_item_component_type NOT NULL DEFAULT 'other',
  required boolean NOT NULL DEFAULT false,
  quantity numeric NOT NULL DEFAULT 1,
  order_index integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.package_template_items TO authenticated;
GRANT ALL ON public.package_template_items TO service_role;
ALTER TABLE public.package_template_items ENABLE ROW LEVEL SECURITY;

-- helpers (declarados luego de package_template_items, que consultan)
CREATE OR REPLACE FUNCTION public.provider_in_package_template(_template_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.package_template_items i
    WHERE i.package_template_id = _template_id
      AND public.can_manage_product(i.product_id)
  )
$$;

CREATE OR REPLACE FUNCTION public.can_read_package_template(_template_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.package_templates t
    WHERE t.id = _template_id
      AND (
        t.user_id = auth.uid()
        OR public.has_role(auth.uid(),'admin')
        OR public.is_operations(auth.uid())
        OR public.has_role(auth.uid(),'agent')
        OR public.provider_in_package_template(t.id)
      )
  )
$$;

CREATE OR REPLACE FUNCTION public.can_manage_package_template(_template_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.package_templates t
    WHERE t.id = _template_id
      AND (t.user_id = auth.uid() OR public.has_role(auth.uid(),'admin'))
  )
$$;

CREATE POLICY "Staff read package templates" ON public.package_templates
FOR SELECT TO authenticated USING (
  public.is_operations(auth.uid())
  OR public.has_role(auth.uid(),'agent')
  OR public.provider_in_package_template(id)
);

CREATE POLICY "Read package template items" ON public.package_template_items
FOR SELECT TO authenticated USING (
  public.can_read_package_template(package_template_id)
  OR public.can_manage_product(product_id)
);
CREATE POLICY "Manage package template items" ON public.package_template_items
FOR ALL TO authenticated USING (public.can_manage_package_template(package_template_id)) WITH CHECK (public.can_manage_package_template(package_template_id));

CREATE INDEX idx_package_template_items_template ON public.package_template_items(package_template_id);
CREATE INDEX idx_package_template_items_product ON public.package_template_items(product_id);

-- 3. package_rules
CREATE TABLE public.package_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_template_id uuid NOT NULL REFERENCES public.package_templates(id) ON DELETE CASCADE,
  rule_type public.package_rule_type NOT NULL,
  condition jsonb NOT NULL DEFAULT '{}'::jsonb,
  action jsonb NOT NULL DEFAULT '{}'::jsonb,
  priority integer NOT NULL DEFAULT 100,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.package_rules TO authenticated;
GRANT ALL ON public.package_rules TO service_role;
ALTER TABLE public.package_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read package rules" ON public.package_rules
FOR SELECT TO authenticated USING (public.can_read_package_template(package_template_id));
CREATE POLICY "Manage package rules" ON public.package_rules
FOR ALL TO authenticated USING (public.can_manage_package_template(package_template_id)) WITH CHECK (public.can_manage_package_template(package_template_id));

CREATE TRIGGER trg_package_rules_updated_at BEFORE UPDATE ON public.package_rules
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE INDEX idx_package_rules_template ON public.package_rules(package_template_id);

-- 4. package_constraints
CREATE TABLE public.package_constraints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_template_id uuid NOT NULL REFERENCES public.package_templates(id) ON DELETE CASCADE,
  constraint_type public.package_constraint_type NOT NULL,
  operator public.package_constraint_operator NOT NULL DEFAULT 'equals',
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.package_constraints TO authenticated;
GRANT ALL ON public.package_constraints TO service_role;
ALTER TABLE public.package_constraints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read package constraints" ON public.package_constraints
FOR SELECT TO authenticated USING (public.can_read_package_template(package_template_id));
CREATE POLICY "Manage package constraints" ON public.package_constraints
FOR ALL TO authenticated USING (public.can_manage_package_template(package_template_id)) WITH CHECK (public.can_manage_package_template(package_template_id));

CREATE INDEX idx_package_constraints_template ON public.package_constraints(package_template_id);

-- 5. package_versions
CREATE TABLE public.package_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_template_id uuid NOT NULL REFERENCES public.package_templates(id) ON DELETE CASCADE,
  version integer NOT NULL DEFAULT 1,
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  status public.package_version_status NOT NULL DEFAULT 'draft',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (package_template_id, version)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.package_versions TO authenticated;
GRANT ALL ON public.package_versions TO service_role;
ALTER TABLE public.package_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read package versions" ON public.package_versions
FOR SELECT TO authenticated USING (public.can_read_package_template(package_template_id));
CREATE POLICY "Manage package versions" ON public.package_versions
FOR ALL TO authenticated USING (public.can_manage_package_template(package_template_id)) WITH CHECK (public.can_manage_package_template(package_template_id));

CREATE INDEX idx_package_versions_template ON public.package_versions(package_template_id);