REVOKE ALL ON FUNCTION public.tg_audit() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_agent_link_stamp() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.expire_stale_invitations() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.expire_stale_invitations() TO authenticated;