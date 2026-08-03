-- ENUMS
CREATE TYPE public.smart_quote_source AS ENUM ('manual','orchestrator','package','external');
CREATE TYPE public.smart_quote_status AS ENUM ('draft','calculating','ready','sent','accepted','rejected','expired');
CREATE TYPE public.smart_quote_item_type AS ENUM ('accommodation','activity','excursion','transfer','rental','package','other');
CREATE TYPE public.smart_quote_source_type AS ENUM ('internal','provider','api','manual');
CREATE TYPE public.smart_quote_version_status AS ENUM ('draft','published','retired');

-- 1. smart_quotes
CREATE TABLE public.smart_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  organization_id uuid NULL REFERENCES public.organizations(id) ON DELETE SET NULL,
  agent_id uuid NULL REFERENCES public.agents(id) ON DELETE SET NULL,
  client_id uuid NULL REFERENCES public.clients(id) ON DELETE SET NULL,
  source public.smart_quote_source NOT NULL DEFAULT 'manual',
  status public.smart_quote_status NOT NULL DEFAULT 'draft',
  title text NOT NULL,
  destination_country text NULL,
  destination_state text NULL,
  destination_city text NULL,
  start_date date NULL,
  end_date date NULL,
  passengers_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  currency text NOT NULL DEFAULT 'ARS',
  total_amount numeric NULL,
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.smart_quotes TO authenticated;
GRANT ALL ON public.smart_quotes TO service_role;
ALTER TABLE public.smart_quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "smart_quotes_admin_all" ON public.smart_quotes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "smart_quotes_operations_all" ON public.smart_quotes FOR ALL TO authenticated
  USING (public.is_operations(auth.uid())) WITH CHECK (public.is_operations(auth.uid()));
CREATE POLICY "smart_quotes_owner_all" ON public.smart_quotes FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "smart_quotes_agent_select" ON public.smart_quotes FOR SELECT TO authenticated
  USING (agent_id IS NOT NULL AND agent_id = public.current_agent_id());

-- Helpers (declared after smart_quotes exists)
CREATE OR REPLACE FUNCTION public.can_read_smart_quote(_quote_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.smart_quotes q
    WHERE q.id = _quote_id
      AND (
        public.has_role(auth.uid(), 'admin')
        OR public.is_operations(auth.uid())
        OR q.user_id = auth.uid()
        OR (q.agent_id IS NOT NULL AND q.agent_id = public.current_agent_id())
      )
  )
$$;

CREATE OR REPLACE FUNCTION public.can_manage_smart_quote(_quote_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.smart_quotes q
    WHERE q.id = _quote_id
      AND (
        public.has_role(auth.uid(), 'admin')
        OR public.is_operations(auth.uid())
        OR q.user_id = auth.uid()
      )
  )
$$;

-- 2. smart_quote_items
CREATE TABLE public.smart_quote_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  smart_quote_id uuid NOT NULL REFERENCES public.smart_quotes(id) ON DELETE CASCADE,
  product_id uuid NULL REFERENCES public.products(id) ON DELETE SET NULL,
  product_variant_id uuid NULL REFERENCES public.product_variants(id) ON DELETE SET NULL,
  package_id uuid NULL REFERENCES public.package_templates(id) ON DELETE SET NULL,
  item_type public.smart_quote_item_type NOT NULL DEFAULT 'other',
  quantity numeric NOT NULL DEFAULT 1,
  unit_amount numeric NOT NULL DEFAULT 0,
  total_amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'ARS',
  pricing_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  availability_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.smart_quote_items TO authenticated;
GRANT ALL ON public.smart_quote_items TO service_role;
ALTER TABLE public.smart_quote_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "smart_quote_items_select" ON public.smart_quote_items FOR SELECT TO authenticated
  USING (public.can_read_smart_quote(smart_quote_id));
CREATE POLICY "smart_quote_items_manage" ON public.smart_quote_items FOR ALL TO authenticated
  USING (public.can_manage_smart_quote(smart_quote_id)) WITH CHECK (public.can_manage_smart_quote(smart_quote_id));

