CREATE TYPE public.availability_block_origin AS ENUM ('manual','viae_booking','ical','booking_engine','channel_manager','api','other');

CREATE TABLE public.product_availability_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  product_variant_id uuid REFERENCES public.product_variants(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date NOT NULL,
  origin public.availability_block_origin NOT NULL DEFAULT 'manual',
  reason text,
  booking_id uuid REFERENCES public.bookings(id) ON DELETE CASCADE,
  source_id uuid REFERENCES public.availability_sources(id) ON DELETE CASCADE,
  external_uid text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT product_availability_blocks_dates CHECK (end_date > start_date)
);
COMMENT ON TABLE public.product_availability_blocks IS 'Bloqueos del calendario interno de alojamientos. start_date inclusiva (check-in), end_date exclusiva (check-out). product_variant_id NULL = todo el alojamiento.';
CREATE INDEX product_availability_blocks_product_idx ON public.product_availability_blocks(product_id, start_date, end_date);
CREATE UNIQUE INDEX product_availability_blocks_booking_uidx ON public.product_availability_blocks(booking_id) WHERE booking_id IS NOT NULL;
CREATE UNIQUE INDEX product_availability_blocks_ical_uidx ON public.product_availability_blocks(source_id, external_uid) WHERE source_id IS NOT NULL AND external_uid IS NOT NULL;
CREATE TRIGGER tg_product_availability_blocks_updated BEFORE UPDATE ON public.product_availability_blocks FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_availability_blocks TO authenticated;
GRANT ALL ON public.product_availability_blocks TO service_role;
ALTER TABLE public.product_availability_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY product_availability_blocks_manage ON public.product_availability_blocks FOR ALL TO authenticated
  USING (public.can_manage_product(product_id)) WITH CHECK (public.can_manage_product(product_id));
CREATE POLICY product_availability_blocks_staff_read ON public.product_availability_blocks FOR SELECT TO authenticated
  USING (public.is_operations(auth.uid()));

-- iCal: reutiliza availability_sources (source_type external, configuration.kind = ical) vinculadas a un producto.
CREATE POLICY availability_sources_product_manage ON public.availability_sources FOR ALL TO authenticated
  USING (product_id IS NOT NULL AND public.can_manage_product(product_id))
  WITH CHECK (product_id IS NOT NULL AND public.can_manage_product(product_id));

-- Estado de disponibilidad para el selector (sin exponer bloqueos ni URLs).
CREATE OR REPLACE FUNCTION public.product_availability_status(_product_ids uuid[], _from date, _to date)
RETURNS TABLE(product_id uuid, status text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH p AS (
    SELECT pr.id FROM public.products pr
    WHERE pr.id = ANY(_product_ids) AND public.can_read_product(pr.id)
  ), managed AS (
    SELECT p.id FROM p WHERE
      EXISTS (SELECT 1 FROM public.product_availability_profiles ap WHERE ap.product_id = p.id AND ap.status = 'active' AND ap.availability_mode = 'calendar')
      OR EXISTS (SELECT 1 FROM public.availability_sources s WHERE s.product_id = p.id AND s.enabled AND s.configuration->>'kind' = 'ical')
  ), blocks AS (
    SELECT b.product_id, b.product_variant_id FROM public.product_availability_blocks b
    WHERE b.product_id IN (SELECT id FROM managed) AND b.start_date < _to AND b.end_date > _from
  )
  SELECT p.id,
    CASE
      WHEN p.id NOT IN (SELECT id FROM managed) THEN 'unknown'
      WHEN EXISTS (SELECT 1 FROM blocks b WHERE b.product_id = p.id AND b.product_variant_id IS NULL) THEN 'unavailable'
      WHEN NOT EXISTS (SELECT 1 FROM public.product_variants v WHERE v.product_id = p.id AND v.status = 'active') THEN
        CASE WHEN EXISTS (SELECT 1 FROM blocks b WHERE b.product_id = p.id) THEN 'unavailable' ELSE 'available' END
      WHEN EXISTS (SELECT 1 FROM public.product_variants v WHERE v.product_id = p.id AND v.status = 'active'
             AND NOT EXISTS (SELECT 1 FROM blocks b WHERE b.product_variant_id = v.id)) THEN 'available'
      ELSE 'unavailable'
    END
  FROM p;
$$;
GRANT EXECUTE ON FUNCTION public.product_availability_status(uuid[], date, date) TO authenticated;

-- Reserva ViaE confirmada => bloqueo automático del alojamiento de la cotización.
CREATE OR REPLACE FUNCTION public.tg_booking_availability_block()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _pid uuid;
BEGIN
  IF NEW.status = 'cancelled' THEN
    DELETE FROM public.product_availability_blocks WHERE booking_id = NEW.id AND origin = 'viae_booking';
    RETURN NEW;
  END IF;
  IF NEW.status <> 'confirmed' OR (TG_OP = 'UPDATE' AND OLD.status = 'confirmed') THEN RETURN NEW; END IF;
  IF NEW.quotation_id IS NULL OR NEW.travel_start IS NULL OR NEW.travel_end IS NULL OR NEW.travel_end <= NEW.travel_start THEN RETURN NEW; END IF;
  SELECT q.accommodation_catalog_product_id INTO _pid FROM public.quotations q WHERE q.id = NEW.quotation_id;
  IF _pid IS NULL THEN RETURN NEW; END IF;
  INSERT INTO public.product_availability_blocks(product_id, start_date, end_date, origin, reason, booking_id, created_by)
  VALUES (_pid, NEW.travel_start, NEW.travel_end, 'viae_booking', 'Reserva ViaE ' || coalesce(NEW.booking_number, ''), NEW.id, NEW.user_id)
  ON CONFLICT (booking_id) WHERE booking_id IS NOT NULL DO NOTHING;
  RETURN NEW;
END $$;
CREATE TRIGGER tg_booking_availability_block AFTER INSERT OR UPDATE OF status ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.tg_booking_availability_block();