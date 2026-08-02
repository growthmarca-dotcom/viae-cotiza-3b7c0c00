-- ============================================================
-- Motor de Disponibilidad Multiproveedor — Fase 0 (solo estructura)
-- Sin funciones, sin RPC, sin cálculo de cupos.
-- ============================================================

DO $$ BEGIN
  CREATE TYPE public.availability_source_type AS ENUM ('manual','api','cache','external');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.availability_status AS ENUM ('available','limited','full','closed','blocked');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.availability_request_type AS ENUM ('manual','api','cache','fallback');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.availability_request_status AS ENUM ('pending','processing','completed','failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ------------------------------------------------------------
-- 1) availability_sources
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.availability_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider_id uuid REFERENCES public.providers(id) ON DELETE SET NULL,
  source_type public.availability_source_type NOT NULL DEFAULT 'manual',
  source_name text NOT NULL,
  priority integer NOT NULL DEFAULT 0,
  enabled boolean NOT NULL DEFAULT true,
  configuration jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS availability_sources_owner_idx ON public.availability_sources(owner_id);
CREATE INDEX IF NOT EXISTS availability_sources_org_idx ON public.availability_sources(organization_id);
CREATE INDEX IF NOT EXISTS availability_sources_provider_idx ON public.availability_sources(provider_id);
CREATE INDEX IF NOT EXISTS availability_sources_priority_idx ON public.availability_sources(organization_id, priority);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.availability_sources TO authenticated;
GRANT ALL ON public.availability_sources TO service_role;
ALTER TABLE public.availability_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "availability_sources_admin_all" ON public.availability_sources
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "availability_sources_staff_read" ON public.availability_sources
  FOR SELECT TO authenticated
  USING (
    public.is_operations(auth.uid())
    OR public.has_role(auth.uid(), 'agent')
    OR owner_id = auth.uid()
  );

CREATE POLICY "availability_sources_provider_read" ON public.availability_sources
  FOR SELECT TO authenticated
  USING (
    organization_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.providers p
      WHERE p.organization_id = availability_sources.organization_id
        AND p.user_id = auth.uid()
    )
  );

-- ------------------------------------------------------------
-- 2) service_availability — calendario propio del proveedor
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.service_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  service_id uuid NOT NULL,
  availability_date date NOT NULL,
  start_time time,
  end_time time,
  available_units integer NOT NULL DEFAULT 0,
  reserved_units integer NOT NULL DEFAULT 0,
  status public.availability_status NOT NULL DEFAULT 'available',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT service_availability_units_check CHECK (available_units >= 0 AND reserved_units >= 0),
  CONSTRAINT service_availability_time_check CHECK (start_time IS NULL OR end_time IS NULL OR end_time >= start_time)
);
CREATE INDEX IF NOT EXISTS service_availability_service_date_idx ON public.service_availability(service_id, availability_date);
CREATE INDEX IF NOT EXISTS service_availability_owner_idx ON public.service_availability(owner_id);
CREATE INDEX IF NOT EXISTS service_availability_org_idx ON public.service_availability(organization_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_availability TO authenticated;
GRANT ALL ON public.service_availability TO service_role;
ALTER TABLE public.service_availability ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_availability_admin_all" ON public.service_availability
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "service_availability_staff_read" ON public.service_availability
  FOR SELECT TO authenticated
  USING (
    public.is_operations(auth.uid())
    OR public.has_role(auth.uid(), 'agent')
    OR owner_id = auth.uid()
  );

CREATE POLICY "service_availability_provider_manage" ON public.service_availability
  FOR ALL TO authenticated
  USING (
    organization_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.providers p
      WHERE p.organization_id = service_availability.organization_id
        AND p.user_id = auth.uid()
    )
  )
  WITH CHECK (
    organization_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.providers p
      WHERE p.organization_id = service_availability.organization_id
        AND p.user_id = auth.uid()
    )
  );

-- ------------------------------------------------------------
-- 3) availability_cache
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.availability_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid REFERENCES public.availability_sources(id) ON DELETE CASCADE,
  service_id uuid,
  query_hash text NOT NULL,
  availability_result jsonb NOT NULL DEFAULT '{}'::jsonb,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS availability_cache_hash_idx ON public.availability_cache(query_hash);
