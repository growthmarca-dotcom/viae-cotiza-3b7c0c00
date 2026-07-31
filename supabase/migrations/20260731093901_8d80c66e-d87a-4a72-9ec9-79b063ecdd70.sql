CREATE TYPE public.provider_type AS ENUM ('wholesaler','hotel','car_rental','transport_company','excursion_operator','independent_guide','gastronomy','nautical','air','ground','other');
CREATE TYPE public.provider_status AS ENUM ('active','inactive','suspended','archived');
CREATE TYPE public.provider_operation_mode AS ENUM ('manual','viae_portal','api','webhook','email','whatsapp','other');

CREATE TABLE public.providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  trade_name text NOT NULL,
  legal_name text,
  tax_id text,
  tax_condition text,
  provider_type public.provider_type NOT NULL DEFAULT 'other',
  operation_mode public.provider_operation_mode NOT NULL DEFAULT 'manual',
  is_company boolean NOT NULL DEFAULT true,
  website text,
  email text,
  whatsapp text,
  phone text,
  address text,
  city text,
  state text,
  country text,
  contact_name text,
  notes text,
  status public.provider_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.providers TO authenticated;
GRANT ALL ON public.providers TO service_role;
ALTER TABLE public.providers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "providers_select_auth" ON public.providers FOR SELECT TO authenticated USING (true);
CREATE POLICY "providers_insert_ops" ON public.providers FOR INSERT TO authenticated
  WITH CHECK (public.is_operations(auth.uid()) AND user_id = auth.uid());
CREATE POLICY "providers_update_ops" ON public.providers FOR UPDATE TO authenticated
  USING (public.is_operations(auth.uid())) WITH CHECK (public.is_operations(auth.uid()));

CREATE TRIGGER trg_providers_updated_at BEFORE UPDATE ON public.providers
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER trg_providers_audit AFTER INSERT OR UPDATE ON public.providers
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit();

CREATE INDEX idx_providers_status ON public.providers (status);
CREATE INDEX idx_providers_type ON public.providers (provider_type);

CREATE TABLE public.provider_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES public.providers(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  quality integer NOT NULL DEFAULT 3,
  punctuality integer NOT NULL DEFAULT 3,
  response_time integer NOT NULL DEFAULT 3,
  compliance integer NOT NULL DEFAULT 3,
  internal_rating integer NOT NULL DEFAULT 3,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.provider_evaluations TO authenticated;
GRANT ALL ON public.provider_evaluations TO service_role;
ALTER TABLE public.provider_evaluations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "provider_evaluations_select_ops" ON public.provider_evaluations FOR SELECT TO authenticated
  USING (public.is_operations(auth.uid()));
CREATE POLICY "provider_evaluations_insert_ops" ON public.provider_evaluations FOR INSERT TO authenticated
  WITH CHECK (public.is_operations(auth.uid()) AND user_id = auth.uid());
CREATE POLICY "provider_evaluations_update_ops" ON public.provider_evaluations FOR UPDATE TO authenticated
  USING (public.is_operations(auth.uid())) WITH CHECK (public.is_operations(auth.uid()));

CREATE TRIGGER trg_provider_evaluations_updated_at BEFORE UPDATE ON public.provider_evaluations
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER trg_provider_evaluations_audit AFTER INSERT OR UPDATE ON public.provider_evaluations
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit();

CREATE INDEX idx_provider_evaluations_provider ON public.provider_evaluations (provider_id);

ALTER TABLE public.resources ADD COLUMN provider_id uuid REFERENCES public.providers(id) ON DELETE SET NULL;
ALTER TABLE public.transport_services ADD COLUMN provider_id uuid REFERENCES public.providers(id) ON DELETE SET NULL;
ALTER TABLE public.booking_services ADD COLUMN provider_id uuid REFERENCES public.providers(id) ON DELETE SET NULL;

CREATE INDEX idx_resources_provider ON public.resources (provider_id);
CREATE INDEX idx_transport_services_provider ON public.transport_services (provider_id);
CREATE INDEX idx_booking_services_provider ON public.booking_services (provider_id);