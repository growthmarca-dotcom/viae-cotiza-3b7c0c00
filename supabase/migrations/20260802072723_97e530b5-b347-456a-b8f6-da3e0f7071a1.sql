-- 1) Helper interno de escritura
CREATE OR REPLACE FUNCTION public.create_booking_timeline_event(
  _booking_id uuid,
  _event_type public.booking_timeline_event,
  _entity_type text DEFAULT NULL,
  _entity_id uuid DEFAULT NULL,
  _actor uuid DEFAULT NULL,
  _actor_role text DEFAULT NULL,
  _visibility public.timeline_visibility DEFAULT 'internal',
  _metadata jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_id uuid;
  v_actor uuid := COALESCE(_actor, auth.uid());
  v_role text := _actor_role;
BEGIN
  IF _booking_id IS NULL OR _event_type IS NULL THEN
    RETURN NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.bookings WHERE id = _booking_id) THEN
    RETURN NULL;
  END IF;

  IF v_role IS NULL AND v_actor IS NOT NULL THEN
    SELECT ur.role::text INTO v_role
    FROM public.user_roles ur
    WHERE ur.user_id = v_actor
    ORDER BY CASE ur.role::text
               WHEN 'admin' THEN 1
               WHEN 'operations' THEN 2
               WHEN 'agent' THEN 3
               ELSE 4 END
    LIMIT 1;
  END IF;

  INSERT INTO public.booking_timeline
    (booking_id, event_type, entity_type, entity_id, actor, actor_role, visibility, metadata)
  VALUES
    (_booking_id, _event_type, _entity_type, _entity_id, v_actor,
     COALESCE(v_role, CASE WHEN v_actor IS NULL THEN 'system' END),
     COALESCE(_visibility, 'internal'), COALESCE(_metadata, '{}'::jsonb))
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_booking_timeline_event(uuid, public.booking_timeline_event, text, uuid, uuid, text, public.timeline_visibility, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_booking_timeline_event(uuid, public.booking_timeline_event, text, uuid, uuid, text, public.timeline_visibility, jsonb) TO service_role;

-- 2) bookings: created / status_changed
CREATE OR REPLACE FUNCTION public.tg_timeline_bookings()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.create_booking_timeline_event(
      NEW.id, 'created', 'bookings', NEW.id, auth.uid(), NULL, 'internal',
      jsonb_build_object('booking_number', NEW.booking_number, 'status', NEW.status,
                         'destination', NEW.destination));
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM public.create_booking_timeline_event(
      NEW.id, 'status_changed', 'bookings', NEW.id, auth.uid(), NULL, 'internal',
      jsonb_build_object('from', OLD.status, 'to', NEW.status));
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_timeline_bookings ON public.bookings;
CREATE TRIGGER trg_timeline_bookings
AFTER INSERT OR UPDATE ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.tg_timeline_bookings();

-- 3) booking_payments: payment_received
CREATE OR REPLACE FUNCTION public.tg_timeline_booking_payments()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_fire boolean := false;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_fire := NEW.status IN ('paid','partial');
  ELSE
    v_fire := NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('paid','partial');
  END IF;

  IF v_fire THEN
    PERFORM public.create_booking_timeline_event(
      NEW.booking_id, 'payment_received', 'booking_payments', NEW.id, auth.uid(), NULL, 'internal',
      jsonb_build_object('amount', NEW.amount, 'currency', NEW.currency,
                         'kind', NEW.kind, 'status', NEW.status,
                         'method', NEW.method, 'paid_at', NEW.paid_at));
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_timeline_booking_payments ON public.booking_payments;
CREATE TRIGGER trg_timeline_booking_payments
AFTER INSERT OR UPDATE ON public.booking_payments
FOR EACH ROW EXECUTE FUNCTION public.tg_timeline_booking_payments();

-- 4) booking_services: service_confirmed / updated (solo cambios operativos relevantes)
CREATE OR REPLACE FUNCTION public.tg_timeline_booking_services()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_meta jsonb;
  v_org text;
BEGIN
  SELECT o.trade_name INTO v_org FROM public.organizations o WHERE o.id = NEW.organization_id;
  v_meta := jsonb_build_object(
    'kind', NEW.kind, 'title', NEW.title, 'status', NEW.status,
    'service_date', NEW.service_date,
    'provider', COALESCE(v_org, NEW.provider_name));

  IF TG_OP = 'UPDATE'
     AND NEW.status IS DISTINCT FROM OLD.status
     AND NEW.status::text IN ('services_coordinated','ready') THEN
    PERFORM public.create_booking_timeline_event(
      NEW.booking_id, 'service_confirmed', 'booking_services', NEW.id, auth.uid(), NULL, 'internal',
      v_meta || jsonb_build_object('from', OLD.status));
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND (NEW.status IS DISTINCT FROM OLD.status
          OR NEW.organization_id IS DISTINCT FROM OLD.organization_id
          OR NEW.provider_id IS DISTINCT FROM OLD.provider_id
          OR NEW.resource_id IS DISTINCT FROM OLD.resource_id
          OR NEW.service_date IS DISTINCT FROM OLD.service_date
          OR NEW.record_status IS DISTINCT FROM OLD.record_status) THEN
    PERFORM public.create_booking_timeline_event(
      NEW.booking_id, 'updated', 'booking_services', NEW.id, auth.uid(), NULL, 'internal', v_meta);
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_timeline_booking_services ON public.booking_services;
CREATE TRIGGER trg_timeline_booking_services
AFTER UPDATE ON public.booking_services
FOR EACH ROW EXECUTE FUNCTION public.tg_timeline_booking_services();

