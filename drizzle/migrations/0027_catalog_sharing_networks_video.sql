CREATE TYPE public.product_commercial_origin AS ENUM ('own','external');
CREATE TYPE public.product_visibility AS ENUM ('private','network','public');

CREATE TABLE public.agency_networks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.agency_networks TO authenticated;
GRANT ALL ON public.agency_networks TO service_role;
ALTER TABLE public.agency_networks ENABLE ROW LEVEL SECURITY;
CREATE POLICY agency_networks_read ON public.agency_networks FOR SELECT TO authenticated USING (true);
CREATE POLICY agency_networks_admin ON public.agency_networks FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
GRANT INSERT, UPDATE, DELETE ON public.agency_networks TO authenticated;

ALTER TABLE public.organizations ADD COLUMN network_id uuid REFERENCES public.agency_networks(id) ON DELETE SET NULL;
CREATE INDEX organizations_network_id_idx ON public.organizations(network_id);

ALTER TABLE public.products
  ADD COLUMN commercial_origin public.product_commercial_origin NOT NULL DEFAULT 'own',
  ADD COLUMN visibility public.product_visibility NOT NULL DEFAULT 'private',
  ADD COLUMN seller_commission_pct numeric(5,2),
  ADD COLUMN seller_commission_fixed numeric(14,2),
  ADD COLUMN sharing_declared_at timestamptz,
  ADD COLUMN sharing_declared_by uuid,
  ADD COLUMN video_url text;
COMMENT ON COLUMN public.products.seller_commission_fixed IS 'Preparado para comisión fija futura; no se usa todavía.';
UPDATE public.products SET commercial_origin = 'external' WHERE source_type <> 'manual' OR provider_id IS NOT NULL AND false;
CREATE INDEX products_visibility_idx ON public.products(visibility);

CREATE OR REPLACE FUNCTION public.tg_products_sharing_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.commercial_origin = 'external' AND NEW.visibility <> 'private' THEN
    RAISE EXCEPTION 'Los productos de proveedores externos o mayoristas no pueden compartirse.' USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.seller_commission_pct IS NOT NULL AND (NEW.seller_commission_pct < 0 OR NEW.seller_commission_pct > 100) THEN
    RAISE EXCEPTION 'La comisión debe estar entre 0 y 100%%.' USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.visibility <> 'private' THEN
    IF TG_OP = 'INSERT' OR OLD.visibility = 'private' OR NEW.sharing_declared_at IS NULL THEN
      IF NEW.sharing_declared_at IS NULL THEN
        RAISE EXCEPTION 'Para compartir el producto tenés que aceptar la declaración de derechos.' USING ERRCODE = 'check_violation';
      END IF;
      NEW.sharing_declared_by := auth.uid();
    END IF;
  END IF;
  IF NEW.video_url IS NOT NULL AND NEW.video_url !~* '^https?://' THEN
    RAISE EXCEPTION 'El video debe ser una dirección web (https://...).' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER products_sharing_guard BEFORE INSERT OR UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.tg_products_sharing_guard();

CREATE OR REPLACE FUNCTION public.can_read_shared_product(_org_id uuid, _visibility public.product_visibility)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE _visibility
    WHEN 'public' THEN EXISTS (SELECT 1 FROM organization_members m WHERE m.user_id = auth.uid() AND m.status = 'active')
    WHEN 'network' THEN EXISTS (
      SELECT 1 FROM organizations o JOIN organizations mine ON mine.network_id = o.network_id
      JOIN organization_members m ON m.organization_id = mine.id AND m.user_id = auth.uid() AND m.status = 'active'
      WHERE o.id = _org_id AND o.network_id IS NOT NULL)
    ELSE false END
$$;
REVOKE EXECUTE ON FUNCTION public.can_read_shared_product(uuid, public.product_visibility) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_read_shared_product(uuid, public.product_visibility) TO authenticated;

CREATE POLICY products_shared_read ON public.products FOR SELECT TO authenticated
  USING (status = 'active' AND public.can_read_shared_product(organization_id, visibility));

CREATE OR REPLACE FUNCTION public.can_read_product(_product_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.products pr WHERE pr.id = _product_id
      AND (public.has_role(auth.uid(),'admin') OR pr.user_id = auth.uid()
           OR public.is_member_of(auth.uid(), pr.organization_id)
           OR (pr.status = 'active' AND public.can_read_shared_product(pr.organization_id, pr.visibility)))
  );
$$;

CREATE POLICY "catalog images read for shared products" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'catalog-images' AND EXISTS (
  SELECT 1 FROM public.product_media pm
  WHERE pm.url = 'storage://catalog-images/' || storage.objects.name AND public.can_read_product(pm.product_id)));