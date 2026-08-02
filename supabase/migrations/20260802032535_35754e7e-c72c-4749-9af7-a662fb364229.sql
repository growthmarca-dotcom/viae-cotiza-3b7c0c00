DO $$ BEGIN
  CREATE TYPE public.agreement_type AS ENUM ('commission_percentage','fixed_commission','net_rate','service_fee','custom');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.agreement_status AS ENUM ('draft','active','expired','suspended','archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.commercial_agreements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  agent_id uuid REFERENCES public.agents(id) ON DELETE SET NULL,
  title text,
  agreement_type public.agreement_type NOT NULL DEFAULT 'commission_percentage',
  commission_type public.commission_type,
  commission_value numeric,
  currency text NOT NULL DEFAULT 'ARS',
  valid_from date,
  valid_until date,
  status public.agreement_status NOT NULL DEFAULT 'draft',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT commercial_agreements_target_check
    CHECK (organization_id IS NOT NULL OR agent_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS commercial_agreements_org_idx ON public.commercial_agreements(organization_id);
CREATE INDEX IF NOT EXISTS commercial_agreements_agent_idx ON public.commercial_agreements(agent_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.commercial_agreements TO authenticated;
GRANT ALL ON public.commercial_agreements TO service_role;

ALTER TABLE public.commercial_agreements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins gestionan acuerdos"
  ON public.commercial_agreements FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Operaciones consulta acuerdos"
  ON public.commercial_agreements FOR SELECT TO authenticated
  USING (public.is_operations(auth.uid()));

CREATE POLICY "Agentes consultan sus acuerdos"
  ON public.commercial_agreements FOR SELECT TO authenticated
  USING (agent_id IS NOT NULL AND agent_id = public.current_agent_id());

CREATE TRIGGER commercial_agreements_set_updated_at
  BEFORE UPDATE ON public.commercial_agreements
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TRIGGER commercial_agreements_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.commercial_agreements
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit();