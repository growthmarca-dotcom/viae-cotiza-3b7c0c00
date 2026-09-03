-- Intervención 7 — Trazabilidad de la conversión cotización aceptada -> reserva.
-- Reutiliza el historial existente de la cotización (quotation_history):
-- deja registrado qué cotización originó la reserva, cuándo y quién convirtió.
CREATE OR REPLACE FUNCTION public.tg_quotation_converted_to_booking()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid;
BEGIN
  IF NEW.quotation_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT user_id INTO v_owner FROM public.quotations WHERE id = NEW.quotation_id;
  IF v_owner IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.quotation_history (quotation_id, owner_id, actor_id, action, changes)
  VALUES (
    NEW.quotation_id,
    v_owner,
    COALESCE(NEW.user_id, auth.uid()),
    'converted_to_booking',
    jsonb_build_object(
      'booking_id', NEW.id,
      'booking_number', NEW.booking_number,
      'converted_at', now()
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_quotation_converted_to_booking ON public.bookings;
CREATE TRIGGER tg_quotation_converted_to_booking
AFTER INSERT ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION public.tg_quotation_converted_to_booking();

REVOKE ALL ON FUNCTION public.tg_quotation_converted_to_booking() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.tg_quotation_converted_to_booking() FROM anon;
