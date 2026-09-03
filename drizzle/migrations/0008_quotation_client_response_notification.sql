-- Notificación interna al agente cuando el cliente responde la cotización
-- desde el enlace público. Reutiliza el centro de notificaciones existente
-- (`notifications` + campana global). No crea reservas ni cambia estados.

-- Idempotencia: una sola notificación por (usuario, cotización, tipo).
CREATE UNIQUE INDEX IF NOT EXISTS notifications_quotation_response_uniq
  ON public.notifications (user_id, entity_id, kind)
  WHERE kind = 'quotation_client_response' AND entity = 'quotations';

CREATE OR REPLACE FUNCTION public.tg_quotation_client_response_notify()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_name text;
  v_title text;
  v_body text;
  v_uid uuid;
  v_recipients uuid[] := '{}';
  v_agent_uid uuid;
BEGIN
  -- Sólo en la transición "sin responder" -> "respondida".
  IF NEW.client_responded_at IS NULL OR OLD.client_responded_at IS NOT NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.status NOT IN ('accepted', 'rejected') THEN
    RETURN NEW;
  END IF;

  SELECT nullif(btrim(coalesce(c.full_name, '') || ' ' || coalesce(c.last_name, '')), '')
    INTO v_client_name
    FROM public.clients c
   WHERE c.id = NEW.client_id;

  v_client_name := coalesce(
    v_client_name,
    nullif(btrim(coalesce(NEW.guest_first_name, '') || ' ' || coalesce(NEW.guest_last_name, '')), ''),
    'Cliente'
  );

  v_title := CASE WHEN NEW.status = 'accepted'
                  THEN 'Cotización aceptada por el cliente'
                  ELSE 'Cotización rechazada por el cliente' END;

  v_body := concat_ws(' · ',
    coalesce(NEW.quotation_number, 'Cotización'),
    v_client_name,
    to_char(NEW.client_responded_at AT TIME ZONE 'America/Argentina/Buenos_Aires', 'DD/MM/YYYY HH24:MI'),
    nullif(btrim(coalesce(NEW.client_response_note, '')), '')
  );

  -- Agente responsable según las relaciones existentes:
  -- 1) agente asignado a la oportunidad, 2) usuario dueño de la cotización.
  IF NEW.opportunity_id IS NOT NULL THEN
    SELECT a.user_id INTO v_agent_uid
      FROM public.opportunities o
      JOIN public.agents a ON a.id = o.assigned_agent_id
     WHERE o.id = NEW.opportunity_id;
    IF v_agent_uid IS NOT NULL THEN
      v_recipients := array_append(v_recipients, v_agent_uid);
    END IF;
  END IF;

  IF NEW.user_id IS NOT NULL AND NOT (NEW.user_id = ANY (v_recipients)) THEN
    v_recipients := array_append(v_recipients, NEW.user_id);
  END IF;

  IF array_length(v_recipients, 1) IS NULL THEN
    -- Sin agente responsable: no se interrumpe la respuesta del cliente,
    -- queda registrado para revisión administrativa.
    INSERT INTO public.audit_log (actor_id, action, entity, entity_id, details)
    VALUES (NULL, 'quotation_response_without_agent', 'quotations', NEW.id,
            jsonb_build_object('status', NEW.status,
                               'quotation_number', NEW.quotation_number,
                               'responded_at', NEW.client_responded_at));
    RETURN NEW;
  END IF;

  FOREACH v_uid IN ARRAY v_recipients LOOP
    INSERT INTO public.notifications (user_id, kind, title, body, entity, entity_id, data)
    VALUES (v_uid, 'quotation_client_response', v_title, v_body, 'quotations', NEW.id,
            jsonb_build_object(
              'status', NEW.status,
              'quotation_number', NEW.quotation_number,
              'client_name', v_client_name,
              'responded_at', NEW.client_responded_at,
              'note', nullif(btrim(coalesce(NEW.client_response_note, '')), ''),
              'organization_id', NEW.organization_id,
              'opportunity_id', NEW.opportunity_id,
              'link', '/quotations/' || NEW.id::text))
    ON CONFLICT DO NOTHING;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_quotation_client_response_notify ON public.quotations;
CREATE TRIGGER trg_quotation_client_response_notify
AFTER UPDATE OF status, client_responded_at ON public.quotations
FOR EACH ROW
EXECUTE FUNCTION public.tg_quotation_client_response_notify();

REVOKE ALL ON FUNCTION public.tg_quotation_client_response_notify() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.tg_quotation_client_response_notify() FROM anon;
