-- v1.10.7.1 CRM 360 Base (Maestro de Personas)
DO $$ BEGIN
  CREATE TYPE public.person_role_type AS ENUM ('customer','passenger','agent','supplier_contact','driver','employee');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE public.persons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  first_name text,
  last_name text,
  email text,
  phone text,
  document_type text,
  document_number text,
  birth_date date,
  nationality text,
  language text,
  avatar_url text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.persons TO authenticated;
GRANT ALL ON public.persons TO service_role;
ALTER TABLE public.persons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "persons_select_authenticated" ON public.persons
  FOR SELECT TO authenticated USING (public.is_approved(auth.uid()));
CREATE POLICY "persons_insert_ops" ON public.persons
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.is_operations(auth.uid()));
CREATE POLICY "persons_update_ops" ON public.persons
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.is_operations(auth.uid()))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.is_operations(auth.uid()));
CREATE POLICY "persons_delete_admin" ON public.persons
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE INDEX idx_persons_organization_id ON public.persons(organization_id);
CREATE INDEX idx_persons_email ON public.persons(email);
CREATE INDEX idx_persons_document_number ON public.persons(document_number);

CREATE TRIGGER trg_persons_updated_at
  BEFORE UPDATE ON public.persons
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.person_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES public.persons(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  role_type public.person_role_type NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (person_id, organization_id, role_type)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.person_roles TO authenticated;
GRANT ALL ON public.person_roles TO service_role;
ALTER TABLE public.person_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "person_roles_select_authenticated" ON public.person_roles
  FOR SELECT TO authenticated USING (public.is_approved(auth.uid()));
CREATE POLICY "person_roles_write_ops" ON public.person_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.is_operations(auth.uid()))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.is_operations(auth.uid()));

CREATE INDEX idx_person_roles_person_id ON public.person_roles(person_id);
CREATE INDEX idx_person_roles_organization_id ON public.person_roles(organization_id);