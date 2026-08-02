-- ============================================================
-- v1.10.0 — Inventario Global · Fase A (solo estructura)
-- No modifica bookings, booking_services, transport_services,
-- resources, tariffs, availability, commissions ni el Expediente 360°.
-- ============================================================

DO $$ BEGIN
  CREATE TYPE public.product_category AS ENUM
    ('accommodation','activity','excursion','transfer','rental','package','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.product_status AS ENUM ('draft','active','inactive','archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.product_media_type AS ENUM ('image','video','document');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ------------------------------------------------------------
-- 1) products
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  category public.product_category NOT NULL DEFAULT 'other',
  name text NOT NULL,
  description text,
  short_description text,
  status public.product_status NOT NULL DEFAULT 'draft',
  country text,
  state text,
  city text,
  latitude numeric(9,6),
  longitude numeric(9,6),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS products_owner_idx ON public.products(user_id);
CREATE INDEX IF NOT EXISTS products_org_idx ON public.products(organization_id);
CREATE INDEX IF NOT EXISTS products_category_idx ON public.products(category);
CREATE INDEX IF NOT EXISTS products_status_idx ON public.products(status);
CREATE INDEX IF NOT EXISTS products_location_idx ON public.products(country, state, city);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "products_admin_all" ON public.products
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "products_owner_manage" ON public.products
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "products_provider_manage" ON public.products
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.providers p
      WHERE p.organization_id = products.organization_id
        AND p.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.providers p
      WHERE p.organization_id = products.organization_id
        AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "products_staff_read" ON public.products
  FOR SELECT TO authenticated
  USING (public.is_operations(auth.uid()) OR public.has_role(auth.uid(), 'agent'));

CREATE TRIGGER products_set_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ------------------------------------------------------------
-- helper: acceso de escritura a un producto
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_manage_product(_product_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.products pr
    WHERE pr.id = _product_id
      AND (
        public.has_role(auth.uid(), 'admin')
        OR pr.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.providers p
          WHERE p.organization_id = pr.organization_id
            AND p.user_id = auth.uid()
        )
      )
  )
$$;

-- ------------------------------------------------------------
-- 2) product_variants
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.product_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  capacity_min integer NOT NULL DEFAULT 1,
  capacity_max integer,
  duration_minutes integer,
  status public.product_status NOT NULL DEFAULT 'draft',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT product_variants_capacity_check
    CHECK (capacity_min >= 0 AND (capacity_max IS NULL OR capacity_max >= capacity_min)),
  CONSTRAINT product_variants_duration_check
    CHECK (duration_minutes IS NULL OR duration_minutes >= 0)
);
CREATE INDEX IF NOT EXISTS product_variants_product_idx ON public.product_variants(product_id);
CREATE INDEX IF NOT EXISTS product_variants_status_idx ON public.product_variants(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_variants TO authenticated;
GRANT ALL ON public.product_variants TO service_role;
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "product_variants_manage" ON public.product_variants
  FOR ALL TO authenticated
  USING (public.can_manage_product(product_id))
  WITH CHECK (public.can_manage_product(product_id));

CREATE POLICY "product_variants_staff_read" ON public.product_variants
  FOR SELECT TO authenticated
  USING (public.is_operations(auth.uid()) OR public.has_role(auth.uid(), 'agent'));

CREATE TRIGGER product_variants_set_updated_at
  BEFORE UPDATE ON public.product_variants
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ------------------------------------------------------------
-- 3) product_categories (catálogo configurable)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.product_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS product_categories_active_idx ON public.product_categories(active);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_categories TO authenticated;
GRANT ALL ON public.product_categories TO service_role;
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "product_categories_admin_all" ON public.product_categories
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "product_categories_read" ON public.product_categories
  FOR SELECT TO authenticated
  USING (true);

CREATE TRIGGER product_categories_set_updated_at
  BEFORE UPDATE ON public.product_categories
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

INSERT INTO public.product_categories (code, name, description) VALUES
  ('accommodation','Alojamiento','Hoteles, apart hoteles, cabañas y habitaciones'),
  ('activity','Actividad','Actividades y experiencias'),
  ('excursion','Excursión','Excursiones regulares, premium y privadas'),
  ('transfer','Traslado','Traslados vendibles al pasajero'),
  ('rental','Alquiler','Rent a car y alquiler de equipos'),
  ('package','Paquete','Combinaciones comercializables'),
  ('other','Otro','Otros servicios turísticos')
ON CONFLICT (code) DO NOTHING;

-- ------------------------------------------------------------
-- 4) product_attributes
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.product_attributes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  attribute_key text NOT NULL,
  attribute_value text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS product_attributes_unique_idx
  ON public.product_attributes(product_id, attribute_key);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_attributes TO authenticated;
GRANT ALL ON public.product_attributes TO service_role;
ALTER TABLE public.product_attributes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "product_attributes_manage" ON public.product_attributes
  FOR ALL TO authenticated
  USING (public.can_manage_product(product_id))
  WITH CHECK (public.can_manage_product(product_id));

CREATE POLICY "product_attributes_staff_read" ON public.product_attributes
  FOR SELECT TO authenticated
  USING (public.is_operations(auth.uid()) OR public.has_role(auth.uid(), 'agent'));

CREATE TRIGGER product_attributes_set_updated_at
  BEFORE UPDATE ON public.product_attributes
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ------------------------------------------------------------
-- 5) product_media
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.product_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  type public.product_media_type NOT NULL DEFAULT 'image',
  url text NOT NULL,
  title text,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS product_media_product_idx
  ON public.product_media(product_id, order_index);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_media TO authenticated;
GRANT ALL ON public.product_media TO service_role;
ALTER TABLE public.product_media ENABLE ROW LEVEL SECURITY;

CREATE POLICY "product_media_manage" ON public.product_media
  FOR ALL TO authenticated
  USING (public.can_manage_product(product_id))
  WITH CHECK (public.can_manage_product(product_id));

CREATE POLICY "product_media_staff_read" ON public.product_media
  FOR SELECT TO authenticated
  USING (public.is_operations(auth.uid()) OR public.has_role(auth.uid(), 'agent'));