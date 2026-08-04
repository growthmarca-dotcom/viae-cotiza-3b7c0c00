-- ============================================================
-- VIAE CORE v1.10.8.1 — Preparación del modelo Pipeline Comercial
-- ============================================================

-- 1) Normalización de estados: opportunity_stage es la única fuente de verdad.
COMMENT ON TYPE public.opportunity_status IS
  'DEPRECATED (v1.10.8.1): no se usa en ninguna tabla. El estado comercial real es opportunities.stage (opportunity_stage). No migrar datos aquí.';
COMMENT ON TYPE public.opportunity_stage IS
  'Estado comercial real del pipeline. La metadata (orden, grupo, probabilidad) vive en public.opportunity_stage_config.';

-- ============================================================
-- 2) Configuración de etapas
-- ============================================================
CREATE TABLE public.opportunity_stage_config (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  stage public.opportunity_stage NOT NULL UNIQUE,
  display_name text NOT NULL,
  sort_order integer NOT NULL,
  pipeline_group text NOT NULL,
  default_probability integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT opportunity_stage_config_group_chk
    CHECK (pipeline_group IN ('open', 'won', 'lost')),
  CONSTRAINT opportunity_stage_config_probability_chk
    CHECK (default_probability BETWEEN 0 AND 100)
);

GRANT SELECT ON public.opportunity_stage_config TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.opportunity_stage_config TO authenticated;
GRANT ALL ON public.opportunity_stage_config TO service_role;

ALTER TABLE public.opportunity_stage_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stage config readable by members"
  ON public.opportunity_stage_config FOR SELECT TO authenticated USING (true);

CREATE POLICY "stage config managed by admins"
  ON public.opportunity_stage_config FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_opportunity_stage_config_updated_at
  BEFORE UPDATE ON public.opportunity_stage_config
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

INSERT INTO public.opportunity_stage_config
  (stage, display_name, sort_order, pipeline_group, default_probability)
VALUES
  ('new',          'Nuevo',               10, 'open', 10),
  ('contacted',    'Contactado',          20, 'open', 20),
  ('quoted',       'Cotización enviada',  30, 'open', 40),
  ('following_up', 'En seguimiento',      40, 'open', 55),
  ('negotiating',  'Negociación',         50, 'open', 70),
  ('booked',       'Reserva confirmada',  60, 'won', 100),
  ('completed',    'Viaje finalizado',    70, 'won', 100),
  ('lost',         'Perdida',             80, 'lost', 0),
  ('cancelled',    'Cancelada',           90, 'lost', 0);

-- ============================================================
-- 3) Nuevos campos en opportunities
-- ============================================================
ALTER TABLE public.opportunities
  ADD COLUMN stage_changed_at timestamptz,
  ADD COLUMN expected_close_date date,
  ADD COLUMN lost_reason text,
  ADD COLUMN position integer;

CREATE INDEX idx_opportunities_stage_position
  ON public.opportunities (stage, position, created_at DESC);

-- ============================================================
-- 4) Historial de etapas (append-only, escrito por trigger)
-- ============================================================
CREATE TABLE public.opportunity_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  opportunity_id uuid NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  from_stage public.opportunity_stage,
  to_stage public.opportunity_stage NOT NULL,
  changed_by uuid,
  changed_at timestamptz NOT NULL DEFAULT now(),
  notes text
);

CREATE INDEX idx_opportunity_history_opportunity
  ON public.opportunity_history (opportunity_id, changed_at DESC);

GRANT SELECT ON public.opportunity_history TO authenticated;
GRANT ALL ON public.opportunity_history TO service_role;

ALTER TABLE public.opportunity_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "history readable by admins"
  ON public.opportunity_history FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "history readable by owner or assigned agent"
  ON public.opportunity_history FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.opportunities o
    WHERE o.id = opportunity_history.opportunity_id
      AND (
        o.user_id = auth.uid()
        OR o.owner_user_id = auth.uid()
        OR (o.assigned_agent_id IS NOT NULL AND o.assigned_agent_id = public.current_agent_id())
      )
  ));

-- ============================================================
-- 5) Sellado de stage_changed_at + registro de historial
-- ============================================================
CREATE OR REPLACE FUNCTION public.tg_opportunity_stage_stamp()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.stage_changed_at := COALESCE(NEW.stage_changed_at, now());
    RETURN NEW;
  END IF;

  IF NEW.stage IS DISTINCT FROM OLD.stage THEN
    NEW.stage_changed_at := now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_opportunity_stage_stamp
  BEFORE INSERT OR UPDATE ON public.opportunities
  FOR EACH ROW EXECUTE FUNCTION public.tg_opportunity_stage_stamp();

CREATE OR REPLACE FUNCTION public.tg_opportunity_history()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.opportunity_history
      (opportunity_id, from_stage, to_stage, changed_by, changed_at, notes)
    VALUES (NEW.id, NULL, NEW.stage, auth.uid(), COALESCE(NEW.stage_changed_at, now()), 'Oportunidad creada');
    RETURN NEW;
  END IF;

  IF NEW.stage IS DISTINCT FROM OLD.stage THEN
    INSERT INTO public.opportunity_history
      (opportunity_id, from_stage, to_stage, changed_by, changed_at, notes)
    VALUES (NEW.id, OLD.stage, NEW.stage, auth.uid(), COALESCE(NEW.stage_changed_at, now()),
            NULLIF(NEW.lost_reason, ''));
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_opportunity_history
  AFTER INSERT OR UPDATE OF stage ON public.opportunities
  FOR EACH ROW EXECUTE FUNCTION public.tg_opportunity_history();

-- El historial es append-only: nadie modifica ni borra filas desde la app.
CREATE OR REPLACE FUNCTION public.tg_opportunity_history_append_only()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'opportunity_history is append-only';
END;
$$;

