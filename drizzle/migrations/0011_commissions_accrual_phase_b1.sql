-- Motor de comisiones v1.9.4 Fase B1: devengo, historial automático y transiciones controladas.
-- Reutiliza resolve_agreement() + compute_commission(); no crea un segundo motor de cálculo.

-- 1) Historial automático de comisiones (fuente única del historial)
CREATE OR REPLACE FUNCTION public.tg_commission_history()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.commission_history (
      commission_id, owner_id, actor_id, action, from_status, to_status, changes
    ) VALUES (
      NEW.id, NEW.user_id, COALESCE(auth.uid(), NEW.computed_by), 'accrued', NULL, NEW.status,
      jsonb_build_object(
        'entity', NEW.entity,
        'entity_id', NEW.entity_id,
        'booking_id', NEW.booking_id,
        'agreement_id', NEW.agreement_id,
        'rule_id', NEW.rule_id,
        'commission_amount', NEW.commission_amount,
        'currency', NEW.currency
      )
    );
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.commission_history (
      commission_id, owner_id, actor_id, action, from_status, to_status, changes, comment
    ) VALUES (
      NEW.id, NEW.user_id, COALESCE(auth.uid(), NEW.computed_by), 'status_changed',
      OLD.status, NEW.status,
      jsonb_build_object('commission_amount', NEW.commission_amount, 'currency', NEW.currency),
      NEW.notes
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS commissions_history ON public.commissions;
CREATE TRIGGER commissions_history
AFTER INSERT OR UPDATE OF status ON public.commissions
FOR EACH ROW EXECUTE FUNCTION public.tg_commission_history();

-- 2) Devengo de un servicio de reserva
CREATE OR REPLACE FUNCTION public.accrue_commission(_booking_service_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  s RECORD; b RECORD; e RECORD; ra RECORD; cc RECORD;
  v_gross numeric; v_taxes numeric; v_extras numeric; v_discount numeric; v_cost numeric;
  v_sale_currency text;
  v_existing public.commissions;
  v_new public.commissions;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Sesión no válida'; END IF;
  IF NOT public.has_role(v_uid, 'admin') THEN
    RAISE EXCEPTION 'Solo un administrador puede devengar comisiones.';
  END IF;

  SELECT * INTO s FROM public.booking_services WHERE id = _booking_service_id;
  IF s.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'service_not_found');
  END IF;
  IF s.record_status <> 'active' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'service_not_active', 'booking_service_id', s.id);
  END IF;

  SELECT * INTO b FROM public.bookings WHERE id = s.booking_id;
  IF b.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'booking_not_found');
  END IF;
  IF b.status NOT IN ('confirmed', 'reserved', 'voucher_issued', 'in_progress', 'completed') THEN
    RETURN jsonb_build_object(
      'ok', false, 'reason', 'booking_not_confirmed',
      'booking_id', b.id, 'booking_status', b.status
    );
  END IF;

  SELECT * INTO e FROM public.booking_service_economics WHERE booking_service_id = s.id;

  v_gross := COALESCE(e.gross_sale_amount, s.sale_amount);
  v_taxes := COALESCE(e.taxes_amount, b.taxes_amount, 0);
  v_extras := COALESCE(e.extras_amount, b.extras_amount, 0);
  v_discount := COALESCE(e.discount_amount, 0);
  v_cost := COALESCE(e.cost_amount, s.cost_amount);
  v_sale_currency := COALESCE(e.sale_currency, s.sale_currency, b.currency, 'ARS');

  SELECT * INTO ra FROM public.resolve_agreement(
    s.user_id,
    COALESCE(s.organization_id, b.organization_id),
    b.assigned_agent_id,
    'booking_service'::public.agreement_scope,
    s.kind,
    NULL,
    b.destination, NULL, NULL,
    COALESCE(s.service_date, b.travel_start, CURRENT_DATE)
  );

  IF ra.agreement_id IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false, 'reason', 'no_agreement',
      'booking_service_id', s.id, 'booking_id', b.id
    );
  END IF;

  -- idempotencia: comisión efectiva ya existente para esta combinación
  SELECT * INTO v_existing
  FROM public.commissions
  WHERE entity = 'booking_service'
    AND entity_id = s.id
    AND agreement_id = ra.agreement_id
    AND COALESCE(rule_id, '00000000-0000-0000-0000-000000000000'::uuid)
        = COALESCE(ra.rule_id, '00000000-0000-0000-0000-000000000000'::uuid)
    AND status NOT IN ('cancelled', 'simulated')
  LIMIT 1;

  IF v_existing.id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'ok', true, 'created', false, 'reason', 'already_accrued',
      'commission_id', v_existing.id, 'status', v_existing.status,
      'commission_amount', v_existing.commission_amount, 'currency', v_existing.currency,
      'booking_service_id', s.id, 'booking_id', b.id
    );
  END IF;

  SELECT * INTO cc FROM public.compute_commission(
    v_gross, v_taxes, v_extras, v_discount, v_cost,
    ra.base, ra.calc_type, ra.calc_value, ra.min_amount, ra.max_amount,
    ra.excludes_taxes, ra.excludes_extras
  );

  BEGIN
    INSERT INTO public.commissions (
      user_id, status, party_type, organization_id, agent_id,
      entity, entity_id, booking_id, booking_service_id, quotation_id,
      agreement_id, agreement_version, rule_id, agreement_snapshot, rule_snapshot,
      base, calc_type, calc_value, base_amount, commission_amount, currency,
      exchange_rate, exchange_rate_date, exchange_rate_source,
      computed_at, computed_by, warnings
    ) VALUES (
      s.user_id, 'accrued',
      (ra.agreement_snapshot ->> 'party_type')::public.agreement_party,
      COALESCE(s.organization_id, b.organization_id),
      b.assigned_agent_id,
      'booking_service', s.id, b.id, s.id, b.quotation_id,
      ra.agreement_id, ra.agreement_version, ra.rule_id, ra.agreement_snapshot, ra.rule_snapshot,
      ra.base, ra.calc_type, ra.calc_value, cc.base_amount, cc.commission_amount,
      COALESCE(ra.currency, v_sale_currency),
      e.exchange_rate, e.exchange_rate_date,
      COALESCE(e.exchange_rate_source, 'manual'::public.rate_source),
      now(), v_uid, COALESCE(cc.warnings, '[]'::jsonb)
    )
    RETURNING * INTO v_new;
  EXCEPTION WHEN unique_violation THEN
    SELECT * INTO v_existing
    FROM public.commissions
    WHERE entity = 'booking_service'
      AND entity_id = s.id
      AND agreement_id = ra.agreement_id
      AND COALESCE(rule_id, '00000000-0000-0000-0000-000000000000'::uuid)
          = COALESCE(ra.rule_id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND status NOT IN ('cancelled', 'simulated')
    LIMIT 1;
    RETURN jsonb_build_object(
      'ok', true, 'created', false, 'reason', 'already_accrued',
      'commission_id', v_existing.id, 'status', v_existing.status,
      'commission_amount', v_existing.commission_amount, 'currency', v_existing.currency,
      'booking_service_id', s.id, 'booking_id', b.id
    );
  END;

  RETURN jsonb_build_object(
    'ok', true, 'created', true,
    'commission_id', v_new.id, 'status', v_new.status,
    'booking_service_id', s.id, 'booking_id', b.id,
    'agreement_id', v_new.agreement_id, 'rule_id', v_new.rule_id,
    'base', v_new.base, 'calc_type', v_new.calc_type, 'calc_value', v_new.calc_value,
    'base_amount', v_new.base_amount, 'commission_amount', v_new.commission_amount,
    'currency', v_new.currency, 'exchange_rate', v_new.exchange_rate,
    'exchange_rate_date', v_new.exchange_rate_date,
    'exchange_rate_source', v_new.exchange_rate_source,
    'warnings', v_new.warnings
  );
END;
$$;

-- 3) Devengo de todos los servicios elegibles de una reserva
CREATE OR REPLACE FUNCTION public.accrue_booking_commissions(_booking_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  b RECORD; r RECORD; res jsonb;
  v_processed int := 0; v_created int := 0; v_existing int := 0;
  v_no_agreement int := 0; v_skipped int := 0;
  v_items jsonb := '[]'::jsonb;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Sesión no válida'; END IF;
  IF NOT public.has_role(v_uid, 'admin') THEN
    RAISE EXCEPTION 'Solo un administrador puede devengar comisiones.';
  END IF;

  SELECT * INTO b FROM public.bookings WHERE id = _booking_id;
  IF b.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'booking_not_found');
  END IF;
  IF b.status NOT IN ('confirmed', 'reserved', 'voucher_issued', 'in_progress', 'completed') THEN
    RETURN jsonb_build_object(
      'ok', false, 'reason', 'booking_not_confirmed',
      'booking_id', b.id, 'booking_status', b.status
    );
  END IF;

  FOR r IN
    SELECT id FROM public.booking_services
    WHERE booking_id = _booking_id AND record_status = 'active'
    ORDER BY created_at
  LOOP
    res := public.accrue_commission(r.id);
    v_processed := v_processed + 1;
    IF (res ->> 'ok')::boolean IS TRUE AND (res ->> 'created')::boolean IS TRUE THEN
      v_created := v_created + 1;
    ELSIF (res ->> 'reason') = 'already_accrued' THEN
      v_existing := v_existing + 1;
    ELSIF (res ->> 'reason') = 'no_agreement' THEN
      v_no_agreement := v_no_agreement + 1;
    ELSE
      v_skipped := v_skipped + 1;
    END IF;
    v_items := v_items || jsonb_build_array(res);
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true, 'booking_id', b.id,
    'processed', v_processed, 'created', v_created,
    'already_accrued', v_existing, 'without_agreement', v_no_agreement,
    'skipped', v_skipped, 'items', v_items
  );
