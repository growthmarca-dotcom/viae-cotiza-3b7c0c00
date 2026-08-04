-- v1.10.7.2.2 — Commercial Flow Consolidation: quotations -> opportunities/organizations

ALTER TABLE public.quotations
  ADD COLUMN IF NOT EXISTS opportunity_id uuid NULL,
  ADD COLUMN IF NOT EXISTS organization_id uuid NULL;

ALTER TABLE public.quotations
  DROP CONSTRAINT IF EXISTS quotations_opportunity_id_fkey;
ALTER TABLE public.quotations
  ADD CONSTRAINT quotations_opportunity_id_fkey
  FOREIGN KEY (opportunity_id) REFERENCES public.opportunities(id) ON DELETE SET NULL;

ALTER TABLE public.quotations
  DROP CONSTRAINT IF EXISTS quotations_organization_id_fkey;
ALTER TABLE public.quotations
  ADD CONSTRAINT quotations_organization_id_fkey
  FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_quotations_opportunity_id ON public.quotations(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_quotations_organization_id ON public.quotations(organization_id);

-- Permiso de creación de cotizaciones en una organización
CREATE OR REPLACE FUNCTION public.can_create_quotation_for_organization(_user_id uuid, _org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
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

-- Resolución de organización propietaria de una cotización
-- Orden: explícita -> oportunidad (agente/owner) -> cliente -> creador
CREATE OR REPLACE FUNCTION public.resolve_quotation_organization(
  _creator_user_id uuid,
  _opportunity_id uuid DEFAULT NULL,
  _client_id uuid DEFAULT NULL,
  _explicit_org_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_res jsonb;
  v_agent uuid;
  v_owner uuid;
  v_client_user uuid;
BEGIN
  -- 1. Explícita
  IF _explicit_org_id IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = _explicit_org_id) THEN
      RETURN jsonb_build_object('organization_id', _explicit_org_id, 'source', 'explicit', 'confidence', 'high', 'error', NULL);
    END IF;
    RETURN jsonb_build_object('organization_id', NULL, 'source', 'explicit', 'confidence', 'none', 'error', 'organization_not_found');
  END IF;

  -- 2. Oportunidad: agente asignado o responsable
  IF _opportunity_id IS NOT NULL THEN
    SELECT o.assigned_agent_id, o.owner_user_id INTO v_agent, v_owner
    FROM public.opportunities o WHERE o.id = _opportunity_id;

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

REVOKE ALL ON FUNCTION public.can_create_quotation_for_organization(uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.resolve_quotation_organization(uuid, uuid, uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.can_create_quotation_for_organization(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.resolve_quotation_organization(uuid, uuid, uuid, uuid) TO authenticated, service_role;

-- Enforcement: ninguna cotización nueva puede nacer sin organización válida
CREATE OR REPLACE FUNCTION public.tg_quotation_require_organization()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_res jsonb;
  v_org uuid;
BEGIN
  -- Migraciones / procesos administrativos sin sesión
  IF v_uid IS NULL OR current_setting('role', true) = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF NEW.organization_id IS NOT NULL THEN
    IF NOT public.can_create_quotation_for_organization(v_uid, NEW.organization_id) THEN
      RAISE EXCEPTION 'Quotation requires a valid organization'
        USING HINT = 'not_allowed_for_organization';
    END IF;
    RETURN NEW;
  END IF;

  v_res := public.resolve_quotation_organization(
    COALESCE(NEW.user_id, v_uid), NEW.opportunity_id, NEW.client_id, NULL);
  v_org := NULLIF(v_res->>'organization_id', '')::uuid;

  IF v_org IS NULL OR (v_res->>'error') IS NOT NULL THEN
    RAISE EXCEPTION 'Quotation requires a valid organization'
      USING HINT = COALESCE(v_res->>'error', 'no_organization_found');
  END IF;

  IF NOT public.can_create_quotation_for_organization(v_uid, v_org) THEN
    RAISE EXCEPTION 'Quotation requires a valid organization'
      USING HINT = 'not_allowed_for_organization';
  END IF;

  NEW.organization_id := v_org;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS quotations_require_organization ON public.quotations;
CREATE TRIGGER quotations_require_organization
  BEFORE INSERT ON public.quotations
  FOR EACH ROW EXECUTE FUNCTION public.tg_quotation_require_organization();

-- Backfill no destructivo: vincular cotizaciones a oportunidades existentes
UPDATE public.quotations q
SET opportunity_id = o.id
FROM public.opportunities o
WHERE o.quotation_id = q.id
  AND q.opportunity_id IS NULL;
