-- ===== Enums =====
CREATE TYPE public.checklist_item_status AS ENUM ('pending','in_progress','done','not_applicable');
CREATE TYPE public.incident_category AS ENUM ('flight','hotel','transfer','excursion','vehicle','driver','client','payment','documentation','provider','other');
CREATE TYPE public.incident_priority AS ENUM ('low','medium','high','urgent');
CREATE TYPE public.incident_status AS ENUM ('open','in_review','resolved','closed');

-- ===== Checklist =====
CREATE TABLE public.booking_checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  code text NOT NULL,
  label text NOT NULL,
  status public.checklist_item_status NOT NULL DEFAULT 'pending',
  is_critical boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  notes text,
  completed_at timestamptz,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (booking_id, code)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.booking_checklist_items TO authenticated;
GRANT ALL ON public.booking_checklist_items TO service_role;
ALTER TABLE public.booking_checklist_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Operaciones gestiona el checklist"
  ON public.booking_checklist_items FOR ALL TO authenticated
  USING (public.is_operations(auth.uid()))
  WITH CHECK (public.is_operations(auth.uid()));

CREATE POLICY "El dueño de la reserva ve su checklist"
  ON public.booking_checklist_items FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE TRIGGER trg_checklist_updated_at
  BEFORE UPDATE ON public.booking_checklist_items
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ===== Incidencias =====
CREATE TABLE public.booking_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  category public.incident_category NOT NULL DEFAULT 'other',
  priority public.incident_priority NOT NULL DEFAULT 'medium',
  status public.incident_status NOT NULL DEFAULT 'open',
  description text NOT NULL,
  resolution text,
  reported_by uuid,
  resolved_by uuid,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.booking_incidents TO authenticated;
GRANT ALL ON public.booking_incidents TO service_role;
ALTER TABLE public.booking_incidents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Operaciones gestiona las incidencias"
  ON public.booking_incidents FOR ALL TO authenticated
  USING (public.is_operations(auth.uid()))
  WITH CHECK (public.is_operations(auth.uid()));

CREATE POLICY "El dueño de la reserva ve sus incidencias"
  ON public.booking_incidents FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE TRIGGER trg_incidents_updated_at
  BEFORE UPDATE ON public.booking_incidents
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ===== Catálogo base del checklist (configurable a futuro) =====
CREATE OR REPLACE FUNCTION public.default_checklist_items()
RETURNS TABLE(code text, label text, is_critical boolean, sort_order integer)
LANGUAGE sql IMMUTABLE
SET search_path = public
AS $$
  SELECT * FROM (VALUES
    ('payment_confirmed','Pago confirmado',true,10),
    ('hotel_confirmed','Hotel confirmado',true,20),
    ('voucher_sent','Voucher enviado',false,30),
    ('excursions_confirmed','Excursiones confirmadas',false,40),
    ('transfer_confirmed','Traslado confirmado',true,50),
    ('vehicle_confirmed','Vehículo confirmado',false,60),
    ('driver_assigned','Chofer asignado',true,70),
    ('driver_accepted','Chofer aceptó',false,80),
    ('client_informed','Cliente informado',false,90),
    ('documentation_sent','Documentación enviada',true,100),
    ('notes_reviewed','Observaciones revisadas',false,110),
    ('insurance_issued','Seguro emitido',false,120),
    ('invoiced','Facturación realizada',false,130),
    ('settlement_pending','Liquidación pendiente',false,140),
    ('trip_closed','Viaje cerrado',false,150)
  ) AS t(code, label, is_critical, sort_order);
$$;

-- Alta automática del checklist base al crear una reserva
CREATE OR REPLACE FUNCTION public.tg_seed_booking_checklist()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.booking_checklist_items (booking_id, user_id, code, label, is_critical, sort_order)
  SELECT NEW.id, NEW.user_id, d.code, d.label, d.is_critical, d.sort_order
  FROM public.default_checklist_items() d
  ON CONFLICT (booking_id, code) DO NOTHING;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_seed_booking_checklist
  AFTER INSERT ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.tg_seed_booking_checklist();

-- Auditoría de checklist e incidencias
CREATE OR REPLACE FUNCTION public.tg_audit_checklist()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.updated_by := auth.uid();
    NEW.completed_at := CASE WHEN NEW.status = 'done' THEN now() ELSE NULL END;
    INSERT INTO public.audit_log (actor_id, action, entity, entity_id, details)
    VALUES (auth.uid(), 'checklist_status_changed', 'booking_checklist_items', NEW.id,
            jsonb_build_object('booking_id', NEW.booking_id, 'code', NEW.code,
                               'from', OLD.status, 'to', NEW.status));
  END IF;
  IF NEW.notes IS DISTINCT FROM OLD.notes THEN
    NEW.updated_by := auth.uid();
    INSERT INTO public.audit_log (actor_id, action, entity, entity_id, details)
    VALUES (auth.uid(), 'checklist_note_changed', 'booking_checklist_items', NEW.id,
            jsonb_build_object('booking_id', NEW.booking_id, 'code', NEW.code));
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_audit_checklist
  BEFORE UPDATE ON public.booking_checklist_items
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit_checklist();

CREATE OR REPLACE FUNCTION public.tg_audit_incident()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_log (actor_id, action, entity, entity_id, details)
    VALUES (auth.uid(), 'incident_created', 'booking_incidents', NEW.id,
            jsonb_build_object('booking_id', NEW.booking_id, 'category', NEW.category,
                               'priority', NEW.priority));
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status IN ('resolved','closed') AND NEW.resolved_at IS NULL THEN
      NEW.resolved_at := now();
      NEW.resolved_by := auth.uid();
    END IF;
    INSERT INTO public.audit_log (actor_id, action, entity, entity_id, details)
    VALUES (auth.uid(), 'incident_status_changed', 'booking_incidents', NEW.id,
            jsonb_build_object('booking_id', NEW.booking_id, 'from', OLD.status, 'to', NEW.status));
  END IF;

  IF NEW.resolution IS DISTINCT FROM OLD.resolution THEN
    INSERT INTO public.audit_log (actor_id, action, entity, entity_id, details)
    VALUES (auth.uid(), 'incident_resolution_changed', 'booking_incidents', NEW.id,
            jsonb_build_object('booking_id', NEW.booking_id));
  END IF;

  IF NEW.priority IS DISTINCT FROM OLD.priority OR NEW.category IS DISTINCT FROM OLD.category THEN
    INSERT INTO public.audit_log (actor_id, action, entity, entity_id, details)
    VALUES (auth.uid(), 'incident_updated', 'booking_incidents', NEW.id,
            jsonb_build_object('booking_id', NEW.booking_id, 'priority', NEW.priority,
                               'category', NEW.category));
  END IF;

  RETURN NEW;
END; $$;

CREATE TRIGGER trg_audit_incident_ins
  AFTER INSERT ON public.booking_incidents
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit_incident();

CREATE TRIGGER trg_audit_incident_upd
  BEFORE UPDATE ON public.booking_incidents
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit_incident();

-- Backfill del checklist para reservas existentes
INSERT INTO public.booking_checklist_items (booking_id, user_id, code, label, is_critical, sort_order)
SELECT b.id, b.user_id, d.code, d.label, d.is_critical, d.sort_order
FROM public.bookings b
CROSS JOIN public.default_checklist_items() d
ON CONFLICT (booking_id, code) DO NOTHING;

CREATE INDEX idx_checklist_booking ON public.booking_checklist_items(booking_id);
CREATE INDEX idx_incidents_booking ON public.booking_incidents(booking_id);