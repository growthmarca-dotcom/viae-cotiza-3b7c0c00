-- v1.14.1 — Ciclo de estados de cotizaciones (aditivo)
ALTER TABLE public.quotations
  ADD COLUMN IF NOT EXISTS sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS sent_by uuid,
  ADD COLUMN IF NOT EXISTS accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS accepted_by uuid,
  ADD COLUMN IF NOT EXISTS rejected_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejected_by uuid,
  ADD COLUMN IF NOT EXISTS expired_at timestamptz;

-- Transiciones válidas del ciclo comercial V1
CREATE OR REPLACE FUNCTION public.quotation_status_can_transition(
  _from public.quotation_status,
  _to public.quotation_status
) RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN _from = _to THEN true
    WHEN _from = 'draft'    THEN _to IN ('sent', 'expired')
    WHEN _from = 'sent'     THEN _to IN ('pending', 'accepted', 'rejected', 'expired')
    WHEN _from = 'pending'  THEN _to IN ('accepted', 'rejected', 'expired')
    WHEN _from = 'rejected' THEN _to IN ('sent')
    WHEN _from = 'expired'  THEN _to IN ('sent')
    WHEN _from = 'accepted' THEN false
    ELSE false
  END
$$;

REVOKE ALL ON FUNCTION public.quotation_status_can_transition(public.quotation_status, public.quotation_status) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.quotation_status_can_transition(public.quotation_status, public.quotation_status) TO authenticated, service_role;

-- Guarda de transición + sellado de marcas temporales y actor
CREATE OR REPLACE FUNCTION public.tg_quotation_status_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NOT public.quotation_status_can_transition(OLD.status, NEW.status) THEN
      RAISE EXCEPTION 'Invalid quotation status transition: % -> %', OLD.status, NEW.status
        USING HINT = 'invalid_status_transition';
    END IF;

    IF NEW.status = 'sent' THEN
      NEW.sent_at := COALESCE(NEW.sent_at, now());
      NEW.sent_by := COALESCE(NEW.sent_by, auth.uid());
    ELSIF NEW.status = 'accepted' THEN
      NEW.accepted_at := COALESCE(NEW.accepted_at, now());
      NEW.accepted_by := COALESCE(NEW.accepted_by, auth.uid());
    ELSIF NEW.status = 'rejected' THEN
      NEW.rejected_at := COALESCE(NEW.rejected_at, now());
      NEW.rejected_by := COALESCE(NEW.rejected_by, auth.uid());
    ELSIF NEW.status = 'expired' THEN
      NEW.expired_at := COALESCE(NEW.expired_at, now());
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_quotation_status_guard ON public.quotations;
CREATE TRIGGER tg_quotation_status_guard
BEFORE UPDATE ON public.quotations
FOR EACH ROW EXECUTE FUNCTION public.tg_quotation_status_guard();

-- Expiración perezosa según expires_at (sin cron): la ejecuta la app al listar
CREATE OR REPLACE FUNCTION public.expire_due_quotations()
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  affected integer;
BEGIN
  UPDATE public.quotations
     SET status = 'expired'
   WHERE status IN ('draft', 'sent', 'pending')
     AND expires_at IS NOT NULL
     AND expires_at < now();
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

REVOKE ALL ON FUNCTION public.expire_due_quotations() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.expire_due_quotations() TO authenticated, service_role;