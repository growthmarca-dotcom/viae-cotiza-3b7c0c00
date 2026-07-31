-- ============ 1. EVENTOS DE COMUNICACIÓN (preparación WhatsApp) ============
CREATE TYPE public.communication_event_type AS ENUM (
  'trip_assigned', 'trip_reminder', 'schedule_changed', 'service_confirmed', 'trip_completed'
);
CREATE TYPE public.communication_event_status AS ENUM ('pending', 'sent', 'error');

CREATE TABLE public.communication_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid,
  recipient_user_id uuid,
  recipient_name text,
  phone text,
  event_type public.communication_event_type NOT NULL,
  message text NOT NULL,
  status public.communication_event_status NOT NULL DEFAULT 'pending',
  error_message text,
  entity text,
  entity_id uuid,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  scheduled_for timestamptz,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.communication_events TO authenticated;
GRANT ALL ON public.communication_events TO service_role;
ALTER TABLE public.communication_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "comm_events_select" ON public.communication_events
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR recipient_user_id = auth.uid() OR owner_id = auth.uid());

CREATE POLICY "comm_events_insert" ON public.communication_events
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR owner_id = auth.uid());

CREATE POLICY "comm_events_update_admin" ON public.communication_events
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_comm_events_updated_at BEFORE UPDATE ON public.communication_events
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE INDEX idx_comm_events_status ON public.communication_events (status, created_at DESC);
CREATE INDEX idx_comm_events_recipient ON public.communication_events (recipient_user_id, created_at DESC);

-- auditoría de creación de eventos de comunicación
CREATE OR REPLACE FUNCTION public.tg_audit_communication_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  INSERT INTO public.audit_log (actor_id, action, entity, entity_id, details)
  VALUES (auth.uid(), CASE WHEN TG_OP = 'INSERT' THEN 'communication_event_created' ELSE 'communication_event_updated' END,
          'communication_events', NEW.id,
          jsonb_build_object('event_type', NEW.event_type, 'status', NEW.status, 'entity', NEW.entity, 'entity_id', NEW.entity_id));
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_audit_communication_events
  AFTER INSERT OR UPDATE OF status ON public.communication_events
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit_communication_event();

-- generación automática de eventos desde los servicios de transporte
CREATE OR REPLACE FUNCTION public.tg_transport_communication_events()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_uid uuid;
  v_phone text;
  v_name text;
  v_route text := COALESCE(NEW.origin, '—') || ' → ' || COALESCE(NEW.destination, '—');
  v_when text := COALESCE(NEW.service_date::text, 'sin fecha')
                 || COALESCE(' ' || to_char(NEW.service_time, 'HH24:MI'), '');
BEGIN
  IF NEW.driver_resource_id IS NULL THEN RETURN NEW; END IF;

  SELECT COALESCE(r.driver_user_id, a.user_id),
         COALESCE(r.whatsapp, a.whatsapp, a.wa_number),
         COALESCE(NULLIF(trim(COALESCE(r.driver_first_name,'') || ' ' || COALESCE(r.driver_last_name,'')), ''), r.name)
    INTO v_uid, v_phone, v_name
  FROM public.resources r
  LEFT JOIN public.agents a ON a.id = r.agent_id
  WHERE r.id = NEW.driver_resource_id;

  IF TG_OP = 'INSERT' OR NEW.driver_resource_id IS DISTINCT FROM OLD.driver_resource_id THEN
    INSERT INTO public.communication_events (owner_id, recipient_user_id, recipient_name, phone, event_type, message, entity, entity_id, data)
    VALUES (NEW.user_id, v_uid, v_name, v_phone, 'trip_assigned',
            'Nuevo viaje asignado: ' || v_route || ' · ' || v_when,
            'transport_services', NEW.id,
            jsonb_build_object('service_date', NEW.service_date, 'service_time', NEW.service_time));
    RETURN NEW;
  END IF;

  IF NEW.service_date IS DISTINCT FROM OLD.service_date
     OR NEW.service_time IS DISTINCT FROM OLD.service_time
     OR NEW.duration_minutes IS DISTINCT FROM OLD.duration_minutes THEN
    INSERT INTO public.communication_events (owner_id, recipient_user_id, recipient_name, phone, event_type, message, entity, entity_id, data)
    VALUES (NEW.user_id, v_uid, v_name, v_phone, 'schedule_changed',
            'Cambio de horario: ' || v_route || ' · ' || v_when,
            'transport_services', NEW.id,
            jsonb_build_object('service_date', NEW.service_date, 'service_time', NEW.service_time));
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status::text = 'accepted' THEN
      INSERT INTO public.communication_events (owner_id, recipient_user_id, recipient_name, phone, event_type, message, entity, entity_id)
      VALUES (NEW.user_id, v_uid, v_name, v_phone, 'service_confirmed',
              'Servicio confirmado: ' || v_route || ' · ' || v_when, 'transport_services', NEW.id);
    ELSIF NEW.status::text = 'completed' THEN
      INSERT INTO public.communication_events (owner_id, recipient_user_id, recipient_name, phone, event_type, message, entity, entity_id)
      VALUES (NEW.user_id, v_uid, v_name, v_phone, 'trip_completed',
              'Viaje finalizado: ' || v_route || ' · ' || v_when, 'transport_services', NEW.id);
    END IF;
  END IF;

  RETURN NEW;
