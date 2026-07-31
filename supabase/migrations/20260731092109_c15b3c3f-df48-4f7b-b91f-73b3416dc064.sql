
-- ===================== 1. Clasificación y propietario =====================
DO $$ BEGIN
  CREATE TYPE public.resource_class AS ENUM ('person','vehicle','company','equipment');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.resource_owner_type AS ENUM ('viae','provider','partner_company','private','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.resources
  ADD COLUMN IF NOT EXISTS resource_class public.resource_class,
  ADD COLUMN IF NOT EXISTS subtype text,
  ADD COLUMN IF NOT EXISTS owner_type public.resource_owner_type NOT NULL DEFAULT 'viae',
  ADD COLUMN IF NOT EXISTS owner_company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS owner_name text,
  ADD COLUMN IF NOT EXISTS vehicle_version text,
  ADD COLUMN IF NOT EXISTS vehicle_fuel text,
  ADD COLUMN IF NOT EXISTS vehicle_transmission text,
  ADD COLUMN IF NOT EXISTS large_luggage_capacity integer,
  ADD COLUMN IF NOT EXISTS cabin_luggage_capacity integer,
  ADD COLUMN IF NOT EXISTS is_accessible boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_air_conditioning boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS vehicle_notes text,
  ADD COLUMN IF NOT EXISTS self_drive boolean NOT NULL DEFAULT false;

-- Backfill de clasificación en base a la categoría actual (no destructivo)
UPDATE public.resources SET resource_class =
  CASE
    WHEN category::text IN ('driver','guide','agent') THEN 'person'
    WHEN category::text IN ('vehicle','taxi','transfer') THEN 'vehicle'
    ELSE 'company'
  END::public.resource_class
WHERE resource_class IS NULL;

UPDATE public.resources SET subtype =
  CASE category::text
    WHEN 'driver' THEN 'driver'
    WHEN 'guide' THEN 'guide'
    WHEN 'agent' THEN 'representative'
    WHEN 'taxi' THEN 'taxi'
    WHEN 'transfer' THEN 'transfer'
    WHEN 'vehicle' THEN COALESCE(vehicle_type::text, 'other')
    WHEN 'accommodation' THEN 'hotel'
    WHEN 'room' THEN 'hotel'
    WHEN 'rental' THEN 'car_rental'
    WHEN 'excursion' THEN 'excursion_provider'
    WHEN 'tourism_service' THEN 'tour_operator'
    WHEN 'insurance' THEN 'supplier'
    ELSE 'other'
  END
WHERE subtype IS NULL;

ALTER TABLE public.resources ALTER COLUMN resource_class SET DEFAULT 'company';
UPDATE public.resources SET resource_class = 'company' WHERE resource_class IS NULL;
ALTER TABLE public.resources ALTER COLUMN resource_class SET NOT NULL;

CREATE INDEX IF NOT EXISTS resources_class_idx ON public.resources (resource_class);
CREATE INDEX IF NOT EXISTS resources_subtype_idx ON public.resources (subtype);

-- ===================== 2. Catálogo de extras =====================
CREATE TABLE IF NOT EXISTS public.resource_extras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  record_status public.record_status NOT NULL DEFAULT 'active',
  price numeric,
  cost numeric,
  currency text NOT NULL DEFAULT 'ARS',
  is_included boolean NOT NULL DEFAULT false,
  quantity_available integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.resource_extras TO authenticated;
GRANT ALL ON public.resource_extras TO service_role;
ALTER TABLE public.resource_extras ENABLE ROW LEVEL SECURITY;
CREATE POLICY "resource_extras_select" ON public.resource_extras FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.is_operations(auth.uid()));
CREATE POLICY "resource_extras_insert" ON public.resource_extras FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "resource_extras_update" ON public.resource_extras FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE TRIGGER resource_extras_set_updated_at BEFORE UPDATE ON public.resource_extras
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER resource_extras_audit AFTER INSERT OR UPDATE ON public.resource_extras
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit();

