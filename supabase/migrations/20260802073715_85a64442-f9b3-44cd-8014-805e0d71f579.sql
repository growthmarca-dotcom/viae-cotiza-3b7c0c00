CREATE OR REPLACE FUNCTION public.booking_trip_state(_booking_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  b record;
  total_services int := 0;
  confirmed_services int := 0;
  pending_items text[] := '{}';
  critical_total int := 0;
  critical_done int := 0;
  blocking_incidents int := 0;
  today date := (now() AT TIME ZONE 'UTC')::date;
  state text;
  reason text;
  progress int := 0;
BEGIN
  SELECT id, status::text AS status, travel_start, travel_end, quotation_id, opportunity_id
    INTO b
  FROM public.bookings
  WHERE id = _booking_id;

  IF b.id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT count(*)::int,
         count(*) FILTER (
           WHERE s.status::text IN ('services_coordinated', 'ready', 'in_execution', 'finished')
         )::int,
         coalesce(
           array_agg(coalesce(nullif(btrim(s.title), ''), s.kind::text)
             ORDER BY s.service_date NULLS LAST, s.created_at)
           FILTER (
             WHERE s.status::text NOT IN ('services_coordinated', 'ready', 'in_execution', 'finished', 'cancelled')
           ),
           '{}'::text[]
         )
    INTO total_services, confirmed_services, pending_items
  FROM public.booking_services s
  WHERE s.booking_id = _booking_id
    AND s.record_status = 'active'
    AND s.status::text <> 'cancelled';

  SELECT count(*)::int,
         count(*) FILTER (WHERE c.status::text IN ('done', 'not_applicable'))::int
    INTO critical_total, critical_done
  FROM public.booking_checklist_items c
  WHERE c.booking_id = _booking_id
    AND c.is_critical;

  SELECT count(*)::int INTO blocking_incidents
  FROM public.booking_incidents i
  WHERE i.booking_id = _booking_id
    AND i.status::text IN ('open', 'in_review')
    AND i.priority::text IN ('high', 'critical');

  IF total_services > 0 THEN
    progress := ((confirmed_services::numeric / total_services) * 100)::int;
  END IF;

  IF b.status = 'cancelled' THEN
    state := 'cancelled';
    reason := 'Reserva cancelada comercialmente';
    progress := 0;
  ELSIF total_services = 0 THEN
    IF b.quotation_id IS NOT NULL OR b.opportunity_id IS NOT NULL THEN
      state := 'quoted';
      reason := 'Cotización/oportunidad asociada sin servicios cargados';
    ELSE
      state := 'draft';
      reason := 'Reserva sin servicios asociados';
    END IF;
  ELSIF b.travel_end IS NOT NULL AND b.travel_end < today
        AND (critical_total = 0 OR critical_done = critical_total) THEN
    state := 'finished';
    reason := 'Viaje finalizado y checklist crítico completo';
  ELSIF b.travel_start IS NOT NULL AND b.travel_start <= today
        AND (b.travel_end IS NULL OR b.travel_end >= today) THEN
    state := 'operational';
    reason := 'Viaje en curso';
  ELSIF confirmed_services = total_services THEN
    state := 'confirmed';
    reason := format('%s de %s servicios confirmados', confirmed_services, total_services);
  ELSE
    state := 'partially_confirmed';
    reason := format('%s de %s servicios confirmados', confirmed_services, total_services);
  END IF;

  IF critical_total > 0 AND critical_done < critical_total THEN
    pending_items := pending_items || (
      SELECT coalesce(array_agg('Checklist: ' || c.label ORDER BY c.sort_order), '{}'::text[])
      FROM public.booking_checklist_items c
      WHERE c.booking_id = _booking_id
        AND c.is_critical
        AND c.status::text NOT IN ('done', 'not_applicable')
    );
  END IF;

  RETURN jsonb_build_object(
    'state', state,
    'reason', reason,
    'progress', progress,
    'pending_items', to_jsonb(pending_items),
    'services_total', total_services,
    'services_confirmed', confirmed_services,
    'critical_total', critical_total,
    'critical_done', critical_done,
    'blocking_incidents', blocking_incidents
  );
END;
$$;

REVOKE ALL ON FUNCTION public.booking_trip_state(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.booking_trip_state(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.booking_trip_state(uuid) TO service_role;