-- ============ enums ============
ALTER TYPE public.resource_availability ADD VALUE IF NOT EXISTS 'off_hours';

DO $$ BEGIN
  CREATE TYPE public.transport_service_type AS ENUM (
    'taxi','airport_transfer','tourist_transfer','intercity_transfer',
    'private_transfer','corporate_transfer','group_transfer','driver_excursion','other'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.transport_service_status AS ENUM (
    'pending','requested','assigned','accepted','in_transit','completed','cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.vehicle_type AS ENUM (
    'sedan','suv','van','minibus','bus','pickup','motorcycle','accessible','other'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============ recursos: red de transporte ============
ALTER TABLE public.resources
  ADD COLUMN IF NOT EXISTS base_city text,
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS cities_served text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS destinations text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS max_distance_km integer,
  ADD COLUMN IF NOT EXISTS requires_advance_booking boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS advance_notice_hours integer,
  ADD COLUMN IF NOT EXISTS transport_service_types public.transport_service_type[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS driver_first_name text,
  ADD COLUMN IF NOT EXISTS driver_last_name text,
  ADD COLUMN IF NOT EXISTS vehicle_brand text,
  ADD COLUMN IF NOT EXISTS vehicle_model text,
  ADD COLUMN IF NOT EXISTS vehicle_year integer,
  ADD COLUMN IF NOT EXISTS vehicle_plate text,
  ADD COLUMN IF NOT EXISTS vehicle_color text,
  ADD COLUMN IF NOT EXISTS vehicle_type public.vehicle_type,
  ADD COLUMN IF NOT EXISTS luggage_capacity integer;

-- ============ historial de disponibilidad ============
CREATE TABLE IF NOT EXISTS public.resource_availability_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id uuid NOT NULL REFERENCES public.resources(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  actor_id uuid,
  from_availability public.resource_availability,
  to_availability public.resource_availability NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.resource_availability_log TO authenticated;
GRANT ALL ON public.resource_availability_log TO service_role;
ALTER TABLE public.resource_availability_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "resource_availability_log_select" ON public.resource_availability_log
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.tg_resource_availability_log()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.availability IS DISTINCT FROM OLD.availability THEN
    INSERT INTO public.resource_availability_log (resource_id, owner_id, actor_id, from_availability, to_availability)
    VALUES (NEW.id, NEW.user_id, auth.uid(), OLD.availability, NEW.availability);
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_resource_availability_log ON public.resources;
CREATE TRIGGER trg_resource_availability_log
  AFTER UPDATE ON public.resources
  FOR EACH ROW EXECUTE FUNCTION public.tg_resource_availability_log();

-- ============ servicios de transporte ============
CREATE TABLE IF NOT EXISTS public.transport_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  booking_id uuid REFERENCES public.bookings(id) ON DELETE CASCADE,
  service_type public.transport_service_type NOT NULL DEFAULT 'taxi',
  status public.transport_service_status NOT NULL DEFAULT 'pending',
  origin text,
  destination text,
  service_date date,
  service_time time,
  pax_count integer,
  luggage_count integer,
  driver_resource_id uuid REFERENCES public.resources(id) ON DELETE SET NULL,
  vehicle_resource_id uuid REFERENCES public.resources(id) ON DELETE SET NULL,
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  assigned_by uuid,
  assigned_at timestamptz,
  notes text,
  -- preparado para futuras liquidaciones (aún sin uso)
  amount numeric,
  currency text NOT NULL DEFAULT 'ARS',
  commission_value numeric,
  commission_type public.commission_type,
  record_status public.record_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.transport_services TO authenticated;
GRANT ALL ON public.transport_services TO service_role;
ALTER TABLE public.transport_services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "transport_services_select" ON public.transport_services
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin')
         OR EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = transport_services.booking_id AND b.assigned_agent_id = public.current_agent_id()));
CREATE POLICY "transport_services_insert" ON public.transport_services
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "transport_services_update" ON public.transport_services
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_transport_services_updated_at
  BEFORE UPDATE ON public.transport_services
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TRIGGER trg_transport_services_audit
  AFTER INSERT OR UPDATE ON public.transport_services
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit();

CREATE INDEX IF NOT EXISTS idx_transport_services_booking ON public.transport_services(booking_id);
CREATE INDEX IF NOT EXISTS idx_transport_services_date ON public.transport_services(service_date);

-- ============ historial de estados del servicio ============
CREATE TABLE IF NOT EXISTS public.transport_service_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id uuid NOT NULL REFERENCES public.transport_services(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  actor_id uuid,
  from_status public.transport_service_status,
  to_status public.transport_service_status NOT NULL,
  comment text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.transport_service_history TO authenticated;
GRANT ALL ON public.transport_service_history TO service_role;
ALTER TABLE public.transport_service_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "transport_service_history_select" ON public.transport_service_history
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.tg_transport_service_history()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.transport_service_history (service_id, owner_id, actor_id, from_status, to_status, comment)
    VALUES (NEW.id, NEW.user_id, auth.uid(), NULL, NEW.status, 'Servicio creado');
    RETURN NEW;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.transport_service_history (service_id, owner_id, actor_id, from_status, to_status)
    VALUES (NEW.id, NEW.user_id, auth.uid(), OLD.status, NEW.status);
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_transport_service_history
  AFTER INSERT OR UPDATE ON public.transport_services
  FOR EACH ROW EXECUTE FUNCTION public.tg_transport_service_history();