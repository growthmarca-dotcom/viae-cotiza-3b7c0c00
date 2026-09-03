-- ============================================================
-- ViaE Core — Fase C1.3
-- Conciliación interna, ajustes, saldos y notas de crédito/débito.
-- ============================================================

ALTER TABLE public.commission_settlement_payments
  ADD COLUMN IF NOT EXISTS reconciliation_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS reconciled_at timestamptz,
  ADD COLUMN IF NOT EXISTS reconciled_by uuid,
  ADD COLUMN IF NOT EXISTS reconciliation_notes text;

ALTER TABLE public.commission_settlement_payments
  DROP CONSTRAINT IF EXISTS settlement_payments_reconciliation_check;
ALTER TABLE public.commission_settlement_payments
  ADD CONSTRAINT settlement_payments_reconciliation_check
  CHECK (reconciliation_status IN ('pending', 'reconciled', 'discrepancy'));

CREATE OR REPLACE FUNCTION public.tg_settlement_payment_immutable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'El pago registrado de una liquidación es histórico: no se elimina.';
  END IF;

  IF ROW(NEW.settlement_id, NEW.amount, NEW.currency, NEW.payment_date, NEW.payment_method,
         NEW.payment_reference, NEW.payment_proof_path, NEW.recorded_by, NEW.recorded_at)
     IS DISTINCT FROM
     ROW(OLD.settlement_id, OLD.amount, OLD.currency, OLD.payment_date, OLD.payment_method,
         OLD.payment_reference, OLD.payment_proof_path, OLD.recorded_by, OLD.recorded_at)
  THEN
    RAISE EXCEPTION 'El pago registrado es histórico: sólo se puede conciliar, no modificar.';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public.commission_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  settlement_id uuid REFERENCES public.commission_settlements(id) ON DELETE RESTRICT,
  commission_id uuid REFERENCES public.commissions(id) ON DELETE RESTRICT,
  beneficiary_type public.agreement_party NOT NULL,
  beneficiary_id uuid NOT NULL,
  currency text NOT NULL,
  adjustment_type text NOT NULL,
  amount numeric(14,2) NOT NULL,
  reason text NOT NULL,
  notes text,
  source_type text,
  source_id uuid,
  status text NOT NULL DEFAULT 'pending_approval',
  affects_payment boolean NOT NULL DEFAULT true,
  rejection_reason text,
  idempotency_key text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  approved_by uuid,
  approved_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT commission_adjustments_type_check CHECK (adjustment_type IN ('credit', 'debit')),
  CONSTRAINT commission_adjustments_amount_check CHECK (amount > 0),
  CONSTRAINT commission_adjustments_currency_check CHECK (upper(btrim(currency)) IN ('ARS', 'USD')),
  CONSTRAINT commission_adjustments_status_check
    CHECK (status IN ('pending_approval', 'approved', 'rejected')),
  CONSTRAINT commission_adjustments_reason_check CHECK (reason IN (
    'commission_calculation_error', 'cancellation', 'refund', 'duplicate_commission',
    'rounding_difference', 'administrative_correction', 'other')),
  CONSTRAINT commission_adjustments_other_notes_check
    CHECK (reason <> 'other' OR char_length(btrim(COALESCE(notes, ''))) > 0),
  CONSTRAINT commission_adjustments_beneficiary_check
    CHECK (beneficiary_type IN ('organization', 'agent')),
  CONSTRAINT commission_adjustments_link_check
    CHECK (settlement_id IS NOT NULL OR commission_id IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS commission_adjustments_idempotency_uniq
  ON public.commission_adjustments (idempotency_key)
  WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS commission_adjustments_settlement_idx
  ON public.commission_adjustments (settlement_id);
CREATE INDEX IF NOT EXISTS commission_adjustments_balance_idx
  ON public.commission_adjustments (beneficiary_type, beneficiary_id, currency, status);

GRANT SELECT ON public.commission_adjustments TO authenticated;
GRANT ALL ON public.commission_adjustments TO service_role;
ALTER TABLE public.commission_adjustments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS adjustments_admin_all ON public.commission_adjustments;
CREATE POLICY adjustments_admin_all ON public.commission_adjustments
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS adjustments_operations_read ON public.commission_adjustments;
CREATE POLICY adjustments_operations_read ON public.commission_adjustments
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'operations'));

