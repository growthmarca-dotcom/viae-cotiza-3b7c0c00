ALTER TYPE public.settlement_status ADD VALUE IF NOT EXISTS 'invoice_pending' BEFORE 'settled';
ALTER TYPE public.settlement_status ADD VALUE IF NOT EXISTS 'invoice_review' BEFORE 'settled';
ALTER TYPE public.settlement_status ADD VALUE IF NOT EXISTS 'ready_for_payment' BEFORE 'settled';

CREATE OR REPLACE FUNCTION public.is_settlement_beneficiary(_user_id uuid, _settlement_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.commission_settlements s
     WHERE s.id = _settlement_id
       AND _user_id IS NOT NULL
       AND (
         (s.beneficiary_type = 'agent' AND EXISTS (
            SELECT 1 FROM public.agents a
             WHERE a.id = s.beneficiary_id AND a.user_id = _user_id))
         OR
         (s.beneficiary_type = 'organization'
            AND public.is_member_of(_user_id, s.beneficiary_id))
       )
  )
$$;

DROP POLICY IF EXISTS "settlements_beneficiary_read" ON public.commission_settlements;
CREATE POLICY "settlements_beneficiary_read" ON public.commission_settlements
  FOR SELECT TO authenticated
  USING (public.is_settlement_beneficiary(auth.uid(), id));

DROP POLICY IF EXISTS "settlement_items_beneficiary_read" ON public.commission_settlement_items;
CREATE POLICY "settlement_items_beneficiary_read" ON public.commission_settlement_items
  FOR SELECT TO authenticated
  USING (public.is_settlement_beneficiary(auth.uid(), settlement_id));

DROP POLICY IF EXISTS "settlement_history_beneficiary_read" ON public.commission_settlement_history;
CREATE POLICY "settlement_history_beneficiary_read" ON public.commission_settlement_history
  FOR SELECT TO authenticated
  USING (public.is_settlement_beneficiary(auth.uid(), settlement_id));

CREATE TABLE IF NOT EXISTS public.commission_settlement_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  settlement_id uuid NOT NULL REFERENCES public.commission_settlements(id) ON DELETE CASCADE,
  document_type text NOT NULL DEFAULT 'invoice',
  status text NOT NULL DEFAULT 'pending_review',
  file_path text NOT NULL,
  file_name text,
  mime_type text,
  file_size integer,
  invoice_number text,
  invoice_date date,
  invoice_kind text,
  amount numeric(14,2),
  currency text,
  notes text,
  rejection_reason text,
  uploaded_by uuid,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT settlement_documents_type_check CHECK (document_type IN ('invoice', 'other')),
  CONSTRAINT settlement_documents_status_check CHECK (status IN ('pending_review', 'approved', 'rejected')),
  CONSTRAINT settlement_documents_amount_check CHECK (amount IS NULL OR amount > 0),
  CONSTRAINT settlement_documents_path_check CHECK (char_length(btrim(file_path)) > 0)
);

CREATE INDEX IF NOT EXISTS settlement_documents_settlement_idx
  ON public.commission_settlement_documents (settlement_id, uploaded_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS settlement_documents_approved_invoice_uniq
  ON public.commission_settlement_documents (settlement_id)
  WHERE document_type = 'invoice' AND status = 'approved';

GRANT SELECT ON public.commission_settlement_documents TO authenticated;
GRANT ALL ON public.commission_settlement_documents TO service_role;
ALTER TABLE public.commission_settlement_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "settlement_documents_admin_all" ON public.commission_settlement_documents;
CREATE POLICY "settlement_documents_admin_all" ON public.commission_settlement_documents
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "settlement_documents_operations_read" ON public.commission_settlement_documents;
CREATE POLICY "settlement_documents_operations_read" ON public.commission_settlement_documents
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'operations'));

DROP POLICY IF EXISTS "settlement_documents_beneficiary_read" ON public.commission_settlement_documents;
CREATE POLICY "settlement_documents_beneficiary_read" ON public.commission_settlement_documents
  FOR SELECT TO authenticated
  USING (public.is_settlement_beneficiary(auth.uid(), settlement_id));

CREATE OR REPLACE FUNCTION public.tg_settlement_document_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'La documentación de una liquidación no se elimina.';
  END IF;

  IF OLD.status = 'approved' THEN
    IF ROW(NEW.file_path, NEW.amount, NEW.currency, NEW.invoice_number,
           NEW.invoice_date, NEW.document_type, NEW.status)
       IS DISTINCT FROM
       ROW(OLD.file_path, OLD.amount, OLD.currency, OLD.invoice_number,
           OLD.invoice_date, OLD.document_type, OLD.status)
    THEN
      RAISE EXCEPTION 'Una factura aprobada no se modifica: presentá una nueva.';
    END IF;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS commission_settlement_documents_guard ON public.commission_settlement_documents;
CREATE TRIGGER commission_settlement_documents_guard
  BEFORE UPDATE OR DELETE ON public.commission_settlement_documents
  FOR EACH ROW EXECUTE FUNCTION public.tg_settlement_document_guard();

CREATE TABLE IF NOT EXISTS public.commission_settlement_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  settlement_id uuid NOT NULL UNIQUE REFERENCES public.commission_settlements(id) ON DELETE RESTRICT,
  amount numeric(14,2) NOT NULL,
  currency text NOT NULL,
  payment_date date NOT NULL,
  payment_method text NOT NULL DEFAULT 'bank_transfer',
  payment_reference text,
  payment_proof_path text,
  notes text,
  recorded_by uuid,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT settlement_payments_amount_check CHECK (amount > 0),
  CONSTRAINT settlement_payments_currency_check CHECK (char_length(btrim(currency)) > 0),
  CONSTRAINT settlement_payments_method_check CHECK (payment_method IN ('bank_transfer', 'cash', 'other'))
);

GRANT SELECT ON public.commission_settlement_payments TO authenticated;
GRANT ALL ON public.commission_settlement_payments TO service_role;
ALTER TABLE public.commission_settlement_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "settlement_payments_admin_all" ON public.commission_settlement_payments;
CREATE POLICY "settlement_payments_admin_all" ON public.commission_settlement_payments
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "settlement_payments_operations_read" ON public.commission_settlement_payments;
CREATE POLICY "settlement_payments_operations_read" ON public.commission_settlement_payments
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'operations'));

DROP POLICY IF EXISTS "settlement_payments_beneficiary_read" ON public.commission_settlement_payments;
CREATE POLICY "settlement_payments_beneficiary_read" ON public.commission_settlement_payments
  FOR SELECT TO authenticated
  USING (public.is_settlement_beneficiary(auth.uid(), settlement_id));

CREATE OR REPLACE FUNCTION public.tg_settlement_payment_immutable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'El pago registrado de una liquidación es histórico: no se modifica ni se elimina.';
END;
$$;

DROP TRIGGER IF EXISTS commission_settlement_payments_immutable ON public.commission_settlement_payments;
CREATE TRIGGER commission_settlement_payments_immutable
  BEFORE UPDATE OR DELETE ON public.commission_settlement_payments
  FOR EACH ROW EXECUTE FUNCTION public.tg_settlement_payment_immutable();

REVOKE INSERT, UPDATE, DELETE ON public.commission_settlement_documents FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.commission_settlement_payments FROM authenticated;