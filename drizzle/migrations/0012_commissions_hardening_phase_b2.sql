-- Comisiones v1.9.4 Fase B2: hardening de inmutabilidad.
-- Una comisión persistida no se elimina nunca y, una vez devengada, su
-- información económica y de trazabilidad no puede modificarse directamente.
-- Los cambios de estado se realizan exclusivamente vía set_commission_status().

CREATE OR REPLACE FUNCTION public.tg_commission_immutable()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Las comisiones no se eliminan: usá set_commission_status(id, ''cancelled'') para invalidarlas.';
  END IF;

  IF OLD.status = 'settled' THEN
    RAISE EXCEPTION 'Una comisión liquidada no puede modificarse ni eliminarse.';
  END IF;

  -- Una vez devengada (o aprobada/cancelada), sólo pueden cambiar el estado,
  -- las notas y la marca de actualización.
  IF OLD.status IN ('accrued', 'approved', 'cancelled') THEN
    IF ROW(
      NEW.user_id, NEW.party_type, NEW.organization_id, NEW.agent_id,
      NEW.entity, NEW.entity_id, NEW.booking_id, NEW.booking_service_id,
      NEW.transport_service_id, NEW.quotation_id,
      NEW.agreement_id, NEW.agreement_version, NEW.rule_id,
      NEW.agreement_snapshot, NEW.rule_snapshot,
      NEW.base, NEW.calc_type, NEW.calc_value,
      NEW.base_amount, NEW.commission_amount, NEW.currency,
      NEW.exchange_rate, NEW.exchange_rate_date, NEW.exchange_rate_source,
      NEW.computed_at, NEW.computed_by, NEW.warnings, NEW.created_at
    ) IS DISTINCT FROM ROW(
      OLD.user_id, OLD.party_type, OLD.organization_id, OLD.agent_id,
      OLD.entity, OLD.entity_id, OLD.booking_id, OLD.booking_service_id,
      OLD.transport_service_id, OLD.quotation_id,
      OLD.agreement_id, OLD.agreement_version, OLD.rule_id,
      OLD.agreement_snapshot, OLD.rule_snapshot,
      OLD.base, OLD.calc_type, OLD.calc_value,
      OLD.base_amount, OLD.commission_amount, OLD.currency,
      OLD.exchange_rate, OLD.exchange_rate_date, OLD.exchange_rate_source,
      OLD.computed_at, OLD.computed_by, OLD.warnings, OLD.created_at
    ) THEN
      RAISE EXCEPTION 'Una comisión devengada no admite modificaciones económicas directas.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS commissions_immutable ON public.commissions;
CREATE TRIGGER commissions_immutable
BEFORE DELETE OR UPDATE ON public.commissions
FOR EACH ROW EXECUTE FUNCTION public.tg_commission_immutable();

-- El historial de comisiones es append-only: no se edita ni se elimina.
CREATE OR REPLACE FUNCTION public.tg_commission_history_append_only()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'El historial de comisiones es append-only.';
END;
$$;

DROP TRIGGER IF EXISTS commission_history_append_only ON public.commission_history;
CREATE TRIGGER commission_history_append_only
BEFORE UPDATE OR DELETE ON public.commission_history
FOR EACH ROW EXECUTE FUNCTION public.tg_commission_history_append_only();

-- Refuerzo a nivel de privilegios: nadie borra comisiones desde la Data API.
REVOKE DELETE ON public.commissions FROM authenticated;
REVOKE DELETE, UPDATE ON public.commission_history FROM authenticated;