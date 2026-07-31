CREATE OR REPLACE FUNCTION public.tg_transport_service_history()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.transport_service_history (service_id, owner_id, actor_id, from_status, to_status, comment)
    VALUES (NEW.id, NEW.user_id, auth.uid(), NULL, NEW.status, 'Servicio creado');
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.transport_service_history (service_id, owner_id, actor_id, from_status, to_status, comment)
    VALUES (NEW.id, NEW.user_id, auth.uid(), OLD.status, NEW.status,
            CASE WHEN NEW.status::text = 'rejected' AND NEW.rejection_reason IS NOT NULL
                 THEN 'Motivo: ' || NEW.rejection_reason ELSE NULL END);
  END IF;

  IF NEW.collection_status IS DISTINCT FROM OLD.collection_status THEN
    INSERT INTO public.transport_service_history (service_id, owner_id, actor_id, from_status, to_status, comment)
    VALUES (NEW.id, NEW.user_id, auth.uid(), NEW.status, NEW.status,
            'Cobro: ' || NEW.collection_status::text ||
            COALESCE(' · monto informado ' || NEW.collected_amount::text || ' ' || NEW.collection_currency, ''));
  END IF;

  RETURN NEW;
END;
$$;