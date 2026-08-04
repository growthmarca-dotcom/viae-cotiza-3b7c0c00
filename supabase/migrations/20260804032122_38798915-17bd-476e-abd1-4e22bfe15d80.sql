-- v1.10.7.2.1.4 Booking Organization Enforcement Layer

CREATE OR REPLACE FUNCTION public.can_create_booking_for_organization(
  _user_id uuid,
  _org_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN _user_id IS NULL OR _org_id IS NULL THEN false
    WHEN public.has_role(_user_id, 'admin'::app_role) THEN true
    ELSE EXISTS (
      SELECT 1
      FROM public.organization_members m
      WHERE m.user_id = _user_id
        AND m.organization_id = _org_id
        AND m.status = 'active'
        AND m.role IN (
          'organization_owner'::organization_member_role,
          'organization_admin'::organization_member_role,
          'operations'::organization_member_role,
          'agent'::organization_member_role
        )
    )
  END
$$;

REVOKE ALL ON FUNCTION public.can_create_booking_for_organization(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_create_booking_for_organization(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.can_create_booking_for_organization(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_create_booking_for_organization(uuid, uuid) TO service_role;

-- Trigger BEFORE INSERT: la reserva nueva siempre nace con organización.
CREATE OR REPLACE FUNCTION public.tg_booking_require_organization()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_resolution jsonb;
  v_org uuid;
BEGIN
  -- Procesos administrativos controlados / migraciones / service_role
  IF v_uid IS NULL OR current_setting('role', true) = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF NEW.organization_id IS NOT NULL THEN
    IF NOT public.can_create_booking_for_organization(v_uid, NEW.organization_id) THEN
      RAISE EXCEPTION 'Booking requires a valid organization'
        USING HINT = 'not_allowed_for_organization';
    END IF;
    RETURN NEW;
  END IF;

  v_resolution := public.resolve_booking_organization(
    COALESCE(NEW.user_id, v_uid),
    NEW.assigned_agent_id,
    NULL
  );
  v_org := NULLIF(v_resolution->>'organization_id', '')::uuid;

  IF v_org IS NULL OR (v_resolution->>'error') IS NOT NULL THEN
    RAISE EXCEPTION 'Booking requires a valid organization'
      USING HINT = COALESCE(v_resolution->>'error', 'no_organization_found');
  END IF;

  IF NOT public.can_create_booking_for_organization(v_uid, v_org) THEN
    RAISE EXCEPTION 'Booking requires a valid organization'
      USING HINT = 'not_allowed_for_organization';
  END IF;

  NEW.organization_id := v_org;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bookings_require_organization ON public.bookings;
CREATE TRIGGER bookings_require_organization
BEFORE INSERT ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.tg_booking_require_organization();