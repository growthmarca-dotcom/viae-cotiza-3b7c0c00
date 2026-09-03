-- ============================================================
-- ViaE Core — Fase C1.3: RPC de conciliación, ajustes y saldos.
-- Todas SECURITY DEFINER, sin tocar el motor de cálculo de comisiones.
-- ============================================================

-- Importe realmente pagable de una liquidación:
--   total original + débitos aprobados - créditos aprobados
--   + saldos débito aplicados - saldos crédito aplicados
CREATE OR REPLACE FUNCTION public.settlement_payable_amount(_settlement_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT GREATEST(
    round(
      COALESCE(s.total_commission_amount, 0)
      + COALESCE((
          SELECT SUM(CASE WHEN a.adjustment_type = 'debit' THEN a.amount ELSE -a.amount END)
            FROM public.commission_adjustments a
           WHERE a.settlement_id = s.id
             AND a.status = 'approved'
             AND a.affects_payment = true
        ), 0)
      + COALESCE((
          SELECT SUM(CASE WHEN a.adjustment_type = 'debit' THEN ap.amount_applied ELSE -ap.amount_applied END)
            FROM public.commission_adjustment_applications ap
            JOIN public.commission_adjustments a ON a.id = ap.adjustment_id
           WHERE ap.settlement_id = s.id
        ), 0)
    , 2), 0)
  FROM public.commission_settlements s
 WHERE s.id = _settlement_id
$$;

REVOKE ALL ON FUNCTION public.settlement_payable_amount(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.settlement_payable_amount(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.settlement_payable_amount(uuid) TO authenticated;

-- ------------------------------------------------------------
-- Conciliación interna del pago.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reconcile_settlement_payment(
  _settlement_id uuid,
  _status text,
  _notes text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  s public.commission_settlements;
  p public.commission_settlement_payments;
  issues text[] := ARRAY[]::text[];
  payable numeric;
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;
  IF NOT public.has_role(uid, 'admin') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;
  IF COALESCE(_status, '') NOT IN ('pending', 'reconciled', 'discrepancy') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_reconciliation_status');
  END IF;

  SELECT * INTO s FROM public.commission_settlements WHERE id = _settlement_id;
  IF s.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  SELECT * INTO p FROM public.commission_settlement_payments
   WHERE settlement_id = _settlement_id FOR UPDATE;
  IF p.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'payment_not_found');
  END IF;

  IF _status = 'discrepancy' AND btrim(COALESCE(_notes, '')) = '' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'reason_required');
  END IF;

  -- Coherencia interna: liquidación → factura aprobada → pago.
  payable := public.settlement_payable_amount(_settlement_id);
  IF upper(btrim(p.currency)) <> upper(btrim(s.currency)) THEN
    issues := issues || 'currency_mismatch';
  END IF;
  IF round(p.amount, 2) <> round(payable, 2) THEN
    issues := issues || 'amount_mismatch';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.commission_settlement_documents d
     WHERE d.settlement_id = _settlement_id
       AND d.document_type = 'invoice'
       AND d.status = 'approved'
  ) THEN
    issues := issues || 'approved_invoice_missing';
  END IF;
  IF s.status <> 'settled' THEN
    issues := issues || 'settlement_not_settled';
  END IF;

  IF _status = 'reconciled' AND array_length(issues, 1) > 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'coherence_failed', 'issues', to_jsonb(issues));
  END IF;

  -- Idempotente: repetir el mismo estado no genera un evento nuevo.
  IF p.reconciliation_status = _status THEN
    RETURN jsonb_build_object('ok', true, 'changed', false,
      'reconciliation_status', _status, 'issues', to_jsonb(issues));
  END IF;

  UPDATE public.commission_settlement_payments
     SET reconciliation_status = _status,
         reconciliation_notes = NULLIF(btrim(COALESCE(_notes, '')), ''),
         reconciled_at = CASE WHEN _status = 'pending' THEN NULL ELSE now() END,
         reconciled_by = CASE WHEN _status = 'pending' THEN NULL ELSE uid END
   WHERE id = p.id;

  INSERT INTO public.commission_adjustment_history
    (settlement_id, actor_id, action, from_status, to_status, amount, currency, comment)
  VALUES (_settlement_id, uid,
          CASE WHEN _status = 'discrepancy' THEN 'discrepancy_detected' ELSE 'reconciliation_updated' END,
          p.reconciliation_status, _status, p.amount, p.currency,
          NULLIF(btrim(COALESCE(_notes, '')), ''));

  RETURN jsonb_build_object('ok', true, 'changed', true,
    'reconciliation_status', _status, 'issues', to_jsonb(issues));
