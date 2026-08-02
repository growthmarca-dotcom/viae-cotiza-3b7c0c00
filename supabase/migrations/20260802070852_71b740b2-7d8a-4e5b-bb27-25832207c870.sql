-- =============================================================
-- v1.9.5 Fase 1 — Expediente de Viaje 360°: pasajeros + cronología
-- Sin triggers de alimentación, sin trip_state, sin tocar transporte.
-- =============================================================

-- ------------------------------------------------- booking_passengers
CREATE TABLE public.booking_passengers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  first_name text NOT NULL,
  last_name text NOT NULL,
  document_type text,
  document_number text,
  birth_date date,
  nationality text,
  email text,
  phone text,
  is_lead_passenger boolean NOT NULL DEFAULT false,
  relationship_to_lead_passenger text,
  notes text,
  record_status public.record_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX booking_passengers_booking_idx ON public.booking_passengers (booking_id);
CREATE INDEX booking_passengers_document_idx ON public.booking_passengers (document_number);
CREATE UNIQUE INDEX booking_passengers_lead_uniq
  ON public.booking_passengers (booking_id)
  WHERE is_lead_passenger AND record_status = 'active';

CREATE TRIGGER booking_passengers_updated_at
  BEFORE UPDATE ON public.booking_passengers
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.booking_passengers TO authenticated;
GRANT ALL ON public.booking_passengers TO service_role;

ALTER TABLE public.booking_passengers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins manage booking passengers"
  ON public.booking_passengers FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "operations manage booking passengers"
  ON public.booking_passengers FOR ALL TO authenticated
  USING (is_operations(auth.uid()))
  WITH CHECK (is_operations(auth.uid()));

CREATE POLICY "booking owner manages passengers"
  ON public.booking_passengers FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.bookings b
                 WHERE b.id = booking_passengers.booking_id AND b.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.bookings b
                      WHERE b.id = booking_passengers.booking_id AND b.user_id = auth.uid()));

CREATE POLICY "assigned agent reads passengers"
  ON public.booking_passengers FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.bookings b
                 WHERE b.id = booking_passengers.booking_id
                   AND b.assigned_agent_id IS NOT NULL
                   AND b.assigned_agent_id = current_agent_id()));

-- --------------------------------------------------- booking_timeline
CREATE TYPE public.booking_timeline_event AS ENUM (
  'created',
  'updated',
  'status_changed',
  'payment_received',
  'service_confirmed',
  'provider_confirmed',
  'resource_assigned',
  'document_added',
  'checklist_completed',
  'incident_opened',
  'incident_resolved',
  'communication_sent',
  'communication_read'
);

CREATE TYPE public.timeline_visibility AS ENUM ('internal', 'client');

CREATE TABLE public.booking_timeline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  event_type public.booking_timeline_event NOT NULL,
  entity_type text,
  entity_id uuid,
  actor uuid,
  actor_role text,
  visibility public.timeline_visibility NOT NULL DEFAULT 'internal',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX booking_timeline_booking_idx
  ON public.booking_timeline (booking_id, created_at DESC);
CREATE INDEX booking_timeline_entity_idx
  ON public.booking_timeline (entity_type, entity_id);

-- append-only: sin UPDATE ni DELETE, ni siquiera para service_role
GRANT SELECT, INSERT ON public.booking_timeline TO authenticated;
GRANT SELECT, INSERT ON public.booking_timeline TO service_role;

CREATE OR REPLACE FUNCTION public.tg_timeline_append_only()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'La cronología de la reserva es de solo agregado: no admite modificaciones ni borrados.';
  RETURN NULL;
END;
$$;

CREATE TRIGGER booking_timeline_immutable
  BEFORE UPDATE OR DELETE ON public.booking_timeline
  FOR EACH ROW EXECUTE FUNCTION public.tg_timeline_append_only();

ALTER TABLE public.booking_timeline ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins read timeline"
  ON public.booking_timeline FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "operations read timeline"
  ON public.booking_timeline FOR SELECT TO authenticated
  USING (is_operations(auth.uid()));

CREATE POLICY "booking owner reads timeline"
  ON public.booking_timeline FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.bookings b
                 WHERE b.id = booking_timeline.booking_id AND b.user_id = auth.uid()));

CREATE POLICY "assigned agent reads timeline"
  ON public.booking_timeline FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.bookings b
                 WHERE b.id = booking_timeline.booking_id
                   AND b.assigned_agent_id IS NOT NULL
                   AND b.assigned_agent_id = current_agent_id()));

CREATE POLICY "admins and operations append timeline"
  ON public.booking_timeline FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR is_operations(auth.uid()));

-- ------------------------------- identificador operativo visible
-- Ya existe bookings.booking_number (único). Sólo se actualiza el
-- formato para reservas NUEVAS: VIA-AA-000001. Sin tocar filas existentes.
CREATE OR REPLACE FUNCTION public.tg_booking_number()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.booking_number IS NULL OR NEW.booking_number = '' THEN
    NEW.booking_number := 'VIA-' || to_char(now(), 'YY') || '-' ||
      lpad(nextval('public.booking_number_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END;
$$;