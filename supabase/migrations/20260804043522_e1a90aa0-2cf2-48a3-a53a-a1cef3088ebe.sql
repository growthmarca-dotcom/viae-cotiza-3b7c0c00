CREATE OR REPLACE FUNCTION public.resolve_quotation_organization(
  _creator_user_id uuid,
  _opportunity_id uuid DEFAULT NULL,
  _client_id uuid DEFAULT NULL,
  _explicit_org_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_res jsonb;
  v_agent uuid;
  v_owner uuid;
  v_org uuid;
  v_client_user uuid;
BEGIN
  -- 1. Explícita
  IF _explicit_org_id IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = _explicit_org_id) THEN
      RETURN jsonb_build_object('organization_id', _explicit_org_id, 'source', 'explicit', 'confidence', 'high', 'error', NULL);
    END IF;
    RETURN jsonb_build_object('organization_id', NULL, 'source', 'explicit', 'confidence', 'none', 'error', 'organization_not_found');
  END IF;

  -- 2. Oportunidad: organización propietaria (v1.10.7.2.3), luego agente/responsable
  IF _opportunity_id IS NOT NULL THEN
    SELECT o.organization_id, o.assigned_agent_id, o.owner_user_id
      INTO v_org, v_agent, v_owner
    FROM public.opportunities o WHERE o.id = _opportunity_id;

    IF v_org IS NOT NULL THEN
      RETURN jsonb_build_object('organization_id', v_org, 'source', 'opportunity', 'confidence', 'high', 'error', NULL);
    END IF;

    IF v_agent IS NOT NULL OR v_owner IS NOT NULL THEN
      v_res := public.resolve_booking_organization(v_owner, v_agent, NULL);
      IF (v_res->>'organization_id') IS NOT NULL THEN
        RETURN jsonb_build_object(
          'organization_id', (v_res->>'organization_id')::uuid,
          'source', 'opportunity', 'confidence', 'high', 'error', NULL);
      END IF;
    END IF;
  END IF;

  -- 3. Cliente (a través del usuario dueño del cliente)
  IF _client_id IS NOT NULL THEN
    SELECT c.user_id INTO v_client_user FROM public.clients c WHERE c.id = _client_id;
    IF v_client_user IS NOT NULL THEN
      v_res := public.resolve_booking_organization(v_client_user, NULL, NULL);
      IF (v_res->>'organization_id') IS NOT NULL THEN
        RETURN jsonb_build_object(
          'organization_id', (v_res->>'organization_id')::uuid,
          'source', 'client', 'confidence', 'medium', 'error', NULL);
      END IF;
    END IF;
  END IF;

  -- 4. Creador (último recurso)
  v_res := public.resolve_booking_organization(_creator_user_id, NULL, NULL);
  IF (v_res->>'organization_id') IS NOT NULL THEN
    RETURN jsonb_build_object(
      'organization_id', (v_res->>'organization_id')::uuid,
      'source', 'creator_membership', 'confidence', 'medium', 'error', NULL);
  END IF;

  RETURN jsonb_build_object(
    'organization_id', NULL, 'source', 'none', 'confidence', 'none',
    'error', COALESCE(v_res->>'error', 'no_organization_found'),
    'candidates', v_res->'candidates');
END;
$$;