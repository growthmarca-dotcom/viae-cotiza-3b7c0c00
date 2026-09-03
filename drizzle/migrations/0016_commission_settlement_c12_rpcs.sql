CREATE OR REPLACE FUNCTION public.tg_settlement_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  locked public.settlement_status[] := ARRAY['approved','invoice_pending','invoice_review','ready_for_payment','settled']::public.settlement_status[];
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status = ANY (locked) THEN
      RAISE EXCEPTION 'Una liquidación aprobada no se elimina.';
    END IF;
    RETURN OLD;
  END IF;

  IF OLD.status = ANY (locked) THEN
    IF ROW(NEW.beneficiary_type, NEW.beneficiary_id, NEW.organization_id, NEW.currency,
           NEW.period_start, NEW.period_end, NEW.total_commission_amount, NEW.commission_count)
       IS DISTINCT FROM
       ROW(OLD.beneficiary_type, OLD.beneficiary_id, OLD.organization_id, OLD.currency,
           OLD.period_start, OLD.period_end, OLD.total_commission_amount, OLD.commission_count)
    THEN
      RAISE EXCEPTION 'No se puede modificar la economía de una liquidación aprobada.';
    END IF;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.tg_settlement_item_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  st public.settlement_status;
  locked public.settlement_status[] := ARRAY['approved','invoice_pending','invoice_review','ready_for_payment','settled']::public.settlement_status[];
BEGIN
  SELECT status INTO st FROM public.commission_settlements
   WHERE id = COALESCE(NEW.settlement_id, OLD.settlement_id);

  IF st = ANY (locked) THEN
    RAISE EXCEPTION 'El detalle de una liquidación aprobada no se modifica.';
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_settlement_status(
  _settlement_id uuid,
  _to public.settlement_status,
  _comment text DEFAULT NULL
) RETURNS jsonb
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

  IF _to = 'settled' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'settlement_requires_payment');
  END IF;
  IF _to IN ('invoice_review', 'ready_for_payment') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'status_driven_by_invoice');
  END IF;

  IF NOT (
    (cur = 'draft' AND _to = 'pending_review')
    OR (cur = 'pending_review' AND _to IN ('approved', 'draft'))
    OR (cur = 'approved' AND _to IN ('pending_review', 'invoice_pending'))
    OR (cur = 'invoice_pending' AND _to = 'approved')
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
  _document_type text DEFAULT 'invoice'
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  s public.commission_settlements;
  doc_id uuid;
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

  IF COALESCE(_document_type, 'invoice') NOT IN ('invoice', 'other') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_document_type');
  END IF;

  IF s.status NOT IN ('approved', 'invoice_pending', 'invoice_review') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'settlement_not_open_for_invoice', 'status', s.status);
  END IF;

  IF COALESCE(_document_type, 'invoice') = 'invoice' THEN
    IF EXISTS (
      SELECT 1 FROM public.commission_settlement_documents d
       WHERE d.settlement_id = _settlement_id
         AND d.document_type = 'invoice'
         AND d.status IN ('pending_review', 'approved')
    ) THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'invoice_already_present');
    END IF;

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
     invoice_number, invoice_date, invoice_kind, amount, currency, notes, uploaded_by)
  VALUES (_settlement_id, COALESCE(_document_type, 'invoice'), 'pending_review',
          btrim(_file_path), _file_name, _mime_type, _file_size,
          NULLIF(btrim(COALESCE(_invoice_number, '')), ''), _invoice_date,
          NULLIF(btrim(COALESCE(_invoice_kind, '')), ''), _amount,
          CASE WHEN _currency IS NULL THEN NULL ELSE upper(btrim(_currency)) END,
          NULLIF(btrim(COALESCE(_notes, '')), ''), uid)
  RETURNING id INTO doc_id;

  next_status := s.status;
  IF COALESCE(_document_type, 'invoice') = 'invoice'
     AND s.status IN ('approved', 'invoice_pending') THEN
    next_status := 'invoice_review';
    UPDATE public.commission_settlements SET status = next_status WHERE id = _settlement_id;
  END IF;

  INSERT INTO public.commission_settlement_history
    (settlement_id, actor_id, action, from_status, to_status, comment)
  VALUES (_settlement_id, uid, 'invoice_submitted', s.status, next_status,
          NULLIF(btrim(COALESCE(_invoice_number, '')), ''));

  RETURN jsonb_build_object('ok', true, 'document_id', doc_id, 'status', next_status);
END;
$$;

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
          CASE WHEN _approve THEN 'invoice_approved' ELSE 'invoice_rejected' END,
          s.status, next_status, NULLIF(btrim(COALESCE(_reason, '')), ''));

  RETURN jsonb_build_object('ok', true,
    'document_status', CASE WHEN _approve THEN 'approved' ELSE 'rejected' END,
    'status', next_status);
END;
$$;

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

  IF _amount IS NULL OR round(_amount, 2) <> round(s.total_commission_amount, 2) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'amount_mismatch', 'expected', s.total_commission_amount);
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