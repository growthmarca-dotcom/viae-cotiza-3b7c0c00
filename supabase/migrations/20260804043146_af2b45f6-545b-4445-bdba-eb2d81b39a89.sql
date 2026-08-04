-- v1.10.7.2.3 — Opportunity como entidad comercial principal

ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS organization_id uuid NULL;

ALTER TABLE public.opportunities
  DROP CONSTRAINT IF EXISTS opportunities_organization_id_fkey;
ALTER TABLE public.opportunities
  ADD CONSTRAINT opportunities_organization_id_fkey
  FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_opportunities_organization_id
  ON public.opportunities(organization_id);

-- 2) Resolución de organización de una oportunidad
CREATE OR REPLACE FUNCTION public.resolve_opportunity_organization(
  _creator_user_id uuid,
  _assigned_agent_id uuid DEFAULT NULL,
  _quotation_id uuid DEFAULT NULL,
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
  v_org uuid;
  v_client_user uuid;
BEGIN
  -- 1. Explícita
  IF _explicit_org_id IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = _explicit_org_id) THEN
      RETURN jsonb_build_object('organization_id', _explicit_org_id, 'source', 'explicit',
        'confidence', 'high', 'error', NULL);
    END IF;
    RETURN jsonb_build_object('organization_id', NULL, 'source', 'explicit',
      'confidence', 'none', 'error', 'organization_not_found');
  END IF;

  -- 2. Agente asignado
  IF _assigned_agent_id IS NOT NULL THEN
    v_res := public.resolve_booking_organization(NULL, _assigned_agent_id, NULL);
    IF (v_res->>'organization_id') IS NOT NULL THEN
      RETURN jsonb_build_object('organization_id', (v_res->>'organization_id')::uuid,
        'source', 'agent', 'confidence', 'high', 'error', NULL);
    END IF;
  END IF;

  -- 3. Cotización relacionada
  IF _quotation_id IS NOT NULL THEN
    SELECT q.organization_id INTO v_org FROM public.quotations q WHERE q.id = _quotation_id;
    IF v_org IS NOT NULL THEN
      RETURN jsonb_build_object('organization_id', v_org, 'source', 'quotation',
        'confidence', 'high', 'error', NULL);
    END IF;
  END IF;

  -- 4. Cliente (a través del usuario dueño)
  IF _client_id IS NOT NULL THEN
    SELECT c.user_id INTO v_client_user FROM public.clients c WHERE c.id = _client_id;
    IF v_client_user IS NOT NULL THEN
      v_res := public.resolve_booking_organization(v_client_user, NULL, NULL);
      IF (v_res->>'organization_id') IS NOT NULL THEN
        RETURN jsonb_build_object('organization_id', (v_res->>'organization_id')::uuid,
          'source', 'client', 'confidence', 'medium', 'error', NULL);
      END IF;
    END IF;
  END IF;

  -- 5. Membresía única del creador
  v_res := public.resolve_booking_organization(_creator_user_id, NULL, NULL);
  IF (v_res->>'organization_id') IS NOT NULL THEN
    RETURN jsonb_build_object('organization_id', (v_res->>'organization_id')::uuid,
      'source', 'creator_membership', 'confidence', 'medium', 'error', NULL);
  END IF;

  RETURN jsonb_build_object('organization_id', NULL, 'source', 'none', 'confidence', 'none',
    'error', COALESCE(v_res->>'error', 'no_organization_found'),
    'candidates', v_res->'candidates');
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_opportunity_organization(uuid, uuid, uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_opportunity_organization(uuid, uuid, uuid, uuid, uuid) TO authenticated, service_role;

-- 3) Permiso de creación
CREATE OR REPLACE FUNCTION public.can_create_opportunity_for_organization(
  _user_id uuid, _org_id uuid
) RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN _user_id IS NULL OR _org_id IS NULL THEN false
    WHEN public.has_role(_user_id, 'admin'::app_role) THEN true
    ELSE EXISTS (
      SELECT 1 FROM public.organization_members m
      WHERE m.user_id = _user_id
        AND m.organization_id = _org_id
        AND m.status = 'active'
        AND m.role IN (
          'organization_owner'::organization_member_role,
          'organization_admin'::organization_member_role,
          'operations'::organization_member_role,
          'agent'::organization_member_role
        )
    )
  END