END;
$$;

REVOKE ALL ON FUNCTION public.reconcile_settlement_payment(uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reconcile_settlement_payment(uuid, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.reconcile_settlement_payment(uuid, text, text) TO authenticated;

-- ------------------------------------------------------------
-- Creación de ajustes (crédito / débito).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_commission_adjustment(
  _adjustment_type text,
  _amount numeric,
  _reason text,
  _settlement_id uuid DEFAULT NULL,
  _commission_id uuid DEFAULT NULL,
  _currency text DEFAULT NULL,
  _notes text DEFAULT NULL,
  _source_type text DEFAULT NULL,
  _source_id uuid DEFAULT NULL,
  _idempotency_key text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  s public.commission_settlements;
  c public.commissions;
  b_type public.agreement_party;
  b_id uuid;
  org_id uuid;
  cur text;
  affects boolean;
  paid boolean := false;
  payable numeric;
  existing public.commission_adjustments;
  new_id uuid;
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;
  IF NOT public.has_role(uid, 'admin') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  IF COALESCE(_adjustment_type, '') NOT IN ('credit', 'debit') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_adjustment_type');
  END IF;
  IF _amount IS NULL OR round(_amount, 2) <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_amount');
  END IF;
  IF COALESCE(_reason, '') NOT IN ('commission_calculation_error', 'cancellation', 'refund',
      'duplicate_commission', 'rounding_difference', 'administrative_correction', 'other') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_reason');
  END IF;
  IF _reason = 'other' AND btrim(COALESCE(_notes, '')) = '' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'notes_required');
  END IF;
  IF _settlement_id IS NULL AND _commission_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'link_required');
  END IF;

  -- Idempotencia explícita: la misma clave devuelve el ajuste ya creado.
  IF _idempotency_key IS NOT NULL AND btrim(_idempotency_key) <> '' THEN
    SELECT * INTO existing FROM public.commission_adjustments
     WHERE idempotency_key = btrim(_idempotency_key);
    IF existing.id IS NOT NULL THEN
      RETURN jsonb_build_object('ok', true, 'created', false,
        'adjustment_id', existing.id, 'status', existing.status);
    END IF;
  END IF;

  IF _settlement_id IS NOT NULL THEN
    SELECT * INTO s FROM public.commission_settlements WHERE id = _settlement_id FOR UPDATE;
    IF s.id IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
    END IF;
    b_type := s.beneficiary_type;
    b_id := s.beneficiary_id;
    org_id := s.organization_id;
    cur := upper(btrim(s.currency));
    paid := EXISTS (SELECT 1 FROM public.commission_settlement_payments p
                     WHERE p.settlement_id = s.id);
  ELSE
    SELECT * INTO c FROM public.commissions WHERE id = _commission_id;
    IF c.id IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'commission_not_found');
    END IF;
    IF c.party_type = 'organization' AND c.organization_id IS NOT NULL THEN
      b_type := 'organization'; b_id := c.organization_id;
    ELSIF c.party_type = 'agent' AND c.agent_id IS NOT NULL THEN
      b_type := 'agent'; b_id := c.agent_id;
    ELSE
      RETURN jsonb_build_object('ok', false, 'reason', 'invalid_beneficiary');
    END IF;
    org_id := c.organization_id;
    cur := upper(btrim(COALESCE(c.currency, '')));
  END IF;

  IF _currency IS NOT NULL AND btrim(_currency) <> ''
     AND upper(btrim(_currency)) <> cur THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'currency_mismatch', 'expected', cur);
  END IF;
  IF cur NOT IN ('ARS', 'USD') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'currency_required');
  END IF;
  IF b_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'beneficiary_required');
  END IF;

  -- Antes del pago el ajuste cambia el importe a pagar; después del pago genera
  -- saldo para una liquidación futura. Nunca se edita lo histórico.
  affects := (_settlement_id IS NOT NULL AND NOT paid AND s.status <> 'settled');

  IF affects AND _adjustment_type = 'credit' THEN
    payable := public.settlement_payable_amount(_settlement_id);
    IF round(_amount, 2) > round(payable, 2) THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'credit_exceeds_payable', 'payable', payable);
    END IF;
  END IF;

  INSERT INTO public.commission_adjustments
    (organization_id, settlement_id, commission_id, beneficiary_type, beneficiary_id,
     currency, adjustment_type, amount, reason, notes, source_type, source_id,
     status, affects_payment, idempotency_key, created_by)
  VALUES (org_id, _settlement_id, _commission_id, b_type, b_id, cur, _adjustment_type,
          round(_amount, 2), _reason, NULLIF(btrim(COALESCE(_notes, '')), ''),
          NULLIF(btrim(COALESCE(_source_type, '')), ''), _source_id,
          'pending_approval', affects,
          NULLIF(btrim(COALESCE(_idempotency_key, '')), ''), uid)
  RETURNING id INTO new_id;

  INSERT INTO public.commission_adjustment_history
    (adjustment_id, settlement_id, actor_id, action, to_status, amount, currency, comment)
  VALUES (new_id, _settlement_id, uid, 'adjustment_created', 'pending_approval',
          round(_amount, 2), cur, NULLIF(btrim(COALESCE(_notes, '')), ''));

  RETURN jsonb_build_object('ok', true, 'created', true, 'adjustment_id', new_id,
    'status', 'pending_approval', 'affects_payment', affects, 'currency', cur);
