ALTER TYPE public.invitation_status ADD VALUE IF NOT EXISTS 'cancelled';

ALTER TABLE public.organization_invitations
  ADD COLUMN state public.invitation_status NOT NULL DEFAULT 'pending',
  ADD COLUMN network_id uuid REFERENCES public.agency_networks(id) ON DELETE SET NULL,
  ADD COLUMN last_sent_at timestamptz,
  ADD COLUMN send_count integer NOT NULL DEFAULT 0,
  ADD COLUMN responded_at timestamptz,
  ADD COLUMN cancelled_at timestamptz,
  ADD COLUMN cancelled_by uuid;
ALTER TABLE public.organization_invitations ALTER COLUMN expires_at SET DEFAULT (now() + interval '7 days');
UPDATE public.organization_invitations SET state = CASE
  WHEN status = 'active' THEN 'accepted'::public.invitation_status
  WHEN status = 'pending' AND expires_at < now() THEN 'expired'::public.invitation_status
  WHEN status = 'pending' THEN 'pending'::public.invitation_status
  ELSE 'expired'::public.invitation_status END;
UPDATE public.organization_invitations i SET network_id = o.network_id FROM public.organizations o WHERE o.id = i.organization_id;
CREATE UNIQUE INDEX IF NOT EXISTS organization_invitations_token_key ON public.organization_invitations(token);
CREATE INDEX IF NOT EXISTS organization_invitations_org_email_idx ON public.organization_invitations(organization_id, lower(email));

CREATE OR REPLACE FUNCTION public.can_manage_org_invitations(_org_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(), 'admin')
    OR public.has_org_role(auth.uid(), _org_id, 'organization_owner')
    OR public.has_org_role(auth.uid(), _org_id, 'organization_admin')
