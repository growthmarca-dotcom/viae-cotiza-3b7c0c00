-- 1. Rol interno de Operaciones (se compara por texto para no usar el valor nuevo en esta misma transacción)
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'operations';

-- 2. Estados operativos
DO $$ BEGIN
  CREATE TYPE public.booking_operation_status AS ENUM (
    'pending_operation','preparing','services_coordinated','ready','in_execution','finished','incident','cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.booking_service_kind AS ENUM (
    'accommodation','transfer','excursion','car_rental','flight','insurance','gastronomy','other'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. Campos operativos en reservas
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS operation_status public.booking_operation_status NOT NULL DEFAULT 'pending_operation',
  ADD COLUMN IF NOT EXISTS operations_owner_id uuid,
  ADD COLUMN IF NOT EXISTS operations_taken_at timestamptz,
  ADD COLUMN IF NOT EXISTS operations_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS operations_notes text;

-- 4. Helper de rol Operaciones (sin literal del enum nuevo)
CREATE OR REPLACE FUNCTION public.is_operations(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role::text IN ('operations','admin')
  );
$$;

-- 5. Servicios incluidos en la reserva
CREATE TABLE IF NOT EXISTS public.booking_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  kind public.booking_service_kind NOT NULL DEFAULT 'other',
  title text NOT NULL DEFAULT '',
  status public.booking_operation_status NOT NULL DEFAULT 'pending_operation',
  responsible_user_id uuid,
  resource_id uuid REFERENCES public.resources(id) ON DELETE SET NULL,
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  provider_name text,
  service_date date,
  notes text,
  record_status public.record_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.booking_services TO authenticated;
GRANT ALL ON public.booking_services TO service_role;
ALTER TABLE public.booking_services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "booking_services_select" ON public.booking_services
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR responsible_user_id = auth.uid()
  OR public.is_operations(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.bookings b
    WHERE b.id = booking_services.booking_id AND b.assigned_agent_id = public.current_agent_id()
  )
);

CREATE POLICY "booking_services_insert" ON public.booking_services
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() OR public.is_operations(auth.uid()));

CREATE POLICY "booking_services_update" ON public.booking_services
FOR UPDATE TO authenticated
USING (user_id = auth.uid() OR public.is_operations(auth.uid()))
WITH CHECK (user_id = auth.uid() OR public.is_operations(auth.uid()));

CREATE INDEX IF NOT EXISTS booking_services_booking_idx ON public.booking_services(booking_id);

CREATE TRIGGER booking_services_set_updated_at
BEFORE UPDATE ON public.booking_services
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 6. Operaciones puede leer y actualizar reservas y recursos asignados
CREATE POLICY "operations read bookings" ON public.bookings
FOR SELECT TO authenticated USING (public.is_operations(auth.uid()));

CREATE POLICY "operations update bookings" ON public.bookings
FOR UPDATE TO authenticated
USING (public.is_operations(auth.uid()))
WITH CHECK (public.is_operations(auth.uid()));

CREATE POLICY "operations manage booking resources" ON public.booking_resources
FOR ALL TO authenticated
USING (public.is_operations(auth.uid()))
WITH CHECK (public.is_operations(auth.uid()));

CREATE POLICY "operations manage transport services" ON public.transport_services
FOR ALL TO authenticated
USING (public.is_operations(auth.uid()))
WITH CHECK (public.is_operations(auth.uid()));

-- 7. Aviso a administración y responsable operativo
CREATE OR REPLACE FUNCTION public.notify_operations_team(
  _title text, _body text, _entity text, _entity_id uuid, _data jsonb, _owner uuid, _kind text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.notifications (user_id, kind, title, body, entity, entity_id, data)
  SELECT DISTINCT ur.user_id, _kind, _title, _body, _entity, _entity_id, COALESCE(_data, '{}'::jsonb)
  FROM public.user_roles ur
  WHERE ur.role::text IN ('admin','operations')
    AND ur.user_id IS DISTINCT FROM auth.uid();

  IF _owner IS NOT NULL AND _owner IS DISTINCT FROM auth.uid()
     AND NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = _owner AND ur.role::text IN ('admin','operations')) THEN
    INSERT INTO public.notifications (user_id, kind, title, body, entity, entity_id, data)
    VALUES (_owner, _kind, _title, _body, _entity, _entity_id, COALESCE(_data, '{}'::jsonb));
  END IF;
END; $$;

