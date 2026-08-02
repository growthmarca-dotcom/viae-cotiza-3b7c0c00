-- ============================================================
-- Motor de Itinerarios — Fase 0 (solo estructura)
-- Sin RPC, sin triggers, sin algoritmos, sin precios,
-- sin consultas de disponibilidad.
-- ============================================================

DO $$ BEGIN
  CREATE TYPE public.itinerary_type AS ENUM ('city_break','circuit','excursion','package','custom');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.itinerary_service_kind AS ENUM (
    'hotel','transfer','activity','car_rental','insurance','flight','meal','custom'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.itinerary_request_source AS ENUM ('crm','widget','api','manual','whitelabel');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.itinerary_request_status AS ENUM ('pending','processing','completed','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ------------------------------------------------------------
-- 1) itinerary_templates
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.itinerary_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  code text NOT NULL,
  name text NOT NULL,
  description text,
  destination text,
  itinerary_type public.itinerary_type NOT NULL DEFAULT 'package',
  duration_days integer NOT NULL DEFAULT 1,
  duration_nights integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT itinerary_templates_duration_check CHECK (duration_days >= 0 AND duration_nights >= 0)
);
CREATE UNIQUE INDEX IF NOT EXISTS itinerary_templates_owner_code_idx
  ON public.itinerary_templates(owner_id, code);
CREATE INDEX IF NOT EXISTS itinerary_templates_org_idx ON public.itinerary_templates(organization_id);
CREATE INDEX IF NOT EXISTS itinerary_templates_destination_idx ON public.itinerary_templates(destination);
CREATE INDEX IF NOT EXISTS itinerary_templates_active_idx ON public.itinerary_templates(active);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.itinerary_templates TO authenticated;
GRANT ALL ON public.itinerary_templates TO service_role;
ALTER TABLE public.itinerary_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "itinerary_templates_admin_all" ON public.itinerary_templates
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "itinerary_templates_staff_read" ON public.itinerary_templates
  FOR SELECT TO authenticated
  USING (public.is_operations(auth.uid()) OR public.has_role(auth.uid(), 'agent'));

-- ------------------------------------------------------------
-- 2) itinerary_template_items
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.itinerary_template_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.itinerary_templates(id) ON DELETE CASCADE,
  sequence integer NOT NULL DEFAULT 0,
  day_number integer NOT NULL DEFAULT 1,
  service_kind public.itinerary_service_kind NOT NULL DEFAULT 'custom',
  title text,
  mandatory boolean NOT NULL DEFAULT true,
  optional boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT itinerary_template_items_day_check CHECK (day_number >= 1)
);
CREATE INDEX IF NOT EXISTS itinerary_template_items_template_idx
  ON public.itinerary_template_items(template_id, day_number, sequence);
CREATE INDEX IF NOT EXISTS itinerary_template_items_kind_idx
  ON public.itinerary_template_items(service_kind);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.itinerary_template_items TO authenticated;
GRANT ALL ON public.itinerary_template_items TO service_role;
ALTER TABLE public.itinerary_template_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "itinerary_template_items_admin_all" ON public.itinerary_template_items
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "itinerary_template_items_staff_read" ON public.itinerary_template_items
  FOR SELECT TO authenticated
  USING (public.is_operations(auth.uid()) OR public.has_role(auth.uid(), 'agent'));

-- ------------------------------------------------------------
-- 3) itinerary_rules
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.itinerary_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.itinerary_templates(id) ON DELETE CASCADE,
  minimum_passengers integer,
  maximum_passengers integer,
  minimum_nights integer,
  maximum_nights integer,
  compatible_destinations text[] NOT NULL DEFAULT '{}',
  compatible_seasons uuid[] NOT NULL DEFAULT '{}',
  priority integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT itinerary_rules_pax_check CHECK (
    minimum_passengers IS NULL OR maximum_passengers IS NULL OR maximum_passengers >= minimum_passengers
  ),
  CONSTRAINT itinerary_rules_nights_check CHECK (
    minimum_nights IS NULL OR maximum_nights IS NULL OR maximum_nights >= minimum_nights
  )
);
CREATE INDEX IF NOT EXISTS itinerary_rules_template_idx ON public.itinerary_rules(template_id, priority);
CREATE INDEX IF NOT EXISTS itinerary_rules_active_idx ON public.itinerary_rules(active);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.itinerary_rules TO authenticated;
GRANT ALL ON public.itinerary_rules TO service_role;
ALTER TABLE public.itinerary_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "itinerary_rules_admin_all" ON public.itinerary_rules
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "itinerary_rules_staff_read" ON public.itinerary_rules
  FOR SELECT TO authenticated
  USING (public.is_operations(auth.uid()) OR public.has_role(auth.uid(), 'agent'));

-- ------------------------------------------------------------
-- 4) itinerary_versions
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.itinerary_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.itinerary_templates(id) ON DELETE CASCADE,
  version integer NOT NULL DEFAULT 1,
  published boolean NOT NULL DEFAULT false,
  snapshot jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT itinerary_versions_version_check CHECK (version >= 1)
);
CREATE UNIQUE INDEX IF NOT EXISTS itinerary_versions_template_version_idx
  ON public.itinerary_versions(template_id, version);
CREATE INDEX IF NOT EXISTS itinerary_versions_published_idx ON public.itinerary_versions(published);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.itinerary_versions TO authenticated;
GRANT ALL ON public.itinerary_versions TO service_role;
ALTER TABLE public.itinerary_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "itinerary_versions_admin_all" ON public.itinerary_versions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "itinerary_versions_staff_read" ON public.itinerary_versions
  FOR SELECT TO authenticated
  USING (public.is_operations(auth.uid()) OR public.has_role(auth.uid(), 'agent'));

-- ------------------------------------------------------------
-- 5) itinerary_requests
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.itinerary_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  destination text,
  travel_start date,
  travel_end date,
  adults integer NOT NULL DEFAULT 1,
  children integer NOT NULL DEFAULT 0,
  infants integer NOT NULL DEFAULT 0,
  request_source public.itinerary_request_source NOT NULL DEFAULT 'manual',
  status public.itinerary_request_status NOT NULL DEFAULT 'pending',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT itinerary_requests_pax_check CHECK (adults >= 0 AND children >= 0 AND infants >= 0),
  CONSTRAINT itinerary_requests_dates_check CHECK (
    travel_start IS NULL OR travel_end IS NULL OR travel_end >= travel_start
  )
);
CREATE INDEX IF NOT EXISTS itinerary_requests_org_idx ON public.itinerary_requests(organization_id);
CREATE INDEX IF NOT EXISTS itinerary_requests_status_idx ON public.itinerary_requests(status);
CREATE INDEX IF NOT EXISTS itinerary_requests_created_idx ON public.itinerary_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS itinerary_requests_destination_idx ON public.itinerary_requests(destination);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.itinerary_requests TO authenticated;
GRANT ALL ON public.itinerary_requests TO service_role;
ALTER TABLE public.itinerary_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "itinerary_requests_admin_all" ON public.itinerary_requests
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "itinerary_requests_staff_read" ON public.itinerary_requests
  FOR SELECT TO authenticated
  USING (
    public.is_operations(auth.uid())
    OR public.has_role(auth.uid(), 'agent')
    OR owner_id = auth.uid()
  );

REVOKE ALL ON public.itinerary_templates FROM anon;
REVOKE ALL ON public.itinerary_template_items FROM anon;
REVOKE ALL ON public.itinerary_rules FROM anon;
REVOKE ALL ON public.itinerary_versions FROM anon;
REVOKE ALL ON public.itinerary_requests FROM anon;