-- 1. Estado de liquidación del proveedor
DO $$ BEGIN
  CREATE TYPE public.transport_settlement_status AS ENUM ('pending','in_review','settled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Economía del servicio de transporte
ALTER TABLE public.transport_services
  ADD COLUMN IF NOT EXISTS sale_amount numeric,
  ADD COLUMN IF NOT EXISTS sale_currency text NOT NULL DEFAULT 'ARS',
  ADD COLUMN IF NOT EXISTS sale_exchange_rate numeric,
  ADD COLUMN IF NOT EXISTS sale_rate_date date,
  ADD COLUMN IF NOT EXISTS cost_amount numeric,
  ADD COLUMN IF NOT EXISTS cost_currency text NOT NULL DEFAULT 'ARS',
  ADD COLUMN IF NOT EXISTS cost_exchange_rate numeric,
  ADD COLUMN IF NOT EXISTS cost_rate_date date,
  ADD COLUMN IF NOT EXISTS settlement_status public.transport_settlement_status NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS settlement_note text,
  ADD COLUMN IF NOT EXISTS settled_at timestamptz,
  ADD COLUMN IF NOT EXISTS settled_by uuid;

-- 3. Tipos de cambio operativos (histórico, carga manual)
CREATE TABLE IF NOT EXISTS public.exchange_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  base_currency text NOT NULL DEFAULT 'USD',
  quote_currency text NOT NULL DEFAULT 'ARS',
  rate numeric NOT NULL,
  effective_date date NOT NULL DEFAULT current_date,
  source text NOT NULL DEFAULT 'manual',
  note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.exchange_rates TO authenticated;
GRANT ALL ON public.exchange_rates TO service_role;

ALTER TABLE public.exchange_rates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "exchange_rates_select" ON public.exchange_rates;
CREATE POLICY "exchange_rates_select" ON public.exchange_rates
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "exchange_rates_insert" ON public.exchange_rates;
CREATE POLICY "exchange_rates_insert" ON public.exchange_rates
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "exchange_rates_update" ON public.exchange_rates;
CREATE POLICY "exchange_rates_update" ON public.exchange_rates
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS trg_exchange_rates_updated_at ON public.exchange_rates;
CREATE TRIGGER trg_exchange_rates_updated_at
  BEFORE UPDATE ON public.exchange_rates
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE INDEX IF NOT EXISTS exchange_rates_lookup_idx
  ON public.exchange_rates (user_id, base_currency, quote_currency, effective_date DESC);

-- 4. Auditoría económica del servicio de transporte
CREATE OR REPLACE FUNCTION public.tg_transport_economics_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_changes jsonb := '{}'::jsonb;
  k text;
  fields text[] := ARRAY['sale_amount','sale_currency','sale_exchange_rate','sale_rate_date',
                         'cost_amount','cost_currency','cost_exchange_rate','cost_rate_date',
                         'settlement_status','collection_status','collection_amount',
                         'collection_currency','payment_mode','collected_amount'];
  oldj jsonb := to_jsonb(OLD);
  newj jsonb := to_jsonb(NEW);
BEGIN
  FOREACH k IN ARRAY fields LOOP
    IF newj -> k IS DISTINCT FROM oldj -> k THEN
      v_changes := v_changes || jsonb_build_object(k, jsonb_build_object('from', oldj -> k, 'to', newj -> k));
    END IF;
  END LOOP;

  IF v_changes = '{}'::jsonb THEN RETURN NEW; END IF;

  IF NEW.settlement_status IS DISTINCT FROM OLD.settlement_status
     AND NEW.settlement_status = 'settled' AND NEW.settled_at IS NULL THEN
    NEW.settled_at := now();
    NEW.settled_by := auth.uid();
  END IF;

  INSERT INTO public.audit_log (actor_id, action, entity, entity_id, details)
  VALUES (auth.uid(), 'transport_economics_changed', 'transport_services', NEW.id, v_changes);

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_transport_economics_audit ON public.transport_services;
CREATE TRIGGER trg_transport_economics_audit
  BEFORE UPDATE ON public.transport_services
  FOR EACH ROW EXECUTE FUNCTION public.tg_transport_economics_audit();