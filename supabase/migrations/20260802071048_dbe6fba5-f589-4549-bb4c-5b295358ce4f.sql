-- Auditoría RLS v1.9.5 Fase 1: recortar privilegios heredados por defecto.
REVOKE ALL ON public.booking_passengers FROM anon;
REVOKE ALL ON public.booking_timeline FROM anon;

REVOKE UPDATE, DELETE, TRUNCATE ON public.booking_timeline FROM authenticated;
REVOKE UPDATE, DELETE, TRUNCATE ON public.booking_timeline FROM service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.booking_passengers TO authenticated;
GRANT ALL ON public.booking_passengers TO service_role;
GRANT SELECT, INSERT ON public.booking_timeline TO authenticated;
GRANT SELECT, INSERT ON public.booking_timeline TO service_role;