END;
$$;

-- 4) Transiciones controladas de estado (historial vía trigger)
CREATE OR REPLACE FUNCTION public.set_commission_status(
  _commission_id uuid,
  _to public.commission_status,
  _comment text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  c public.commissions;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Sesión no válida'; END IF;
  IF NOT public.has_role(v_uid, 'admin') THEN
    RAISE EXCEPTION 'Solo un administrador puede cambiar el estado de una comisión.';
  END IF;

  SELECT * INTO c FROM public.commissions WHERE id = _commission_id;
  IF c.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'commission_not_found');
  END IF;

  IF _to = 'settled' THEN
    RAISE EXCEPTION 'La liquidación de comisiones no está habilitada todavía.';
  END IF;
  IF c.status = 'settled' THEN
    RAISE EXCEPTION 'Una comisión liquidada no puede modificarse.';
  END IF;
  IF c.status = _to THEN
    RETURN jsonb_build_object('ok', true, 'changed', false, 'commission_id', c.id, 'status', c.status);
  END IF;

  IF NOT (
    (c.status = 'accrued' AND _to IN ('approved', 'cancelled'))
    OR (c.status = 'approved' AND _to = 'cancelled')
    OR (c.status = 'simulated' AND _to = 'cancelled')
  ) THEN
    RAISE EXCEPTION 'Transición de comisión no permitida: % → %', c.status, _to;
  END IF;

  UPDATE public.commissions
  SET status = _to,
      notes = COALESCE(_comment, notes)
  WHERE id = _commission_id;

  RETURN jsonb_build_object('ok', true, 'changed', true, 'commission_id', c.id,
                            'from_status', c.status, 'status', _to);
END;
$$;

REVOKE ALL ON FUNCTION public.accrue_commission(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.accrue_booking_commissions(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_commission_status(uuid, public.commission_status, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accrue_commission(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accrue_booking_commissions(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_commission_status(uuid, public.commission_status, text) TO authenticated;