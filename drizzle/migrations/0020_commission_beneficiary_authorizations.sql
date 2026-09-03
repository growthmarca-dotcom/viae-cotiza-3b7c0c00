-- =====================================================================
-- Paso previo a Administración: autorización unificada de beneficiarios
-- de comisión (persona/agente u organización).
--
-- No modifica el motor de cálculo (resolve_agreement / compute_commission),
-- ni importes, monedas, períodos o estados económicos de B1–C1.3.
-- La única regla funcional nueva: un beneficiario sin autorización activa
-- no entra al circuito de NUEVAS liquidaciones. Las liquidaciones,
-- comisiones, pagos y ajustes históricos no se modifican.
--
-- `agents.settlement_authorized` deja de ser fuente de verdad (la columna
-- permanece por compatibilidad, fuera de la UI y sin uso funcional).
-- =====================================================================

CREATE TYPE public.beneficiary_authorization_status AS ENUM ('authorized', 'revoked');
CREATE TYPE public.beneficiary_authorization_action AS ENUM ('authorized', 'revoked');

-- ---------------------------------------------------------------------
-- Autorización vigente/histórica por beneficiario
-- ---------------------------------------------------------------------
CREATE TABLE public.commission_beneficiary_authorizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  beneficiary_type public.agreement_party NOT NULL,
  beneficiary_id uuid NOT NULL,
  status public.beneficiary_authorization_status NOT NULL DEFAULT 'authorized',
  authorized_at timestamptz NOT NULL DEFAULT now(),
  authorized_by uuid NOT NULL,
  revoked_at timestamptz,
  revoked_by uuid,
  reason text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT beneficiary_type_supported CHECK (beneficiary_type IN ('agent', 'organization')),
  CONSTRAINT revocation_complete CHECK (
    (status = 'authorized' AND revoked_at IS NULL AND revoked_by IS NULL)
    OR (status = 'revoked' AND revoked_at IS NOT NULL)
  )
);

-- Una sola autorización activa por beneficiario. El histórico se conserva.
CREATE UNIQUE INDEX commission_beneficiary_auth_active_uniq
  ON public.commission_beneficiary_authorizations (beneficiary_type, beneficiary_id)
  WHERE status = 'authorized';

CREATE INDEX commission_beneficiary_auth_beneficiary_idx
  ON public.commission_beneficiary_authorizations (beneficiary_type, beneficiary_id, created_at DESC);

CREATE INDEX commission_beneficiary_auth_org_idx
  ON public.commission_beneficiary_authorizations (organization_id);

-- ---------------------------------------------------------------------
-- Historial append-only de la autorización
-- ---------------------------------------------------------------------
CREATE TABLE public.commission_beneficiary_authorization_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  authorization_id uuid NOT NULL REFERENCES public.commission_beneficiary_authorizations(id) ON DELETE RESTRICT,
  beneficiary_type public.agreement_party NOT NULL,
  beneficiary_id uuid NOT NULL,
  action public.beneficiary_authorization_action NOT NULL,
  actor_id uuid,
  reason text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX commission_beneficiary_auth_history_auth_idx
  ON public.commission_beneficiary_authorization_history (authorization_id, created_at DESC);

CREATE INDEX commission_beneficiary_auth_history_beneficiary_idx
  ON public.commission_beneficiary_authorization_history (beneficiary_type, beneficiary_id, created_at DESC);

GRANT SELECT ON public.commission_beneficiary_authorizations TO authenticated;
GRANT ALL ON public.commission_beneficiary_authorizations TO service_role;
GRANT SELECT ON public.commission_beneficiary_authorization_history TO authenticated;
GRANT ALL ON public.commission_beneficiary_authorization_history TO service_role;

ALTER TABLE public.commission_beneficiary_authorizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_beneficiary_authorization_history ENABLE ROW LEVEL SECURITY;

-- Escritura solo por RPC (SECURITY DEFINER). Aquí solo lectura.
CREATE POLICY "admins read beneficiary authorizations"
  ON public.commission_beneficiary_authorizations FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- El agente consulta únicamente su propia autorización.
CREATE POLICY "agent reads own beneficiary authorization"
  ON public.commission_beneficiary_authorizations FOR SELECT
  TO authenticated
  USING (
    beneficiary_type = 'agent'
    AND EXISTS (
      SELECT 1 FROM public.agents a
       WHERE a.id = beneficiary_id AND a.user_id = auth.uid()
    )
  );

