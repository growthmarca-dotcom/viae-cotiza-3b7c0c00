-- 1. Estados del lead
CREATE TYPE public.lead_status AS ENUM (
  'new','unassigned','assigned','contacted','quoted','following_up','won','lost'
);

CREATE TYPE public.lead_assignment_mode AS ENUM ('manual','automatic');

-- 2. Tabla de leads
CREATE TABLE public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  first_name text NOT NULL,
  last_name text,
  whatsapp text,
  email text,
  country text,
  city text,
  language text,
  destination text,
  travel_date date,
  pax_count integer,
  budget_amount numeric,
  budget_currency text NOT NULL DEFAULT 'USD',
  source public.lead_source NOT NULL DEFAULT 'other',
  notes text,
  assigned_agent_id uuid REFERENCES public.agents(id) ON DELETE SET NULL,
  assigned_at timestamptz,
  assigned_by uuid,
  status public.lead_status NOT NULL DEFAULT 'new',
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  opportunity_id uuid REFERENCES public.opportunities(id) ON DELETE SET NULL,
  quotation_id uuid REFERENCES public.quotations(id) ON DELETE SET NULL,
  converted_at timestamptz,
  last_activity_at timestamptz NOT NULL DEFAULT now(),
  record_status public.record_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_leads_assigned_agent ON public.leads(assigned_agent_id);
CREATE INDEX idx_leads_status ON public.leads(status);
CREATE INDEX idx_leads_created ON public.leads(created_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.leads TO authenticated;
GRANT ALL ON public.leads TO service_role;

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leads_select" ON public.leads FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR user_id = auth.uid()
  OR (assigned_agent_id IS NOT NULL AND assigned_agent_id = public.current_agent_id())
);

CREATE POLICY "leads_insert" ON public.leads FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() AND public.is_approved(auth.uid()));

CREATE POLICY "leads_update" ON public.leads FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR user_id = auth.uid()
  OR (assigned_agent_id IS NOT NULL AND assigned_agent_id = public.current_agent_id())
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR user_id = auth.uid()
  OR (assigned_agent_id IS NOT NULL AND assigned_agent_id = public.current_agent_id())
);

-- 3. Historial del lead
CREATE TABLE public.lead_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  actor_id uuid,
  action text NOT NULL,
  from_status public.lead_status,
  to_status public.lead_status,
  comment text,
  changes jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_lead_history_lead ON public.lead_history(lead_id, created_at DESC);

GRANT SELECT, INSERT ON public.lead_history TO authenticated;
GRANT ALL ON public.lead_history TO service_role;

ALTER TABLE public.lead_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lead_history_select" ON public.lead_history FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR owner_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.leads l
    WHERE l.id = lead_history.lead_id
      AND l.assigned_agent_id IS NOT NULL
      AND l.assigned_agent_id = public.current_agent_id()
  )
);

-- comentarios manuales
CREATE POLICY "lead_history_insert_comment" ON public.lead_history FOR INSERT TO authenticated
WITH CHECK (
  actor_id = auth.uid()
  AND action = 'comment'
  AND EXISTS (
    SELECT 1 FROM public.leads l
    WHERE l.id = lead_history.lead_id
      AND (
        public.has_role(auth.uid(), 'admin')
        OR l.user_id = auth.uid()
        OR (l.assigned_agent_id IS NOT NULL AND l.assigned_agent_id = public.current_agent_id())
      )
  )
);

-- 4. Configuración de asignación
ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS lead_assignment_mode public.lead_assignment_mode NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS lead_assignment_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS lead_assignment_rules jsonb NOT NULL DEFAULT jsonb_build_object(
    'by_destination', false,
    'by_language', false,
    'by_specialty', false,
    'by_zone', false,
    'by_availability', false,
    'by_active_leads', false,
    'by_workload', false
  );

-- 5. Triggers
CREATE OR REPLACE FUNCTION public.tg_lead_stamp()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.assigned_agent_id IS NOT NULL THEN
      NEW.assigned_at := now();
      NEW.assigned_by := auth.uid();
      IF NEW.status = 'new' THEN NEW.status := 'assigned'; END IF;
    ELSIF NEW.status = 'new' THEN
      NEW.status := 'unassigned';
    END IF;
  ELSE
    NEW.updated_at := now();
    IF NEW.assigned_agent_id IS DISTINCT FROM OLD.assigned_agent_id THEN
      NEW.assigned_at := CASE WHEN NEW.assigned_agent_id IS NULL THEN NULL ELSE now() END;
      NEW.assigned_by := CASE WHEN NEW.assigned_agent_id IS NULL THEN NULL ELSE auth.uid() END;
      IF NEW.assigned_agent_id IS NOT NULL AND NEW.status IN ('new','unassigned') THEN
        NEW.status := 'assigned';
      END IF;
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status
       OR NEW.assigned_agent_id IS DISTINCT FROM OLD.assigned_agent_id THEN
      NEW.last_activity_at := now();
    END IF;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_lead_stamp BEFORE INSERT OR UPDATE ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.tg_lead_stamp();