CREATE INDEX IF NOT EXISTS availability_cache_source_idx ON public.availability_cache(source_id);
CREATE INDEX IF NOT EXISTS availability_cache_expires_idx ON public.availability_cache(expires_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.availability_cache TO authenticated;
GRANT ALL ON public.availability_cache TO service_role;
ALTER TABLE public.availability_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "availability_cache_admin_all" ON public.availability_cache
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "availability_cache_staff_read" ON public.availability_cache
  FOR SELECT TO authenticated
  USING (public.is_operations(auth.uid()) OR public.has_role(auth.uid(), 'agent'));

-- ------------------------------------------------------------
-- 4) availability_requests — auditoría futura
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.availability_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid,
  service_id uuid,
  source_id uuid REFERENCES public.availability_sources(id) ON DELETE SET NULL,
  request_type public.availability_request_type NOT NULL DEFAULT 'manual',
  status public.availability_request_status NOT NULL DEFAULT 'pending',
  response_time integer,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS availability_requests_service_idx ON public.availability_requests(service_id);
CREATE INDEX IF NOT EXISTS availability_requests_source_idx ON public.availability_requests(source_id);
CREATE INDEX IF NOT EXISTS availability_requests_created_idx ON public.availability_requests(created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.availability_requests TO authenticated;
GRANT ALL ON public.availability_requests TO service_role;
ALTER TABLE public.availability_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "availability_requests_admin_all" ON public.availability_requests
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "availability_requests_staff_read" ON public.availability_requests
  FOR SELECT TO authenticated
  USING (
    public.is_operations(auth.uid())
    OR public.has_role(auth.uid(), 'agent')
    OR owner_id = auth.uid()
  );

-- ------------------------------------------------------------
-- 5) availability_policies — orden de búsqueda
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.availability_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  service_kind public.booking_service_kind,
  policy_name text NOT NULL,
  priority_order jsonb NOT NULL DEFAULT '[]'::jsonb,
  fallback_manual boolean NOT NULL DEFAULT true,
  cache_minutes integer NOT NULL DEFAULT 30,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT availability_policies_cache_check CHECK (cache_minutes >= 0)
);
CREATE INDEX IF NOT EXISTS availability_policies_owner_idx ON public.availability_policies(owner_id);
CREATE INDEX IF NOT EXISTS availability_policies_org_idx ON public.availability_policies(organization_id, service_kind);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.availability_policies TO authenticated;
GRANT ALL ON public.availability_policies TO service_role;
ALTER TABLE public.availability_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "availability_policies_admin_all" ON public.availability_policies
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "availability_policies_staff_read" ON public.availability_policies
  FOR SELECT TO authenticated
  USING (
    public.is_operations(auth.uid())
    OR public.has_role(auth.uid(), 'agent')
    OR owner_id = auth.uid()
  );

CREATE POLICY "availability_policies_provider_read" ON public.availability_policies
  FOR SELECT TO authenticated
  USING (
    organization_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.providers p
      WHERE p.organization_id = availability_policies.organization_id
        AND p.user_id = auth.uid()
    )
  );

-- updated_at triggers (reutiliza función existente)
DROP TRIGGER IF EXISTS set_updated_at_availability_sources ON public.availability_sources;
CREATE TRIGGER set_updated_at_availability_sources BEFORE UPDATE ON public.availability_sources
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_service_availability ON public.service_availability;
CREATE TRIGGER set_updated_at_service_availability BEFORE UPDATE ON public.service_availability
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_availability_policies ON public.availability_policies;
CREATE TRIGGER set_updated_at_availability_policies BEFORE UPDATE ON public.availability_policies
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

REVOKE ALL ON public.availability_sources FROM anon;
REVOKE ALL ON public.service_availability FROM anon;
REVOKE ALL ON public.availability_cache FROM anon;
REVOKE ALL ON public.availability_requests FROM anon;
REVOKE ALL ON public.availability_policies FROM anon;