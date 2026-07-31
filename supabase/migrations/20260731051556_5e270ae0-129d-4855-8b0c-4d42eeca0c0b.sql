-- Enums
CREATE TYPE public.agent_status AS ENUM ('pending','training','active','suspended','inactive','archived');
CREATE TYPE public.commission_type AS ENUM ('percentage','fixed');
CREATE TYPE public.agent_access_status AS ENUM ('none','invited','linked');
CREATE TYPE public.agent_wa_status AS ENUM ('available','busy','offline');

CREATE TABLE public.agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid NOT NULL DEFAULT auth.uid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  first_name text NOT NULL,
  last_name text,
  company text,
  whatsapp text,
  email text,
  city text,
  state text,
  country text,
  languages text[] NOT NULL DEFAULT '{}'::text[],
  specialties text[] NOT NULL DEFAULT '{}'::text[],
  notes text,
  status public.agent_status NOT NULL DEFAULT 'pending',
  -- Perfil comercial (solo almacenamiento, sin cálculo)
  commission_type public.commission_type,
  commission_value numeric,
  commission_currency text NOT NULL DEFAULT 'USD',
  -- Acceso al sistema
  access_status public.agent_access_status NOT NULL DEFAULT 'none',
  invited_email text,
  invited_at timestamptz,
  -- Preparación WhatsApp (sin integración)
  wa_number text,
  wa_extension text,
  wa_status public.agent_wa_status NOT NULL DEFAULT 'offline',
  -- Preparación motor de asignación (sin lógica)
  main_zone text,
  priority integer NOT NULL DEFAULT 0,
  max_active_clients integer,
  max_open_opportunities integer,
  auto_receive_leads boolean NOT NULL DEFAULT false,
  available_for_assignment boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX agents_user_id_key ON public.agents (user_id) WHERE user_id IS NOT NULL;
CREATE INDEX agents_status_idx ON public.agents (status);

GRANT SELECT, INSERT, UPDATE ON public.agents TO authenticated;
GRANT ALL ON public.agents TO service_role;

ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;

-- Función helper: agente vinculado al usuario actual
CREATE OR REPLACE FUNCTION public.current_agent_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.agents WHERE user_id = auth.uid() LIMIT 1;
$$;

CREATE POLICY "admins manage agents" ON public.agents
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "agent reads own record" ON public.agents
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE TRIGGER trg_agents_updated_at
  BEFORE UPDATE ON public.agents
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Trazabilidad de la asignación de agentes en oportunidades
ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS assigned_at timestamptz,
  ADD COLUMN IF NOT EXISTS assigned_by uuid;

ALTER TABLE public.opportunities
  ADD CONSTRAINT opportunities_assigned_agent_id_fkey
  FOREIGN KEY (assigned_agent_id) REFERENCES public.agents(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.tg_opportunity_assignment_stamp()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.assigned_agent_id IS NOT NULL THEN
      NEW.assigned_at := now();
      NEW.assigned_by := auth.uid();
    END IF;
  ELSIF NEW.assigned_agent_id IS DISTINCT FROM OLD.assigned_agent_id THEN
    NEW.assigned_at := CASE WHEN NEW.assigned_agent_id IS NULL THEN NULL ELSE now() END;
    NEW.assigned_by := CASE WHEN NEW.assigned_agent_id IS NULL THEN NULL ELSE auth.uid() END;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_opportunity_assignment_stamp
  BEFORE INSERT OR UPDATE ON public.opportunities
  FOR EACH ROW EXECUTE FUNCTION public.tg_opportunity_assignment_stamp();

-- Un usuario vinculado a un agente puede leer las oportunidades asignadas a ese agente
CREATE POLICY "assigned agent reads opportunities" ON public.opportunities
  FOR SELECT TO authenticated
  USING (assigned_agent_id IS NOT NULL AND assigned_agent_id = public.current_agent_id());

-- ... y los clientes / cotizaciones vinculados a esas oportunidades
CREATE POLICY "assigned agent reads clients" ON public.clients
  FOR SELECT TO authenticated
  USING (
    public.current_agent_id() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.opportunities o
      WHERE o.client_id = clients.id
        AND o.assigned_agent_id = public.current_agent_id()
    )
  );

CREATE POLICY "assigned agent reads quotations" ON public.quotations
  FOR SELECT TO authenticated
  USING (
    public.current_agent_id() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.opportunities o
      WHERE o.quotation_id = quotations.id
        AND o.assigned_agent_id = public.current_agent_id()
    )
  );