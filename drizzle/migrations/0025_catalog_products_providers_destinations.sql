-- Catálogo ViaE: extiende el Inventario Global existente (products) en lugar de crear una arquitectura paralela.
ALTER TYPE public.product_category ADD VALUE IF NOT EXISTS 'insurance';
ALTER TYPE public.product_category ADD VALUE IF NOT EXISTS 'flight';

CREATE TYPE public.product_source_type AS ENUM ('manual','api','feed','import','other');
CREATE TYPE public.provider_source_kind AS ENUM ('direct','wholesaler_b2b','platform','api','other');

-- Proveedores / fuentes: se reutiliza public.providers y se agrega la naturaleza de la fuente.
ALTER TABLE public.providers
  ADD COLUMN source_kind public.provider_source_kind NOT NULL DEFAULT 'direct';
COMMENT ON COLUMN public.providers.source_kind IS 'Naturaleza de la fuente: proveedor directo, mayorista B2B, plataforma, API u otra. Independiente de la categoría de los productos.';

-- Destinos reutilizables. organization_id NULL = destino compartido de la plataforma.
CREATE TABLE public.destinations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  state text,
  country text NOT NULL DEFAULT 'Argentina',
  active boolean NOT NULL DEFAULT true,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT destinations_name_not_blank CHECK (length(btrim(name)) > 0)
);
CREATE UNIQUE INDEX destinations_unique_name ON public.destinations
  (COALESCE(organization_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(btrim(name)));
CREATE INDEX destinations_org_idx ON public.destinations(organization_id);
GRANT SELECT, INSERT, UPDATE ON public.destinations TO authenticated;
GRANT ALL ON public.destinations TO service_role;
ALTER TABLE public.destinations ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER destinations_set_updated_at BEFORE UPDATE ON public.destinations
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

INSERT INTO public.destinations (organization_id, name, state, country, created_by) VALUES
  (NULL, 'Bariloche', 'Río Negro', 'Argentina', NULL),
  (NULL, 'San Martín de los Andes', 'Neuquén', 'Argentina', NULL),
  (NULL, 'Villa La Angostura', 'Neuquén', 'Argentina', NULL),
  (NULL, 'El Bolsón', 'Río Negro', 'Argentina', NULL);

-- Quién puede editar el catálogo de una organización.
CREATE OR REPLACE FUNCTION public.can_edit_org_catalog(_org_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.organization_members m
      WHERE m.user_id = auth.uid() AND m.organization_id = _org_id AND m.status = 'active'
        AND m.role IN ('organization_owner','organization_admin','operations','agent')
    );
$$;
REVOKE EXECUTE ON FUNCTION public.can_edit_org_catalog(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_edit_org_catalog(uuid) TO authenticated;

CREATE POLICY destinations_read ON public.destinations FOR SELECT TO authenticated
  USING (organization_id IS NULL OR public.has_role(auth.uid(),'admin') OR public.is_member_of(auth.uid(), organization_id));
CREATE POLICY destinations_insert ON public.destinations FOR INSERT TO authenticated
  WITH CHECK ((organization_id IS NULL AND public.has_role(auth.uid(),'admin')) OR (organization_id IS NOT NULL AND public.can_edit_org_catalog(organization_id)));
CREATE POLICY destinations_update ON public.destinations FOR UPDATE TO authenticated
  USING ((organization_id IS NULL AND public.has_role(auth.uid(),'admin')) OR (organization_id IS NOT NULL AND public.can_edit_org_catalog(organization_id)))
  WITH CHECK ((organization_id IS NULL AND public.has_role(auth.uid(),'admin')) OR (organization_id IS NOT NULL AND public.can_edit_org_catalog(organization_id)));

-- Productos: datos comerciales, origen e identificación externa futura.
ALTER TABLE public.products
  ADD COLUMN provider_id uuid REFERENCES public.providers(id) ON DELETE SET NULL,
  ADD COLUMN internal_code text,
  ADD COLUMN external_code text,
  ADD COLUMN source_type public.product_source_type NOT NULL DEFAULT 'manual',
  ADD COLUMN external_provider_id text,
  ADD COLUMN external_product_id text,
  ADD COLUMN last_synced_at timestamptz,
  ADD COLUMN cost_amount numeric(12,2),
  ADD COLUMN sale_amount numeric(12,2),
  ADD COLUMN currency text NOT NULL DEFAULT 'USD',
  ADD COLUMN internal_notes text,
  ADD CONSTRAINT products_cost_nonneg CHECK (cost_amount IS NULL OR cost_amount >= 0),
  ADD CONSTRAINT products_sale_nonneg CHECK (sale_amount IS NULL OR sale_amount >= 0);
CREATE INDEX products_provider_idx ON public.products(provider_id);
CREATE INDEX products_source_idx ON public.products(source_type);
CREATE UNIQUE INDEX products_internal_code_unique ON public.products(organization_id, lower(internal_code)) WHERE internal_code IS NOT NULL;
COMMENT ON COLUMN public.products.external_provider_id IS 'Identificador del proveedor en el sistema externo (futuras integraciones). Sin lógica de sincronización.';
COMMENT ON COLUMN public.products.metadata IS 'Campos específicos por categoría (alojamiento, excursión, vehículo) y estructuras futuras.';

-- Relación producto ↔ destinos.
CREATE TABLE public.product_destinations (
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  destination_id uuid NOT NULL REFERENCES public.destinations(id) ON DELETE CASCADE,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (product_id, destination_id)
);
CREATE INDEX product_destinations_destination_idx ON public.product_destinations(destination_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_destinations TO authenticated;
GRANT ALL ON public.product_destinations TO service_role;
ALTER TABLE public.product_destinations ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.product_media ADD COLUMN is_primary boolean NOT NULL DEFAULT false;

-- Lectura/gestión por organización (multiagencia).
CREATE OR REPLACE FUNCTION public.can_read_product(_product_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.products pr WHERE pr.id = _product_id
      AND (public.has_role(auth.uid(),'admin') OR pr.user_id = auth.uid()
           OR public.is_member_of(auth.uid(), pr.organization_id))
  );
$$;
REVOKE EXECUTE ON FUNCTION public.can_read_product(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_read_product(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.can_manage_product(_product_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.products pr
    WHERE pr.id = _product_id
      AND (
        public.has_role(auth.uid(), 'admin')
        OR pr.user_id = auth.uid()
        OR public.can_edit_org_catalog(pr.organization_id)
        OR EXISTS (
          SELECT 1 FROM public.providers p
          WHERE p.organization_id = pr.organization_id
            AND p.user_id = auth.uid()
        )
      )
  );
$$;

-- products estaba vacía: se reemplaza la lectura global por lectura por organización.
DROP POLICY IF EXISTS products_staff_read ON public.products;
CREATE POLICY products_member_read ON public.products FOR SELECT TO authenticated
  USING (public.is_member_of(auth.uid(), organization_id));
CREATE POLICY products_member_manage ON public.products FOR ALL TO authenticated
  USING (public.can_edit_org_catalog(organization_id))
  WITH CHECK (public.can_edit_org_catalog(organization_id));

DROP POLICY IF EXISTS product_media_staff_read ON public.product_media;
CREATE POLICY product_media_member_read ON public.product_media FOR SELECT TO authenticated
  USING (public.can_read_product(product_id));
DROP POLICY IF EXISTS product_attributes_staff_read ON public.product_attributes;
CREATE POLICY product_attributes_member_read ON public.product_attributes FOR SELECT TO authenticated
  USING (public.can_read_product(product_id));

CREATE POLICY product_destinations_read ON public.product_destinations FOR SELECT TO authenticated
  USING (public.can_read_product(product_id));
CREATE POLICY product_destinations_manage ON public.product_destinations FOR ALL TO authenticated
  USING (public.can_manage_product(product_id))
  WITH CHECK (public.can_manage_product(product_id));