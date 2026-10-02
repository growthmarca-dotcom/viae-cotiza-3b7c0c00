CREATE OR REPLACE FUNCTION public.can_manage_package_template(_template_id uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.package_templates t
    WHERE t.id = _template_id
      AND (public.has_role(auth.uid(),'admin')
        OR (t.organization_id IS NOT NULL AND public.is_member_of(auth.uid(), t.organization_id))
        OR (t.organization_id IS NULL AND t.user_id = auth.uid()))
  )
$$;

CREATE OR REPLACE FUNCTION public.can_read_package_template(_template_id uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT public.can_manage_package_template(_template_id) $$;

DROP POLICY IF EXISTS "Owners manage own package templates" ON public.package_templates;
DROP POLICY IF EXISTS "Staff read package templates" ON public.package_templates;

CREATE POLICY "Org members manage package templates" ON public.package_templates
  FOR ALL TO authenticated
  USING (organization_id IS NOT NULL AND public.is_member_of(auth.uid(), organization_id))
  WITH CHECK (organization_id IS NOT NULL AND public.is_member_of(auth.uid(), organization_id));

DROP POLICY IF EXISTS "Read package template items" ON public.package_template_items;
CREATE POLICY "Read package template items" ON public.package_template_items
  FOR SELECT TO authenticated USING (public.can_read_package_template(package_template_id));

ALTER TABLE public.quotations
  ADD COLUMN IF NOT EXISTS package_template_id uuid REFERENCES public.package_templates(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS quotations_package_template_idx ON public.quotations(package_template_id, created_at DESC);
COMMENT ON COLUMN public.quotations.package_template_id IS 'Paquete aplicado al armar la cotización. Solo referencia histórica: la cotización no depende del paquete.';