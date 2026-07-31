REVOKE EXECUTE ON FUNCTION public.driver_service_context() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.current_driver_resource_ids() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_driver(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.driver_service_context() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_driver_resource_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_driver(uuid) TO authenticated;