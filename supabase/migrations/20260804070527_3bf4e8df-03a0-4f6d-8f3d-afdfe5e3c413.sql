DROP TRIGGER IF EXISTS smart_quote_versions_immutable ON public.smart_quote_versions;
CREATE TRIGGER smart_quote_versions_immutable
BEFORE UPDATE ON public.smart_quote_versions
FOR EACH ROW EXECUTE FUNCTION public.tg_smart_quote_version_immutable();

REVOKE DELETE, UPDATE ON public.smart_quote_versions FROM authenticated;