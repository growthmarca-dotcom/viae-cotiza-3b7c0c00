REVOKE ALL ON FUNCTION public.sync_transport_resource_state(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_notify_driver_assignment() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_transport_operation_audit() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_sync_driver_availability() FROM PUBLIC, anon, authenticated;