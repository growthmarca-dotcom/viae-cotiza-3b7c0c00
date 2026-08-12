ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS opportunities_lead_id_unique
  ON public.opportunities (lead_id) WHERE lead_id IS NOT NULL;