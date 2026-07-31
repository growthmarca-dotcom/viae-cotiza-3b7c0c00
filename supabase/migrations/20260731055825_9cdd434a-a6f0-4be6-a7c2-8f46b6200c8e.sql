
-- ENUMS
CREATE TYPE public.company_kind AS ENUM ('internal','external');
CREATE TYPE public.resource_category AS ENUM ('accommodation','room','vehicle','driver','taxi','transfer','excursion','guide','insurance','rental','tourism_service','agent','other');
CREATE TYPE public.resource_availability AS ENUM ('available','busy','unavailable','out_of_service');
CREATE TYPE public.agent_availability AS ENUM ('available','busy','unavailable','off_hours');

-- COMPANIES
CREATE TABLE public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  kind public.company_kind NOT NULL DEFAULT 'external',
  contact_name text,
  whatsapp text,
  email text,
  city text,
  state text,
  country text,
  notes text,
  record_status public.record_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.companies TO authenticated;
GRANT ALL ON public.companies TO service_role;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "companies_select" ON public.companies FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "companies_insert" ON public.companies FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "companies_update" ON public.companies FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- RESOURCES
CREATE TABLE public.resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  agent_id uuid REFERENCES public.agents(id) ON DELETE SET NULL,
  name text NOT NULL,
  category public.resource_category NOT NULL DEFAULT 'other',
  kind public.company_kind NOT NULL DEFAULT 'external',
  main_zone text,
  zones text[] NOT NULL DEFAULT '{}',
  specialties text[] NOT NULL DEFAULT '{}',
  description text,
  contact_name text,
  whatsapp text,
  email text,
  availability public.resource_availability NOT NULL DEFAULT 'available',
  pax_capacity integer,
  unit_count integer,
  operating_limit integer,
  notes text,
  record_status public.record_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.resources TO authenticated;
GRANT ALL ON public.resources TO service_role;
ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "resources_select" ON public.resources FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "resources_insert" ON public.resources FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "resources_update" ON public.resources FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE INDEX idx_resources_company ON public.resources(company_id);
CREATE INDEX idx_resources_category ON public.resources(category);

-- BOOKING RESOURCES
CREATE TABLE public.booking_resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  resource_id uuid NOT NULL REFERENCES public.resources(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL,
  assigned_by uuid,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  notes text,
  record_status public.record_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.booking_resources TO authenticated;
GRANT ALL ON public.booking_resources TO service_role;
ALTER TABLE public.booking_resources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "booking_resources_select" ON public.booking_resources FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin')
    OR EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = booking_id AND b.assigned_agent_id = public.current_agent_id()));
CREATE POLICY "booking_resources_insert" ON public.booking_resources FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "booking_resources_update" ON public.booking_resources FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE INDEX idx_booking_resources_booking ON public.booking_resources(booking_id);

-- AGENT QUICK AVAILABILITY
ALTER TABLE public.agents ADD COLUMN availability public.agent_availability NOT NULL DEFAULT 'available';

-- TIMESTAMPS + AUDIT
CREATE TRIGGER tg_companies_updated_at BEFORE UPDATE ON public.companies FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER tg_resources_updated_at BEFORE UPDATE ON public.resources FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER tg_booking_resources_updated_at BEFORE UPDATE ON public.booking_resources FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TRIGGER tg_companies_audit AFTER INSERT OR UPDATE ON public.companies FOR EACH ROW EXECUTE FUNCTION public.tg_audit();
CREATE TRIGGER tg_resources_audit AFTER INSERT OR UPDATE ON public.resources FOR EACH ROW EXECUTE FUNCTION public.tg_audit();
CREATE TRIGGER tg_booking_resources_audit AFTER INSERT OR UPDATE ON public.booking_resources FOR EACH ROW EXECUTE FUNCTION public.tg_audit();
