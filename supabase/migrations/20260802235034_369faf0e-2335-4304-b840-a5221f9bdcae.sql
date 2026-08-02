REVOKE ALL ON FUNCTION public.can_manage_product(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_product(uuid) TO authenticated, service_role;