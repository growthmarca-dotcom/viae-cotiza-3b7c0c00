-- =========================================================
-- VIAE CORE v1.10.9.1 — Smart Quote Integration Foundation (Fase B1)
-- =========================================================

-- 1. RELACIÓN SMART QUOTE -> OPPORTUNITY
ALTER TABLE public.smart_quotes
  ADD COLUMN IF NOT EXISTS opportunity_id uuid;

ALTER TABLE public.smart_quotes
  DROP CONSTRAINT IF EXISTS smart_quotes_opportunity_id_fkey;
ALTER TABLE public.smart_quotes
  ADD CONSTRAINT smart_quotes_opportunity_id_fkey
  FOREIGN KEY (opportunity_id) REFERENCES public.opportunities(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_smart_quotes_opportunity_id ON public.smart_quotes(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_smart_quotes_organization_id ON public.smart_quotes(organization_id);
CREATE INDEX IF NOT EXISTS idx_smart_quotes_client_id ON public.smart_quotes(client_id);
CREATE INDEX IF NOT EXISTS idx_smart_quotes_agent_id ON public.smart_quotes(agent_id);

-- 2. RELACIÓN QUOTATION -> SMART QUOTE
ALTER TABLE public.quotations
  ADD COLUMN IF NOT EXISTS smart_quote_id uuid;

ALTER TABLE public.quotations
  DROP CONSTRAINT IF EXISTS quotations_smart_quote_id_fkey;
ALTER TABLE public.quotations
  ADD CONSTRAINT quotations_smart_quote_id_fkey
  FOREIGN KEY (smart_quote_id) REFERENCES public.smart_quotes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_quotations_smart_quote_id ON public.quotations(smart_quote_id);

-- 3. RELACIÓN BOOKING -> SMART QUOTE
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS smart_quote_id uuid;

ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_smart_quote_id_fkey;
ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_smart_quote_id_fkey
  FOREIGN KEY (smart_quote_id) REFERENCES public.smart_quotes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_bookings_smart_quote_id ON public.bookings(smart_quote_id);

-- =========================================================
-- 4. RESOLUCIÓN DE ORGANIZACIÓN
-- =========================================================
CREATE OR REPLACE FUNCTION public.resolve_smart_quote_organization(
  _creator_user_id uuid,
  _opportunity_id uuid DEFAULT NULL,
  _client_id uuid DEFAULT NULL,
  _agent_id uuid DEFAULT NULL,
  _explicit_org_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_res jsonb;
  v_org uuid;
  v_agent uuid;
  v_owner uuid;
  v_client_user uuid;
  v_candidates uuid[] := ARRAY[]::uuid[];
  v_distinct uuid[];
BEGIN
  -- 1. Organización explícita
  IF _explicit_org_id IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = _explicit_org_id) THEN
      RETURN jsonb_build_object('organization_id', _explicit_org_id, 'source', 'explicit',
                                'confidence', 'high', 'error', NULL);
    END IF;
    RETURN jsonb_build_object('organization_id', NULL, 'source', 'explicit',
                              'confidence', 'none', 'error', 'organization_not_found');
  END IF;

  -- 2. Oportunidad
  IF _opportunity_id IS NOT NULL THEN
    SELECT o.organization_id, o.assigned_agent_id, o.owner_user_id
      INTO v_org, v_agent, v_owner
    FROM public.opportunities o WHERE o.id = _opportunity_id;

    IF v_org IS NOT NULL THEN
      v_candidates := v_candidates || v_org;
    ELSIF v_agent IS NOT NULL OR v_owner IS NOT NULL THEN
      v_res := public.resolve_booking_organization(v_owner, v_agent, NULL);
      IF (v_res->>'organization_id') IS NOT NULL THEN
        v_candidates := v_candidates || (v_res->>'organization_id')::uuid;
      END IF;
    END IF;
  END IF;

  -- 3. Agente asignado
  IF _agent_id IS NOT NULL THEN
    v_res := public.resolve_booking_organization(NULL, _agent_id, NULL);
    IF (v_res->>'organization_id') IS NOT NULL THEN
      v_candidates := v_candidates || (v_res->>'organization_id')::uuid;
    END IF;
  END IF;

  -- 4. Cliente relacionado
  IF _client_id IS NOT NULL THEN
    SELECT c.user_id INTO v_client_user FROM public.clients c WHERE c.id = _client_id;
    IF v_client_user IS NOT NULL THEN
      v_res := public.resolve_booking_organization(v_client_user, NULL, NULL);
      IF (v_res->>'organization_id') IS NOT NULL THEN
        v_candidates := v_candidates || (v_res->>'organization_id')::uuid;
      END IF;
    END IF;
  END IF;

  SELECT ARRAY(SELECT DISTINCT u FROM unnest(v_candidates) AS u) INTO v_distinct;

  IF array_length(v_distinct, 1) > 1 THEN
    RETURN jsonb_build_object(
      'organization_id', NULL, 'source', 'ambiguous', 'confidence', 'none',
      'error', 'ambiguous_organization',
      'candidates', to_jsonb(v_distinct));
  END IF;

  IF array_length(v_distinct, 1) = 1 THEN
    RETURN jsonb_build_object('organization_id', v_distinct[1], 'source', 'related',
                              'confidence', 'high', 'error', NULL);
  END IF;

  -- 5. Membresía única del creador
  v_res := public.resolve_booking_organization(_creator_user_id, NULL, NULL);
  IF (v_res->>'organization_id') IS NOT NULL THEN
    RETURN jsonb_build_object('organization_id', (v_res->>'organization_id')::uuid,
                              'source', 'creator_membership', 'confidence', 'medium', 'error', NULL);
  END IF;

  RETURN jsonb_build_object(
    'organization_id', NULL, 'source', 'none', 'confidence', 'none',
    'error', COALESCE(v_res->>'error', 'no_organization_found'),
    'candidates', v_res->'candidates');
END;
$$;

-- =========================================================
-- 5. VALIDACIÓN MULTI-TENANT
-- =========================================================

-- 5.a Smart Quote: exigir organización al insertar + coherencia con oportunidad
CREATE OR REPLACE FUNCTION public.tg_smart_quote_require_organization()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_res jsonb;
BEGIN
  IF NEW.organization_id IS NULL THEN
    v_res := public.resolve_smart_quote_organization(
      NEW.user_id, NEW.opportunity_id, NEW.client_id, NEW.agent_id, NULL);

    IF (v_res->>'organization_id') IS NULL THEN
      RAISE EXCEPTION 'Smart quote requires an organization (%)', COALESCE(v_res->>'error', 'unknown')
        USING HINT = COALESCE(v_res->>'error', 'no_organization_found');
    END IF;

    NEW.organization_id := (v_res->>'organization_id')::uuid;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_smart_quote_require_organization ON public.smart_quotes;
CREATE TRIGGER trg_smart_quote_require_organization
BEFORE INSERT ON public.smart_quotes
FOR EACH ROW EXECUTE FUNCTION public.tg_smart_quote_require_organization();

CREATE OR REPLACE FUNCTION public.tg_smart_quote_coherence()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_org uuid;
BEGIN
  IF NEW.organization_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Oportunidad vinculada
  IF NEW.opportunity_id IS NOT NULL THEN
    SELECT o.organization_id INTO v_org
    FROM public.opportunities o WHERE o.id = NEW.opportunity_id;
    IF v_org IS NOT NULL AND v_org <> NEW.organization_id THEN
      RAISE EXCEPTION 'Smart quote and opportunity belong to different organizations'
        USING HINT = 'organization_mismatch';
    END IF;
  END IF;

  -- Cotizaciones ya vinculadas a esta smart quote
  IF EXISTS (
    SELECT 1 FROM public.quotations q
    WHERE q.smart_quote_id = NEW.id
      AND q.organization_id IS NOT NULL
      AND q.organization_id <> NEW.organization_id
  ) THEN
    RAISE EXCEPTION 'Smart quote organization conflicts with a linked quotation'
      USING HINT = 'organization_mismatch';
  END IF;

  -- Reservas ya vinculadas a esta smart quote
  IF EXISTS (
    SELECT 1 FROM public.bookings b
    WHERE b.smart_quote_id = NEW.id
      AND b.organization_id IS NOT NULL
      AND b.organization_id <> NEW.organization_id
  ) THEN
    RAISE EXCEPTION 'Smart quote organization conflicts with a linked booking'
      USING HINT = 'organization_mismatch';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_smart_quote_coherence ON public.smart_quotes;
CREATE TRIGGER trg_smart_quote_coherence
BEFORE INSERT OR UPDATE ON public.smart_quotes
FOR EACH ROW EXECUTE FUNCTION public.tg_smart_quote_coherence();

-- 5.b Quotation <-> Smart Quote
CREATE OR REPLACE FUNCTION public.tg_quotation_smart_quote_same_org()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_org uuid;
  v_opp uuid;
BEGIN
  IF NEW.smart_quote_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT sq.organization_id, sq.opportunity_id INTO v_org, v_opp
  FROM public.smart_quotes sq WHERE sq.id = NEW.smart_quote_id;

  IF NEW.organization_id IS NULL THEN
    NEW.organization_id := v_org;
  ELSIF v_org IS NOT NULL AND v_org <> NEW.organization_id THEN
    RAISE EXCEPTION 'Quotation and smart quote belong to different organizations'
      USING HINT = 'organization_mismatch';
  END IF;

  IF NEW.opportunity_id IS NULL THEN
    NEW.opportunity_id := v_opp;
  ELSIF v_opp IS NOT NULL AND v_opp <> NEW.opportunity_id THEN
    RAISE EXCEPTION 'Quotation and smart quote reference different opportunities'
      USING HINT = 'opportunity_mismatch';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_quotation_smart_quote_same_org ON public.quotations;
CREATE TRIGGER trg_quotation_smart_quote_same_org
BEFORE INSERT OR UPDATE OF smart_quote_id, organization_id, opportunity_id ON public.quotations
FOR EACH ROW EXECUTE FUNCTION public.tg_quotation_smart_quote_same_org();

-- 5.c Booking <-> Smart Quote
CREATE OR REPLACE FUNCTION public.tg_booking_smart_quote_same_org()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_org uuid;
BEGIN
  IF NEW.smart_quote_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT sq.organization_id INTO v_org
  FROM public.smart_quotes sq WHERE sq.id = NEW.smart_quote_id;

  IF NEW.organization_id IS NULL THEN
    NEW.organization_id := v_org;
  ELSIF v_org IS NOT NULL AND v_org <> NEW.organization_id THEN
    RAISE EXCEPTION 'Booking and smart quote belong to different organizations'
      USING HINT = 'organization_mismatch';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_booking_smart_quote_same_org ON public.bookings;
CREATE TRIGGER trg_booking_smart_quote_same_org
BEFORE INSERT OR UPDATE OF smart_quote_id, organization_id ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.tg_booking_smart_quote_same_org();

-- =========================================================
-- 6. PERMISOS
-- =========================================================

-- Agente asignado puede actualizar sus smart quotes (campos comerciales)
DROP POLICY IF EXISTS "smart_quotes_agent_update" ON public.smart_quotes;
CREATE POLICY "smart_quotes_agent_update"
ON public.smart_quotes
FOR UPDATE
TO authenticated
USING (agent_id IS NOT NULL AND agent_id = public.current_agent_id())
WITH CHECK (agent_id IS NOT NULL AND agent_id = public.current_agent_id());

-- Guardia: el agente no puede alterar campos estructurales
CREATE OR REPLACE FUNCTION public.tg_smart_quote_guard_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL
     OR public.has_role(auth.uid(), 'admin')
     OR public.is_operations(auth.uid())
     OR OLD.user_id = auth.uid() THEN
    RETURN NEW;
  END IF;

  IF NEW.organization_id IS DISTINCT FROM OLD.organization_id
     OR NEW.opportunity_id IS DISTINCT FROM OLD.opportunity_id
     OR NEW.client_id IS DISTINCT FROM OLD.client_id
     OR NEW.agent_id IS DISTINCT FROM OLD.agent_id
     OR NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'Assigned agents cannot change structural fields of a smart quote'
      USING HINT = 'structural_field_locked';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_smart_quote_guard_update ON public.smart_quotes;
CREATE TRIGGER trg_smart_quote_guard_update
BEFORE UPDATE ON public.smart_quotes
FOR EACH ROW EXECUTE FUNCTION public.tg_smart_quote_guard_update();

-- Documentación
COMMENT ON COLUMN public.smart_quotes.opportunity_id IS 'v1.10.9.1 — oportunidad origen del flujo Opportunity -> Smart Quote -> Quotation -> Booking';
COMMENT ON COLUMN public.quotations.smart_quote_id IS 'v1.10.9.1 — smart quote (motor de cálculo) que originó esta cotización de presentación';
COMMENT ON COLUMN public.bookings.smart_quote_id IS 'v1.10.9.1 — smart quote origen; se conserva junto a quotation_id y opportunity_id';
COMMENT ON FUNCTION public.resolve_smart_quote_organization(uuid, uuid, uuid, uuid, uuid) IS 'v1.10.9.1 — resuelve organización: explícita > oportunidad > agente > cliente > membresía del creador; ambiguous_organization si hay varias';