END;
$$;

REVOKE ALL ON FUNCTION public.create_commission_adjustment(text, numeric, text, uuid, uuid, text, text, text, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_commission_adjustment(text, numeric, text, uuid, uuid, text, text, text, uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_commission_adjustment(text, numeric, text, uuid, uuid, text, text, text, uuid, text) TO authenticated;

-- ------------------------------------------------------------
-- Aprobación / rechazo de ajustes.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.review_commission_adjustment(
  _adjustment_id uuid,
  _approve boolean,
  _reason text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  a public.commission_adjustments;
  payable numeric;
  new_status text;
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;
  IF NOT public.has_role(uid, 'admin') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  SELECT * INTO a FROM public.commission_adjustments WHERE id = _adjustment_id FOR UPDATE;
  IF a.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF a.status <> 'pending_approval' THEN
    RETURN jsonb_build_object('ok', true, 'changed', false, 'status', a.status);
  END IF;
  IF NOT _approve AND btrim(COALESCE(_reason, '')) = '' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'reason_required');
  END IF;

  IF _approve AND a.affects_payment AND a.adjustment_type = 'credit' THEN
    payable := public.settlement_payable_amount(a.settlement_id);
    IF round(a.amount, 2) > round(payable, 2) THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'credit_exceeds_payable', 'payable', payable);
    END IF;
  END IF;

  new_status := CASE WHEN _approve THEN 'approved' ELSE 'rejected' END;

  UPDATE public.commission_adjustments
     SET status = new_status,
         approved_by = CASE WHEN _approve THEN uid ELSE approved_by END,
         approved_at = CASE WHEN _approve THEN now() ELSE approved_at END,
         rejection_reason = CASE WHEN _approve THEN NULL ELSE btrim(_reason) END
   WHERE id = _adjustment_id;

  INSERT INTO public.commission_adjustment_history
    (adjustment_id, settlement_id, actor_id, action, from_status, to_status, amount, currency, comment)
  VALUES (_adjustment_id, a.settlement_id, uid,
          CASE WHEN _approve THEN 'adjustment_approved' ELSE 'adjustment_rejected' END,
          a.status, new_status, a.amount, a.currency,
          NULLIF(btrim(COALESCE(_reason, '')), ''));

  IF _approve AND NOT a.affects_payment THEN
    INSERT INTO public.commission_adjustment_history
      (adjustment_id, settlement_id, actor_id, action, to_status, amount, currency, comment)
    VALUES (_adjustment_id, a.settlement_id, uid, 'balance_created', 'approved',
            a.amount, a.currency,
            CASE WHEN a.adjustment_type = 'debit'
                 THEN 'Saldo a favor del beneficiario.'
                 ELSE 'Saldo a favor de ViaE.' END);
  END IF;

  RETURN jsonb_build_object('ok', true, 'changed', true, 'status', new_status,
    'creates_balance', (_approve AND NOT a.affects_payment));
END;
$$;

REVOKE ALL ON FUNCTION public.review_commission_adjustment(uuid, boolean, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.review_commission_adjustment(uuid, boolean, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.review_commission_adjustment(uuid, boolean, text) TO authenticated;

-- ------------------------------------------------------------
-- Aplicación de saldo a una liquidación futura.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.apply_commission_adjustment_balance(
  _adjustment_id uuid,
  _settlement_id uuid,
  _amount numeric
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  a public.commission_adjustments;
  s public.commission_settlements;
  remaining numeric;
  payable numeric;
  app_id uuid;
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;
  IF NOT public.has_role(uid, 'admin') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  SELECT * INTO a FROM public.commission_adjustments WHERE id = _adjustment_id FOR UPDATE;
  IF a.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF a.status <> 'approved' OR a.affects_payment THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'adjustment_not_applicable');
  END IF;

  SELECT * INTO s FROM public.commission_settlements WHERE id = _settlement_id FOR UPDATE;
  IF s.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'settlement_not_found');
  END IF;

  -- Nunca se compensa entre monedas ni entre beneficiarios distintos.
  IF upper(btrim(a.currency)) <> upper(btrim(s.currency)) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'currency_mismatch',
      'settlement_currency', s.currency, 'balance_currency', a.currency);
  END IF;
  IF a.beneficiary_type <> s.beneficiary_type OR a.beneficiary_id <> s.beneficiary_id THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'beneficiary_mismatch');
  END IF;
  IF s.status = 'settled'
     OR EXISTS (SELECT 1 FROM public.commission_settlement_payments p WHERE p.settlement_id = s.id) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'settlement_already_paid');
  END IF;
  IF a.settlement_id = s.id THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'same_settlement');
  END IF;

  -- Idempotencia: el mismo saldo no se aplica dos veces a la misma liquidación.
  SELECT id INTO app_id FROM public.commission_adjustment_applications
   WHERE adjustment_id = _adjustment_id AND settlement_id = _settlement_id;
  IF app_id IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'changed', false, 'application_id', app_id);
  END IF;

  IF _amount IS NULL OR round(_amount, 2) <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_amount');
  END IF;

  SELECT remaining_amount INTO remaining
    FROM public.commission_adjustment_balances WHERE adjustment_id = _adjustment_id;
  IF remaining IS NULL OR round(_amount, 2) > round(remaining, 2) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'exceeds_balance',
      'remaining', COALESCE(remaining, 0));
  END IF;

  IF a.adjustment_type = 'credit' THEN
    payable := public.settlement_payable_amount(_settlement_id);
    IF round(_amount, 2) > round(payable, 2) THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'exceeds_settlement', 'payable', payable);
    END IF;
  END IF;

  INSERT INTO public.commission_adjustment_applications
    (adjustment_id, settlement_id, amount_applied, currency, applied_by)
  VALUES (_adjustment_id, _settlement_id, round(_amount, 2), upper(btrim(a.currency)), uid)
  RETURNING id INTO app_id;

  INSERT INTO public.commission_adjustment_history
    (adjustment_id, settlement_id, actor_id, action, amount, currency, comment)
  VALUES (_adjustment_id, _settlement_id, uid, 'balance_applied',
          round(_amount, 2), upper(btrim(a.currency)),
          CASE WHEN a.adjustment_type = 'debit'
               THEN 'Saldo a favor del beneficiario aplicado.'
               ELSE 'Saldo a favor de ViaE aplicado.' END);

  RETURN jsonb_build_object('ok', true, 'changed', true, 'application_id', app_id,
    'payable', public.settlement_payable_amount(_settlement_id));