-- Miembros de la organización beneficiaria pueden ver su propio estado.
CREATE POLICY "organization members read own beneficiary authorization"
  ON public.commission_beneficiary_authorizations FOR SELECT
  TO authenticated
  USING (
    beneficiary_type = 'organization'
    AND public.is_member_of(auth.uid(), beneficiary_id)
  );

CREATE POLICY "admins read beneficiary authorization history"
  ON public.commission_beneficiary_authorization_history FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "agent reads own beneficiary authorization history"
  ON public.commission_beneficiary_authorization_history FOR SELECT
  TO authenticated
  USING (
    beneficiary_type = 'agent'
    AND EXISTS (
      SELECT 1 FROM public.agents a
       WHERE a.id = beneficiary_id AND a.user_id = auth.uid()
    )
  );

CREATE POLICY "organization members read own beneficiary authorization history"
  ON public.commission_beneficiary_authorization_history FOR SELECT
  TO authenticated
  USING (
    beneficiary_type = 'organization'
    AND public.is_member_of(auth.uid(), beneficiary_id)
  );

-- ---------------------------------------------------------------------
-- Inmutabilidad: historial append-only, autorizaciones no se borran
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tg_beneficiary_auth_history_append_only()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RAISE EXCEPTION 'El historial de autorizaciones es append-only.';
END;
$$;

CREATE TRIGGER beneficiary_auth_history_no_update
  BEFORE UPDATE OR DELETE ON public.commission_beneficiary_authorization_history
  FOR EACH ROW EXECUTE FUNCTION public.tg_beneficiary_auth_history_append_only();

CREATE OR REPLACE FUNCTION public.tg_beneficiary_auth_no_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RAISE EXCEPTION 'Las autorizaciones de beneficiario no se eliminan: se revocan.';
END;
$$;

CREATE TRIGGER beneficiary_auth_no_delete
  BEFORE DELETE ON public.commission_beneficiary_authorizations
  FOR EACH ROW EXECUTE FUNCTION public.tg_beneficiary_auth_no_delete();

CREATE OR REPLACE FUNCTION public.tg_beneficiary_auth_touch()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at := now();
  -- La trazabilidad original nunca se reescribe.
  NEW.beneficiary_type := OLD.beneficiary_type;
  NEW.beneficiary_id := OLD.beneficiary_id;
  NEW.authorized_at := OLD.authorized_at;
  NEW.authorized_by := OLD.authorized_by;
  NEW.created_at := OLD.created_at;
  RETURN NEW;
END;
$$;

CREATE TRIGGER beneficiary_auth_touch
  BEFORE UPDATE ON public.commission_beneficiary_authorizations
  FOR EACH ROW EXECUTE FUNCTION public.tg_beneficiary_auth_touch();

-- ---------------------------------------------------------------------
-- Fuente de verdad de la autorización
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_authorized_beneficiary(
  _beneficiary_type public.agreement_party,
  _beneficiary_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.commission_beneficiary_authorizations
     WHERE beneficiary_type = _beneficiary_type
       AND beneficiary_id = _beneficiary_id
       AND status = 'authorized'
  );
$$;

-- ---------------------------------------------------------------------
-- RPC: autorizar
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.authorize_commission_beneficiary(
  _beneficiary_type public.agreement_party,
  _beneficiary_id uuid,
  _reason text DEFAULT NULL,
  _notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  uid uuid := auth.uid();
  org_id uuid;
  auth_id uuid;
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;
  IF NOT public.has_role(uid, 'admin') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;
  IF _beneficiary_type NOT IN ('agent', 'organization') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'unsupported_beneficiary_type');
  END IF;

  IF _beneficiary_type = 'agent' THEN
    IF NOT EXISTS (SELECT 1 FROM public.agents WHERE id = _beneficiary_id) THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'agent_not_found');
    END IF;
    -- Nadie se autoriza a sí mismo.
    IF EXISTS (
      SELECT 1 FROM public.agents WHERE id = _beneficiary_id AND user_id = uid
    ) THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'self_authorization_forbidden');
    END IF;
    SELECT NULL::uuid INTO org_id;
  ELSE
    IF NOT EXISTS (SELECT 1 FROM public.organizations WHERE id = _beneficiary_id) THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'organization_not_found');
    END IF;
    -- Una organización no se autoriza a sí misma a través de su membresía.
    IF public.is_member_of(uid, _beneficiary_id) THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'self_authorization_forbidden');
    END IF;
    org_id := _beneficiary_id;
  END IF;

  SELECT id INTO auth_id
    FROM public.commission_beneficiary_authorizations
   WHERE beneficiary_type = _beneficiary_type
     AND beneficiary_id = _beneficiary_id
     AND status = 'authorized';

  IF auth_id IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'created', false, 'authorization_id', auth_id);
  END IF;

  INSERT INTO public.commission_beneficiary_authorizations
    (organization_id, beneficiary_type, beneficiary_id, status,
     authorized_at, authorized_by, reason, notes)
  VALUES (org_id, _beneficiary_type, _beneficiary_id, 'authorized',
          now(), uid, NULLIF(btrim(COALESCE(_reason, '')), ''), NULLIF(btrim(COALESCE(_notes, '')), ''))
  RETURNING id INTO auth_id;

  INSERT INTO public.commission_beneficiary_authorization_history
    (authorization_id, beneficiary_type, beneficiary_id, action, actor_id, reason, notes)
  VALUES (auth_id, _beneficiary_type, _beneficiary_id, 'authorized', uid,
          NULLIF(btrim(COALESCE(_reason, '')), ''), NULLIF(btrim(COALESCE(_notes, '')), ''));

  RETURN jsonb_build_object('ok', true, 'created', true, 'authorization_id', auth_id);
