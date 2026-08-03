-- ENUMS
CREATE TYPE public.search_request_type AS ENUM ('package','accommodation','activity','transfer','rental','custom');
CREATE TYPE public.search_request_status AS ENUM ('pending','processing','completed','failed','expired');
CREATE TYPE public.search_service_category AS ENUM ('accommodation','activity','transfer','rental','package');
CREATE TYPE public.search_availability_status AS ENUM ('available','unavailable','request_only','unknown');
CREATE TYPE public.search_pricing_status AS ENUM ('calculated','unavailable','pending');
CREATE TYPE public.search_source_type AS ENUM ('internal','api','manual');
CREATE TYPE public.search_component_type AS ENUM ('product','transfer','accommodation','activity','rental');

-- 1. search_requests
CREATE TABLE public.search_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  agent_id uuid REFERENCES public.agents(id) ON DELETE SET NULL,
  request_type public.search_request_type NOT NULL DEFAULT 'custom',
  destination_country text,
  destination_state text,
  destination_city text,
  start_date date,
  end_date date,
  adults integer NOT NULL DEFAULT 0,
  children integer NOT NULL DEFAULT 0,
  infants integer NOT NULL DEFAULT 0,
  passengers_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  status public.search_request_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.search_requests TO authenticated;
GRANT ALL ON public.search_requests TO service_role;
ALTER TABLE public.search_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage search requests" ON public.search_requests
FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Operations read search requests" ON public.search_requests
FOR SELECT TO authenticated USING (public.is_operations(auth.uid()));
CREATE POLICY "Owners read own search requests" ON public.search_requests
FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Owners create own search requests" ON public.search_requests
FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Owners update own search requests" ON public.search_requests
FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Owners delete own search requests" ON public.search_requests
FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE TRIGGER trg_search_requests_updated_at BEFORE UPDATE ON public.search_requests
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE INDEX idx_search_requests_user ON public.search_requests(user_id);
CREATE INDEX idx_search_requests_status ON public.search_requests(status);

-- helper: can the caller see a given search request?
CREATE OR REPLACE FUNCTION public.can_read_search_request(_request_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.search_requests sr
    WHERE sr.id = _request_id
      AND (sr.user_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.is_operations(auth.uid()))
  )
$$;

CREATE OR REPLACE FUNCTION public.can_manage_search_request(_request_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.search_requests sr
    WHERE sr.id = _request_id
      AND (sr.user_id = auth.uid() OR public.has_role(auth.uid(),'admin'))
  )
$$;

-- 2. search_items
CREATE TABLE public.search_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  search_request_id uuid NOT NULL REFERENCES public.search_requests(id) ON DELETE CASCADE,
  service_category public.search_service_category NOT NULL,
  quantity numeric NOT NULL DEFAULT 1,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.search_items TO authenticated;
GRANT ALL ON public.search_items TO service_role;
ALTER TABLE public.search_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read search items" ON public.search_items
FOR SELECT TO authenticated USING (public.can_read_search_request(search_request_id));
CREATE POLICY "Manage search items" ON public.search_items
FOR ALL TO authenticated USING (public.can_manage_search_request(search_request_id)) WITH CHECK (public.can_manage_search_request(search_request_id));

CREATE INDEX idx_search_items_request ON public.search_items(search_request_id);

-- 3. search_results
CREATE TABLE public.search_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  search_request_id uuid NOT NULL REFERENCES public.search_requests(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  product_variant_id uuid REFERENCES public.product_variants(id) ON DELETE SET NULL,
  provider_id uuid REFERENCES public.providers(id) ON DELETE SET NULL,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  availability_status public.search_availability_status NOT NULL DEFAULT 'unknown',
  pricing_status public.search_pricing_status NOT NULL DEFAULT 'pending',
  estimated_amount numeric,
  currency text,
  source_type public.search_source_type NOT NULL DEFAULT 'internal',
  priority integer NOT NULL DEFAULT 100,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.search_results TO authenticated;
GRANT ALL ON public.search_results TO service_role;
ALTER TABLE public.search_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read search results" ON public.search_results
FOR SELECT TO authenticated USING (
  public.can_read_search_request(search_request_id)
  OR (product_id IS NOT NULL AND public.can_manage_product(product_id))
);
CREATE POLICY "Manage search results" ON public.search_results
FOR ALL TO authenticated USING (public.can_manage_search_request(search_request_id)) WITH CHECK (public.can_manage_search_request(search_request_id));

CREATE INDEX idx_search_results_request ON public.search_results(search_request_id);
CREATE INDEX idx_search_results_product ON public.search_results(product_id);

CREATE OR REPLACE FUNCTION public.can_read_search_result(_result_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.search_results r
    WHERE r.id = _result_id
      AND (public.can_read_search_request(r.search_request_id)
           OR (r.product_id IS NOT NULL AND public.can_manage_product(r.product_id)))
  )
$$;

CREATE OR REPLACE FUNCTION public.can_manage_search_result(_result_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.search_results r
    WHERE r.id = _result_id AND public.can_manage_search_request(r.search_request_id)
  )
$$;

-- 4. search_result_components
CREATE TABLE public.search_result_components (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  search_result_id uuid NOT NULL REFERENCES public.search_results(id) ON DELETE CASCADE,
  component_type public.search_component_type NOT NULL,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  variant_id uuid REFERENCES public.product_variants(id) ON DELETE SET NULL,
  quantity numeric NOT NULL DEFAULT 1,
  amount numeric,
  currency text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.search_result_components TO authenticated;
GRANT ALL ON public.search_result_components TO service_role;
ALTER TABLE public.search_result_components ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read search result components" ON public.search_result_components
FOR SELECT TO authenticated USING (public.can_read_search_result(search_result_id));
CREATE POLICY "Manage search result components" ON public.search_result_components
FOR ALL TO authenticated USING (public.can_manage_search_result(search_result_id)) WITH CHECK (public.can_manage_search_result(search_result_id));

CREATE INDEX idx_search_result_components_result ON public.search_result_components(search_result_id);

-- 5. provider_search_sources
CREATE TABLE public.provider_search_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider_id uuid REFERENCES public.providers(id) ON DELETE CASCADE,
  source_type public.search_source_type NOT NULL DEFAULT 'internal',
  priority integer NOT NULL DEFAULT 100,
  active boolean NOT NULL DEFAULT true,
  configuration jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.provider_search_sources TO authenticated;
GRANT ALL ON public.provider_search_sources TO service_role;
ALTER TABLE public.provider_search_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage provider search sources" ON public.provider_search_sources
FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Staff read provider search sources" ON public.provider_search_sources
FOR SELECT TO authenticated USING (public.is_operations(auth.uid()) OR user_id = auth.uid());

CREATE TRIGGER trg_provider_search_sources_updated_at BEFORE UPDATE ON public.provider_search_sources
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE INDEX idx_provider_search_sources_org ON public.provider_search_sources(organization_id);