END;
$$;

REVOKE ALL ON FUNCTION public.apply_commission_adjustment_balance(uuid, uuid, numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.apply_commission_adjustment_balance(uuid, uuid, numeric) FROM anon;
GRANT EXECUTE ON FUNCTION public.apply_commission_adjustment_balance(uuid, uuid, numeric) TO authenticated;

-- ------------------------------------------------------------
-- El pago se registra por el importe FINAL aprobado (con ajustes y saldos).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_commission_settlement_payment(
  _settlement_id uuid,
  _amount numeric,
  _currency text,
  _payment_date date,
  _payment_method text DEFAULT 'bank_transfer',
  _payment_reference text DEFAULT NULL,
  _payment_proof_path text DEFAULT NULL,
  _notes text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  s public.commission_settlements;
  payment_id uuid;
  payable numeric;
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;
  IF NOT public.has_role(uid, 'admin') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  SELECT * INTO s FROM public.commission_settlements WHERE id = _settlement_id FOR UPDATE;
  IF s.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  IF EXISTS (SELECT 1 FROM public.commission_settlement_payments p WHERE p.settlement_id = _settlement_id) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'payment_already_recorded');
  END IF;

  IF s.status <> 'ready_for_payment' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'settlement_not_ready_for_payment', 'status', s.status);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.commission_settlement_documents d
     WHERE d.settlement_id = _settlement_id
       AND d.document_type = 'invoice'
       AND d.status = 'approved'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'approved_invoice_required');
  END IF;

  -- Un ajuste pendiente de aprobación bloquea el pago: el importe final todavía
  -- no está definido.
  IF EXISTS (
    SELECT 1 FROM public.commission_adjustments a
     WHERE a.settlement_id = _settlement_id AND a.status = 'pending_approval'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'adjustment_pending_approval');
  END IF;

  IF s.beneficiary_type = 'agent' THEN
    IF NOT EXISTS (SELECT 1 FROM public.agents a WHERE a.id = s.beneficiary_id AND a.settlement_authorized) THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'beneficiary_not_authorized');
    END IF;
  ELSIF s.beneficiary_type = 'organization' THEN
    IF NOT EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = s.beneficiary_id) THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'beneficiary_not_found');
    END IF;
  ELSE
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_beneficiary');
  END IF;

  IF _currency IS NULL OR upper(btrim(_currency)) <> upper(btrim(s.currency)) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'currency_mismatch', 'settlement_currency', s.currency);
  END IF;

  payable := public.settlement_payable_amount(_settlement_id);
  IF payable IS NULL OR round(payable, 2) <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'nothing_to_pay', 'expected', payable);
  END IF;
  IF _amount IS NULL OR round(_amount, 2) <> round(payable, 2) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'amount_mismatch', 'expected', payable);
  END IF;

  IF _payment_date IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'payment_date_required');
  END IF;
  IF COALESCE(_payment_method, '') NOT IN ('bank_transfer', 'cash', 'other') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_payment_method');
  END IF;

  INSERT INTO public.commission_settlement_payments
    (settlement_id, amount, currency, payment_date, payment_method,
     payment_reference, payment_proof_path, notes, recorded_by)
  VALUES (_settlement_id, round(_amount, 2), upper(btrim(_currency)), _payment_date,
          _payment_method, NULLIF(btrim(COALESCE(_payment_reference, '')), ''),
          NULLIF(btrim(COALESCE(_payment_proof_path, '')), ''),
          NULLIF(btrim(COALESCE(_notes, '')), ''), uid)
  RETURNING id INTO payment_id;

  UPDATE public.commission_settlements SET status = 'settled' WHERE id = _settlement_id;

  INSERT INTO public.commission_settlement_history
    (settlement_id, actor_id, action, from_status, to_status, comment)
  VALUES (_settlement_id, uid, 'payment_recorded', s.status, 'settled',
          NULLIF(btrim(COALESCE(_payment_reference, '')), ''));

  RETURN jsonb_build_object('ok', true, 'payment_id', payment_id, 'status', 'settled');