END;
$$;

-- ---------------------------------------------------------------------
-- RPC: revocar (conserva el registro histórico)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.revoke_commission_beneficiary(
  _beneficiary_type public.agreement_party,
  _beneficiary_id uuid,
  _reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  uid uuid := auth.uid();
  auth_id uuid;
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;
  IF NOT public.has_role(uid, 'admin') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;
  IF NULLIF(btrim(COALESCE(_reason, '')), '') IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'reason_required');
  END IF;

  SELECT id INTO auth_id
    FROM public.commission_beneficiary_authorizations
   WHERE beneficiary_type = _beneficiary_type
     AND beneficiary_id = _beneficiary_id
     AND status = 'authorized';

  IF auth_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_active_authorization');
  END IF;

  UPDATE public.commission_beneficiary_authorizations
     SET status = 'revoked',
         revoked_at = now(),
         revoked_by = uid,
         reason = btrim(_reason)
   WHERE id = auth_id;

  INSERT INTO public.commission_beneficiary_authorization_history
    (authorization_id, beneficiary_type, beneficiary_id, action, actor_id, reason)
  VALUES (auth_id, _beneficiary_type, _beneficiary_id, 'revoked', uid, btrim(_reason));

  RETURN jsonb_build_object('ok', true, 'authorization_id', auth_id);
END;
$$;

