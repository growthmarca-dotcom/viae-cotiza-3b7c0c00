-- Adaptación multiagencia: marca por organización, organización en leads/clients
-- y acceso por pertenencia (aditivo; no se reescriben políticas existentes).

-- 1. Marca por organización -------------------------------------------------
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS primary_color TEXT,
  ADD COLUMN IF NOT EXISTS accent_color TEXT,
  ADD COLUMN IF NOT EXISTS footer_text TEXT,
  ADD COLUMN IF NOT EXISTS instagram TEXT,
  ADD COLUMN IF NOT EXISTS facebook TEXT;

-- 2. Organización propietaria en leads y clients ----------------------------
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL;
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_leads_organization_id ON public.leads(organization_id);
CREATE INDEX IF NOT EXISTS idx_clients_organization_id ON public.clients(organization_id);

-- 3. Acceso por pertenencia a la organización (políticas nuevas) ------------
-- leads
DROP POLICY IF EXISTS leads_org_member_select ON public.leads;
CREATE POLICY leads_org_member_select ON public.leads FOR SELECT TO authenticated
USING (organization_id IS NOT NULL AND public.is_member_of(auth.uid(), organization_id));

DROP POLICY IF EXISTS leads_org_member_update ON public.leads;
CREATE POLICY leads_org_member_update ON public.leads FOR UPDATE TO authenticated
USING (organization_id IS NOT NULL AND public.is_member_of(auth.uid(), organization_id))
WITH CHECK (organization_id IS NOT NULL AND public.is_member_of(auth.uid(), organization_id));

-- clients
DROP POLICY IF EXISTS clients_org_member_select ON public.clients;
CREATE POLICY clients_org_member_select ON public.clients FOR SELECT TO authenticated
USING (organization_id IS NOT NULL AND public.is_member_of(auth.uid(), organization_id));

DROP POLICY IF EXISTS clients_org_member_update ON public.clients;
CREATE POLICY clients_org_member_update ON public.clients FOR UPDATE TO authenticated
USING (organization_id IS NOT NULL AND public.is_member_of(auth.uid(), organization_id))
WITH CHECK (organization_id IS NOT NULL AND public.is_member_of(auth.uid(), organization_id));

-- opportunities
DROP POLICY IF EXISTS opportunities_org_member_select ON public.opportunities;
CREATE POLICY opportunities_org_member_select ON public.opportunities FOR SELECT TO authenticated
USING (public.is_member_of(auth.uid(), organization_id));

DROP POLICY IF EXISTS opportunities_org_member_update ON public.opportunities;
CREATE POLICY opportunities_org_member_update ON public.opportunities FOR UPDATE TO authenticated
USING (public.is_member_of(auth.uid(), organization_id))
WITH CHECK (public.is_member_of(auth.uid(), organization_id));

-- quotations
DROP POLICY IF EXISTS quotations_org_member_select ON public.quotations;
CREATE POLICY quotations_org_member_select ON public.quotations FOR SELECT TO authenticated
USING (public.is_member_of(auth.uid(), organization_id));

DROP POLICY IF EXISTS quotations_org_member_update ON public.quotations;
CREATE POLICY quotations_org_member_update ON public.quotations FOR UPDATE TO authenticated
USING (public.is_member_of(auth.uid(), organization_id))
WITH CHECK (public.is_member_of(auth.uid(), organization_id));

-- bookings
DROP POLICY IF EXISTS bookings_org_member_select ON public.bookings;
CREATE POLICY bookings_org_member_select ON public.bookings FOR SELECT TO authenticated
USING (public.is_member_of(auth.uid(), organization_id));

DROP POLICY IF EXISTS bookings_org_member_update ON public.bookings;
CREATE POLICY bookings_org_member_update ON public.bookings FOR UPDATE TO authenticated
USING (public.is_member_of(auth.uid(), organization_id))
WITH CHECK (public.is_member_of(auth.uid(), organization_id));

-- smart_quotes
DROP POLICY IF EXISTS smart_quotes_org_member_select ON public.smart_quotes;
CREATE POLICY smart_quotes_org_member_select ON public.smart_quotes FOR SELECT TO authenticated
USING (public.is_member_of(auth.uid(), organization_id));

DROP POLICY IF EXISTS smart_quotes_org_member_update ON public.smart_quotes;
CREATE POLICY smart_quotes_org_member_update ON public.smart_quotes FOR UPDATE TO authenticated
USING (public.is_member_of(auth.uid(), organization_id))
WITH CHECK (public.is_member_of(auth.uid(), organization_id));