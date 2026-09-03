-- Comisiones Fase C1.1 — Núcleo de Liquidaciones.
-- Las liquidaciones CONSUMEN comisiones existentes: no calculan ni recalculan
-- comisiones. El motor (resolve_agreement/compute_commission/accrue_*) no se toca.

-- 1) Configuración de liquidación en el acuerdo comercial (mínimo necesario).
DO $$ BEGIN
  CREATE TYPE public.settlement_frequency AS ENUM ('monthly', 'biweekly');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.settlement_status AS ENUM ('draft', 'pending_review', 'approved', 'settled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.commercial_agreements
  ADD COLUMN IF NOT EXISTS settlement_delay_days integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS settlement_frequency public.settlement_frequency NOT NULL DEFAULT 'monthly';

ALTER TABLE public.commercial_agreements
  DROP CONSTRAINT IF EXISTS commercial_agreements_settlement_delay_days_check;
ALTER TABLE public.commercial_agreements
  ADD CONSTRAINT commercial_agreements_settlement_delay_days_check
  CHECK (settlement_delay_days >= 0 AND settlement_delay_days <= 365);

-- Autorización del agente para recibir comisión liquidable a título propio.
-- NO participa del cálculo (los importes siguen viniendo del motor de acuerdos).
ALTER TABLE public.agents
  ADD COLUMN IF NOT EXISTS settlement_authorized boolean NOT NULL DEFAULT false;

-- 2) Liquidaciones.
CREATE TABLE IF NOT EXISTS public.commission_settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  beneficiary_type public.agreement_party NOT NULL,
  beneficiary_id uuid NOT NULL,
  currency text NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  total_commission_amount numeric(14,2) NOT NULL DEFAULT 0,
  commission_count integer NOT NULL DEFAULT 0,
  status public.settlement_status NOT NULL DEFAULT 'draft',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid,
  CONSTRAINT commission_settlements_period_check CHECK (period_end >= period_start),
  CONSTRAINT commission_settlements_amount_check CHECK (total_commission_amount >= 0),
  CONSTRAINT commission_settlements_count_check CHECK (commission_count >= 0),
  CONSTRAINT commission_settlements_currency_check CHECK (char_length(btrim(currency)) > 0),
  CONSTRAINT commission_settlements_beneficiary_check CHECK (beneficiary_type IN ('organization', 'agent'))
);

CREATE UNIQUE INDEX IF NOT EXISTS commission_settlements_group_uniq
  ON public.commission_settlements (beneficiary_type, beneficiary_id, currency, period_start, period_end);
CREATE INDEX IF NOT EXISTS commission_settlements_status_idx
  ON public.commission_settlements (status, period_start DESC);
CREATE INDEX IF NOT EXISTS commission_settlements_org_idx
  ON public.commission_settlements (organization_id);

GRANT SELECT, INSERT, UPDATE ON public.commission_settlements TO authenticated;
GRANT ALL ON public.commission_settlements TO service_role;
ALTER TABLE public.commission_settlements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS settlements_admin_all ON public.commission_settlements;
CREATE POLICY settlements_admin_all ON public.commission_settlements
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS settlements_operations_read ON public.commission_settlements;
CREATE POLICY settlements_operations_read ON public.commission_settlements
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'operations'));

-- 3) Detalle: snapshot del importe liquidado.
CREATE TABLE IF NOT EXISTS public.commission_settlement_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  settlement_id uuid NOT NULL REFERENCES public.commission_settlements(id) ON DELETE CASCADE,
  commission_id uuid NOT NULL REFERENCES public.commissions(id) ON DELETE RESTRICT,
  commission_amount numeric(14,2) NOT NULL,
  currency text NOT NULL,
  eligible_on date,
  checkout_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT commission_settlement_items_amount_check CHECK (commission_amount > 0)
);

-- Una comisión no puede pertenecer a dos liquidaciones ni repetirse en una.
CREATE UNIQUE INDEX IF NOT EXISTS commission_settlement_items_commission_uniq
  ON public.commission_settlement_items (commission_id);
CREATE UNIQUE INDEX IF NOT EXISTS commission_settlement_items_pair_uniq
  ON public.commission_settlement_items (settlement_id, commission_id);

GRANT SELECT, INSERT ON public.commission_settlement_items TO authenticated;
GRANT ALL ON public.commission_settlement_items TO service_role;
ALTER TABLE public.commission_settlement_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS settlement_items_admin_all ON public.commission_settlement_items;
CREATE POLICY settlement_items_admin_all ON public.commission_settlement_items
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS settlement_items_operations_read ON public.commission_settlement_items;
CREATE POLICY settlement_items_operations_read ON public.commission_settlement_items
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'operations'));

-- 4) Historial append-only.
CREATE TABLE IF NOT EXISTS public.commission_settlement_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  settlement_id uuid NOT NULL REFERENCES public.commission_settlements(id) ON DELETE CASCADE,
  actor_id uuid,
  action text NOT NULL,
  from_status public.settlement_status,
  to_status public.settlement_status,
  comment text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS commission_settlement_history_idx
  ON public.commission_settlement_history (settlement_id, created_at DESC);

GRANT SELECT ON public.commission_settlement_history TO authenticated;
GRANT ALL ON public.commission_settlement_history TO service_role;
ALTER TABLE public.commission_settlement_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS settlement_history_read ON public.commission_settlement_history;
CREATE POLICY settlement_history_read ON public.commission_settlement_history
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'operations'));

CREATE OR REPLACE FUNCTION public.tg_settlement_history_append_only()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION 'El historial de liquidaciones es append-only.';
END;
$$;