REVOKE ALL ON FUNCTION public.is_authorized_beneficiary(public.agreement_party, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.authorize_commission_beneficiary(public.agreement_party, uuid, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.revoke_commission_beneficiary(public.agreement_party, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_authorized_beneficiary(public.agreement_party, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.authorize_commission_beneficiary(public.agreement_party, uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_commission_beneficiary(public.agreement_party, uuid, text) TO authenticated;

-- ---------------------------------------------------------------------
-- Liquidaciones: la elegibilidad del beneficiario pasa a depender de la
-- autorización unificada, tanto para agentes como para organizaciones.
-- Todo el resto del cálculo (importe, moneda, período, delay, frecuencia,
-- estados) queda exactamente igual.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.generate_commission_settlements(_as_of date DEFAULT NULL::date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  today date := COALESCE(_as_of, CURRENT_DATE);
  r record;
  s_id uuid;
  created_settlements integer := 0;
  created_items integer := 0;
  skipped integer := 0;
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;
  IF NOT public.has_role(uid, 'admin') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  FOR r IN
    SELECT
      c.id AS commission_id,
      c.commission_amount,
      c.currency,
      c.organization_id,
      c.party_type,
      c.agent_id,
      chk.checkout_date,
      (chk.checkout_date + COALESCE(ag.settlement_delay_days, 0)) AS eligible_on,
      COALESCE(ag.settlement_frequency, 'monthly') AS freq
    FROM public.commissions c
    LEFT JOIN public.commercial_agreements ag ON ag.id = c.agreement_id
    LEFT JOIN public.booking_services bs ON bs.id = c.booking_service_id
    LEFT JOIN public.bookings b ON b.id = c.booking_id
    CROSS JOIN LATERAL (
      SELECT COALESCE(bs.service_date, b.travel_end)::date AS checkout_date
    ) chk
    WHERE c.status = 'approved'
      AND c.commission_amount IS NOT NULL
      AND c.commission_amount > 0
      AND c.currency IS NOT NULL
      AND btrim(c.currency) <> ''
      AND chk.checkout_date IS NOT NULL
      AND (chk.checkout_date + COALESCE(ag.settlement_delay_days, 0)) <= today
      AND NOT EXISTS (
        SELECT 1 FROM public.commission_settlement_items i WHERE i.commission_id = c.id
      )
      AND (
        (
          c.party_type = 'organization' AND c.organization_id IS NOT NULL
          AND public.is_authorized_beneficiary('organization', c.organization_id)
        )
        OR (
          c.party_type = 'agent' AND c.agent_id IS NOT NULL
          AND public.is_authorized_beneficiary('agent', c.agent_id)
        )
      )
    ORDER BY c.computed_at
  LOOP
    DECLARE
      b_type public.agreement_party := r.party_type;
      b_id uuid := CASE WHEN r.party_type = 'organization' THEN r.organization_id ELSE r.agent_id END;
      p_start date;
      p_end date;
    BEGIN
      IF r.freq = 'biweekly' THEN
        IF EXTRACT(DAY FROM r.eligible_on) <= 15 THEN
          p_start := date_trunc('month', r.eligible_on)::date;
          p_end := (date_trunc('month', r.eligible_on)::date + 14);
        ELSE
          p_start := (date_trunc('month', r.eligible_on)::date + 15);
          p_end := (date_trunc('month', r.eligible_on) + interval '1 month - 1 day')::date;
        END IF;
      ELSE
        p_start := date_trunc('month', r.eligible_on)::date;
        p_end := (date_trunc('month', r.eligible_on) + interval '1 month - 1 day')::date;
      END IF;

      SELECT id INTO s_id FROM public.commission_settlements
       WHERE beneficiary_type = b_type AND beneficiary_id = b_id
         AND currency = r.currency AND period_start = p_start AND period_end = p_end;

      IF s_id IS NULL THEN
        INSERT INTO public.commission_settlements
          (organization_id, beneficiary_type, beneficiary_id, currency,
           period_start, period_end, status, created_by)
        VALUES (r.organization_id, b_type, b_id, r.currency, p_start, p_end, 'draft', uid)
        RETURNING id INTO s_id;
        created_settlements := created_settlements + 1;

        INSERT INTO public.commission_settlement_history
          (settlement_id, actor_id, action, from_status, to_status, comment)
        VALUES (s_id, uid, 'created', NULL, 'draft', 'Liquidación generada automáticamente.');
      ELSIF (SELECT status FROM public.commission_settlements WHERE id = s_id) IN ('approved', 'settled') THEN
        skipped := skipped + 1;
        CONTINUE;
      END IF;

      INSERT INTO public.commission_settlement_items
        (settlement_id, commission_id, commission_amount, currency, eligible_on, checkout_date)
      VALUES (s_id, r.commission_id, r.commission_amount, r.currency, r.eligible_on, r.checkout_date)
      ON CONFLICT (commission_id) DO NOTHING;

      IF FOUND THEN created_items := created_items + 1; END IF;
    END;
  END LOOP;

  UPDATE public.commission_settlements s
     SET total_commission_amount = agg.total,
         commission_count = agg.cnt
    FROM (
      SELECT settlement_id, SUM(commission_amount)::numeric(14,2) AS total, COUNT(*)::int AS cnt
        FROM public.commission_settlement_items GROUP BY settlement_id
    ) agg
   WHERE agg.settlement_id = s.id
     AND s.status NOT IN ('approved', 'settled')
     AND (s.total_commission_amount, s.commission_count) IS DISTINCT FROM (agg.total, agg.cnt);

  RETURN jsonb_build_object(
    'ok', true,
    'as_of', today,
    'settlements_created', created_settlements,
    'items_created', created_items,
    'skipped', skipped
  );
END;
$function$;

COMMENT ON COLUMN public.agents.settlement_authorized IS
  'OBSOLETO: la autorización de beneficiario vive en commission_beneficiary_authorizations. Se conserva por compatibilidad histórica y no se usa.';
COMMENT ON COLUMN public.agents.commission_type IS
  'OBSOLETO: el cálculo de comisiones proviene exclusivamente de commercial_agreements + agreement_rules.';
COMMENT ON COLUMN public.agents.commission_value IS
  'OBSOLETO: el cálculo de comisiones proviene exclusivamente de commercial_agreements + agreement_rules.';
COMMENT ON COLUMN public.agents.commission_currency IS
  'OBSOLETO: el cálculo de comisiones proviene exclusivamente de commercial_agreements + agreement_rules.';
