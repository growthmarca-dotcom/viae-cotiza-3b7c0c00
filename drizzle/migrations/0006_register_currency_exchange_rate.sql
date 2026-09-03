-- Intervención 5 — Economía / Tipo de cambio.
-- Alta de cotizaciones del Financial Core cerrando el período abierto anterior.
-- Aditivo: no cambia tablas, ni la validación de solapamiento, ni las tasas ya
-- registradas (solo se cierra la vigencia del período anterior; el valor de la
-- tasa histórica nunca se modifica).
CREATE OR REPLACE FUNCTION public.register_currency_exchange_rate(
  _from_iso text,
  _to_iso text,
  _rate numeric,
  _valid_from timestamptz DEFAULT now(),
  _rate_type text DEFAULT 'operational',
  _source text DEFAULT 'manual',
  _note text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _from_id uuid;
  _to_id uuid;
  _new_id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Solo un administrador puede registrar tipos de cambio';
  END IF;

  IF _rate IS NULL OR _rate <= 0 THEN
    RAISE EXCEPTION 'El tipo de cambio debe ser mayor a 0';
  END IF;

  SELECT id INTO _from_id FROM public.currencies WHERE iso_code = upper(_from_iso) AND is_active;
  SELECT id INTO _to_id FROM public.currencies WHERE iso_code = upper(_to_iso) AND is_active;
  IF _from_id IS NULL OR _to_id IS NULL THEN
    RAISE EXCEPTION 'Las monedas deben existir y estar activas';
  END IF;
  IF _from_id = _to_id THEN
    RAISE EXCEPTION 'Las monedas deben ser distintas';
  END IF;

  -- Cierra el período abierto anterior del mismo par/tipo/fuente.
  UPDATE public.currency_exchange_rates r
     SET valid_until = _valid_from
   WHERE r.from_currency_id = _from_id
     AND r.to_currency_id = _to_id
     AND r.rate_type = _rate_type
     AND r.source = _source
     AND r.valid_until IS NULL
     AND r.valid_from < _valid_from;

  INSERT INTO public.currency_exchange_rates (
    from_currency_id, to_currency_id, exchange_rate, rate_type, source,
    valid_from, valid_until, note, created_by
  ) VALUES (
    _from_id, _to_id, _rate, _rate_type, _source,
    _valid_from, NULL, nullif(btrim(coalesce(_note, '')), ''), auth.uid()
  )
  RETURNING id INTO _new_id;

  RETURN _new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.register_currency_exchange_rate(text, text, numeric, timestamptz, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.register_currency_exchange_rate(text, text, numeric, timestamptz, text, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.register_currency_exchange_rate(text, text, numeric, timestamptz, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_currency_exchange_rate(text, text, numeric, timestamptz, text, text, text) TO service_role;