DROP POLICY IF EXISTS adjustments_beneficiary_read ON public.commission_adjustments;
CREATE POLICY adjustments_beneficiary_read ON public.commission_adjustments
  FOR SELECT TO authenticated
  USING (
    (settlement_id IS NOT NULL AND public.is_settlement_beneficiary(auth.uid(), settlement_id))
    OR (beneficiary_type = 'agent' AND EXISTS (
          SELECT 1 FROM public.agents a
           WHERE a.id = beneficiary_id AND a.user_id = auth.uid()))
    OR (beneficiary_type = 'organization' AND public.is_member_of(auth.uid(), beneficiary_id))
  );

CREATE OR REPLACE FUNCTION public.tg_commission_adjustment_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Un ajuste de comisiones no se elimina: es un movimiento contable.';
  END IF;

  IF OLD.status IN ('approved', 'rejected') THEN
    IF ROW(NEW.amount, NEW.currency, NEW.adjustment_type, NEW.beneficiary_type,
           NEW.beneficiary_id, NEW.settlement_id, NEW.commission_id, NEW.reason,
           NEW.affects_payment, NEW.status)
       IS DISTINCT FROM
       ROW(OLD.amount, OLD.currency, OLD.adjustment_type, OLD.beneficiary_type,
           OLD.beneficiary_id, OLD.settlement_id, OLD.commission_id, OLD.reason,
           OLD.affects_payment, OLD.status)
    THEN
      RAISE EXCEPTION 'Un ajuste ya resuelto no se modifica: registrá un ajuste nuevo.';
    END IF;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS commission_adjustments_guard ON public.commission_adjustments;
CREATE TRIGGER commission_adjustments_guard
  BEFORE UPDATE OR DELETE ON public.commission_adjustments
  FOR EACH ROW EXECUTE FUNCTION public.tg_commission_adjustment_guard();

CREATE TABLE IF NOT EXISTS public.commission_adjustment_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  adjustment_id uuid NOT NULL REFERENCES public.commission_adjustments(id) ON DELETE RESTRICT,
  settlement_id uuid NOT NULL REFERENCES public.commission_settlements(id) ON DELETE RESTRICT,
  amount_applied numeric(14,2) NOT NULL,
  currency text NOT NULL,
  applied_by uuid,
  applied_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT adjustment_applications_amount_check CHECK (amount_applied > 0),
  CONSTRAINT adjustment_applications_currency_check
    CHECK (upper(btrim(currency)) IN ('ARS', 'USD'))
);

CREATE UNIQUE INDEX IF NOT EXISTS adjustment_applications_pair_uniq
  ON public.commission_adjustment_applications (adjustment_id, settlement_id);
CREATE INDEX IF NOT EXISTS adjustment_applications_settlement_idx
  ON public.commission_adjustment_applications (settlement_id);

GRANT SELECT ON public.commission_adjustment_applications TO authenticated;
GRANT ALL ON public.commission_adjustment_applications TO service_role;
ALTER TABLE public.commission_adjustment_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS adjustment_applications_admin_all ON public.commission_adjustment_applications;
CREATE POLICY adjustment_applications_admin_all ON public.commission_adjustment_applications
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS adjustment_applications_operations_read ON public.commission_adjustment_applications;
CREATE POLICY adjustment_applications_operations_read ON public.commission_adjustment_applications
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'operations'));

DROP POLICY IF EXISTS adjustment_applications_beneficiary_read ON public.commission_adjustment_applications;
CREATE POLICY adjustment_applications_beneficiary_read ON public.commission_adjustment_applications
  FOR SELECT TO authenticated
  USING (public.is_settlement_beneficiary(auth.uid(), settlement_id));

CREATE OR REPLACE FUNCTION public.tg_adjustment_application_immutable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'La aplicación de un saldo es un movimiento histórico: no se modifica ni se elimina.';
END;
$$;

DROP TRIGGER IF EXISTS adjustment_applications_immutable ON public.commission_adjustment_applications;
CREATE TRIGGER adjustment_applications_immutable
  BEFORE UPDATE OR DELETE ON public.commission_adjustment_applications
  FOR EACH ROW EXECUTE FUNCTION public.tg_adjustment_application_immutable();

