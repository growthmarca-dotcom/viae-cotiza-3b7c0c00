CREATE OR REPLACE FUNCTION public.tg_lead_notifications()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_agent_uid uuid;
  v_name text := trim(coalesce(NEW.first_name,'') || ' ' || coalesce(NEW.last_name,''));
  v_body text;
  v_context text;
BEGIN
  v_body := coalesce(nullif(v_name,''), 'Sin nombre')
            || ' · ' || coalesce(NEW.destination, 'sin destino');

  v_context := concat_ws(' · ',
    NULLIF(NEW.trip_type::text, ''),
    CASE WHEN NEW.days_count IS NOT NULL THEN NEW.days_count || ' días' END,
    CASE WHEN NEW.nights_count IS NOT NULL THEN NEW.nights_count || ' noches' END,
    CASE WHEN NEW.pax_count IS NOT NULL THEN NEW.pax_count || ' pax' END,
    CASE WHEN coalesce(array_length(NEW.services_interest,1),0) > 0
         THEN array_to_string(NEW.services_interest, ', ') END,
    NULLIF(NEW.commercial_notes, '')
  );

  IF NEW.assigned_agent_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.assigned_agent_id IS DISTINCT FROM OLD.assigned_agent_id) THEN
    SELECT user_id INTO v_agent_uid FROM public.agents WHERE id = NEW.assigned_agent_id;
    IF v_agent_uid IS NOT NULL AND v_agent_uid IS DISTINCT FROM auth.uid() THEN
      INSERT INTO public.notifications (user_id, kind, title, body, entity, entity_id, data)
      VALUES (v_agent_uid, 'lead_assigned', 'Nuevo lead asignado',
              v_body || COALESCE(' · ' || NULLIF(v_context,''), ''), 'leads', NEW.id,
              jsonb_build_object(
                'destination', NEW.destination,
                'source', NEW.source,
                'trip_type', NEW.trip_type,
                'services_interest', NEW.services_interest,
                'days_count', NEW.days_count,
                'nights_count', NEW.nights_count,
                'pax_count', NEW.pax_count,
                'adults_count', NEW.adults_count,
                'children_count', NEW.children_count,
                'children_ages', NEW.children_ages,
                'budget_amount', NEW.budget_amount,
                'budget_currency', NEW.budget_currency,
                'commercial_notes', NEW.commercial_notes));
    END IF;
  END IF;

  IF TG_OP = 'INSERT' AND NEW.user_id IS DISTINCT FROM auth.uid() THEN
    INSERT INTO public.notifications (user_id, kind, title, body, entity, entity_id)
    VALUES (NEW.user_id, 'lead_new', 'Nueva consulta comercial', v_body, 'leads', NEW.id);
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status
     AND NEW.status IN ('quoted','won')
     AND NEW.user_id IS DISTINCT FROM auth.uid() THEN
    INSERT INTO public.notifications (user_id, kind, title, body, entity, entity_id)
    VALUES (NEW.user_id, 'lead_status',
            CASE WHEN NEW.status = 'quoted' THEN 'Cotización enviada a un lead' ELSE 'Lead ganado' END,
            v_body, 'leads', NEW.id);
  END IF;

  RETURN NEW;
END; $function$;