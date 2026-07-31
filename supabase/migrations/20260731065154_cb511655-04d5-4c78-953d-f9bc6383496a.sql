-- 1. Nuevos estados operativos de recursos
ALTER TYPE public.resource_availability ADD VALUE IF NOT EXISTS 'assigned';
ALTER TYPE public.resource_availability ADD VALUE IF NOT EXISTS 'reserved';
ALTER TYPE public.resource_availability ADD VALUE IF NOT EXISTS 'in_service';

-- 2. Notificaciones internas
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind text NOT NULL DEFAULT 'transport_assignment',
  title text NOT NULL,
  body text,
  entity text,
  entity_id uuid,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_select_own" ON public.notifications;
CREATE POLICY "notifications_select_own" ON public.notifications
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "notifications_update_own" ON public.notifications;
CREATE POLICY "notifications_update_own" ON public.notifications
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS notifications_user_created_idx
  ON public.notifications (user_id, created_at DESC);

-- 3. Notificación al conductor cuando se le asigna un servicio
CREATE OR REPLACE FUNCTION public.tg_notify_driver_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid;
  v_booking text;
  v_client text;
BEGIN
  IF NEW.driver_resource_id IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND NEW.driver_resource_id IS NOT DISTINCT FROM OLD.driver_resource_id THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(r.driver_user_id, a.user_id) INTO v_uid
  FROM public.resources r
  LEFT JOIN public.agents a ON a.id = r.agent_id
  WHERE r.id = NEW.driver_resource_id;

  IF v_uid IS NULL THEN RETURN NEW; END IF;

  IF NEW.booking_id IS NOT NULL THEN
    SELECT b.booking_number, c.full_name INTO v_booking, v_client
    FROM public.bookings b
    LEFT JOIN public.clients c ON c.id = b.client_id
    WHERE b.id = NEW.booking_id;
  END IF;

  INSERT INTO public.notifications (user_id, kind, title, body, entity, entity_id, data)
  VALUES (
    v_uid,
    'transport_assignment',
    'Nuevo servicio asignado',
    COALESCE(NEW.service_date::text, 'Sin fecha')
      || COALESCE(' · ' || to_char(NEW.service_time, 'HH24:MI'), '')
      || ' · ' || COALESCE(NEW.origin, '—') || ' → ' || COALESCE(NEW.destination, '—'),
    'transport_services',
    NEW.id,
    jsonb_build_object(
      'service_date', NEW.service_date,
      'service_time', NEW.service_time,
      'origin', NEW.origin,
      'destination', NEW.destination,
      'pax_count', NEW.pax_count,
      'luggage_count', NEW.luggage_count,
      'payment_mode', NEW.payment_mode,
      'collection_status', NEW.collection_status,
      'collection_amount', NEW.collection_amount,
      'collection_currency', NEW.collection_currency,
      'booking_number', v_booking,
      'client_name', v_client
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_driver_assignment ON public.transport_services;
CREATE TRIGGER trg_notify_driver_assignment
AFTER INSERT OR UPDATE OF driver_resource_id ON public.transport_services
FOR EACH ROW EXECUTE FUNCTION public.tg_notify_driver_assignment();

-- 4. Sincronización de estados de conductor y vehículo
CREATE OR REPLACE FUNCTION public.sync_transport_resource_state(_resource_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_cat text;
  v_running int;
  v_booked int;
  v_target text;
BEGIN
  IF _resource_id IS NULL THEN RETURN; END IF;
  SELECT category::text INTO v_cat FROM public.resources WHERE id = _resource_id;
  IF v_cat IS NULL THEN RETURN; END IF;

  SELECT
    count(*) FILTER (WHERE ts.status::text IN ('en_route','at_origin','in_transit')),
    count(*) FILTER (WHERE ts.status::text IN ('assigned','accepted'))
  INTO v_running, v_booked
  FROM public.transport_services ts
  WHERE ts.record_status = 'active'
    AND (ts.driver_resource_id = _resource_id OR ts.vehicle_resource_id = _resource_id);

  IF v_cat = 'vehicle' THEN
    v_target := CASE WHEN v_running > 0 THEN 'in_service'
                     WHEN v_booked > 0 THEN 'reserved'
                     ELSE 'available' END;
  ELSE
    v_target := CASE WHEN v_running > 0 THEN 'busy'
                     WHEN v_booked > 0 THEN 'assigned'
                     ELSE 'available' END;
  END IF;

  UPDATE public.resources
  SET availability = v_target::resource_availability
  WHERE id = _resource_id
    AND availability::text NOT IN ('unavailable','out_of_service','off_hours')
    AND availability::text IS DISTINCT FROM v_target;

  -- si estaba ocupado/reservado por servicios y ya no hay ninguno, liberar
  UPDATE public.resources
  SET availability = 'available'::resource_availability
  WHERE id = _resource_id
    AND v_target = 'available'
    AND availability::text IN ('busy','assigned','reserved','in_service');
END;
$$;

CREATE OR REPLACE FUNCTION public.tg_sync_driver_availability()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.driver_resource_id IS DISTINCT FROM OLD.driver_resource_id THEN
      PERFORM public.sync_transport_resource_state(OLD.driver_resource_id);
    END IF;
    IF NEW.vehicle_resource_id IS DISTINCT FROM OLD.vehicle_resource_id THEN
      PERFORM public.sync_transport_resource_state(OLD.vehicle_resource_id);
    END IF;
  END IF;

  PERFORM public.sync_transport_resource_state(NEW.driver_resource_id);
  PERFORM public.sync_transport_resource_state(NEW.vehicle_resource_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_driver_availability ON public.transport_services;
CREATE TRIGGER trg_sync_driver_availability
AFTER INSERT OR UPDATE OF status, driver_resource_id, vehicle_resource_id, record_status
ON public.transport_services
FOR EACH ROW EXECUTE FUNCTION public.tg_sync_driver_availability();

-- 5. Auditoría específica de la operación de transporte
CREATE OR REPLACE FUNCTION public.tg_transport_operation_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_action text;
  v_details jsonb := '{}'::jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.driver_resource_id IS NOT NULL THEN
      INSERT INTO public.audit_log (actor_id, action, entity, entity_id, details)
      VALUES (auth.uid(), 'transport_assigned', 'transport_services', NEW.id,
              jsonb_build_object('driver_resource_id', NEW.driver_resource_id,
                                 'vehicle_resource_id', NEW.vehicle_resource_id));
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.driver_resource_id IS DISTINCT FROM OLD.driver_resource_id THEN
    INSERT INTO public.audit_log (actor_id, action, entity, entity_id, details)
    VALUES (auth.uid(),
            CASE WHEN OLD.driver_resource_id IS NULL THEN 'transport_assigned' ELSE 'transport_driver_changed' END,
            'transport_services', NEW.id,
            jsonb_build_object('from', OLD.driver_resource_id, 'to', NEW.driver_resource_id));
  END IF;

  IF NEW.vehicle_resource_id IS DISTINCT FROM OLD.vehicle_resource_id THEN
    INSERT INTO public.audit_log (actor_id, action, entity, entity_id, details)
    VALUES (auth.uid(), 'transport_vehicle_changed', 'transport_services', NEW.id,
            jsonb_build_object('from', OLD.vehicle_resource_id, 'to', NEW.vehicle_resource_id));
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    v_action := CASE NEW.status::text
      WHEN 'accepted' THEN 'transport_accepted'
      WHEN 'rejected' THEN 'transport_rejected'
      WHEN 'en_route' THEN 'transport_started'
      WHEN 'completed' THEN 'transport_completed'
      ELSE 'transport_status_changed' END;
    v_details := jsonb_build_object('from', OLD.status, 'to', NEW.status);
    IF NEW.status::text = 'rejected' THEN
      v_details := v_details || jsonb_build_object('reason', NEW.rejection_reason);
    END IF;
    INSERT INTO public.audit_log (actor_id, action, entity, entity_id, details)
    VALUES (auth.uid(), v_action, 'transport_services', NEW.id, v_details);
  END IF;

  IF NEW.collection_status IS DISTINCT FROM OLD.collection_status
     AND NEW.collection_status::text = 'collected' THEN
    INSERT INTO public.audit_log (actor_id, action, entity, entity_id, details)
    VALUES (auth.uid(), 'transport_collection_confirmed', 'transport_services', NEW.id,
            jsonb_build_object('amount', NEW.collected_amount, 'currency', NEW.collection_currency));
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_transport_operation_audit ON public.transport_services;
CREATE TRIGGER trg_transport_operation_audit
AFTER INSERT OR UPDATE ON public.transport_services
FOR EACH ROW EXECUTE FUNCTION public.tg_transport_operation_audit();