$$;
REVOKE EXECUTE ON FUNCTION public.can_manage_org_invitations(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_org_invitations(uuid) TO authenticated;

-- Invitar: reutiliza una pendiente vigente para el mismo email y agencia.
CREATE OR REPLACE FUNCTION public.invite_organization_member(_org_id uuid, _email text, _role organization_member_role)
RETURNS public.organization_invitations LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_row public.organization_invitations;
  v_email text := lower(btrim(coalesce(_email, '')));
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  IF NOT public.can_manage_org_invitations(_org_id) THEN
    RAISE EXCEPTION 'Sin permisos para invitar miembros en esta organización';
  END IF;
  IF v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' THEN RAISE EXCEPTION 'Email inválido'; END IF;
  IF EXISTS (SELECT 1 FROM organization_members m JOIN auth.users u ON u.id = m.user_id
             WHERE m.organization_id = _org_id AND m.status = 'active' AND lower(u.email) = v_email) THEN
    RAISE EXCEPTION 'Esa persona ya es miembro activo de esta agencia';
  END IF;
  UPDATE organization_invitations SET state = 'expired', status = 'inactive'
    WHERE organization_id = _org_id AND lower(email) = v_email AND state = 'pending' AND expires_at < now();
  SELECT * INTO v_row FROM organization_invitations
    WHERE organization_id = _org_id AND lower(email) = v_email AND state = 'pending' LIMIT 1;
  IF v_row.id IS NOT NULL THEN RETURN v_row; END IF;

  INSERT INTO organization_invitations (organization_id, email, role, invited_by, network_id, expires_at)
  VALUES (_org_id, v_email, _role, auth.uid(), (SELECT network_id FROM organizations WHERE id = _org_id), now() + interval '7 days')
  RETURNING * INTO v_row;
  RETURN v_row;
END $$;

-- Datos mínimos para mostrar la invitación a quien tiene el enlace.
CREATE OR REPLACE FUNCTION public.get_invitation_by_token(_token uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'email', i.email,
    'state', CASE WHEN i.state = 'pending' AND i.expires_at < now() THEN 'expired' ELSE i.state::text END,
    'expires_at', i.expires_at,
    'role', i.role,
    'organization_name', o.trade_name,
    'network_name', n.name,
    'inviter_name', coalesce(p.full_name, u.email))
  FROM organization_invitations i
  JOIN organizations o ON o.id = i.organization_id
  LEFT JOIN agency_networks n ON n.id = i.network_id
  LEFT JOIN profiles p ON p.id = i.invited_by
  LEFT JOIN auth.users u ON u.id = i.invited_by
  WHERE i.token = _token
$$;
REVOKE EXECUTE ON FUNCTION public.get_invitation_by_token(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_invitation_by_token(uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.accept_organization_invitation(_token uuid)
RETURNS public.organization_members LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_inv public.organization_invitations;
  v_member public.organization_members;
  v_email text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  SELECT lower(email) INTO v_email FROM auth.users WHERE id = auth.uid();
  SELECT * INTO v_inv FROM organization_invitations WHERE token = _token FOR UPDATE;
  IF v_inv.id IS NULL THEN RAISE EXCEPTION 'Invitación inválida'; END IF;
  IF lower(v_inv.email) <> v_email THEN
    RAISE EXCEPTION 'Esta invitación fue enviada a otra dirección de email. Ingresá con la cuenta de %', v_inv.email;
  END IF;
  IF v_inv.state = 'accepted' THEN RAISE EXCEPTION 'Esta invitación ya fue aceptada'; END IF;
  IF v_inv.state = 'cancelled' THEN RAISE EXCEPTION 'Esta invitación fue cancelada'; END IF;
  IF v_inv.state = 'rejected' THEN RAISE EXCEPTION 'Esta invitación fue rechazada'; END IF;
  IF v_inv.state = 'expired' OR v_inv.expires_at < now() THEN
    UPDATE organization_invitations SET state = 'expired', status = 'inactive' WHERE id = v_inv.id;
    RETURN NULL;
  END IF;

  INSERT INTO organization_members (organization_id, user_id, role, status, invited_by)
  VALUES (v_inv.organization_id, auth.uid(), v_inv.role, 'active', v_inv.invited_by)
  ON CONFLICT (user_id, organization_id)
  DO UPDATE SET role = EXCLUDED.role, status = 'active', updated_at = now()
  RETURNING * INTO v_member;

  UPDATE organization_invitations
  SET state = 'accepted', status = 'active', accepted_at = now(), accepted_by = auth.uid(), responded_at = now()
  WHERE id = v_inv.id;

  -- La agencia invitante avala la cuenta: se aprueba si estaba pendiente.
  UPDATE profiles SET status = 'approved' WHERE id = auth.uid() AND status = 'pending';
  RETURN v_member;
END $$;

CREATE OR REPLACE FUNCTION public.reject_organization_invitation(_token uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_inv public.organization_invitations;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  SELECT * INTO v_inv FROM organization_invitations WHERE token = _token FOR UPDATE;
  IF v_inv.id IS NULL THEN RAISE EXCEPTION 'Invitación inválida'; END IF;
  IF lower(v_inv.email) <> (SELECT lower(email) FROM auth.users WHERE id = auth.uid()) THEN
    RAISE EXCEPTION 'Esta invitación fue enviada a otra dirección de email';
  END IF;
  IF v_inv.state <> 'pending' OR v_inv.expires_at < now() THEN RAISE EXCEPTION 'La invitación ya no está pendiente'; END IF;
  UPDATE organization_invitations SET state = 'rejected', status = 'inactive', responded_at = now() WHERE id = v_inv.id;
END $$;

CREATE OR REPLACE FUNCTION public.cancel_organization_invitation(_invitation_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_inv public.organization_invitations;
BEGIN
  SELECT * INTO v_inv FROM organization_invitations WHERE id = _invitation_id FOR UPDATE;
  IF v_inv.id IS NULL OR NOT public.can_manage_org_invitations(v_inv.organization_id) THEN
    RAISE EXCEPTION 'Sin permisos sobre esta invitación';
  END IF;
  IF v_inv.state <> 'pending' THEN RAISE EXCEPTION 'Solo se pueden cancelar invitaciones pendientes'; END IF;
  UPDATE organization_invitations
  SET state = 'cancelled', status = 'inactive', cancelled_at = now(), cancelled_by = auth.uid()
  WHERE id = v_inv.id;
END $$;

-- Reenvío: renueva el vencimiento y registra el envío (el email lo manda el servidor).
CREATE OR REPLACE FUNCTION public.mark_invitation_sent(_invitation_id uuid, _renew boolean)
RETURNS public.organization_invitations LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_inv public.organization_invitations;
BEGIN
  SELECT * INTO v_inv FROM organization_invitations WHERE id = _invitation_id FOR UPDATE;
  IF v_inv.id IS NULL OR NOT public.can_manage_org_invitations(v_inv.organization_id) THEN
    RAISE EXCEPTION 'Sin permisos sobre esta invitación';
  END IF;
  IF v_inv.state <> 'pending' OR (v_inv.expires_at < now() AND NOT _renew) THEN
    RAISE EXCEPTION 'Solo se pueden enviar invitaciones pendientes y vigentes';
  END IF;
  UPDATE organization_invitations
  SET send_count = send_count + 1, last_sent_at = now(),
      expires_at = CASE WHEN _renew THEN now() + interval '7 days' ELSE expires_at END
  WHERE id = v_inv.id RETURNING * INTO v_inv;
  RETURN v_inv;
END $$;

REVOKE EXECUTE ON FUNCTION public.reject_organization_invitation(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.cancel_organization_invitation(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.mark_invitation_sent(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reject_organization_invitation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_organization_invitation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_invitation_sent(uuid, boolean) TO authenticated;

-- Solo gestores ven invitaciones (antes cualquier miembro).
DROP POLICY IF EXISTS org_invitations_select ON public.organization_invitations;
CREATE POLICY org_invitations_select ON public.organization_invitations FOR SELECT TO authenticated
  USING (public.can_manage_org_invitations(organization_id));