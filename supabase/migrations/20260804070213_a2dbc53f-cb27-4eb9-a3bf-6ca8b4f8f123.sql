ALTER TABLE public.smart_quote_versions
  ADD COLUMN IF NOT EXISTS reason text,
  ADD COLUMN IF NOT EXISTS total_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS currency text;

ALTER TABLE public.smart_quote_versions
  ALTER COLUMN created_by SET DEFAULT auth.uid();

-- Numeración automática y consecutiva por cotización
CREATE OR REPLACE FUNCTION public.tg_smart_quote_version_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.version IS NULL OR NEW.version <= 1 THEN
    SELECT COALESCE(MAX(v.version), 0) + 1
      INTO NEW.version
      FROM public.smart_quote_versions v
     WHERE v.smart_quote_id = NEW.smart_quote_id;
  END IF;
  IF NEW.created_by IS NULL THEN
    NEW.created_by := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS smart_quote_versions_number ON public.smart_quote_versions;
CREATE TRIGGER smart_quote_versions_number
BEFORE INSERT ON public.smart_quote_versions
FOR EACH ROW EXECUTE FUNCTION public.tg_smart_quote_version_number();

-- Append-only: el histórico no se edita ni se borra
CREATE OR REPLACE FUNCTION public.tg_smart_quote_version_immutable()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'smart_quote_version_immutable';
END;
$$;

DROP TRIGGER IF EXISTS smart_quote_versions_immutable ON public.smart_quote_versions;
CREATE TRIGGER smart_quote_versions_immutable
BEFORE UPDATE OR DELETE ON public.smart_quote_versions
FOR EACH ROW EXECUTE FUNCTION public.tg_smart_quote_version_immutable();

GRANT SELECT, INSERT ON public.smart_quote_versions TO authenticated;
GRANT ALL ON public.smart_quote_versions TO service_role;