-- 5) booking_documents: document_added
CREATE OR REPLACE FUNCTION public.tg_timeline_booking_documents()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  PERFORM public.create_booking_timeline_event(
    NEW.booking_id, 'document_added', 'booking_documents', NEW.id, auth.uid(), NULL, 'internal',
    jsonb_build_object('kind', NEW.kind, 'title', NEW.title, 'created_at', NEW.created_at));
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_timeline_booking_documents ON public.booking_documents;
CREATE TRIGGER trg_timeline_booking_documents
AFTER INSERT ON public.booking_documents
FOR EACH ROW EXECUTE FUNCTION public.tg_timeline_booking_documents();

-- 6) booking_checklist_items: checklist_completed
CREATE OR REPLACE FUNCTION public.tg_timeline_checklist()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status = 'done' THEN
    PERFORM public.create_booking_timeline_event(
      NEW.booking_id, 'checklist_completed', 'booking_checklist_items', NEW.id, auth.uid(), NULL, 'internal',
      jsonb_build_object('code', NEW.code, 'label', NEW.label, 'is_critical', NEW.is_critical));
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_timeline_checklist ON public.booking_checklist_items;
CREATE TRIGGER trg_timeline_checklist
AFTER UPDATE ON public.booking_checklist_items
FOR EACH ROW EXECUTE FUNCTION public.tg_timeline_checklist();

-- 7) booking_incidents: incident_opened / incident_resolved
CREATE OR REPLACE FUNCTION public.tg_timeline_incidents()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.create_booking_timeline_event(
      NEW.booking_id, 'incident_opened', 'booking_incidents', NEW.id, auth.uid(), NULL, 'internal',
      jsonb_build_object('category', NEW.category, 'priority', NEW.priority, 'status', NEW.status));
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status::text IN ('resolved','closed') THEN
    PERFORM public.create_booking_timeline_event(
      NEW.booking_id, 'incident_resolved', 'booking_incidents', NEW.id, auth.uid(), NULL, 'internal',
      jsonb_build_object('category', NEW.category, 'status', NEW.status, 'from', OLD.status));
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_timeline_incidents ON public.booking_incidents;
CREATE TRIGGER trg_timeline_incidents
AFTER INSERT OR UPDATE ON public.booking_incidents
FOR EACH ROW EXECUTE FUNCTION public.tg_timeline_incidents();

-- 8) communication_events: communication_sent / communication_read
CREATE OR REPLACE FUNCTION public.tg_timeline_communication()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_booking uuid;
BEGIN
  IF NEW.entity = 'bookings' THEN
    v_booking := NEW.entity_id;
  ELSIF NEW.entity = 'transport_services' THEN
    SELECT ts.booking_id INTO v_booking FROM public.transport_services ts WHERE ts.id = NEW.entity_id;
  ELSIF NEW.entity = 'booking_services' THEN
    SELECT bs.booking_id INTO v_booking FROM public.booking_services bs WHERE bs.id = NEW.entity_id;
  END IF;

  IF v_booking IS NULL THEN RETURN NEW; END IF;

  IF NEW.status IS DISTINCT FROM COALESCE(OLD.status, NULL) AND NEW.status::text = 'sent' THEN
    PERFORM public.create_booking_timeline_event(
      v_booking, 'communication_sent', 'communication_events', NEW.id, auth.uid(), NULL, 'internal',
      jsonb_build_object('channel', 'whatsapp', 'event_type', NEW.event_type, 'sent_at', NEW.sent_at));
  END IF;

  IF TG_OP = 'UPDATE'
     AND (NEW.data ->> 'read_at') IS NOT NULL
     AND (OLD.data ->> 'read_at') IS NULL THEN
    PERFORM public.create_booking_timeline_event(
      v_booking, 'communication_read', 'communication_events', NEW.id, auth.uid(), NULL, 'internal',
      jsonb_build_object('channel', 'whatsapp', 'event_type', NEW.event_type));
  END IF;

  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_timeline_communication ON public.communication_events;
CREATE TRIGGER trg_timeline_communication
AFTER INSERT OR UPDATE ON public.communication_events
FOR EACH ROW EXECUTE FUNCTION public.tg_timeline_communication();