END; $$;

CREATE TRIGGER trg_transport_communication_events
  AFTER INSERT OR UPDATE ON public.transport_services
  FOR EACH ROW EXECUTE FUNCTION public.tg_transport_communication_events();

-- ============ 2. SEGUIMIENTO PARA CLIENTE ============
CREATE TYPE public.client_trip_status AS ENUM (
  'confirmed', 'driver_assigned', 'preparing', 'on_the_way', 'finished', 'cancelled'
);

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS tracking_token text NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
  ADD COLUMN IF NOT EXISTS tracking_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS client_status public.client_trip_status NOT NULL DEFAULT 'confirmed';

CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_tracking_token ON public.bookings (tracking_token);

-- estado visible al cliente calculado desde el servicio de transporte
CREATE OR REPLACE FUNCTION public.sync_booking_client_status(_booking_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_status public.client_trip_status;
  v_old public.client_trip_status;
  v_owner uuid;
BEGIN
  IF _booking_id IS NULL THEN RETURN; END IF;
  SELECT client_status, user_id INTO v_old, v_owner FROM public.bookings WHERE id = _booking_id;
  IF v_owner IS NULL THEN RETURN; END IF;

  SELECT CASE
    WHEN bool_or(ts.status::text IN ('en_route','at_origin','in_transit')) THEN 'on_the_way'
    WHEN bool_or(ts.status::text = 'accepted') THEN 'preparing'
    WHEN bool_or(ts.driver_resource_id IS NOT NULL AND ts.status::text NOT IN ('cancelled','rejected','completed')) THEN 'driver_assigned'
    WHEN count(*) > 0 AND bool_and(ts.status::text IN ('completed','cancelled')) THEN 'finished'
    ELSE 'confirmed' END::public.client_trip_status
  INTO v_status
  FROM public.transport_services ts
  WHERE ts.booking_id = _booking_id AND ts.record_status = 'active';

  v_status := COALESCE(v_status, 'confirmed');
  IF v_status IS DISTINCT FROM v_old THEN
    UPDATE public.bookings SET client_status = v_status WHERE id = _booking_id;
    INSERT INTO public.audit_log (actor_id, action, entity, entity_id, details)
    VALUES (auth.uid(), 'client_status_changed', 'bookings', _booking_id,
            jsonb_build_object('from', v_old, 'to', v_status));
  END IF;
END; $$;

CREATE OR REPLACE FUNCTION public.tg_sync_booking_client_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  PERFORM public.sync_booking_client_status(NEW.booking_id);
  IF TG_OP = 'UPDATE' AND NEW.booking_id IS DISTINCT FROM OLD.booking_id THEN
    PERFORM public.sync_booking_client_status(OLD.booking_id);
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_sync_booking_client_status
  AFTER INSERT OR UPDATE ON public.transport_services
  FOR EACH ROW EXECUTE FUNCTION public.tg_sync_booking_client_status();

-- lectura pública mínima por token (sin datos privados)
CREATE OR REPLACE FUNCTION public.booking_public_tracking(_token text)
RETURNS TABLE(booking_number text, destination text, travel_start date, travel_end date,
              client_status public.client_trip_status, updated_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT b.booking_number, b.destination, b.travel_start, b.travel_end, b.client_status, b.updated_at
  FROM public.bookings b
  WHERE b.tracking_token = _token
    AND b.tracking_enabled = true
    AND b.record_status = 'active'
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.booking_public_tracking(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.booking_public_tracking(text) TO anon, authenticated;

-- ============ 3. BRANDING DESARROLLADOR ============
ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS show_developer_branding boolean NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION public.tg_audit_branding_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.show_developer_branding IS DISTINCT FROM OLD.show_developer_branding THEN
    INSERT INTO public.audit_log (actor_id, action, entity, entity_id, details)
    VALUES (auth.uid(), 'branding_changed', 'company_settings', NEW.id,
            jsonb_build_object('show_developer_branding', jsonb_build_object('from', OLD.show_developer_branding, 'to', NEW.show_developer_branding)));
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_audit_branding_change
  AFTER UPDATE ON public.company_settings
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit_branding_change();

-- ============ 4. REALTIME ============
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER TABLE public.communication_events REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.communication_events;