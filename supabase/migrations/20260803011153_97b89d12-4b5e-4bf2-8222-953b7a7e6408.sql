REVOKE EXECUTE ON FUNCTION public.invite_organization_member(uuid, text, organization_member_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.accept_organization_invitation(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.change_organization_member_role(uuid, organization_member_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.remove_organization_member(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.invite_organization_member(uuid, text, organization_member_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.accept_organization_invitation(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.change_organization_member_role(uuid, organization_member_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.remove_organization_member(uuid) TO authenticated, service_role;