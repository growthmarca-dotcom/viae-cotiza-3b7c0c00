-- 1) Enums
DO $$ BEGIN
  CREATE TYPE public.organization_role AS ENUM ('provider','agency','wholesaler','corporate_client','partner');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) Tabla central
CREATE TABLE IF NOT EXISTS public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  legal_name text,
  trade_name text NOT NULL,
  tax_id_type text,
  tax_id text,
  tax_condition text,
  country text,
  state text,
  city text,
  address text,
  postal_code text,
  phone text,
  whatsapp text,
  email text,
  website text,
  logo_path text,
  contact_name text,
  status record_status NOT NULL DEFAULT 'active',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.organizations TO authenticated;
GRANT ALL ON public.organizations TO service_role;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_select_authenticated" ON public.organizations
  FOR SELECT TO authenticated USING (public.is_approved(auth.uid()));
CREATE POLICY "org_insert_ops" ON public.organizations
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.is_operations(auth.uid()));
CREATE POLICY "org_update_ops" ON public.organizations
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.is_operations(auth.uid()))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.is_operations(auth.uid()));
CREATE POLICY "org_delete_admin" ON public.organizations
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_org_updated_at BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER trg_org_audit AFTER INSERT OR UPDATE OR DELETE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit();

CREATE UNIQUE INDEX IF NOT EXISTS organizations_tax_id_key ON public.organizations (lower(tax_id)) WHERE tax_id IS NOT NULL AND tax_id <> '';
CREATE INDEX IF NOT EXISTS organizations_trade_name_idx ON public.organizations (lower(trade_name));

-- 3) Roles de organización
CREATE TABLE IF NOT EXISTS public.organization_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  role public.organization_role NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, role)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_roles TO authenticated;
GRANT ALL ON public.organization_roles TO service_role;
ALTER TABLE public.organization_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "orgrole_select_authenticated" ON public.organization_roles
  FOR SELECT TO authenticated USING (public.is_approved(auth.uid()));
CREATE POLICY "orgrole_write_ops" ON public.organization_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.is_operations(auth.uid()))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.is_operations(auth.uid()));

CREATE TRIGGER trg_orgrole_updated_at BEFORE UPDATE ON public.organization_roles
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER trg_orgrole_audit AFTER INSERT OR UPDATE OR DELETE ON public.organization_roles
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit();

-- 4) Referencias progresivas
ALTER TABLE public.companies         ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL;
ALTER TABLE public.providers         ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL;
ALTER TABLE public.resources         ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL;
ALTER TABLE public.transport_services ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL;
ALTER TABLE public.booking_services  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL;
ALTER TABLE public.bookings          ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS resources_organization_idx ON public.resources(organization_id);
CREATE INDEX IF NOT EXISTS transport_services_organization_idx ON public.transport_services(organization_id);
CREATE INDEX IF NOT EXISTS booking_services_organization_idx ON public.booking_services(organization_id);
CREATE INDEX IF NOT EXISTS bookings_organization_idx ON public.bookings(organization_id);
CREATE INDEX IF NOT EXISTS providers_organization_idx ON public.providers(organization_id);

-- 5) Migración segura companies -> organizations (sin borrar nada)
DO $$
DECLARE c RECORD; v_org uuid;
BEGIN
  FOR c IN SELECT * FROM public.companies WHERE organization_id IS NULL LOOP
    SELECT o.id INTO v_org FROM public.organizations o
    WHERE lower(o.trade_name) = lower(c.name)
       OR (c.email IS NOT NULL AND c.email <> '' AND lower(o.email) = lower(c.email))
    LIMIT 1;

    IF v_org IS NULL THEN
      INSERT INTO public.organizations (user_id, trade_name, legal_name, country, state, city,
                                        whatsapp, email, contact_name, notes, status)
      VALUES (c.user_id, c.name, c.name, c.country, c.state, c.city,
              c.whatsapp, c.email, c.contact_name, c.notes, c.record_status)
      RETURNING id INTO v_org;

      INSERT INTO public.organization_roles (organization_id, role)
      VALUES (v_org, 'provider') ON CONFLICT DO NOTHING;
    END IF;

    UPDATE public.companies SET organization_id = v_org WHERE id = c.id;
  END LOOP;
END $$;