CREATE OR REPLACE FUNCTION public.tg_lead_history()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.lead_history (lead_id, owner_id, actor_id, action, to_status, comment)
    VALUES (NEW.id, NEW.user_id, auth.uid(), 'created', NEW.status, 'Lead recibido');
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.lead_history (lead_id, owner_id, actor_id, action, from_status, to_status)
    VALUES (NEW.id, NEW.user_id, auth.uid(), 'status_changed', OLD.status, NEW.status);
  END IF;

  IF NEW.assigned_agent_id IS DISTINCT FROM OLD.assigned_agent_id THEN
    INSERT INTO public.lead_history (lead_id, owner_id, actor_id, action, changes)
    VALUES (NEW.id, NEW.user_id, auth.uid(),
            CASE WHEN OLD.assigned_agent_id IS NULL THEN 'assigned' ELSE 'reassigned' END,
            jsonb_build_object('from', OLD.assigned_agent_id, 'to', NEW.assigned_agent_id));
  END IF;

  IF NEW.client_id IS DISTINCT FROM OLD.client_id AND NEW.client_id IS NOT NULL THEN
    INSERT INTO public.lead_history (lead_id, owner_id, actor_id, action, changes)
    VALUES (NEW.id, NEW.user_id, auth.uid(), 'converted',
            jsonb_build_object('client_id', NEW.client_id));
  END IF;

  RETURN NEW;
END; $$;

CREATE TRIGGER trg_lead_history AFTER INSERT OR UPDATE ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.tg_lead_history();

-- Notificaciones
CREATE OR REPLACE FUNCTION public.tg_lead_notifications()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_agent_uid uuid;
  v_name text := trim(coalesce(NEW.first_name,'') || ' ' || coalesce(NEW.last_name,''));
  v_body text;
BEGIN
  v_body := coalesce(nullif(v_name,''), 'Sin nombre')
            || ' · ' || coalesce(NEW.destination, 'sin destino');

  IF NEW.assigned_agent_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.assigned_agent_id IS DISTINCT FROM OLD.assigned_agent_id) THEN
    SELECT user_id INTO v_agent_uid FROM public.agents WHERE id = NEW.assigned_agent_id;
    IF v_agent_uid IS NOT NULL AND v_agent_uid IS DISTINCT FROM auth.uid() THEN
      INSERT INTO public.notifications (user_id, kind, title, body, entity, entity_id, data)
      VALUES (v_agent_uid, 'lead_assigned', 'Nuevo lead asignado', v_body, 'leads', NEW.id,
              jsonb_build_object('destination', NEW.destination, 'source', NEW.source));
    END IF;
  END IF;

  IF TG_OP = 'INSERT' AND NEW.user_id IS DISTINCT FROM auth.uid() THEN
    INSERT INTO public.notifications (user_id, kind, title, body, entity, entity_id)
    VALUES (NEW.user_id, 'lead_new', 'Nueva consulta comercial', v_body, 'leads', NEW.id);
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status
     AND NEW.status IN ('quoted','won')
     AND NEW.user_id IS DISTINCT FROM auth.uid() THEN
    INSERT INTO public.notifications (user_id, kind, title, body, entity, entity_id)
    VALUES (NEW.user_id, 'lead_status',
            CASE WHEN NEW.status = 'quoted' THEN 'Cotización enviada a un lead' ELSE 'Lead ganado' END,
            v_body, 'leads', NEW.id);
  END IF;

  RETURN NEW;
END; $$;

CREATE TRIGGER trg_lead_notifications AFTER INSERT OR UPDATE ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.tg_lead_notifications();

-- Comentario manual actualiza la última actividad
CREATE OR REPLACE FUNCTION public.tg_lead_comment_activity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.action = 'comment' THEN
    UPDATE public.leads SET last_activity_at = now() WHERE id = NEW.lead_id;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_lead_comment_activity AFTER INSERT ON public.lead_history
FOR EACH ROW EXECUTE FUNCTION public.tg_lead_comment_activity();

-- Auditoría general
CREATE TRIGGER trg_leads_audit AFTER INSERT OR UPDATE ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.tg_audit();