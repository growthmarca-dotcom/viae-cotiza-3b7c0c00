CREATE OR REPLACE FUNCTION public.resolve_booking_organization(
  _creator_user_id uuid,
  _agent_id uuid DEFAULT NULL,
  _explicit_org_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _agent_user uuid;
  _ids uuid[];
BEGIN
  -- 1. Organización explícita: gana siempre (si existe y está activa)
  IF _explicit_org_id IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = _explicit_org_id) THEN
      RETURN jsonb_build_object('organization_id', _explicit_org_id, 'source', 'explicit', 'confidence', 'high', 'error', NULL);
    END IF;
    RETURN jsonb_build_object('organization_id', NULL, 'source', 'explicit', 'confidence', 'none', 'error', 'organization_not_found');
  END IF;

  -- 2. Agente asignado -> usuario del agente -> membresías activas
  IF _agent_id IS NOT NULL THEN
    SELECT a.user_id INTO _agent_user FROM public.agents a WHERE a.id = _agent_id;
    IF _agent_user IS NOT NULL THEN
      SELECT array_agg(DISTINCT m.organization_id) INTO _ids
      FROM public.organization_members m
      WHERE m.user_id = _agent_user AND m.status = 'active';

      IF _ids IS NOT NULL AND array_length(_ids, 1) = 1 THEN
        RETURN jsonb_build_object('organization_id', _ids[1], 'source', 'agent_membership', 'confidence', 'high', 'error', NULL);
      ELSIF _ids IS NOT NULL AND array_length(_ids, 1) > 1 THEN
        RETURN jsonb_build_object('organization_id', NULL, 'source', 'agent_membership', 'confidence', 'ambiguous', 'error', 'ambiguous_organization', 'candidates', to_jsonb(_ids));
      END IF;
    END IF;
  END IF;

  -- 3. Membresía activa del creador
  IF _creator_user_id IS NOT NULL THEN
    SELECT array_agg(DISTINCT m.organization_id) INTO _ids
    FROM public.organization_members m
    WHERE m.user_id = _creator_user_id AND m.status = 'active';

    IF _ids IS NOT NULL AND array_length(_ids, 1) = 1 THEN
      RETURN jsonb_build_object('organization_id', _ids[1], 'source', 'creator_membership', 'confidence', 'medium', 'error', NULL);
    ELSIF _ids IS NOT NULL AND array_length(_ids, 1) > 1 THEN
      RETURN jsonb_build_object('organization_id', NULL, 'source', 'creator_membership', 'confidence', 'ambiguous', 'error', 'ambiguous_organization', 'candidates', to_jsonb(_ids));
    END IF;
  END IF;

  -- 4/5. Sin candidatos
  RETURN jsonb_build_object('organization_id', NULL, 'source', 'none', 'confidence', 'none', 'error', 'no_organization_found');
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_booking_organization(uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_booking_organization(uuid, uuid, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.validate_booking_organization(_booking_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _org uuid;
  _found boolean;
  _org_status text;
  _provider_conflict boolean;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = _booking_id) THEN
    RETURN jsonb_build_object('valid', false, 'error', 'booking_not_found');
  END IF;

  SELECT b.organization_id INTO _org FROM public.bookings b WHERE b.id = _booking_id;

  IF _org IS NULL THEN
    RETURN jsonb_build_object('valid', false, 'organization_id', NULL, 'error', 'organization_missing');
  END IF;

  SELECT true, o.status::text INTO _found, _org_status
  FROM public.organizations o WHERE o.id = _org;

  IF _found IS NOT TRUE THEN
    RETURN jsonb_build_object('valid', false, 'organization_id', _org, 'error', 'organization_not_found');
  END IF;

  -- Señal conceptual: la organización dueña no debería ser la de un proveedor del catálogo
  SELECT EXISTS (
    SELECT 1 FROM public.providers p WHERE p.organization_id = _org
  ) INTO _provider_conflict;

  RETURN jsonb_build_object(
    'valid', _org_status = 'active' AND NOT _provider_conflict,
    'organization_id', _org,
    'organization_status', _org_status,
    'provider_semantics_conflict', _provider_conflict,
    'error', CASE
      WHEN _org_status <> 'active' THEN 'organization_inactive'
      WHEN _provider_conflict THEN 'organization_is_provider_scope'
      ELSE NULL END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.validate_booking_organization(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.validate_booking_organization(uuid) TO authenticated, service_role;