-- 6) Migración segura providers -> organizations
DO $$
DECLARE p RECORD; v_org uuid;
BEGIN
  FOR p IN SELECT * FROM public.providers WHERE organization_id IS NULL LOOP
    SELECT o.id INTO v_org FROM public.organizations o
    WHERE (p.tax_id IS NOT NULL AND p.tax_id <> '' AND lower(o.tax_id) = lower(p.tax_id))
       OR lower(o.trade_name) = lower(p.trade_name)
       OR (p.email IS NOT NULL AND p.email <> '' AND lower(o.email) = lower(p.email))
    LIMIT 1;

    IF v_org IS NULL THEN
      INSERT INTO public.organizations (user_id, trade_name, legal_name, tax_id, tax_condition,
                                        country, state, city, address, phone, whatsapp, email,
                                        website, contact_name, notes, status)
      VALUES (p.user_id, p.trade_name, p.legal_name, NULLIF(p.tax_id,''), p.tax_condition,
              p.country, p.state, p.city, p.address, p.phone, p.whatsapp, p.email,
              p.website, p.contact_name, p.notes,
              CASE p.status::text WHEN 'active' THEN 'active' WHEN 'archived' THEN 'archived'
                                  WHEN 'suspended' THEN 'suspended' ELSE 'inactive' END::record_status)
      RETURNING id INTO v_org;
    END IF;

    INSERT INTO public.organization_roles (organization_id, role)
    VALUES (v_org, 'provider') ON CONFLICT DO NOTHING;

    UPDATE public.providers SET organization_id = v_org WHERE id = p.id;
  END LOOP;
END $$;

-- 7) Propagar organization_id desde relaciones existentes
UPDATE public.resources r SET organization_id = p.organization_id
FROM public.providers p WHERE r.provider_id = p.id AND r.organization_id IS NULL;

UPDATE public.resources r SET organization_id = c.organization_id
FROM public.companies c WHERE r.company_id = c.id AND r.organization_id IS NULL;

UPDATE public.transport_services t SET organization_id = c.organization_id
FROM public.companies c WHERE t.company_id = c.id AND t.organization_id IS NULL;

UPDATE public.transport_services t SET organization_id = p.organization_id
FROM public.providers p WHERE t.provider_id = p.id AND t.organization_id IS NULL;

UPDATE public.booking_services b SET organization_id = c.organization_id
FROM public.companies c WHERE b.company_id = c.id AND b.organization_id IS NULL;

UPDATE public.booking_services b SET organization_id = p.organization_id
FROM public.providers p WHERE b.provider_id = p.id AND b.organization_id IS NULL;

UPDATE public.bookings b SET organization_id = p.organization_id
FROM public.providers p WHERE b.provider_id = p.id AND b.organization_id IS NULL;

-- 8) Helper: asegurar organización para un proveedor existente
CREATE OR REPLACE FUNCTION public.ensure_provider_organization(_provider_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE p RECORD; v_org uuid;
BEGIN
  SELECT * INTO p FROM public.providers WHERE id = _provider_id;
  IF p.id IS NULL THEN RETURN NULL; END IF;
  IF p.organization_id IS NOT NULL THEN RETURN p.organization_id; END IF;

  SELECT o.id INTO v_org FROM public.organizations o
  WHERE (p.tax_id IS NOT NULL AND p.tax_id <> '' AND lower(o.tax_id) = lower(p.tax_id))
     OR lower(o.trade_name) = lower(p.trade_name)
  LIMIT 1;

  IF v_org IS NULL THEN
    INSERT INTO public.organizations (user_id, trade_name, legal_name, tax_id, tax_condition,
                                      country, state, city, address, phone, whatsapp, email,
                                      website, contact_name, notes)
    VALUES (p.user_id, p.trade_name, p.legal_name, NULLIF(p.tax_id,''), p.tax_condition,
            p.country, p.state, p.city, p.address, p.phone, p.whatsapp, p.email,
            p.website, p.contact_name, p.notes)
    RETURNING id INTO v_org;
  END IF;

  INSERT INTO public.organization_roles (organization_id, role) VALUES (v_org, 'provider')
  ON CONFLICT DO NOTHING;
  UPDATE public.providers SET organization_id = v_org WHERE id = p.id;
  RETURN v_org;
END; $$;