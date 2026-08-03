-- v1.10.7.1.3 Membership Provisioning Layer

CREATE TABLE IF NOT EXISTS public.organization_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email text NOT NULL,
  role organization_member_role NOT NULL,
  status organization_member_status NOT NULL DEFAULT 'pending',
  invited_by uuid NOT NULL,
  token uuid NOT NULL DEFAULT gen_random_uuid(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  accepted_at timestamptz,
  accepted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_invitations_org ON public.organization_invitations(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_invitations_email ON public.organization_invitations(lower(email));
CREATE UNIQUE INDEX IF NOT EXISTS idx_org_invitations_token ON public.organization_invitations(token);
CREATE INDEX IF NOT EXISTS idx_org_invitations_status ON public.organization_invitations(status);

CREATE UNIQUE INDEX IF NOT EXISTS uq_org_invitations_pending
  ON public.organization_invitations(organization_id, lower(email))
  WHERE status = 'pending';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_invitations TO authenticated;
GRANT ALL ON public.organization_invitations TO service_role;

ALTER TABLE public.organization_invitations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS org_invitations_select ON public.organization_invitations;
CREATE POLICY org_invitations_select ON public.organization_invitations
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.is_member_of(auth.uid(), organization_id)
  );

DROP POLICY IF EXISTS org_invitations_insert ON public.organization_invitations;
CREATE POLICY org_invitations_insert ON public.organization_invitations
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_org_role(auth.uid(), organization_id, 'organization_owner')
    OR public.has_org_role(auth.uid(), organization_id, 'organization_admin')
  );

DROP POLICY IF EXISTS org_invitations_update ON public.organization_invitations;
CREATE POLICY org_invitations_update ON public.organization_invitations
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_org_role(auth.uid(), organization_id, 'organization_owner')
    OR public.has_org_role(auth.uid(), organization_id, 'organization_admin')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_org_role(auth.uid(), organization_id, 'organization_owner')
    OR public.has_org_role(auth.uid(), organization_id, 'organization_admin')
  );

DROP POLICY IF EXISTS org_invitations_delete ON public.organization_invitations;
CREATE POLICY org_invitations_delete ON public.organization_invitations
  FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_org_role(auth.uid(), organization_id, 'organization_owner')
  );

DROP TRIGGER IF EXISTS set_updated_at_org_invitations ON public.organization_invitations;
CREATE TRIGGER set_updated_at_org_invitations
  BEFORE UPDATE ON public.organization_invitations
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============ RPC ============

CREATE OR REPLACE FUNCTION public.invite_organization_member(
  _org_id uuid,
  _email text,
  _role organization_member_role
)
RETURNS public.organization_invitations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.organization_invitations;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;
  IF NOT (
    public.has_role(auth.uid(), 'admin')
    OR public.has_org_role(auth.uid(), _org_id, 'organization_owner')
    OR public.has_org_role(auth.uid(), _org_id, 'organization_admin')
  ) THEN
    RAISE EXCEPTION 'Sin permisos para invitar miembros en esta organización';
  END IF;
  IF _email IS NULL OR btrim(_email) = '' THEN
    RAISE EXCEPTION 'Email requerido';
  END IF;

  INSERT INTO public.organization_invitations (organization_id, email, role, invited_by)
  VALUES (_org_id, lower(btrim(_email)), _role, auth.uid())
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_organization_invitation(_token uuid)
RETURNS public.organization_members
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inv public.organization_invitations;
  v_member public.organization_members;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  SELECT * INTO v_inv FROM public.organization_invitations WHERE token = _token FOR UPDATE;

  IF v_inv.id IS NULL THEN
    RAISE EXCEPTION 'Invitación inválida';
  END IF;
  IF v_inv.status <> 'pending' THEN
    RAISE EXCEPTION 'La invitación ya no está pendiente';
  END IF;
  IF v_inv.expires_at IS NOT NULL AND v_inv.expires_at < now() THEN
    UPDATE public.organization_invitations SET status = 'inactive' WHERE id = v_inv.id;
    RAISE EXCEPTION 'La invitación expiró';
  END IF;

  INSERT INTO public.organization_members (organization_id, user_id, role, status, invited_by)
  VALUES (v_inv.organization_id, auth.uid(), v_inv.role, 'active', v_inv.invited_by)
  ON CONFLICT (user_id, organization_id)
  DO UPDATE SET role = EXCLUDED.role, status = 'active', updated_at = now()
  RETURNING * INTO v_member;

  UPDATE public.organization_invitations
  SET status = 'active', accepted_at = now(), accepted_by = auth.uid()
  WHERE id = v_inv.id;

  RETURN v_member;
END;
$$;

CREATE OR REPLACE FUNCTION public.change_organization_member_role(
  _member_id uuid,
  _new_role organization_member_role
)
RETURNS public.organization_members
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member public.organization_members;
  v_owners int;
BEGIN
  SELECT * INTO v_member FROM public.organization_members WHERE id = _member_id;
  IF v_member.id IS NULL THEN
    RAISE EXCEPTION 'Miembro inexistente';
  END IF;

  IF NOT (
    public.has_role(auth.uid(), 'admin')
    OR public.has_org_role(auth.uid(), v_member.organization_id, 'organization_owner')
    OR public.has_org_role(auth.uid(), v_member.organization_id, 'organization_admin')
  ) THEN
    RAISE EXCEPTION 'Sin permisos para cambiar roles en esta organización';
  END IF;

  IF v_member.role = 'organization_owner' AND _new_role <> 'organization_owner' THEN
    SELECT count(*) INTO v_owners FROM public.organization_members
    WHERE organization_id = v_member.organization_id
      AND role = 'organization_owner' AND status = 'active';
    IF v_owners <= 1 THEN
      RAISE EXCEPTION 'No se puede quitar el último dueño de la organización';
    END IF;
  END IF;

  UPDATE public.organization_members
  SET role = _new_role, is_owner = (_new_role = 'organization_owner'), updated_at = now()
  WHERE id = _member_id
  RETURNING * INTO v_member;

  RETURN v_member;
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_organization_member(_member_id uuid)
RETURNS public.organization_members
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member public.organization_members;
  v_owners int;
BEGIN
  SELECT * INTO v_member FROM public.organization_members WHERE id = _member_id;
  IF v_member.id IS NULL THEN
    RAISE EXCEPTION 'Miembro inexistente';
  END IF;

  IF NOT (
    public.has_role(auth.uid(), 'admin')
    OR public.has_org_role(auth.uid(), v_member.organization_id, 'organization_owner')
  ) THEN
    RAISE EXCEPTION 'Sin permisos para revocar accesos en esta organización';
  END IF;

  IF v_member.role = 'organization_owner' AND v_member.status = 'active' THEN
    SELECT count(*) INTO v_owners FROM public.organization_members
    WHERE organization_id = v_member.organization_id
      AND role = 'organization_owner' AND status = 'active';
    IF v_owners <= 1 THEN
      RAISE EXCEPTION 'No se puede quitar el último dueño de la organización';
    END IF;
  END IF;

  UPDATE public.organization_members
  SET status = 'inactive', updated_at = now()
  WHERE id = _member_id
  RETURNING * INTO v_member;

  RETURN v_member;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.invite_organization_member(uuid, text, organization_member_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.accept_organization_invitation(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.change_organization_member_role(uuid, organization_member_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.remove_organization_member(uuid) FROM anon;

GRANT EXECUTE ON FUNCTION public.invite_organization_member(uuid, text, organization_member_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_organization_invitation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.change_organization_member_role(uuid, organization_member_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_organization_member(uuid) TO authenticated;