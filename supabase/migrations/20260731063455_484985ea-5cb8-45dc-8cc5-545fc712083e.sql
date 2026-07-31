-- 1. nuevos estados
ALTER TYPE public.transport_service_status ADD VALUE IF NOT EXISTS 'rejected';
ALTER TYPE public.transport_service_status ADD VALUE IF NOT EXISTS 'en_route';
ALTER TYPE public.transport_service_status ADD VALUE IF NOT EXISTS 'at_origin';

-- 2. enums de cobro
DO $$ BEGIN
  CREATE TYPE public.transport_payment_mode AS ENUM ('prepaid_viae','direct_to_driver','partial','pending');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.transport_collection_status AS ENUM ('not_applicable','pending','collected','reported');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. columnas operativas y de cobro
ALTER TABLE public.transport_services
  ADD COLUMN IF NOT EXISTS accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejected_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS started_at timestamptz,
  ADD COLUMN IF NOT EXISTS arrived_at timestamptz,
  ADD COLUMN IF NOT EXISTS onboard_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS payment_mode public.transport_payment_mode NOT NULL DEFAULT 'prepaid_viae',
  ADD COLUMN IF NOT EXISTS collection_status public.transport_collection_status NOT NULL DEFAULT 'not_applicable',
  ADD COLUMN IF NOT EXISTS collection_amount numeric,
  ADD COLUMN IF NOT EXISTS collection_currency text NOT NULL DEFAULT 'ARS',
  ADD COLUMN IF NOT EXISTS collected_at timestamptz,
  ADD COLUMN IF NOT EXISTS collected_by uuid,
  ADD COLUMN IF NOT EXISTS collected_amount numeric;

-- 4. vínculo conductor <-> usuario
ALTER TABLE public.resources
  ADD COLUMN IF NOT EXISTS driver_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS resources_driver_user_id_idx ON public.resources(driver_user_id);
CREATE INDEX IF NOT EXISTS transport_services_driver_idx ON public.transport_services(driver_resource_id);

-- 5. recursos de conducción del usuario actual
CREATE OR REPLACE FUNCTION public.current_driver_resource_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.id
  FROM public.resources r
  LEFT JOIN public.agents a ON a.id = r.agent_id
  WHERE r.driver_user_id = auth.uid()
     OR (a.user_id IS NOT NULL AND a.user_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.is_driver(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.resources r
    LEFT JOIN public.agents a ON a.id = r.agent_id
    WHERE r.category = 'driver'
      AND (r.driver_user_id = _user_id OR a.user_id = _user_id)
  );
$$;

-- 6. contexto seguro de la reserva para el conductor (sin exponer importes internos)
CREATE OR REPLACE FUNCTION public.driver_service_context()
RETURNS TABLE (service_id uuid, booking_number text, client_name text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ts.id, b.booking_number, c.full_name
  FROM public.transport_services ts
  LEFT JOIN public.bookings b ON b.id = ts.booking_id
  LEFT JOIN public.clients c ON c.id = b.client_id
  WHERE ts.driver_resource_id IN (SELECT public.current_driver_resource_ids());
$$;

GRANT EXECUTE ON FUNCTION public.driver_service_context() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_driver_resource_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_driver(uuid) TO authenticated;

-- 7. políticas del conductor
DROP POLICY IF EXISTS "driver reads own services" ON public.transport_services;
CREATE POLICY "driver reads own services" ON public.transport_services
FOR SELECT TO authenticated
USING (driver_resource_id IN (SELECT public.current_driver_resource_ids()));

DROP POLICY IF EXISTS "driver updates own services" ON public.transport_services;
CREATE POLICY "driver updates own services" ON public.transport_services
FOR UPDATE TO authenticated
USING (driver_resource_id IN (SELECT public.current_driver_resource_ids()))
WITH CHECK (driver_resource_id IN (SELECT public.current_driver_resource_ids()));

DROP POLICY IF EXISTS "driver reads own resource" ON public.resources;
CREATE POLICY "driver reads own resource" ON public.resources
FOR SELECT TO authenticated
USING (id IN (SELECT public.current_driver_resource_ids()));

DROP POLICY IF EXISTS "driver updates own availability" ON public.resources;
CREATE POLICY "driver updates own availability" ON public.resources
FOR UPDATE TO authenticated
USING (id IN (SELECT public.current_driver_resource_ids()))
WITH CHECK (id IN (SELECT public.current_driver_resource_ids()));

DROP POLICY IF EXISTS "driver reads own service history" ON public.transport_service_history;
CREATE POLICY "driver reads own service history" ON public.transport_service_history
FOR SELECT TO authenticated
USING (service_id IN (
  SELECT ts.id FROM public.transport_services ts
  WHERE ts.driver_resource_id IN (SELECT public.current_driver_resource_ids())
));

DROP POLICY IF EXISTS "driver reads own availability log" ON public.resource_availability_log;
CREATE POLICY "driver reads own availability log" ON public.resource_availability_log
FOR SELECT TO authenticated
USING (resource_id IN (SELECT public.current_driver_resource_ids()));

-- 8. sincronización automática de disponibilidad del conductor
CREATE OR REPLACE FUNCTION public.tg_sync_driver_availability()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_active int;
BEGIN
  IF NEW.driver_resource_id IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;

  SELECT count(*) INTO v_active
  FROM public.transport_services ts
  WHERE ts.driver_resource_id = NEW.driver_resource_id
    AND ts.record_status = 'active'
    AND ts.status::text IN ('en_route','at_origin','in_transit');

  IF v_active > 0 THEN
    UPDATE public.resources SET availability = 'busy'
    WHERE id = NEW.driver_resource_id AND availability <> 'busy' AND availability <> 'unavailable';
  ELSE
    UPDATE public.resources SET availability = 'available'
    WHERE id = NEW.driver_resource_id AND availability = 'busy';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_driver_availability ON public.transport_services;
CREATE TRIGGER trg_sync_driver_availability
AFTER INSERT OR UPDATE OF status, driver_resource_id ON public.transport_services
FOR EACH ROW EXECUTE FUNCTION public.tg_sync_driver_availability();