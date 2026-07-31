-- 1. Duración estimada + ubicación estructurada + seguimiento
ALTER TABLE public.transport_services
  ADD COLUMN IF NOT EXISTS duration_minutes integer,
  ADD COLUMN IF NOT EXISTS estimated_end_time time without time zone,
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS tourist_zone text,
  ADD COLUMN IF NOT EXISTS last_status_at timestamp with time zone NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS last_updated_by uuid;

ALTER TABLE public.resources
  ADD COLUMN IF NOT EXISTS tourist_zones text[] NOT NULL DEFAULT '{}'::text[];

-- 2. Hora estimada de finalización + sello de última actualización
CREATE OR REPLACE FUNCTION public.tg_transport_service_stamp()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.service_time IS NOT NULL AND NEW.duration_minutes IS NOT NULL THEN
    NEW.estimated_end_time := (NEW.service_time + make_interval(mins => NEW.duration_minutes))::time;
  ELSE
    NEW.estimated_end_time := NULL;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.last_status_at := now();
    NEW.last_updated_by := auth.uid();
  ELSIF NEW.status IS DISTINCT FROM OLD.status
     OR NEW.collection_status IS DISTINCT FROM OLD.collection_status
     OR NEW.driver_resource_id IS DISTINCT FROM OLD.driver_resource_id
     OR NEW.vehicle_resource_id IS DISTINCT FROM OLD.vehicle_resource_id
     OR NEW.service_date IS DISTINCT FROM OLD.service_date
     OR NEW.service_time IS DISTINCT FROM OLD.service_time
     OR NEW.duration_minutes IS DISTINCT FROM OLD.duration_minutes THEN
    NEW.last_status_at := now();
    NEW.last_updated_by := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_transport_service_stamp ON public.transport_services;
CREATE TRIGGER trg_transport_service_stamp
BEFORE INSERT OR UPDATE ON public.transport_services
FOR EACH ROW EXECUTE FUNCTION public.tg_transport_service_stamp();

-- 3. Notificaciones globales de operación
CREATE OR REPLACE FUNCTION public.tg_notify_transport_events()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_driver_uid uuid;
  v_owner uuid := NEW.user_id;
  v_route text := COALESCE(NEW.origin, '—') || ' → ' || COALESCE(NEW.destination, '—');
  v_when text := COALESCE(NEW.service_date::text, 'sin fecha')
                 || COALESCE(' ' || to_char(NEW.service_time, 'HH24:MI'), '');
  v_title text;
  v_kind text;
BEGIN
  IF TG_OP <> 'UPDATE' THEN RETURN NEW; END IF;

  SELECT COALESCE(r.driver_user_id, a.user_id) INTO v_driver_uid
  FROM public.resources r
  LEFT JOIN public.agents a ON a.id = r.agent_id
  WHERE r.id = NEW.driver_resource_id;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    v_kind := 'transport_status';
    v_title := CASE NEW.status::text
      WHEN 'accepted'  THEN 'El conductor aceptó el servicio'
      WHEN 'rejected'  THEN 'El conductor rechazó el servicio'
      WHEN 'en_route'  THEN 'Servicio iniciado'
      WHEN 'at_origin' THEN 'Conductor en el punto de origen'
      WHEN 'in_transit' THEN 'Pasajero a bordo'
      WHEN 'completed' THEN 'Servicio finalizado'
      WHEN 'cancelled' THEN 'Servicio cancelado'
      ELSE 'Cambio de estado del servicio' END;

    IF v_owner IS NOT NULL AND v_owner IS DISTINCT FROM auth.uid() THEN
      INSERT INTO public.notifications (user_id, kind, title, body, entity, entity_id, data)
      VALUES (v_owner, v_kind, v_title, v_route || ' · ' || v_when, 'transport_services', NEW.id,
              jsonb_build_object('from', OLD.status, 'to', NEW.status, 'actor', auth.uid()));
    END IF;

    IF v_driver_uid IS NOT NULL AND v_driver_uid IS DISTINCT FROM auth.uid()
       AND NEW.status::text IN ('cancelled','assigned') THEN
      INSERT INTO public.notifications (user_id, kind, title, body, entity, entity_id, data)
      VALUES (v_driver_uid, v_kind,
              CASE WHEN NEW.status::text = 'cancelled' THEN 'Servicio cancelado' ELSE 'Servicio asignado' END,
              v_route || ' · ' || v_when, 'transport_services', NEW.id,
              jsonb_build_object('from', OLD.status, 'to', NEW.status, 'actor', auth.uid()));
    END IF;
  END IF;

  -- cambio de horario / duración → aviso al conductor
  IF (NEW.service_date IS DISTINCT FROM OLD.service_date
      OR NEW.service_time IS DISTINCT FROM OLD.service_time
      OR NEW.duration_minutes IS DISTINCT FROM OLD.duration_minutes)
     AND v_driver_uid IS NOT NULL AND v_driver_uid IS DISTINCT FROM auth.uid() THEN
    INSERT INTO public.notifications (user_id, kind, title, body, entity, entity_id, data)
    VALUES (v_driver_uid, 'transport_schedule', 'Cambio de horario del servicio',
            v_route || ' · ' || v_when, 'transport_services', NEW.id,
            jsonb_build_object('service_date', NEW.service_date, 'service_time', NEW.service_time,
                               'duration_minutes', NEW.duration_minutes, 'actor', auth.uid()));
  END IF;

  -- cobro informado → aviso al responsable
  IF NEW.collection_status IS DISTINCT FROM OLD.collection_status
     AND NEW.collection_status::text IN ('collected','reported')
     AND v_owner IS NOT NULL AND v_owner IS DISTINCT FROM auth.uid() THEN
    INSERT INTO public.notifications (user_id, kind, title, body, entity, entity_id, data)
    VALUES (v_owner, 'transport_collection', 'Cobro informado por el conductor',
            v_route || ' · ' || COALESCE(NEW.collected_amount::text, '—') || ' ' || NEW.collection_currency,
            'transport_services', NEW.id,
            jsonb_build_object('amount', NEW.collected_amount, 'currency', NEW.collection_currency,
                               'actor', auth.uid()));
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_transport_events ON public.transport_services;
CREATE TRIGGER trg_notify_transport_events
AFTER UPDATE ON public.transport_services
FOR EACH ROW EXECUTE FUNCTION public.tg_notify_transport_events();

-- 4. Auditoría de lectura de notificaciones
CREATE OR REPLACE FUNCTION public.mark_notifications_read(_ids uuid[])
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_count integer := 0;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Sesión no válida'; END IF;

  WITH upd AS (
    UPDATE public.notifications
    SET read_at = now()
    WHERE id = ANY(_ids) AND user_id = v_uid AND read_at IS NULL
    RETURNING 1
  )
  SELECT count(*)::int INTO v_count FROM upd;

  IF v_count > 0 THEN
    INSERT INTO public.audit_log (actor_id, action, entity, entity_id, details)
    VALUES (v_uid, 'notifications_read', 'notifications', NULL,
            jsonb_build_object('count', v_count));
  END IF;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_notifications_read(uuid[]) FROM public;
GRANT EXECUTE ON FUNCTION public.mark_notifications_read(uuid[]) TO authenticated;