-- 8. Triggers operativos sobre reservas
CREATE OR REPLACE FUNCTION public.tg_booking_operations()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_ctx text;
BEGIN
  v_ctx := COALESCE(NEW.booking_number, 'Reserva') || ' · ' || COALESCE(NEW.destination, 'sin destino')
           || COALESCE(' · ' || NEW.travel_start::text, '');

  IF TG_OP = 'INSERT' THEN
    PERFORM public.notify_operations_team(
      'Nueva reserva pendiente de operación', v_ctx, 'bookings', NEW.id,
      jsonb_build_object('operation_status', NEW.operation_status), NEW.operations_owner_id, 'operation_pending');
    RETURN NEW;
  END IF;

  IF NEW.operations_owner_id IS DISTINCT FROM OLD.operations_owner_id THEN
    NEW.operations_taken_at := CASE WHEN NEW.operations_owner_id IS NULL THEN NULL ELSE now() END;
    INSERT INTO public.audit_log (actor_id, action, entity, entity_id, details)
    VALUES (auth.uid(), 'operations_owner_assigned', 'bookings', NEW.id,
            jsonb_build_object('from', OLD.operations_owner_id, 'to', NEW.operations_owner_id));
    IF NEW.operations_owner_id IS NOT NULL AND NEW.operations_owner_id IS DISTINCT FROM auth.uid() THEN
      INSERT INTO public.notifications (user_id, kind, title, body, entity, entity_id, data)
      VALUES (NEW.operations_owner_id, 'operation_assigned', 'Sos responsable operativo de una reserva',
              v_ctx, 'bookings', NEW.id, jsonb_build_object('operation_status', NEW.operation_status));
    END IF;
  END IF;

  IF NEW.operation_status IS DISTINCT FROM OLD.operation_status THEN
    NEW.operations_updated_at := now();
    INSERT INTO public.audit_log (actor_id, action, entity, entity_id, details)
    VALUES (auth.uid(), 'operation_status_changed', 'bookings', NEW.id,
            jsonb_build_object('from', OLD.operation_status, 'to', NEW.operation_status));
    PERFORM public.notify_operations_team(
      CASE WHEN NEW.operation_status = 'incident' THEN 'Incidencia operativa en una reserva'
           ELSE 'Cambio de estado operativo' END,
      v_ctx, 'bookings', NEW.id,
      jsonb_build_object('from', OLD.operation_status, 'to', NEW.operation_status),
      NEW.operations_owner_id,
      CASE WHEN NEW.operation_status = 'incident' THEN 'operation_incident' ELSE 'operation_status' END);
  ELSIF NEW.operations_notes IS DISTINCT FROM OLD.operations_notes THEN
    NEW.operations_updated_at := now();
  END IF;

  RETURN NEW;
END; $$;

CREATE TRIGGER booking_operations_insert
AFTER INSERT ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.tg_booking_operations();

CREATE TRIGGER booking_operations_update
BEFORE UPDATE ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.tg_booking_operations();

-- 9. Auditoría y avisos de servicios de la reserva
CREATE OR REPLACE FUNCTION public.tg_booking_service_events()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_ctx text;
  v_owner uuid;
BEGIN
  SELECT b.operations_owner_id INTO v_owner FROM public.bookings b WHERE b.id = NEW.booking_id;
  v_ctx := COALESCE(NULLIF(NEW.title, ''), NEW.kind::text);

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_log (actor_id, action, entity, entity_id, details)
    VALUES (auth.uid(), 'created', 'booking_services', NEW.id,
            jsonb_build_object('booking_id', NEW.booking_id, 'kind', NEW.kind));
    PERFORM public.notify_operations_team('Servicio agregado a una reserva', v_ctx,
      'booking_services', NEW.id, jsonb_build_object('booking_id', NEW.booking_id), v_owner, 'operation_service');
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.audit_log (actor_id, action, entity, entity_id, details)
    VALUES (auth.uid(), 'operation_status_changed', 'booking_services', NEW.id,
            jsonb_build_object('from', OLD.status, 'to', NEW.status, 'booking_id', NEW.booking_id));
  END IF;

  IF NEW.resource_id IS DISTINCT FROM OLD.resource_id
     OR NEW.company_id IS DISTINCT FROM OLD.company_id
     OR NEW.provider_name IS DISTINCT FROM OLD.provider_name THEN
    INSERT INTO public.audit_log (actor_id, action, entity, entity_id, details)
    VALUES (auth.uid(), 'provider_assigned', 'booking_services', NEW.id,
            jsonb_build_object('resource_id', NEW.resource_id, 'company_id', NEW.company_id,
                               'provider_name', NEW.provider_name, 'booking_id', NEW.booking_id));
    PERFORM public.notify_operations_team('Servicio asignado', v_ctx,
      'booking_services', NEW.id, jsonb_build_object('booking_id', NEW.booking_id), v_owner, 'operation_service');
  END IF;

  IF NEW.responsible_user_id IS DISTINCT FROM OLD.responsible_user_id THEN
    INSERT INTO public.audit_log (actor_id, action, entity, entity_id, details)
    VALUES (auth.uid(), 'operations_owner_assigned', 'booking_services', NEW.id,
            jsonb_build_object('from', OLD.responsible_user_id, 'to', NEW.responsible_user_id));
    IF NEW.responsible_user_id IS NOT NULL AND NEW.responsible_user_id IS DISTINCT FROM auth.uid() THEN
      INSERT INTO public.notifications (user_id, kind, title, body, entity, entity_id, data)
      VALUES (NEW.responsible_user_id, 'operation_service', 'Sos responsable de un servicio',
              v_ctx, 'booking_services', NEW.id, jsonb_build_object('booking_id', NEW.booking_id));
    END IF;
  END IF;

  RETURN NEW;
END; $$;

CREATE TRIGGER booking_services_events
AFTER INSERT OR UPDATE ON public.booking_services
FOR EACH ROW EXECUTE FUNCTION public.tg_booking_service_events();

ALTER PUBLICATION supabase_realtime ADD TABLE public.booking_services;