DROP TRIGGER IF EXISTS settlement_history_append_only ON public.commission_settlement_history;
CREATE TRIGGER settlement_history_append_only
BEFORE UPDATE OR DELETE ON public.commission_settlement_history
FOR EACH ROW EXECUTE FUNCTION public.tg_settlement_history_append_only();

-- 5) Integridad: una liquidación aprobada/liquidada no admite cambios económicos.
CREATE OR REPLACE FUNCTION public.tg_settlement_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status IN ('approved', 'settled') THEN
      RAISE EXCEPTION 'Una liquidación aprobada no se elimina.';
    END IF;
    RETURN OLD;
  END IF;

  IF OLD.status IN ('approved', 'settled') THEN
    IF ROW(NEW.beneficiary_type, NEW.beneficiary_id, NEW.organization_id, NEW.currency,
           NEW.period_start, NEW.period_end, NEW.total_commission_amount, NEW.commission_count)
       IS DISTINCT FROM
       ROW(OLD.beneficiary_type, OLD.beneficiary_id, OLD.organization_id, OLD.currency,
           OLD.period_start, OLD.period_end, OLD.total_commission_amount, OLD.commission_count)
    THEN
      RAISE EXCEPTION 'Una liquidación aprobada no admite modificaciones económicas.';
    END IF;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS commission_settlements_guard ON public.commission_settlements;
CREATE TRIGGER commission_settlements_guard
BEFORE UPDATE OR DELETE ON public.commission_settlements
FOR EACH ROW EXECUTE FUNCTION public.tg_settlement_guard();

CREATE OR REPLACE FUNCTION public.tg_settlement_item_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  st public.settlement_status;
BEGIN
  SELECT status INTO st FROM public.commission_settlements
   WHERE id = COALESCE(NEW.settlement_id, OLD.settlement_id);

  IF st IN ('approved', 'settled') THEN
    RAISE EXCEPTION 'Una liquidación aprobada no admite cambios en su detalle.';
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS commission_settlement_items_guard ON public.commission_settlement_items;
CREATE TRIGGER commission_settlement_items_guard
BEFORE INSERT OR UPDATE OR DELETE ON public.commission_settlement_items
FOR EACH ROW EXECUTE FUNCTION public.tg_settlement_item_guard();

-- 6) Generación automática, idempotente y sólo administrativa.
CREATE OR REPLACE FUNCTION public.generate_commission_settlements(_as_of date DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
        (c.party_type = 'organization' AND c.organization_id IS NOT NULL)
        OR (
          c.party_type = 'agent' AND c.agent_id IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM public.agents a
             WHERE a.id = c.agent_id AND a.settlement_authorized = true
          )
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
        -- No se agregan comisiones a una liquidación ya aprobada.
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

  -- Totales derivados del detalle (snapshot ya guardado por ítem).
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
$$;

REVOKE ALL ON FUNCTION public.generate_commission_settlements(date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.generate_commission_settlements(date) FROM anon;
GRANT EXECUTE ON FUNCTION public.generate_commission_settlements(date) TO authenticated;

-- 7) Transiciones de estado controladas + auditoría.
CREATE OR REPLACE FUNCTION public.set_settlement_status(
  _settlement_id uuid,
  _to public.settlement_status,
  _comment text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  cur public.settlement_status;
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;
  IF NOT public.has_role(uid, 'admin') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  SELECT status INTO cur FROM public.commission_settlements WHERE id = _settlement_id;
  IF cur IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF cur = _to THEN
    RETURN jsonb_build_object('ok', true, 'changed', false, 'status', cur);
  END IF;

  -- 'settled' queda reservado para C1.2 (registro real del pago).
  IF _to = 'settled' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'settlement_payment_not_available');
  END IF;

  IF NOT (
    (cur = 'draft' AND _to = 'pending_review')
    OR (cur = 'pending_review' AND _to IN ('approved', 'draft'))
    OR (cur = 'approved' AND _to = 'pending_review')
  ) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_transition', 'from', cur, 'to', _to);
  END IF;

  UPDATE public.commission_settlements
     SET status = _to,
         reviewed_at = CASE WHEN _to = 'approved' THEN now() ELSE reviewed_at END,
         reviewed_by = CASE WHEN _to = 'approved' THEN uid ELSE reviewed_by END
   WHERE id = _settlement_id;

  INSERT INTO public.commission_settlement_history
    (settlement_id, actor_id, action, from_status, to_status, comment)
  VALUES (_settlement_id, uid, 'status_changed', cur, _to,
          NULLIF(btrim(COALESCE(_comment, '')), ''));

  RETURN jsonb_build_object('ok', true, 'changed', true, 'from', cur, 'status', _to);
END;
$$;

REVOKE ALL ON FUNCTION public.set_settlement_status(uuid, public.settlement_status, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_settlement_status(uuid, public.settlement_status, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.set_settlement_status(uuid, public.settlement_status, text) TO authenticated;

-- Notas administrativas: sólo admin, y nunca sobre una liquidación aprobada.
CREATE OR REPLACE FUNCTION public.set_settlement_notes(_settlement_id uuid, _notes text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;
  IF NOT public.has_role(uid, 'admin') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  UPDATE public.commission_settlements
     SET notes = NULLIF(btrim(COALESCE(_notes, '')), '')
   WHERE id = _settlement_id;

  INSERT INTO public.commission_settlement_history
    (settlement_id, actor_id, action, comment)
  VALUES (_settlement_id, uid, 'notes_updated', NULLIF(btrim(COALESCE(_notes, '')), ''));

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.set_settlement_notes(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_settlement_notes(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.set_settlement_notes(uuid, text) TO authenticated;