CREATE TRIGGER trg_opportunity_history_append_only
  BEFORE UPDATE OR DELETE ON public.opportunity_history
  FOR EACH ROW EXECUTE FUNCTION public.tg_opportunity_history_append_only();

-- ============================================================
-- 6) Guardas de UPDATE: columnas permitidas al agente + coherencia multi-tenant
-- ============================================================
CREATE OR REPLACE FUNCTION public.tg_opportunity_guard_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_is_admin boolean;
  v_is_owner boolean;
  v_is_agent boolean;
  v_quote_org uuid;
  v_booking_org uuid;
BEGIN
  IF v_uid IS NULL OR current_setting('role', true) = 'service_role' THEN
    RETURN NEW;
  END IF;

  v_is_admin := public.has_role(v_uid, 'admin');
  v_is_owner := (OLD.user_id = v_uid OR OLD.owner_user_id = v_uid);
  v_is_agent := (OLD.assigned_agent_id IS NOT NULL
                 AND OLD.assigned_agent_id = public.current_agent_id());

  -- El agente asignado (sin ser dueño ni admin) sólo edita campos comerciales.
  IF NOT v_is_admin AND NOT v_is_owner AND v_is_agent THEN
    IF NEW.organization_id IS DISTINCT FROM OLD.organization_id
       OR NEW.owner_user_id IS DISTINCT FROM OLD.owner_user_id
       OR NEW.user_id IS DISTINCT FROM OLD.user_id
       OR NEW.assigned_agent_id IS DISTINCT FROM OLD.assigned_agent_id
       OR NEW.client_id IS DISTINCT FROM OLD.client_id
       OR NEW.quotation_id IS DISTINCT FROM OLD.quotation_id
       OR NEW.record_status IS DISTINCT FROM OLD.record_status
       OR NEW.estimated_value IS DISTINCT FROM OLD.estimated_value
       OR NEW.currency IS DISTINCT FROM OLD.currency
       OR NEW.lead_source IS DISTINCT FROM OLD.lead_source
    THEN
      RAISE EXCEPTION 'Assigned agent may only update commercial fields'
        USING HINT = 'agent_field_not_allowed';
    END IF;
  END IF;

  -- Coherencia de organización con cotización y reserva relacionadas.
  IF NEW.organization_id IS DISTINCT FROM OLD.organization_id
     AND NEW.organization_id IS NOT NULL THEN
    IF NOT public.can_create_opportunity_for_organization(v_uid, NEW.organization_id) THEN
      RAISE EXCEPTION 'Opportunity requires a valid organization'
        USING HINT = 'not_allowed_for_organization';
    END IF;
  END IF;

  IF NEW.organization_id IS NOT NULL AND NEW.quotation_id IS NOT NULL THEN
    SELECT q.organization_id INTO v_quote_org
    FROM public.quotations q WHERE q.id = NEW.quotation_id;
    IF v_quote_org IS NOT NULL AND v_quote_org <> NEW.organization_id THEN
      RAISE EXCEPTION 'Opportunity and quotation belong to different organizations'
        USING HINT = 'organization_mismatch';
    END IF;
  END IF;

  IF NEW.organization_id IS NOT NULL THEN
    SELECT b.organization_id INTO v_booking_org
    FROM public.bookings b
    WHERE b.opportunity_id = NEW.id AND b.organization_id IS NOT NULL
    LIMIT 1;
    IF v_booking_org IS NOT NULL AND v_booking_org <> NEW.organization_id THEN
      RAISE EXCEPTION 'Opportunity and booking belong to different organizations'
        USING HINT = 'organization_mismatch';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_opportunity_guard_update
  BEFORE UPDATE ON public.opportunities
  FOR EACH ROW EXECUTE FUNCTION public.tg_opportunity_guard_update();

-- ============================================================
-- 7) Permisos: el agente asignado puede actualizar (columnas limitadas por trigger)
-- ============================================================
CREATE POLICY "assigned agent updates opportunities"
  ON public.opportunities FOR UPDATE TO authenticated
  USING (
    assigned_agent_id IS NOT NULL
    AND assigned_agent_id = public.current_agent_id()
    AND public.is_approved(auth.uid())
  )
  WITH CHECK (
    assigned_agent_id IS NOT NULL
    AND assigned_agent_id = public.current_agent_id()
    AND public.is_approved(auth.uid())
  );

-- ============================================================
-- 8) Backfill determinista (sin inventar datos)
-- ============================================================
UPDATE public.opportunities
SET stage_changed_at = created_at
WHERE stage_changed_at IS NULL;

WITH ranked AS (
  SELECT id, row_number() OVER (PARTITION BY stage ORDER BY created_at) AS rn
  FROM public.opportunities
)
UPDATE public.opportunities o
SET position = ranked.rn * 100
FROM ranked
WHERE ranked.id = o.id AND o.position IS NULL;

-- Historial inicial para las oportunidades preexistentes (una sola vez).
INSERT INTO public.opportunity_history
  (opportunity_id, from_stage, to_stage, changed_by, changed_at, notes)
SELECT o.id, NULL, o.stage, o.user_id, o.created_at, 'Registro histórico (backfill v1.10.8.1)'
FROM public.opportunities o
WHERE NOT EXISTS (
  SELECT 1 FROM public.opportunity_history h WHERE h.opportunity_id = o.id
);

COMMENT ON COLUMN public.opportunities.stage_changed_at IS 'Último cambio de etapa; sellado por trigger.';
COMMENT ON COLUMN public.opportunities.position IS 'Orden manual dentro de la columna del Kanban (múltiplos de 100).';
COMMENT ON COLUMN public.opportunities.lost_reason IS 'Motivo de pérdida/cancelación; se copia como nota del historial.';