-- 3. smart_quote_pricing
CREATE TABLE public.smart_quote_pricing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  smart_quote_item_id uuid NOT NULL REFERENCES public.smart_quote_items(id) ON DELETE CASCADE,
  pricing_profile_id uuid NULL REFERENCES public.product_pricing_profiles(id) ON DELETE SET NULL,
  pricing_rule_id uuid NULL REFERENCES public.pricing_rules(id) ON DELETE SET NULL,
  passenger_type text NULL,
  quantity numeric NOT NULL DEFAULT 1,
  base_amount numeric NOT NULL DEFAULT 0,
  calculated_amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'ARS',
  calculation_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.smart_quote_pricing TO authenticated;
GRANT ALL ON public.smart_quote_pricing TO service_role;
ALTER TABLE public.smart_quote_pricing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "smart_quote_pricing_select" ON public.smart_quote_pricing FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.smart_quote_items i WHERE i.id = smart_quote_item_id AND public.can_read_smart_quote(i.smart_quote_id)));
CREATE POLICY "smart_quote_pricing_manage" ON public.smart_quote_pricing FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.smart_quote_items i WHERE i.id = smart_quote_item_id AND public.can_manage_smart_quote(i.smart_quote_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.smart_quote_items i WHERE i.id = smart_quote_item_id AND public.can_manage_smart_quote(i.smart_quote_id)));

-- 4. smart_quote_versions
CREATE TABLE public.smart_quote_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  smart_quote_id uuid NOT NULL REFERENCES public.smart_quotes(id) ON DELETE CASCADE,
  version integer NOT NULL DEFAULT 1,
  status public.smart_quote_version_status NOT NULL DEFAULT 'draft',
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (smart_quote_id, version)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.smart_quote_versions TO authenticated;
GRANT ALL ON public.smart_quote_versions TO service_role;
ALTER TABLE public.smart_quote_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "smart_quote_versions_select" ON public.smart_quote_versions FOR SELECT TO authenticated
  USING (public.can_read_smart_quote(smart_quote_id));
CREATE POLICY "smart_quote_versions_manage" ON public.smart_quote_versions FOR ALL TO authenticated
  USING (public.can_manage_smart_quote(smart_quote_id)) WITH CHECK (public.can_manage_smart_quote(smart_quote_id));

-- 5. smart_quote_sources
CREATE TABLE public.smart_quote_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  smart_quote_id uuid NOT NULL REFERENCES public.smart_quotes(id) ON DELETE CASCADE,
  source_type public.smart_quote_source_type NOT NULL DEFAULT 'internal',
  provider_id uuid NULL REFERENCES public.providers(id) ON DELETE SET NULL,
  organization_id uuid NULL REFERENCES public.organizations(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.smart_quote_sources TO authenticated;
GRANT ALL ON public.smart_quote_sources TO service_role;
ALTER TABLE public.smart_quote_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "smart_quote_sources_select" ON public.smart_quote_sources FOR SELECT TO authenticated
  USING (public.can_read_smart_quote(smart_quote_id));
CREATE POLICY "smart_quote_sources_manage" ON public.smart_quote_sources FOR ALL TO authenticated
  USING (public.can_manage_smart_quote(smart_quote_id)) WITH CHECK (public.can_manage_smart_quote(smart_quote_id));

-- Indexes
CREATE INDEX idx_smart_quotes_user ON public.smart_quotes(user_id);
CREATE INDEX idx_smart_quotes_agent ON public.smart_quotes(agent_id);
CREATE INDEX idx_smart_quotes_client ON public.smart_quotes(client_id);
CREATE INDEX idx_smart_quotes_status ON public.smart_quotes(status);
CREATE INDEX idx_smart_quote_items_quote ON public.smart_quote_items(smart_quote_id);
CREATE INDEX idx_smart_quote_pricing_item ON public.smart_quote_pricing(smart_quote_item_id);
CREATE INDEX idx_smart_quote_versions_quote ON public.smart_quote_versions(smart_quote_id);
CREATE INDEX idx_smart_quote_sources_quote ON public.smart_quote_sources(smart_quote_id);

-- updated_at trigger
CREATE TRIGGER trg_smart_quotes_updated_at BEFORE UPDATE ON public.smart_quotes
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();