CREATE TABLE IF NOT EXISTS public.commission_adjustment_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  adjustment_id uuid REFERENCES public.commission_adjustments(id) ON DELETE CASCADE,
  settlement_id uuid REFERENCES public.commission_settlements(id) ON DELETE CASCADE,
  actor_id uuid,
  action text NOT NULL,
  from_status text,
  to_status text,
  amount numeric(14,2),
  currency text,
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT adjustment_history_link_check
    CHECK (adjustment_id IS NOT NULL OR settlement_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS adjustment_history_adjustment_idx
  ON public.commission_adjustment_history (adjustment_id, created_at DESC);
CREATE INDEX IF NOT EXISTS adjustment_history_settlement_idx
  ON public.commission_adjustment_history (settlement_id, created_at DESC);

GRANT SELECT ON public.commission_adjustment_history TO authenticated;
GRANT ALL ON public.commission_adjustment_history TO service_role;
ALTER TABLE public.commission_adjustment_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS adjustment_history_admin_read ON public.commission_adjustment_history;
CREATE POLICY adjustment_history_admin_read ON public.commission_adjustment_history
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'operations'));

DROP POLICY IF EXISTS adjustment_history_beneficiary_read ON public.commission_adjustment_history;
CREATE POLICY adjustment_history_beneficiary_read ON public.commission_adjustment_history
  FOR SELECT TO authenticated
  USING (settlement_id IS NOT NULL AND public.is_settlement_beneficiary(auth.uid(), settlement_id));

CREATE OR REPLACE FUNCTION public.tg_adjustment_history_append_only()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'El historial de ajustes es append-only.';
END;
$$;

DROP TRIGGER IF EXISTS commission_adjustment_history_append_only ON public.commission_adjustment_history;
CREATE TRIGGER commission_adjustment_history_append_only
  BEFORE UPDATE OR DELETE ON public.commission_adjustment_history
  FOR EACH ROW EXECUTE FUNCTION public.tg_adjustment_history_append_only();

ALTER TABLE public.commission_settlement_documents
  ADD COLUMN IF NOT EXISTS adjustment_id uuid REFERENCES public.commission_adjustments(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS commission_id uuid REFERENCES public.commissions(id) ON DELETE RESTRICT;

ALTER TABLE public.commission_settlement_documents
  DROP CONSTRAINT IF EXISTS settlement_documents_type_check;
ALTER TABLE public.commission_settlement_documents
  ADD CONSTRAINT settlement_documents_type_check
  CHECK (document_type IN ('invoice', 'credit_note', 'debit_note', 'other'));

ALTER TABLE public.commission_settlement_documents
  DROP CONSTRAINT IF EXISTS settlement_documents_note_link_check;
ALTER TABLE public.commission_settlement_documents
  ADD CONSTRAINT settlement_documents_note_link_check
  CHECK (document_type NOT IN ('credit_note', 'debit_note') OR adjustment_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS settlement_documents_adjustment_idx
  ON public.commission_settlement_documents (adjustment_id);

CREATE OR REPLACE VIEW public.commission_adjustment_balances
WITH (security_invoker = true) AS
  SELECT
    a.id AS adjustment_id,
    a.organization_id,
    a.beneficiary_type,
    a.beneficiary_id,
    a.currency,
    a.adjustment_type,
    a.amount,
    a.settlement_id AS origin_settlement_id,
    a.commission_id AS origin_commission_id,
    a.reason,
    a.created_at,
    COALESCE(ap.applied, 0)::numeric(14,2) AS amount_applied,
    (a.amount - COALESCE(ap.applied, 0))::numeric(14,2) AS remaining_amount
  FROM public.commission_adjustments a
  LEFT JOIN (
    SELECT adjustment_id, SUM(amount_applied) AS applied
      FROM public.commission_adjustment_applications
     GROUP BY adjustment_id
  ) ap ON ap.adjustment_id = a.id
 WHERE a.status = 'approved'
   AND a.affects_payment = false;

GRANT SELECT ON public.commission_adjustment_balances TO authenticated;
GRANT SELECT ON public.commission_adjustment_balances TO service_role;