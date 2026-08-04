-- =====================================================================
-- VIAE CORE v1.12.2 (Smart Quote Fase 2.1) — Moneda única por cotización
-- smart_quotes.currency es la única fuente de moneda.
-- =====================================================================

-- 1) Normalización de moneda en cabecera
UPDATE public.smart_quotes SET currency = upper(trim(currency)) WHERE currency IS NOT NULL;

-- 2) Compatibilidad con registros existentes: heredar moneda y recalcular
UPDATE public.smart_quote_items i
   SET currency = q.currency,
       total_amount = round((i.quantity * i.unit_amount)::numeric, 2)
  FROM public.smart_quotes q
 WHERE q.id = i.smart_quote_id
   AND (i.currency IS DISTINCT FROM q.currency
        OR i.total_amount IS DISTINCT FROM round((i.quantity * i.unit_amount)::numeric, 2));

UPDATE public.smart_quote_pricing p
   SET currency = q.currency
  FROM public.smart_quote_items i
  JOIN public.smart_quotes q ON q.id = i.smart_quote_id
 WHERE i.id = p.smart_quote_item_id
   AND p.currency IS DISTINCT FROM q.currency;

UPDATE public.smart_quotes q
   SET total_amount = COALESCE(s.total, 0)
  FROM (
    SELECT smart_quote_id, SUM(total_amount) AS total
      FROM public.smart_quote_items GROUP BY smart_quote_id
  ) s
 WHERE s.smart_quote_id = q.id
   AND q.total_amount IS DISTINCT FROM COALESCE(s.total, 0);

-- 3) Ítem: hereda/valida la moneda de la cabecera y recalcula su importe
CREATE OR REPLACE FUNCTION public.tg_smart_quote_item_currency()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  header_currency text;
BEGIN
  SELECT currency INTO header_currency FROM public.smart_quotes WHERE id = NEW.smart_quote_id;
  IF header_currency IS NULL THEN
    RAISE EXCEPTION 'smart quote not found or has no currency'
      USING HINT = 'smart_quote_currency_missing';
  END IF;

  IF NEW.currency IS NULL OR trim(NEW.currency) = '' THEN
    NEW.currency := header_currency;
  ELSE
    NEW.currency := upper(trim(NEW.currency));
    IF NEW.currency <> header_currency THEN
      RAISE EXCEPTION 'smart quote item currency % must match quote currency %', NEW.currency, header_currency
        USING HINT = 'currency_mismatch';
    END IF;
  END IF;

  IF NEW.quantity IS NULL OR NEW.quantity <= 0 THEN
    RAISE EXCEPTION 'smart quote item quantity must be greater than zero'
      USING HINT = 'invalid_quantity';
  END IF;
  IF NEW.unit_amount IS NULL OR NEW.unit_amount < 0 THEN
    RAISE EXCEPTION 'smart quote item unit amount must be zero or greater'
      USING HINT = 'invalid_unit_amount';
  END IF;

  NEW.total_amount := round((NEW.quantity * NEW.unit_amount)::numeric, 2);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_smart_quote_item_currency ON public.smart_quote_items;
CREATE TRIGGER trg_smart_quote_item_currency
BEFORE INSERT OR UPDATE ON public.smart_quote_items
FOR EACH ROW EXECUTE FUNCTION public.tg_smart_quote_item_currency();

-- 4) Detalle de precio: misma moneda que su ítem
CREATE OR REPLACE FUNCTION public.tg_smart_quote_pricing_currency()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item_currency text;
BEGIN
  SELECT currency INTO item_currency FROM public.smart_quote_items WHERE id = NEW.smart_quote_item_id;
  IF item_currency IS NULL THEN
    RAISE EXCEPTION 'smart quote item not found'
      USING HINT = 'smart_quote_item_missing';
  END IF;
  IF NEW.currency IS NULL OR trim(NEW.currency) = '' THEN
    NEW.currency := item_currency;
  ELSE
    NEW.currency := upper(trim(NEW.currency));
    IF NEW.currency <> item_currency THEN
      RAISE EXCEPTION 'smart quote pricing currency % must match item currency %', NEW.currency, item_currency
        USING HINT = 'currency_mismatch';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_smart_quote_pricing_currency ON public.smart_quote_pricing;
CREATE TRIGGER trg_smart_quote_pricing_currency
BEFORE INSERT OR UPDATE ON public.smart_quote_pricing
FOR EACH ROW EXECUTE FUNCTION public.tg_smart_quote_pricing_currency();

-- 5) Recálculo del total de la cabecera ante cambios de ítems
CREATE OR REPLACE FUNCTION public.tg_smart_quote_recalc_total()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target uuid := COALESCE(NEW.smart_quote_id, OLD.smart_quote_id);
BEGIN
  UPDATE public.smart_quotes q
     SET total_amount = COALESCE((
       SELECT SUM(total_amount) FROM public.smart_quote_items WHERE smart_quote_id = target
     ), 0)
   WHERE q.id = target;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_smart_quote_recalc_total ON public.smart_quote_items;
CREATE TRIGGER trg_smart_quote_recalc_total
AFTER INSERT OR UPDATE OR DELETE ON public.smart_quote_items
FOR EACH ROW EXECUTE FUNCTION public.tg_smart_quote_recalc_total();

-- 6) Cambio de moneda en la cabecera: propaga a ítems y detalles
CREATE OR REPLACE FUNCTION public.tg_smart_quote_currency_propagate()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.smart_quote_pricing p
     SET currency = NEW.currency
   WHERE p.smart_quote_item_id IN (
     SELECT id FROM public.smart_quote_items WHERE smart_quote_id = NEW.id
   );
  UPDATE public.smart_quote_items
     SET currency = NEW.currency
   WHERE smart_quote_id = NEW.id
     AND currency IS DISTINCT FROM NEW.currency;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_smart_quote_currency_propagate ON public.smart_quotes;
CREATE TRIGGER trg_smart_quote_currency_propagate
AFTER UPDATE OF currency ON public.smart_quotes
FOR EACH ROW
WHEN (OLD.currency IS DISTINCT FROM NEW.currency)
EXECUTE FUNCTION public.tg_smart_quote_currency_propagate();

-- 7) Normalización de moneda en cabecera al escribir
CREATE OR REPLACE FUNCTION public.tg_smart_quote_normalize_currency()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.currency IS NULL OR trim(NEW.currency) = '' THEN
    RAISE EXCEPTION 'smart quote requires a currency' USING HINT = 'smart_quote_currency_missing';
  END IF;
  NEW.currency := upper(trim(NEW.currency));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_smart_quote_normalize_currency ON public.smart_quotes;
CREATE TRIGGER trg_smart_quote_normalize_currency
BEFORE INSERT OR UPDATE ON public.smart_quotes
FOR EACH ROW EXECUTE FUNCTION public.tg_smart_quote_normalize_currency();