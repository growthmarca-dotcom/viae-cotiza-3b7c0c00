-- 1. Enums
DO $$ BEGIN
  CREATE TYPE public.organization_member_role AS ENUM ('organization_owner','organization_admin','operations','agent','provider','driver','viewer');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.organization_member_status AS ENUM ('active','pending','inactive','suspended');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Tabla
CREATE TABLE IF NOT EXISTS public.organization_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role public.organization_member_role NOT NULL DEFAULT 'viewer',
  status public.organization_member_status NOT NULL DEFAULT 'active',
  is_owner boolean NOT NULL DEFAULT false,
  invited_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT organization_members_user_org_unique UNIQUE (user_id, organization_id)
);

CREATE INDEX IF NOT EXISTS idx_organization_members_org ON public.organization_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_organization_members_user ON public.organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_organization_members_role ON public.organization_members(organization_id, role);

-- 3. Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_members TO authenticated;
GRANT ALL ON public.organization_members TO service_role;

-- 4. Trigger updated_at (reutiliza patrón existente)
DROP TRIGGER IF EXISTS trg_organization_members_updated_at ON public.organization_members;
CREATE TRIGGER trg_organization_members_updated_at
  BEFORE UPDATE ON public.organization_members
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 5. Helpers de seguridad
CREATE OR REPLACE FUNCTION public.is_member_of(_user_id uuid, _org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = _user_id
      AND organization_id = _org_id
      AND status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.has_org_role(_user_id uuid, _org_id uuid, _role text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = _user_id
      AND organization_id = _org_id
      AND status = 'active'
      AND role::text = _role
  );
$$;

CREATE OR REPLACE FUNCTION public.can_manage_organization_members(_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.has_role(auth.uid(), 'admin')
      OR public.is_operations(auth.uid())
      OR public.has_org_role(auth.uid(), _org_id, 'organization_owner')
      OR public.has_org_role(auth.uid(), _org_id, 'organization_admin');
$$;

-- 6. RLS
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS organization_members_select ON public.organization_members;
CREATE POLICY organization_members_select ON public.organization_members
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR (
      public.is_approved(auth.uid())
      AND (
        public.has_role(auth.uid(), 'admin')
        OR public.is_operations(auth.uid())
        OR public.is_member_of(auth.uid(), organization_id)
      )
    )
  );

DROP POLICY IF EXISTS organization_members_insert ON public.organization_members;
CREATE POLICY organization_members_insert ON public.organization_members
  FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_organization_members(organization_id));

DROP POLICY IF EXISTS organization_members_update ON public.organization_members;
CREATE POLICY organization_members_update ON public.organization_members
  FOR UPDATE TO authenticated
  USING (public.can_manage_organization_members(organization_id))
  WITH CHECK (public.can_manage_organization_members(organization_id));

DROP POLICY IF EXISTS organization_members_delete ON public.organization_members;
CREATE POLICY organization_members_delete ON public.organization_members
  FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_org_role(auth.uid(), organization_id, 'organization_owner')
  );

-- 7. Backfill seguro (idempotente)
INSERT INTO public.organization_members (organization_id, user_id, role, status, is_owner)
SELECT o.id, o.user_id, 'organization_owner'::public.organization_member_role, 'active'::public.organization_member_status, true
FROM public.organizations o
WHERE o.user_id IS NOT NULL
ON CONFLICT (user_id, organization_id) DO NOTHING;

INSERT INTO public.organization_members (organization_id, user_id, role, status, is_owner)
SELECT DISTINCT o.id, a.user_id, 'agent'::public.organization_member_role, 'active'::public.organization_member_status, false
FROM public.agents a
JOIN public.organizations o ON o.user_id = a.created_by
WHERE a.user_id IS NOT NULL
  AND a.access_status = 'linked'
ON CONFLICT (user_id, organization_id) DO NOTHING;