-- ===================== 3. Extras por recurso =====================
CREATE TABLE IF NOT EXISTS public.resource_extra_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  resource_id uuid NOT NULL REFERENCES public.resources(id) ON DELETE CASCADE,
  extra_id uuid NOT NULL REFERENCES public.resource_extras(id) ON DELETE CASCADE,
  quantity integer NOT NULL DEFAULT 1,
  extra_cost numeric,
  currency text NOT NULL DEFAULT 'ARS',
  is_included boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (resource_id, extra_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.resource_extra_links TO authenticated;
GRANT ALL ON public.resource_extra_links TO service_role;
ALTER TABLE public.resource_extra_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "resource_extra_links_select" ON public.resource_extra_links FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.is_operations(auth.uid())
         OR resource_id IN (SELECT public.current_driver_resource_ids()));
CREATE POLICY "resource_extra_links_insert" ON public.resource_extra_links FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "resource_extra_links_update" ON public.resource_extra_links FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "resource_extra_links_delete" ON public.resource_extra_links FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE TRIGGER resource_extra_links_set_updated_at BEFORE UPDATE ON public.resource_extra_links
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER resource_extra_links_audit AFTER INSERT OR UPDATE OR DELETE ON public.resource_extra_links
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit();

-- ===================== 4. Extras solicitados en servicios =====================
CREATE TABLE IF NOT EXISTS public.transport_service_extras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  service_id uuid NOT NULL REFERENCES public.transport_services(id) ON DELETE CASCADE,
  extra_id uuid NOT NULL REFERENCES public.resource_extras(id) ON DELETE RESTRICT,
  quantity integer NOT NULL DEFAULT 1,
  is_required boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transport_service_extras TO authenticated;
GRANT ALL ON public.transport_service_extras TO service_role;
ALTER TABLE public.transport_service_extras ENABLE ROW LEVEL SECURITY;
CREATE POLICY "transport_service_extras_select" ON public.transport_service_extras FOR SELECT TO authenticated
  USING (
    user_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.is_operations(auth.uid())
    OR service_id IN (
      SELECT ts.id FROM public.transport_services ts
      WHERE ts.driver_resource_id IN (SELECT public.current_driver_resource_ids())
    )
  );
CREATE POLICY "transport_service_extras_insert" ON public.transport_service_extras FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.is_operations(auth.uid()));
CREATE POLICY "transport_service_extras_update" ON public.transport_service_extras FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.is_operations(auth.uid()))
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.is_operations(auth.uid()));
CREATE POLICY "transport_service_extras_delete" ON public.transport_service_extras FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.is_operations(auth.uid()));

CREATE TRIGGER transport_service_extras_set_updated_at BEFORE UPDATE ON public.transport_service_extras
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER transport_service_extras_audit AFTER INSERT OR UPDATE OR DELETE ON public.transport_service_extras
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit();

-- ===================== 5. Auditoría específica del catálogo =====================
CREATE OR REPLACE FUNCTION public.tg_resource_catalog_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
DECLARE
  v_changes jsonb := '{}'::jsonb;
  k text;
  fields text[] := ARRAY['country','state','base_city','cities_served','tourist_zones','destinations','main_zone','zones',
                         'owner_type','owner_company_id','owner_name','company_id',
                         'resource_class','subtype','self_drive',
                         'vehicle_brand','vehicle_model','vehicle_version','vehicle_year','vehicle_plate','vehicle_color',
                         'vehicle_type','vehicle_fuel','vehicle_transmission','pax_capacity','luggage_capacity',
                         'large_luggage_capacity','cabin_luggage_capacity','is_accessible','has_air_conditioning'];
  oldj jsonb := to_jsonb(OLD);
  newj jsonb := to_jsonb(NEW);
BEGIN
  FOREACH k IN ARRAY fields LOOP
    IF newj -> k IS DISTINCT FROM oldj -> k THEN
      v_changes := v_changes || jsonb_build_object(k, jsonb_build_object('from', oldj -> k, 'to', newj -> k));
    END IF;
  END LOOP;
  IF v_changes = '{}'::jsonb THEN RETURN NEW; END IF;
  INSERT INTO public.audit_log (actor_id, action, entity, entity_id, details)
  VALUES (auth.uid(), 'resource_catalog_changed', 'resources', NEW.id, v_changes);
  RETURN NEW;
END; $fn$;

DROP TRIGGER IF EXISTS resources_catalog_audit ON public.resources;
CREATE TRIGGER resources_catalog_audit AFTER UPDATE ON public.resources
  FOR EACH ROW EXECUTE FUNCTION public.tg_resource_catalog_audit();
