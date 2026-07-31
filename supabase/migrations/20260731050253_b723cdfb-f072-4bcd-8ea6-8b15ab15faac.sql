CREATE TYPE public.opportunity_stage AS ENUM ('new','contacted','quoted','following_up','negotiating','booked','completed','lost','cancelled');
CREATE TYPE public.lead_source AS ENUM ('website','whatsapp','instagram','facebook','google','referral','existing_client','other');

CREATE TABLE public.opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  quotation_id uuid REFERENCES public.quotations(id) ON DELETE SET NULL,
  title text NOT NULL DEFAULT 'Oportunidad',
  stage public.opportunity_stage NOT NULL DEFAULT 'new',
  lead_source public.lead_source NOT NULL DEFAULT 'other',
  estimated_value numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  probability integer NOT NULL DEFAULT 0,
  next_action text,
  next_contact_date date,
  owner_user_id uuid NOT NULL,
  assigned_agent_id uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX opportunities_client_idx ON public.opportunities (client_id, created_at DESC);
CREATE INDEX opportunities_user_idx ON public.opportunities (user_id, created_at DESC);
CREATE UNIQUE INDEX opportunities_quotation_uidx ON public.opportunities (quotation_id) WHERE quotation_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.opportunities TO authenticated;
GRANT ALL ON public.opportunities TO service_role;

ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own opportunities all" ON public.opportunities FOR ALL TO authenticated
USING ((auth.uid() = user_id) AND (public.is_approved(auth.uid()) OR public.has_role(auth.uid(),'admin'::app_role)))
WITH CHECK ((auth.uid() = user_id) AND (public.is_approved(auth.uid()) OR public.has_role(auth.uid(),'admin'::app_role)));

CREATE POLICY "admins read all opportunities" ON public.opportunities FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'admin'::app_role));

CREATE TRIGGER trg_opportunities_updated_at BEFORE UPDATE ON public.opportunities
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE OR REPLACE FUNCTION public.validate_opportunity()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.probability < 0 OR NEW.probability > 100 THEN
    RAISE EXCEPTION 'La probabilidad de cierre debe estar entre 0 y 100.';
  END IF;
  IF NEW.owner_user_id IS NULL THEN NEW.owner_user_id := NEW.user_id; END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_opportunities_validate BEFORE INSERT OR UPDATE ON public.opportunities
FOR EACH ROW EXECUTE FUNCTION public.validate_opportunity();