END;
$$;

-- ------------------------------------------------------------
-- Carga documental: se suman notas de crédito/débito, vinculadas al ajuste.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_settlement_invoice(
  _settlement_id uuid,
  _file_path text,
  _file_name text DEFAULT NULL,
  _mime_type text DEFAULT NULL,
  _file_size integer DEFAULT NULL,
  _invoice_number text DEFAULT NULL,
  _invoice_date date DEFAULT NULL,
  _amount numeric DEFAULT NULL,
  _currency text DEFAULT NULL,
  _invoice_kind text DEFAULT NULL,
  _notes text DEFAULT NULL,
  _document_type text DEFAULT 'invoice',
  _adjustment_id uuid DEFAULT NULL,
  _commission_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  s public.commission_settlements;
  a public.commission_adjustments;
  doc_id uuid;
  dtype text := COALESCE(_document_type, 'invoice');
  next_status public.settlement_status;
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;

  SELECT * INTO s FROM public.commission_settlements WHERE id = _settlement_id;
  IF s.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  IF NOT public.has_role(uid, 'admin')
     AND NOT public.is_settlement_beneficiary(uid, _settlement_id) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  IF dtype NOT IN ('invoice', 'credit_note', 'debit_note', 'other') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_document_type');
  END IF;

  IF dtype = 'invoice' AND s.status NOT IN ('approved', 'invoice_pending', 'invoice_review') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'settlement_not_open_for_invoice', 'status', s.status);
  END IF;

  IF dtype = 'invoice' THEN
    IF EXISTS (
      SELECT 1 FROM public.commission_settlement_documents d
       WHERE d.settlement_id = _settlement_id
         AND d.document_type = 'invoice'
         AND d.status IN ('pending_review', 'approved')
    ) THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'invoice_already_present');
    END IF;
  END IF;

  -- Una nota de crédito/débito siempre cuelga de un ajuste de la misma
  -- liquidación y de la misma moneda: nunca queda huérfana.
  IF dtype IN ('credit_note', 'debit_note') THEN
    IF _adjustment_id IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'adjustment_required');
    END IF;
    SELECT * INTO a FROM public.commission_adjustments WHERE id = _adjustment_id;
    IF a.id IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'adjustment_not_found');
    END IF;
    IF a.settlement_id IS DISTINCT FROM _settlement_id THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'adjustment_settlement_mismatch');
    END IF;
    IF (dtype = 'credit_note' AND a.adjustment_type <> 'credit')
       OR (dtype = 'debit_note' AND a.adjustment_type <> 'debit') THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'note_type_mismatch');
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.commission_settlement_documents d
       WHERE d.adjustment_id = _adjustment_id
         AND d.document_type = dtype
         AND d.status IN ('pending_review', 'approved')
    ) THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'note_already_present');
    END IF;
  END IF;

  IF dtype IN ('invoice', 'credit_note', 'debit_note') THEN
    IF _currency IS NULL OR btrim(_currency) = '' THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'currency_required');
    END IF;
    IF upper(btrim(_currency)) <> upper(btrim(s.currency)) THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'currency_mismatch', 'settlement_currency', s.currency);
    END IF;
    IF _amount IS NULL OR _amount <= 0 THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'invalid_amount');
    END IF;
  END IF;

  IF btrim(COALESCE(_file_path, '')) = '' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'file_required');
  END IF;
  IF _mime_type IS NOT NULL
     AND lower(_mime_type) NOT IN ('application/pdf', 'image/jpeg', 'image/jpg', 'image/png') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_mime_type');
  END IF;
  IF _file_size IS NOT NULL AND _file_size > 5 * 1024 * 1024 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'file_too_large');
  END IF;

  INSERT INTO public.commission_settlement_documents
    (settlement_id, document_type, status, file_path, file_name, mime_type, file_size,
     invoice_number, invoice_date, invoice_kind, amount, currency, notes, uploaded_by,
     adjustment_id, commission_id)
  VALUES (_settlement_id, dtype, 'pending_review',
          btrim(_file_path), _file_name, _mime_type, _file_size,
          NULLIF(btrim(COALESCE(_invoice_number, '')), ''), _invoice_date,
          NULLIF(btrim(COALESCE(_invoice_kind, '')), ''), _amount,
          CASE WHEN _currency IS NULL THEN NULL ELSE upper(btrim(_currency)) END,
          NULLIF(btrim(COALESCE(_notes, '')), ''), uid, _adjustment_id, _commission_id)
  RETURNING id INTO doc_id;

  next_status := s.status;
  IF dtype = 'invoice' AND s.status IN ('approved', 'invoice_pending') THEN
    next_status := 'invoice_review';
    UPDATE public.commission_settlements SET status = next_status WHERE id = _settlement_id;
  END IF;

  INSERT INTO public.commission_settlement_history
    (settlement_id, actor_id, action, from_status, to_status, comment)
  VALUES (_settlement_id, uid,
          CASE WHEN dtype = 'invoice' THEN 'invoice_submitted' ELSE 'note_submitted' END,
          s.status, next_status,
          NULLIF(btrim(COALESCE(_invoice_number, '')), ''));

  IF dtype IN ('credit_note', 'debit_note') THEN
    INSERT INTO public.commission_adjustment_history
      (adjustment_id, settlement_id, actor_id, action, amount, currency, comment)
    VALUES (_adjustment_id, _settlement_id, uid, 'note_submitted', _amount,
            upper(btrim(_currency)), NULLIF(btrim(COALESCE(_invoice_number, '')), ''));
  END IF;

  RETURN jsonb_build_object('ok', true, 'document_id', doc_id, 'status', next_status);