$$;

REVOKE ALL ON FUNCTION public.can_create_opportunity_for_organization(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_create_opportunity_for_organization(uuid, uuid) TO authenticated, service_role;

-- Trigger de enforcement + coherencia con la cotización relacionada
CREATE OR REPLACE FUNCTION public.tg_opportunity_require_organization()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_res jsonb;
  v_org uuid;
  v_quote_org uuid;
BEGIN
  IF v_uid IS NULL OR current_setting('role', true) = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF NEW.organization_id IS NOT NULL THEN
    IF NOT public.can_create_opportunity_for_organization(v_uid, NEW.organization_id) THEN
      RAISE EXCEPTION 'Opportunity requires a valid organization'
        USING HINT = 'not_allowed_for_organization';
    END IF;
    v_org := NEW.organization_id;
  ELSE
    v_res := public.resolve_opportunity_organization(
      COALESCE(NEW.owner_user_id, NEW.user_id, v_uid),
      NEW.assigned_agent_id, NEW.quotation_id, NEW.client_id, NULL);
    v_org := NULLIF(v_res->>'organization_id', '')::uuid;

    IF v_org IS NULL OR (v_res->>'error') IS NOT NULL THEN
      RAISE EXCEPTION 'Opportunity requires a valid organization'
        USING HINT = COALESCE(v_res->>'error', 'no_organization_found');
    END IF;

    IF NOT public.can_create_opportunity_for_organization(v_uid, v_org) THEN
      RAISE EXCEPTION 'Opportunity requires a valid organization'
        USING HINT = 'not_allowed_for_organization';
    END IF;
  END IF;

  -- Coherencia con la cotización vinculada: no se permiten cruces de organización
  IF NEW.quotation_id IS NOT NULL THEN
    SELECT q.organization_id INTO v_quote_org FROM public.quotations q WHERE q.id = NEW.quotation_id;
    IF v_quote_org IS NOT NULL AND v_quote_org <> v_org THEN
      RAISE EXCEPTION 'Opportunity and quotation belong to different organizations'
        USING HINT = 'organization_mismatch';
    END IF;
  END IF;

  NEW.organization_id := v_org;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS opportunities_require_organization ON public.opportunities;
CREATE TRIGGER opportunities_require_organization
  BEFORE INSERT ON public.opportunities
  FOR EACH ROW EXECUTE FUNCTION public.tg_opportunity_require_organization();

-- 5) Coherencia inversa: quotation.opportunity_id no puede cruzar organizaciones
CREATE OR REPLACE FUNCTION public.tg_quotation_opportunity_same_org()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_opp_org uuid;
BEGIN
  IF NEW.opportunity_id IS NULL OR NEW.organization_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT o.organization_id INTO v_opp_org
  FROM public.opportunities o WHERE o.id = NEW.opportunity_id;
  IF v_opp_org IS NOT NULL AND v_opp_org <> NEW.organization_id THEN
    RAISE EXCEPTION 'Quotation and opportunity belong to different organizations'
      USING HINT = 'organization_mismatch';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS quotations_opportunity_same_org ON public.quotations;
CREATE TRIGGER quotations_opportunity_same_org
  AFTER INSERT OR UPDATE OF opportunity_id, organization_id ON public.quotations
  FOR EACH ROW EXECUTE FUNCTION public.tg_quotation_opportunity_same_org();

-- 6) Backfill determinista (no destructivo)
-- a) desde la cotización vinculada
UPDATE public.opportunities o
SET organization_id = q.organization_id
FROM public.quotations q
WHERE o.organization_id IS NULL
  AND o.quotation_id = q.id
  AND q.organization_id IS NOT NULL;

-- b) desde el agente asignado, si su organización es única y determinista
UPDATE public.opportunities o
SET organization_id = NULLIF(
      (public.resolve_booking_organization(NULL, o.assigned_agent_id, NULL)->>'organization_id'), ''
    )::uuid
WHERE o.organization_id IS NULL
  AND o.assigned_agent_id IS NOT NULL
  AND (public.resolve_booking_organization(NULL, o.assigned_agent_id, NULL)->>'organization_id') IS NOT NULL;