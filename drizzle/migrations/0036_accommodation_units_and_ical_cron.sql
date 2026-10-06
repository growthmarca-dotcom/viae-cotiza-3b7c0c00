-- lovable-cron-fallback-reviewed: iCal feeds are external and offer no push/webhook; user requires 30-minute sync.
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

ALTER TABLE public.quotations ADD COLUMN IF NOT EXISTS accommodation_unit_id uuid REFERENCES public.product_variants(id) ON DELETE SET NULL;
COMMENT ON COLUMN public.quotations.accommodation_unit_id IS 'Unidad/habitación concreta del alojamiento del Catálogo elegida en la cotización (opcional).';

CREATE POLICY product_variants_read_shared ON public.product_variants FOR SELECT TO authenticated
  USING (public.can_read_product(product_id));

CREATE OR REPLACE FUNCTION public.product_units_availability(_product_ids uuid[], _from date, _to date)
RETURNS TABLE(product_id uuid, variant_id uuid, name text, status text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH v AS (
    SELECT v.id, v.product_id, v.name, v.created_at FROM public.product_variants v
    WHERE v.product_id = ANY(_product_ids) AND v.status = 'active' AND public.can_read_product(v.product_id)
  ), managed AS (
    SELECT DISTINCT v.product_id FROM v WHERE
      EXISTS (SELECT 1 FROM public.product_availability_profiles ap WHERE ap.product_id = v.product_id AND ap.status = 'active' AND ap.availability_mode = 'calendar')
      OR EXISTS (SELECT 1 FROM public.availability_sources s WHERE s.product_id = v.product_id AND s.enabled AND s.configuration->>'kind' = 'ical')
  )
  SELECT v.product_id, v.id, v.name,
    CASE
      WHEN _from IS NULL OR _to IS NULL OR _to <= _from OR v.product_id NOT IN (SELECT product_id FROM managed) THEN 'unknown'
      WHEN EXISTS (SELECT 1 FROM public.product_availability_blocks b WHERE b.product_id = v.product_id
             AND (b.product_variant_id IS NULL OR b.product_variant_id = v.id)
             AND b.start_date < _to AND b.end_date > _from) THEN 'unavailable'
      ELSE 'available'
    END
  FROM v ORDER BY v.product_id, v.created_at;
$$;
GRANT EXECUTE ON FUNCTION public.product_units_availability(uuid[], date, date) TO authenticated;

CREATE OR REPLACE FUNCTION public.tg_booking_availability_block()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _pid uuid; _uid uuid;
BEGIN
  IF NEW.status = 'cancelled' THEN
    DELETE FROM public.product_availability_blocks WHERE booking_id = NEW.id AND origin = 'viae_booking';
    RETURN NEW;
  END IF;
  IF NEW.status <> 'confirmed' OR (TG_OP = 'UPDATE' AND OLD.status = 'confirmed') THEN RETURN NEW; END IF;
  IF NEW.quotation_id IS NULL OR NEW.travel_start IS NULL OR NEW.travel_end IS NULL OR NEW.travel_end <= NEW.travel_start THEN RETURN NEW; END IF;
  SELECT q.accommodation_catalog_product_id, q.accommodation_unit_id INTO _pid, _uid FROM public.quotations q WHERE q.id = NEW.quotation_id;
  IF _pid IS NULL THEN RETURN NEW; END IF;
  IF _uid IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.product_variants v WHERE v.id = _uid AND v.product_id = _pid) THEN _uid := NULL; END IF;
  INSERT INTO public.product_availability_blocks(product_id, product_variant_id, start_date, end_date, origin, reason, booking_id, created_by)
  VALUES (_pid, _uid, NEW.travel_start, NEW.travel_end, 'viae_booking', 'Reserva ViaE ' || coalesce(NEW.booking_number, ''), NEW.id, NEW.user_id)
  ON CONFLICT (booking_id) WHERE booking_id IS NOT NULL DO NOTHING;
  RETURN NEW;
END $$;

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
CREATE TABLE IF NOT EXISTS private.cron_tokens (name text PRIMARY KEY, token text NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'));
INSERT INTO private.cron_tokens(name) VALUES ('ical_sync') ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.verify_cron_token(_name text, _token text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, private AS $$
  SELECT EXISTS (SELECT 1 FROM private.cron_tokens t WHERE t.name = _name AND t.token = _token);
$$;
REVOKE ALL ON FUNCTION public.verify_cron_token(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_cron_token(text, text) TO service_role;

SELECT cron.unschedule('ical-sync-30min') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'ical-sync-30min');
SELECT cron.schedule('ical-sync-30min', '*/30 * * * *', $cron$
  SELECT net.http_post(
    url := 'https://project--66b28d78-96cd-47d4-baf7-583eb031a1c6.lovable.app/api/public/ical-sync',
    headers := jsonb_build_object('Content-Type','application/json','x-cron-token',(SELECT token FROM private.cron_tokens WHERE name = 'ical_sync')),
    body := '{}'::jsonb
  );
$cron$);