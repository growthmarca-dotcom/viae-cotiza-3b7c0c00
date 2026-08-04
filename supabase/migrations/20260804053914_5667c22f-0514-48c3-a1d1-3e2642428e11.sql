-- ============================================================
-- VIAE CORE v1.12 — FINANCIAL CORE (arquitectura base)
-- No reemplaza la tabla legacy public.exchange_rates (v1.6).
-- ============================================================

-- 1. CURRENCIES ------------------------------------------------
CREATE TABLE public.currencies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  iso_code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  symbol TEXT NOT NULL DEFAULT '$',
  decimal_places SMALLINT NOT NULL DEFAULT 2,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT currencies_iso_code_format CHECK (iso_code ~ '^[A-Z]{3}$'),
  CONSTRAINT currencies_decimals_range CHECK (decimal_places BETWEEN 0 AND 6)
);

GRANT SELECT ON public.currencies TO authenticated;
GRANT INSERT, UPDATE ON public.currencies TO authenticated;
GRANT ALL ON public.currencies TO service_role;

ALTER TABLE public.currencies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "currencies_select_authenticated"
  ON public.currencies FOR SELECT TO authenticated USING (true);

CREATE POLICY "currencies_insert_admin"
  ON public.currencies FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "currencies_update_admin"
  ON public.currencies FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER tg_currencies_updated_at
  BEFORE UPDATE ON public.currencies
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

INSERT INTO public.currencies (iso_code, name, symbol, decimal_places) VALUES
  ('ARS', 'Peso argentino', '$', 2),
  ('USD', 'Dólar estadounidense', 'US$', 2),
  ('EUR', 'Euro', '€', 2),
  ('BRL', 'Real brasileño', 'R$', 2),
  ('CLP', 'Peso chileno', '$', 0),
  ('UYU', 'Peso uruguayo', '$U', 2);

-- 2. CURRENCY EXCHANGE RATES ----------------------------------
CREATE TABLE public.currency_exchange_rates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  from_currency_id UUID NOT NULL REFERENCES public.currencies(id) ON DELETE RESTRICT,
  to_currency_id UUID NOT NULL REFERENCES public.currencies(id) ON DELETE RESTRICT,
  exchange_rate NUMERIC(20, 8) NOT NULL,
  rate_type TEXT NOT NULL DEFAULT 'operational',
  source TEXT NOT NULL DEFAULT 'manual',
  valid_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_until TIMESTAMPTZ,
  note TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT cer_rate_positive CHECK (exchange_rate > 0),
  CONSTRAINT cer_distinct_currencies CHECK (from_currency_id <> to_currency_id),
  CONSTRAINT cer_rate_type_valid CHECK (rate_type IN ('operational', 'official', 'buy', 'sell', 'mid', 'custom'))
);

CREATE INDEX idx_cer_pair_validity
  ON public.currency_exchange_rates (from_currency_id, to_currency_id, valid_from DESC);

GRANT SELECT, INSERT ON public.currency_exchange_rates TO authenticated;
GRANT ALL ON public.currency_exchange_rates TO service_role;

ALTER TABLE public.currency_exchange_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cer_select_authenticated"
  ON public.currency_exchange_rates FOR SELECT TO authenticated USING (true);

CREATE POLICY "cer_insert_admin"
  ON public.currency_exchange_rates FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') AND created_by = auth.uid());

-- Validaciones: monedas activas, sin períodos superpuestos por par/tipo/fuente
CREATE OR REPLACE FUNCTION public.tg_validate_currency_exchange_rate()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.exchange_rate IS NULL OR NEW.exchange_rate <= 0 THEN
    RAISE EXCEPTION 'El tipo de cambio debe ser mayor a 0';
  END IF;

  IF NEW.valid_until IS NOT NULL AND NEW.valid_until <= NEW.valid_from THEN
    RAISE EXCEPTION 'La vigencia final debe ser posterior a la vigencia inicial';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.currencies c WHERE c.id = NEW.from_currency_id AND c.is_active) THEN
    RAISE EXCEPTION 'La moneda de origen no está activa';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.currencies c WHERE c.id = NEW.to_currency_id AND c.is_active) THEN
    RAISE EXCEPTION 'La moneda de destino no está activa';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.currency_exchange_rates r
    WHERE r.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND r.from_currency_id = NEW.from_currency_id
      AND r.to_currency_id = NEW.to_currency_id
      AND r.rate_type = NEW.rate_type
      AND r.source = NEW.source
      AND tstzrange(r.valid_from, r.valid_until, '[)')
          && tstzrange(NEW.valid_from, NEW.valid_until, '[)')
  ) THEN
    RAISE EXCEPTION 'Ya existe una cotización para ese par de monedas y período';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER tg_cer_validate
  BEFORE INSERT OR UPDATE ON public.currency_exchange_rates
  FOR EACH ROW EXECUTE FUNCTION public.tg_validate_currency_exchange_rate();

-- Búsqueda histórica: cotización vigente a una fecha dada
CREATE OR REPLACE FUNCTION public.currency_rate_at(
  _from_iso TEXT,
  _to_iso TEXT,
  _at TIMESTAMPTZ DEFAULT now(),
  _rate_type TEXT DEFAULT NULL
)
RETURNS NUMERIC
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH direct AS (
    SELECT r.exchange_rate AS rate, r.valid_from
    FROM public.currency_exchange_rates r
    JOIN public.currencies f ON f.id = r.from_currency_id
    JOIN public.currencies t ON t.id = r.to_currency_id
    WHERE f.iso_code = upper(_from_iso)
      AND t.iso_code = upper(_to_iso)
      AND (_rate_type IS NULL OR r.rate_type = _rate_type)
      AND r.valid_from <= _at
      AND (r.valid_until IS NULL OR r.valid_until > _at)
  ),
  inverse AS (
    SELECT (1 / r.exchange_rate) AS rate, r.valid_from
    FROM public.currency_exchange_rates r
    JOIN public.currencies f ON f.id = r.from_currency_id
    JOIN public.currencies t ON t.id = r.to_currency_id
    WHERE f.iso_code = upper(_to_iso)
      AND t.iso_code = upper(_from_iso)
      AND (_rate_type IS NULL OR r.rate_type = _rate_type)
      AND r.valid_from <= _at
      AND (r.valid_until IS NULL OR r.valid_until > _at)
  )
  SELECT CASE WHEN upper(_from_iso) = upper(_to_iso) THEN 1::numeric ELSE (
    SELECT rate FROM (
      SELECT rate, valid_from, 0 AS pref FROM direct
      UNION ALL
      SELECT rate, valid_from, 1 AS pref FROM inverse
    ) s ORDER BY pref, valid_from DESC LIMIT 1
  ) END;
$$;

GRANT EXECUTE ON FUNCTION public.currency_rate_at(TEXT, TEXT, TIMESTAMPTZ, TEXT) TO authenticated, service_role;

-- 3. ORGANIZATION BASE CURRENCY -------------------------------
ALTER TABLE public.organizations
  ADD COLUMN base_currency_id UUID REFERENCES public.currencies(id) ON DELETE SET NULL,
  ADD COLUMN analysis_currency_id UUID REFERENCES public.currencies(id) ON DELETE SET NULL;