-- v1.9.3 Fase A · Migración 3: snapshots de tipo de cambio
-- Auditoría previa: 0 filas en exchange_rates, 0 duplicados por (user_id, base, quote, effective_date).

ALTER TABLE public.exchange_rates
  ADD COLUMN IF NOT EXISTS is_snapshot boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS snapshot_of uuid REFERENCES public.exchange_rates(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_exchange_rates_owner_pair_date
  ON public.exchange_rates(user_id, base_currency, quote_currency, effective_date)
  WHERE is_snapshot = false;

-- Tipo de cambio vigente a una fecha (para congelar valores en Fase B)
CREATE OR REPLACE FUNCTION public.rate_at(
  _owner uuid,
  _base text,
  _quote text,
  _date date DEFAULT CURRENT_DATE
)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT rate
  FROM public.exchange_rates
  WHERE user_id = _owner
    AND base_currency = _base
    AND quote_currency = _quote
    AND is_snapshot = false
    AND effective_date <= _date
  ORDER BY effective_date DESC, created_at DESC
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.rate_at(uuid, text, text, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rate_at(uuid, text, text, date) TO authenticated, service_role;