END;
$$;

DROP FUNCTION IF EXISTS public.submit_settlement_invoice(uuid, text, text, text, integer, text, date, numeric, text, text, text, text);

-- ------------------------------------------------------------
-- Revisión documental: contempla notas y deja rastro en el ajuste.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.review_settlement_document(
  _document_id uuid,
  _approve boolean,
  _reason text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  d public.commission_settlement_documents;
  s public.commission_settlements;
  next_status public.settlement_status;
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;
  IF NOT public.has_role(uid, 'admin') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  SELECT * INTO d FROM public.commission_settlement_documents WHERE id = _document_id;
  IF d.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF d.status <> 'pending_review' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'document_already_reviewed', 'status', d.status);
  END IF;
  IF NOT _approve AND btrim(COALESCE(_reason, '')) = '' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'reason_required');
  END IF;

  SELECT * INTO s FROM public.commission_settlements WHERE id = d.settlement_id;

  UPDATE public.commission_settlement_documents
     SET status = CASE WHEN _approve THEN 'approved' ELSE 'rejected' END,
         reviewed_by = uid,
         reviewed_at = now(),
         rejection_reason = CASE WHEN _approve THEN NULL ELSE NULLIF(btrim(COALESCE(_reason, '')), '') END
   WHERE id = _document_id;

  next_status := s.status;
  IF d.document_type = 'invoice' THEN
    IF _approve THEN
      IF s.status IN ('approved', 'invoice_pending', 'invoice_review') THEN
        next_status := 'ready_for_payment';
      END IF;
    ELSE
      IF s.status IN ('invoice_review', 'approved') THEN
        next_status := 'invoice_pending';
      END IF;
    END IF;
    IF next_status <> s.status THEN
      UPDATE public.commission_settlements SET status = next_status WHERE id = s.id;
    END IF;
  END IF;

  INSERT INTO public.commission_settlement_history
    (settlement_id, actor_id, action, from_status, to_status, comment)
  VALUES (s.id, uid,
          CASE
            WHEN d.document_type = 'invoice' AND _approve THEN 'invoice_approved'
            WHEN d.document_type = 'invoice' THEN 'invoice_rejected'
            WHEN _approve THEN 'note_approved'
            ELSE 'note_rejected'
          END,
          s.status, next_status, NULLIF(btrim(COALESCE(_reason, '')), ''));

  IF d.adjustment_id IS NOT NULL THEN
    INSERT INTO public.commission_adjustment_history
      (adjustment_id, settlement_id, actor_id, action, amount, currency, comment)
    VALUES (d.adjustment_id, s.id, uid,
            CASE WHEN _approve THEN 'note_approved' ELSE 'note_rejected' END,
            d.amount, d.currency, NULLIF(btrim(COALESCE(_reason, '')), ''));
  END IF;

  RETURN jsonb_build_object('ok', true,
    'document_status', CASE WHEN _approve THEN 'approved' ELSE 'rejected' END,
    'status', next_status);
END;
$$;