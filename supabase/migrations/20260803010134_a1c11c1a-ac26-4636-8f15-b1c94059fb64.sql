-- v1.10.7.1.2 Identity Security Alignment
-- Helper: membresía activa con rol dentro de una organización
CREATE OR REPLACE FUNCTION public.org_identity_can_read(_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'admin')
      OR public.is_member_of(auth.uid(), _org_id);
$$;

CREATE OR REPLACE FUNCTION public.org_identity_can_write(_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'admin')
      OR public.has_org_role(auth.uid(), _org_id, 'organization_owner')
      OR public.has_org_role(auth.uid(), _org_id, 'organization_admin')
      OR public.has_org_role(auth.uid(), _org_id, 'operations');
$$;

CREATE OR REPLACE FUNCTION public.org_identity_can_admin(_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'admin')
      OR public.has_org_role(auth.uid(), _org_id, 'organization_owner')
      OR public.has_org_role(auth.uid(), _org_id, 'organization_admin');
$$;

CREATE OR REPLACE FUNCTION public.org_identity_can_delete(_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'admin')
      OR public.has_org_role(auth.uid(), _org_id, 'organization_owner');
$$;

REVOKE EXECUTE ON FUNCTION public.org_identity_can_read(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.org_identity_can_write(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.org_identity_can_admin(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.org_identity_can_delete(uuid) FROM anon;

-- persons
DROP POLICY IF EXISTS persons_select_authenticated ON public.persons;
DROP POLICY IF EXISTS persons_insert_ops ON public.persons;
DROP POLICY IF EXISTS persons_update_ops ON public.persons;
DROP POLICY IF EXISTS persons_delete_admin ON public.persons;

CREATE POLICY persons_select_org_members ON public.persons
  FOR SELECT TO authenticated
  USING (public.org_identity_can_read(organization_id));

CREATE POLICY persons_insert_org_write ON public.persons
  FOR INSERT TO authenticated
  WITH CHECK (public.org_identity_can_write(organization_id));

CREATE POLICY persons_update_org_write ON public.persons
  FOR UPDATE TO authenticated
  USING (public.org_identity_can_write(organization_id))
  WITH CHECK (public.org_identity_can_write(organization_id));

CREATE POLICY persons_delete_org_owner ON public.persons
  FOR DELETE TO authenticated
  USING (public.org_identity_can_delete(organization_id));

-- person_roles
DROP POLICY IF EXISTS person_roles_select_authenticated ON public.person_roles;
DROP POLICY IF EXISTS person_roles_write_ops ON public.person_roles;

CREATE POLICY person_roles_select_org_members ON public.person_roles
  FOR SELECT TO authenticated
  USING (public.org_identity_can_read(organization_id));

CREATE POLICY person_roles_insert_org_admin ON public.person_roles
  FOR INSERT TO authenticated
  WITH CHECK (public.org_identity_can_admin(organization_id));

CREATE POLICY person_roles_update_org_admin ON public.person_roles
  FOR UPDATE TO authenticated
  USING (public.org_identity_can_admin(organization_id))
  WITH CHECK (public.org_identity_can_admin(organization_id));

CREATE POLICY person_roles_delete_org_owner ON public.person_roles
  FOR DELETE TO authenticated
  USING (public.org_identity_can_delete(organization_id));