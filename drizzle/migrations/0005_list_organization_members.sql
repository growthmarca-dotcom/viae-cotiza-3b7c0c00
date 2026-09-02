-- Intervención 4 — Membresías: lectura de miembros con identidad legible.
-- Aditivo: no modifica tablas, RLS ni RPCs existentes.
CREATE OR REPLACE FUNCTION public.list_organization_members(_org_id uuid)
RETURNS TABLE (
  id uuid,
  organization_id uuid,
  user_id uuid,
  role public.organization_member_role,
  status public.organization_member_status,
  is_owner boolean,
  created_at timestamptz,
  updated_at timestamptz,
  full_name text,
  email text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.id, m.organization_id, m.user_id, m.role, m.status, m.is_owner,
         m.created_at, m.updated_at, p.full_name, u.email::text
  FROM public.organization_members m
  LEFT JOIN public.profiles p ON p.id = m.user_id
  LEFT JOIN auth.users u ON u.id = m.user_id
  WHERE m.organization_id = _org_id
    AND (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.is_member_of(auth.uid(), _org_id)
    )
  ORDER BY m.is_owner DESC, m.created_at ASC
$$;

REVOKE ALL ON FUNCTION public.list_organization_members(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_organization_members(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.list_organization_members(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_organization_members(uuid) TO service_role;