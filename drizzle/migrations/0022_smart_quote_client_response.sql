-- Respuesta pública del cliente sobre la propuesta (Smart Quote).
ALTER TABLE public.smart_quotes
  ADD COLUMN IF NOT EXISTS client_responded_at timestamptz,
  ADD COLUMN IF NOT EXISTS client_response_note text,
  ADD COLUMN IF NOT EXISTS client_response_channel text;

CREATE OR REPLACE FUNCTION public.tg_smart_quote_client_response_notify()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_client_name text;
  v_title text;
  v_body text;
  v_uid uuid;
  v_recipients uuid[] := '{}';
  v_agent_uid uuid;
BEGIN
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
  v_client_name := coalesce(v_client_name, 'Cliente');

  v_title := CASE WHEN NEW.status = 'accepted'
                  THEN 'Propuesta aceptada por el cliente'
                  ELSE 'Propuesta rechazada por el cliente' END;

  v_body := concat_ws(' · ',
    coalesce(NEW.title, 'Propuesta'),
    v_client_name,
    to_char(NEW.client_responded_at AT TIME ZONE 'America/Argentina/Buenos_Aires', 'DD/MM/YYYY HH24:MI'),
    nullif(btrim(coalesce(NEW.client_response_note, '')), '')
  );

  IF NEW.agent_id IS NOT NULL THEN
    SELECT a.user_id INTO v_agent_uid FROM public.agents a WHERE a.id = NEW.agent_id;
    IF v_agent_uid IS NOT NULL THEN
      v_recipients := array_append(v_recipients, v_agent_uid);
    END IF;
  END IF;

  IF v_agent_uid IS NULL AND NEW.opportunity_id IS NOT NULL THEN
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
    INSERT INTO public.audit_log (actor_id, action, entity, entity_id, details)
    VALUES (NULL, 'smart_quote_response_without_agent', 'smart_quotes', NEW.id,
            jsonb_build_object('status', NEW.status, 'responded_at', NEW.client_responded_at));
    RETURN NEW;
  END IF;

  FOREACH v_uid IN ARRAY v_recipients LOOP
    INSERT INTO public.notifications (user_id, kind, title, body, entity, entity_id, data)
    VALUES (v_uid, 'quotation_client_response', v_title, v_body, 'smart_quotes', NEW.id,
            jsonb_build_object(
              'status', NEW.status,
              'title', NEW.title,
              'client_name', v_client_name,
              'responded_at', NEW.client_responded_at,
              'note', nullif(btrim(coalesce(NEW.client_response_note, '')), ''),
              'organization_id', NEW.organization_id,
              'opportunity_id', NEW.opportunity_id,
              'link', '/smart-quotes/' || NEW.id::text))
    ON CONFLICT DO NOTHING;
  END LOOP;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.tg_smart_quote_client_response_notify() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_smart_quote_client_response_notify ON public.smart_quotes;
CREATE TRIGGER trg_smart_quote_client_response_notify
AFTER UPDATE OF client_responded_at ON public.smart_quotes
FOR EACH ROW EXECUTE FUNCTION public.tg_smart_quote_client_response_notify();