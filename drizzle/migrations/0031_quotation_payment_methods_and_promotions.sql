CREATE TABLE public.promotions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  valid_from date,
  valid_to date,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.promotions TO authenticated;
GRANT ALL ON public.promotions TO service_role;
ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "promotions read" ON public.promotions FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR (organization_id IS NOT NULL AND public.is_member_of(auth.uid(), organization_id)));
CREATE POLICY "promotions insert" ON public.promotions FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR (organization_id IS NOT NULL AND public.is_member_of(auth.uid(), organization_id)));
CREATE POLICY "promotions update" ON public.promotions FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR (organization_id IS NOT NULL AND public.is_member_of(auth.uid(), organization_id)));
CREATE INDEX promotions_org_idx ON public.promotions(organization_id);

ALTER TABLE public.quotations
  ADD COLUMN payment_methods text[] NOT NULL DEFAULT '{}',
  ADD COLUMN promotion_id uuid REFERENCES public.promotions(id) ON DELETE SET NULL,
  ADD COLUMN promotion_title text,
  ADD COLUMN promotion_text text;